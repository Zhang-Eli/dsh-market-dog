/**
 * Keyword extraction and catalog relevance scoring for Market Dog.
 *
 * Pure functions only: the Host half (`index.js`) owns the HTTP route and the
 * catalog fetch, this module owns the part that makes the market searchable by
 * a plain-language description.
 *
 * The catalog is the public awesome-dsh-plugin list: every entry has an English
 * name, a Chinese and an English description, one or more category ids, npm
 * downloads (30-day window, `null` for github-only plugins), stars and an
 * install command. Descriptions are the only place that says what an English
 * plugin name actually does, so they carry the most weight in the score.
 */

/** Category ids shipped by the catalog (kept here only for the UI's filter). */
export const CATEGORY_IDS = [
  'agi', 'ui', 'usage', 'theme', 'model', 'identity', 'session', 'memory',
  'tools', 'wsl', 'browser', 'vision', 'voice', 'docs', 'skill', 'workflow',
  'git', 'notify', 'dev', 'security', 'remote', 'market', 'fun',
]

/**
 * Words that appear in almost every catalog description. Matching them would
 * return the whole catalog, so they never become keywords.
 */
const STOPWORDS = new Set([
  'a', 'about', 'add', 'adds', 'adding', 'agent', 'all', 'also', 'an', 'and',
  'any', 'app', 'apps', 'are', 'as', 'at', 'auto', 'automatically', 'be',
  'because', 'better', 'by', 'can', 'cordis', 'deepseek', 'different', 'do',
  'does', 'dsh', 'each', 'easy', 'etc', 'every', 'feature', 'features', 'for',
  'display', 'displays', 'show', 'shows', 'shown', 'allow', 'allows', 'let',
  'lets', 'based', 'option', 'options', 'include', 'includes', 'including',
  'from', 'function', 'functionality', 'get', 'give', 'gives', 'harness', 'has',
  'have', 'help', 'helps', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'just', 'like', 'make', 'makes', 'many', 'me', 'more', 'most', 'my', 'need',
  'needs', 'new', 'no', 'not', 'of', 'on', 'one', 'only', 'or', 'other', 'our',
  'out', 'over', 'per', 'plugin', 'plugins', 'please', 'quick', 'same', 'set',
  'should', 'simple', 'so', 'some', 'something', 'specific', 'such', 'support',
  'supports', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'thing', 'things', 'this', 'those', 'through', 'to', 'tool', 'tools',
  'under', 'up', 'use', 'used', 'useful', 'using', 'very', 'want', 'was', 'way',
  'we', 'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with',
  'without', 'work', 'works', 'would', 'you', 'your',
  // Chinese filler that carries no plugin signal.
  '一个', '一下', '一些', '一种', '以及', '但是', '使用', '可以', '可能', '各种',
  '功能', '需要', '想要', '希望', '支持', '提供', '这个', '那个', '这种', '那种',
  '什么', '怎么', '如何', '自动', '方便', '简单', '进行', '并且', '或者', '还有',
  '就是', '主要', '用来', '用于', '我们', '我的', '你的', '帮我', '给我', '插件',
])

/**
 * Domain markers for polysemous intents. "发布" is a release for a plugin
 * author (npm, 发版) and a post for a content operator (抖音, 公众号). A
 * keyword carrying "domains" only scores at full strength when both sides
 * agree on the domain (or one side stays silent); an active disagreement
 * cuts it to a fraction. Generic words like 插件/plugin are deliberately NOT
 * markers: they appear in nearly every description and prove nothing.
 */
const DOMAIN_MARKERS = {
  dev: ['插件发布', '发布插件', '发版', '发包', '发布流程', '发布链路', '发布门禁', '版本号',
    '语义化版本', 'npm', 'pnpm', 'tarball', 'pre-publish',
    'changelog', '脚手架', 'scaffold'],
  social: ['抖音', 'douyin', 'tiktok', '快手', 'kuaishou', '小红书', 'xiaohongshu', 'rednote',
    '公众号', '微信', 'wechat', 'weixin', '视频号', '微博', 'weibo', 'b站', 'bilibili', '哔哩',
    '短视频', 'youtube', 'instagram', 'facebook', 'twitter', 'postiz', '社交', '自媒体',
    '博客', 'blog', '涨粉', '粉丝', '点赞', '运营'],
}

/** 'dev' or 'social' when the text names exactly one domain, else null. */
function classifyDomain(text) {
  const dev = DOMAIN_MARKERS.dev.some((marker) => text.includes(marker))
  const social = DOMAIN_MARKERS.social.some((marker) => text.includes(marker))
  if (dev && !social) return 'dev'
  if (social && !dev) return 'social'
  return null
}

/**
 * Concept dictionary: one entry per user intent, with the English and Chinese
 * surface forms that describe it and the catalog category ids it maps onto.
 * Category hits only add a modest boost; description hits dominate.
 */
const CONCEPTS = [
  { id: 'theme', cats: ['theme', 'ui'],
    en: ['theme', 'themes', 'appearance', 'skin', 'skins', 'palette', 'color palette',
      'accent color', 'color scheme', 'colors', 'dark mode', 'light mode', 'dark theme',
      'light theme', 'styling', 'style', 'theming'],
    zh: ['主题', '皮肤', '外观', '配色', '配色方案', '颜色', '主题色', '暗色', '深色',
      '浅色', '亮色', '暗色主题', '亮色主题', '风格', '样式'] },
  { id: 'ui', cats: ['ui'],
    en: ['ui', 'interface', 'layout', 'layouts', 'widget', 'widgets', 'decoration',
      'beautify', 'beautification', 'visual', 'visuals', 'enhancement', 'enhancements',
      'enhance', 'polish', 'ux', 'accessibility', 'a11y', 'responsive', 'compact mode',
      'masonry', 'grid', 'card', 'cards'],
    zh: ['界面', '布局', '组件', '美化', '装饰', '窗口', '视觉', '增强', '体验', '交互',
      '无障碍', '自适应', '紧凑', '紧凑模式'] },
  { id: 'sidebar', cats: ['ui'],
    en: ['sidebar', 'side bar', 'navigation', 'navigator', 'rail', 'panel'],
    zh: ['侧边栏', '侧栏', '侧边', '导航', '面板'] },
  { id: 'search', cats: ['ui', 'tools', 'market'],
    en: ['search', 'find', 'filter', 'query', 'lookup', 'discover', 'fuzzy',
      'fuzzy search', 'semantic search', 'ranking', 'index'],
    zh: ['搜索', '查找', '检索', '筛选', '过滤', '发现', '匹配', '语义搜索', '排序'] },
  { id: 'translate', cats: ['tools', 'docs'],
    en: ['translate', 'translation', 'translator', 'bilingual', 'i18n', 'localization',
      'localize'],
    zh: ['翻译', '中英', '双语', '本地化', '多语言', '英译', '汉化'] },
  { id: 'screenshot', cats: ['vision', 'ui'],
    en: ['screenshot', 'capture', 'snapshot', 'screen recording'],
    zh: ['截图', '截屏', '抓图', '屏幕录制'] },
  { id: 'chart', cats: ['ui', 'docs', 'tools'],
    en: ['chart', 'graph', 'plot', 'visualization', 'visualisation', 'dashboard',
      'diagram', 'sparkline'],
    zh: ['图表', '图形', '可视化', '仪表盘', '统计图', '曲线', '柱状图'] },
  { id: 'calendar', cats: ['tools', 'workflow'],
    en: ['calendar', 'schedule', 'agenda', 'planner', 'time blocking'],
    zh: ['日历', '日程', '排期', '计划表', '时间管理'] },
  { id: 'todo', cats: ['tools', 'workflow'],
    en: ['todo', 'to-do', 'task', 'tasks', 'checklist', 'kanban', 'eisenhower',
      'quadrant', 'project management'],
    zh: ['待办', '任务', '清单', '四象限', '看板', '项目'] },
  { id: 'note', cats: ['tools', 'docs', 'memory'],
    en: ['note', 'notes', 'notebook', 'markdown', 'wiki', 'journal', 'memo',
      'knowledge base'],
    zh: ['笔记', '文档', '记录', '日记', '备忘', '知识库'] },
  { id: 'memory', cats: ['memory', 'agi'],
    en: ['memory', 'memories', 'remember', 'recall', 'embedding', 'embeddings', 'rag',
      'long-term memory', 'knowledge graph', 'knowledge graphs', 'persistent memory',
      'vector store', 'semantic memory'],
    zh: ['记忆', '回忆', '向量', '长期记忆', '检索增强', '知识图谱', '持久记忆',
      '语义记忆', '记忆库'] },
  { id: 'chat', cats: ['session', 'ui'],
    en: ['chat', 'conversation', 'message', 'dialogue', 'transcript', 'thread'],
    zh: ['聊天', '对话', '会话', '消息', '聊天记录'] },
  { id: 'session', cats: ['session', 'ui'],
    en: ['session', 'sessions', 'session history', 'conversation history', 'history',
      'rewind', 'checkpoint', 'checkpoints', 'fork', 'branching', 'archive',
      'export conversation', 'session manager'],
    zh: ['会话管理', '会话历史', '历史记录', '回滚', '检查点', '分支', '归档',
      '会话导出', '会话列表', '会话归档'] },
  { id: 'summary', cats: ['session', 'usage', 'memory', 'docs'],
    en: ['summarize', 'summarise', 'summary', 'summaries', 'digest', 'recap', 'tldr',
      'brief', 'briefing'],
    zh: ['总结', '摘要', '概括', '归纳', '提炼', '综述', '纪要', '要点'] },
  { id: 'compact', cats: ['session', 'memory', 'usage'],
    en: ['compress', 'compression', 'condense', 'compact', 'compaction', 'collapse',
      'fold', 'shorten', 'prune', 'pruning'],
    zh: ['压缩', '精简', '折叠', '裁剪', '精简上下文', '压缩上下文'] },
  { id: 'context', cats: ['session', 'memory', 'usage'],
    en: ['context', 'contexts', 'context window', 'context limit', 'context length',
      'context compression', 'compress context', 'compressed context', 'context pruning',
      'prune context', 'active context pruning', 'token', 'tokens', 'token usage',
      'token consumption', 'save tokens', 'less tokens'],
    zh: ['上下文', '上下文窗口', '上下文压缩', '压缩上下文', '上下文长度', '上下文溢出',
      '裁剪上下文', '上下文管理', '省token', '节省token', '省 token', '节省 token',
      'token消耗', 'token 消耗', '减少token', '省token消耗', '节省我的token'] },
  { id: 'model', cats: ['model', 'usage'],
    en: ['model', 'models', 'provider', 'providers', 'llm', 'llms', 'api key',
      'api keys', 'openai', 'anthropic', 'gemini', 'ollama', 'billing', 'quota',
      'account', 'accounts', 'oauth', 'base url', 'endpoint', 'endpoints', 'gateway',
      'proxy', 'api endpoint', 'provider config'],
    zh: ['模型', '供应商', '接口', '密钥', '令牌', '用量', '计费', '额度', '接入',
      '模型接入', '账号接入', '供应商接入', '网关', '接口地址', '代理', '账号管理',
      '配置模型'] },
  { id: 'usage', cats: ['usage', 'model'],
    en: ['usage', 'cost', 'costs', 'spend', 'spending', 'token count', 'statistics',
      'stats', 'analytics', 'rate limit', 'rate limits', 'budget', 'meter', 'metering'],
    zh: ['用量', '花费', '成本', '统计', '用量统计', '限流', '预算', '计量', '费用',
      '消耗统计'] },
  { id: 'prompt', cats: ['tools', 'session', 'agi'],
    en: ['prompt', 'prompts', 'system prompt', 'template', 'preset', 'persona',
      'instruction'],
    zh: ['提示词', '系统提示', '模板', '预设', '人设', '指令'] },
  { id: 'skill', cats: ['skill', 'tools'],
    en: ['skill', 'skills', 'manifest', 'skill pack', 'skill packs', 'skillset',
      'skill marketplace', 'skill library'],
    zh: ['技能', '技能包', '技能市场', '技能库', '技能集'] },
  { id: 'agent', cats: ['agi', 'tools'],
    en: ['agent', 'agents', 'subagent', 'multi-agent', 'orchestration', 'autonomous',
      'swarm'],
    zh: ['智能体', '子代理', '多智能体', '编排', '自主'] },
  { id: 'agi', cats: ['agi'],
    en: ['agi', 'architecture', 'architectural', 'reasoning', 'planning',
      'planning mode', 'self-improving', 'autonomy', 'emergent behavior', 'cognitive'],
    zh: ['架构', '架构探索', '推理', '规划', '自主决策', '自进化', '涌现', '认知'] },
  { id: 'workflow', cats: ['workflow', 'tools'],
    en: ['workflow', 'workflows', 'automation', 'automate', 'automations', 'pipeline',
      'cron', 'trigger', 'triggers', 'script', 'scripts', 'rule', 'rules',
      'automation rule', 'scheduler', 'scheduling', 'task automation'],
    zh: ['工作流', '自动化', '自动化流程', '流程', '定时', '定时任务', '调度', '触发',
      '脚本', '规则', '联动'] },
  { id: 'terminal', cats: ['tools', 'dev'],
    en: ['terminal', 'shell', 'bash', 'command', 'commands', 'console', 'cli',
      'powershell'],
    zh: ['终端', '命令行', '控制台', '脚本执行'] },
  { id: 'file', cats: ['tools', 'dev'],
    en: ['file', 'files', 'folder', 'folders', 'directory', 'explorer', 'file tree',
      'path'],
    zh: ['文件', '文件夹', '目录', '资源管理器', '路径'] },
  { id: 'image', cats: ['vision'],
    en: ['image', 'images', 'picture', 'pictures', 'photo', 'photos', 'gallery',
      'ocr', 'recognize', 'multimodal', 'vlm', 'image generation',
      'image understanding', 'vision model'],
    zh: ['图片', '图像', '照片', '相册', '识别', '视觉模型', '多模态', '图像生成',
      '图像理解', '视觉理解'] },
  { id: 'ocr', cats: ['vision', 'tools'],
    en: ['ocr', 'text recognition', 'recognize text', 'recognise text', 'extract text',
      'read text', 'read the text', 'text from image', 'text from images'],
    zh: ['识别文字', '文字识别', '提取文字', '读取文字', '截图文字', '扫描文字',
      '识别图片文字'] },
  { id: 'media', cats: ['vision', 'voice'],
    en: ['video', 'videos', 'movie', 'subtitle', 'subtitles', 'audio', 'music',
      'sound', 'player', 'gallery'],
    zh: ['视频', '电影', '字幕', '音频', '音乐', '声音', '播放器'] },
  { id: 'speech', cats: ['voice'],
    en: ['voice', 'speech', 'tts', 'asr', 'speech recognition', 'speech synthesis',
      'speech-to-text', 'transcribe', 'transcription', 'whisper', 'read aloud',
      'microphone', 'audio transcription'],
    zh: ['语音', '朗读', '配音', '语音识别', '麦克风', '录音', '转录', '语音合成',
      '语音转文字'] },
  { id: 'download', cats: ['tools', 'usage'],
    en: ['download', 'downloads', 'fetch', 'crawler', 'scrape', 'scraper', 'mirror'],
    zh: ['下载', '爬取', '抓取', '采集', '镜像'] },
  { id: 'sync', cats: ['tools', 'notify'],
    en: ['sync', 'backup', 'restore', 'export', 'import', 'migrate', 'migration',
      'snapshot', 'cloud'],
    zh: ['同步', '备份', '恢复', '导出', '导入', '迁移', '云端'] },
  { id: 'github', cats: ['git', 'dev'],
    en: ['github', 'git', 'repo', 'repos', 'repository', 'repositories', 'pull request',
      'pull requests', 'pr', 'prs', 'issue', 'issues', 'commit', 'commits',
      'code review', 'review', 'reviews', 'diff', 'branch', 'merge request',
      'merge requests', 'changes'],
    zh: ['仓库', '代码评审', '代码审查', '评审', '提交', '差异', '拉取请求',
      '合并请求', '分支'] },
  { id: 'notify', cats: ['notify'],
    en: ['notify', 'notification', 'notifications', 'alert', 'alerts', 'reminder',
      'email', 'mail', 'push', 'webhook', 'webhooks', 'integration', 'integrations',
      'channel', 'channels', 'telegram', 'discord', 'slack', 'feishu', 'lark',
      'dingtalk', 'wecom', 'serverchan', 'bark', 'sms'],
    zh: ['通知', '提醒', '告警', '邮件', '推送', '集成', '集成通知', '频道', '飞书',
      '钉钉', '企业微信', '微信', '短信', '推送渠道'] },
  { id: 'browser', cats: ['browser'],
    en: ['browser', 'webpage', 'web page', 'url', 'html', 'crawl', 'chrome',
      'reader mode', 'web clipper', 'clipper', 'bookmark', 'bookmarks', 'tab', 'tabs',
      'dom', 'page reader'],
    zh: ['浏览器', '网页', '链接', '阅读模式', '抓取网页', '剪藏', '书签', '标签页',
      '网页剪藏', '页面读取'] },
  { id: 'security', cats: ['security'],
    en: ['security', 'permission', 'permissions', 'approval', 'approvals', 'policy',
      'policies', 'auth', 'login', 'password', 'secret', 'secrets',
      'secret management', 'credential', 'credentials', 'sandbox', 'audit'],
    zh: ['安全', '权限', '权限管理', '审批', '策略', '登录', '密码', '沙箱', '审计',
      '凭证', '密钥管理'] },
  { id: 'remote', cats: ['remote'],
    en: ['remote', 'mobile', 'phone', 'tunnel', 'qr code', 'qrcode', 'remote access',
      'pairing', 'lan', 'local network', 'mobile access'],
    zh: ['远程', '手机', '移动端', '隧道', '二维码', '配对', '局域网', '手机访问',
      '手机端访问'] },
  { id: 'market', cats: ['market'],
    en: ['market', 'markets', 'marketplace', 'plugin store', 'catalog', 'registry',
      'category', 'categories', 'categorized', 'browse', 'browsing',
      'install', 'installs', 'uninstall', 'update', 'updates', 'manager', 'managers',
      'plugin manager', 'publisher', 'publishers', 'rating', 'ratings', 'favorite',
      'favorites'],
    zh: ['市场', '插件市场', '插件商店', '目录', '注册表', '安装', '更新', '管理器',
      '插件管理', '插件管理器', '插件分类', '分类', '分类浏览', '分类筛选',
      '发布者', '评分', '收藏', '卸载', '更新插件'] },
  { id: 'office', cats: ['docs', 'vision'],
    en: ['pdf', 'docx', 'word', 'excel', 'spreadsheet', 'spreadsheets', 'slide',
      'slides', 'powerpoint', 'convert', 'conversion', 'office'],
    zh: ['文档', '表格', '幻灯片', '转换', '办公'] },
  { id: 'render', cats: ['docs', 'ui'],
    en: ['render', 'renders', 'rendering', 'markdown render', 'markdown preview',
      'latex', 'math', 'math formula', 'formula', 'mermaid', 'diagram', 'diagrams',
      'preview', 'pdf export', 'syntax render', 'typography render'],
    zh: ['渲染', '渲染器', '数学公式', '公式', '流程图', '图表渲染', '预览', '导出',
      '排版渲染'] },
  { id: 'code', cats: ['dev', 'git'],
    en: ['code', 'syntax', 'highlight', 'highlighting', 'editor', 'refactor',
      'lint', 'linter', 'test', 'tests', 'testing'],
    zh: ['代码', '高亮', '编辑器', '重构', '测试'] },
  { id: 'runtime', cats: ['dev', 'tools'],
    en: ['runtime', 'devtools', 'hot reload', 'hmr', 'build', 'bundle', 'bundler',
      'vite', 'esbuild', 'debug', 'debugging', 'logs', 'logging', 'profiler',
      'performance', 'startup'],
    zh: ['运行时', '构建', '打包', '热更新', '调试', '日志', '性能分析', '启动加速',
      '性能'] },
  { id: 'publish', cats: ['dev', 'market'], domains: ['dev', 'social'],
    en: ['publish', 'publishing', 'release', 'releases', 'releasing', 'ship',
      'shipping', 'deploy', 'deployment', 'npm publish', 'publish gate', 'pre-publish',
      'release flow', 'release pipeline', 'version bump', 'tarball'],
    zh: ['发布', '发版', '发包', '上线', '上架', '发布流程', '插件发布', '发布插件',
      '发布链路', '发布门禁', '发布前检查', '版本号'] },
  { id: 'authoring', cats: ['dev', 'docs', 'skill'],
    en: ['authoring', 'scaffold', 'scaffolding', 'boilerplate', 'plugin development',
      'plugin developer', 'plugin author', 'develop a plugin', 'build a plugin',
      'create a plugin', 'write a plugin', 'dev flow', 'development flow'],
    zh: ['开发', '插件开发', '开发插件', '写插件', '制作插件', '插件作者', '开发流程',
      '脚手架', '模板'] },
  { id: 'toolkit', cats: ['tools'],
    en: ['toolbox', 'toolkit', 'toolkits', 'capability', 'capabilities',
      'capability pack', 'mcp server', 'mcp servers', 'extension', 'extensions'],
    zh: ['工具箱', '工具集', '能力', '能力包', '扩展', '扩展包', '工具链'] },
  { id: 'wsl', cats: ['wsl'],
    en: ['wsl', 'windows', 'interop', 'registry', 'windows subsystem',
      'windows subsystem for linux', 'wsl2', 'windows interop', 'registry editor'],
    zh: ['子系统', '互操作', '注册表', '视窗', 'windows子系统', '子系统互操作',
      '注册表编辑器', '视窗互操作'] },
  { id: 'identity', cats: ['identity', 'notify'],
    en: ['identity', 'account', 'profile', 'avatar', 'nickname', 'contact',
      'contact card', 'communication', 'messaging', 'social', 'signature'],
    zh: ['身份', '账号', '资料', '头像', '昵称', '通信', '通讯', '社交', '联系人',
      '名片', '签名'] },
  { id: 'fun', cats: ['fun'],
    en: ['game', 'games', 'fun', 'toy', 'toys', 'easter egg', 'easter eggs', 'pet',
      'pets', 'animation', 'animations', 'mini game', 'pixel', 'retro'],
    zh: ['游戏', '小游戏', '娱乐', '玩具', '彩蛋', '宠物', '动画', '动效', '像素',
      '复古'] },
  { id: 'feed', cats: ['browser', 'notify'],
    en: ['rss', 'feed', 'feeds', 'subscribe', 'subscription', 'news', 'trending',
      'hot list'],
    zh: ['订阅', '新闻', '热门', '趋势', '资讯', '阅读器'] },
  { id: 'drag', cats: ['ui'],
    en: ['drag', 'drop', 'drag and drop', 'reorder', 'sortable', 'dnd'],
    zh: ['拖拽', '拖动', '排序', '拖放'] },
  { id: 'shortcut', cats: ['ui', 'tools'],
    en: ['shortcut', 'shortcuts', 'hotkey', 'hotkeys', 'keyboard', 'command palette'],
    zh: ['快捷键', '热键', '键盘', '命令面板'] },
  { id: 'icon', cats: ['ui', 'theme'],
    en: ['icon', 'icons', 'logo', 'logos', 'svg', 'badge', 'badges'],
    zh: ['图标', '徽标', '标志'] },
  { id: 'font', cats: ['theme', 'ui'],
    en: ['font', 'fonts', 'typography', 'zoom', 'text size'],
    zh: ['字体', '排版', '字号', '缩放'] },
  { id: 'statusbar', cats: ['ui'],
    en: ['status bar', 'footer', 'toolbar', 'header'],
    zh: ['状态栏', '页脚', '头部', '工具栏'] },
  { id: 'habit', cats: ['tools', 'workflow'],
    en: ['habit', 'habits', 'streak', 'tracker', 'pomodoro', 'timer', 'focus'],
    zh: ['习惯', '打卡', '连续', '番茄钟', '计时', '专注'] },
  { id: 'finance', cats: ['fun', 'tools'],
    en: ['weather', 'forecast', 'stock', 'stocks', 'finance', 'crypto', 'price',
      'prices'],
    zh: ['天气', '预报', '股票', '行情', '金融', '加密货币', '价格'] },
  { id: 'mcp', cats: ['tools', 'dev'],
    en: ['mcp', 'model context protocol', 'tool server', 'tool servers'],
    zh: ['协议', '工具服务器', 'mcp服务'] },
]

const MAX_KEYWORDS = 24
const MAX_MATCHED_TERMS = 4
/** How many top relevance hits are considered when ordering by downloads. */
const DOWNLOAD_POOL = 120
const NAME_SPLIT = /[^a-z0-9]+/u
/** Tolerated trailing inflection of one English search term ("themes", "themed"). */
const SUFFIX_SOURCE = '(?:s|es|ing|ed)?'

/** Lowercase and collapse whitespace; keeps CJK intact. */
function normalize(value) {
  return String(value === undefined || value === null ? '' : value)
    .toLowerCase()
    .replace(/[\u3000\s]+/gu, ' ')
    .trim()
}

/** Escape one literal term for use inside a RegExp alternation. */
function escapeRegExp(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/** Count substring occurrences, capped by the caller. */
function countSubstring(haystack, needle) {
  if (needle === '' || haystack === '') return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

/** English terms match at word edges and tolerate a trailing plural/verb suffix. */
function englishMatcher(terms) {
  // Longest alternatives first: "npm publish" must win over "publish",
  // otherwise the rarer compound never counts as itself.
  const sorted = terms.filter((term) => term !== '').slice().sort((a, b) => b.length - a.length)
  const parts = sorted.map((term) => `${escapeRegExp(term)}${SUFFIX_SOURCE}`)
  if (parts.length === 0) return null
  return new RegExp(`(?<![a-z0-9])(?:${parts.join('|')})(?![a-z0-9])`, 'gu')
}

/** Chinese terms match as plain substrings (no word boundaries in CJK). */
function chineseMatcher(terms) {
  // Longest dictionary term first, so "插件发布" is not shadowed by "发布".
  const parts = terms.filter((term) => term !== '').slice()
    .sort((a, b) => b.length - a.length).map(escapeRegExp)
  if (parts.length === 0) return null
  return new RegExp(`(?:${parts.join('|')})`, 'gu')
}

/** Latin tokens of the description, used for words no concept covers. */
function latinTokens(text) {
  const found = String(text).match(/[a-z][a-z0-9+.#_-]*/gu) ?? []
  const tokens = []
  for (const raw of found) {
    const token = raw.replace(/^[-.]+|[-.]+$/gu, '')
    if (token.length < 3) continue
    if (STOPWORDS.has(token)) continue
    if (/^\d+$/u.test(token)) continue
    if (!tokens.includes(token)) tokens.push(token)
  }
  return tokens
}

/** Display label of one keyword in the requested language. */
function labelOf(id, en, zh, lang) {
  if (lang === 'zh') return zh[0] ?? en[0] ?? id
  return en[0] ?? zh[0] ?? id
}

/**
 * Extract the keyword set for a description.
 *
 * Concepts are matched against the whole raw description (both languages of the
 * user text usually; Chinese users sometimes mix in English). Every matched
 * concept becomes one keyword carrying both its English and Chinese search
 * terms, so a Chinese request can match an English plugin name or description.
 * Leftover English tokens become weaker custom keywords.
 */
export function buildKeywordSet(description, options = {}) {
  const lang = options.lang === 'zh' ? 'zh' : 'en'
  const text = normalize(description)
  if (text === '') return []
  const keywords = []
  const consumed = new Set()
  const queryDomain = classifyDomain(text)

  for (const concept of CONCEPTS) {
    let hits = 0
    for (const term of concept.zh) {
      if (term === '' || STOPWORDS.has(term)) continue
      hits += countSubstring(text, term)
    }
    for (const term of concept.en) {
      if (term === '' || STOPWORDS.has(term)) continue
      const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?:s|es|ing|ed)?(?![a-z0-9])`, 'gu')
      hits += (text.match(re) ?? []).length
    }
    if (hits === 0) continue
    for (const term of concept.zh) consumed.add(term)
    for (const term of concept.en) consumed.add(term)
    keywords.push({
      id: concept.id,
      cats: concept.cats,
      en: concept.en.slice(),
      zh: concept.zh.slice(),
      label: labelOf(concept.id, concept.en, concept.zh, lang),
      weight: hits > 2 ? 1.2 : 1,
      enRegex: englishMatcher(concept.en),
      zhRegex: chineseMatcher(concept.zh),
      domains: concept.domains ?? null,
      queryDomain: concept.domains ? queryDomain : null,
    })
    if (keywords.length >= MAX_KEYWORDS) break
  }

  for (const token of latinTokens(text)) {
    if (keywords.length >= MAX_KEYWORDS) break
    if (consumed.has(token)) continue
    let covered = false
    for (const term of consumed) {
      if (term.length >= 3 && token.startsWith(term)) { covered = true; break }
    }
    if (covered) continue
    keywords.push({
      id: `custom:${token}`,
      cats: [],
      en: [token],
      zh: [],
      label: token,
      weight: 0.8,
      enRegex: englishMatcher([token]),
      zhRegex: null,
    })
  }

  return keywords
}

const DAY_MS = 24 * 60 * 60 * 1000

const RAW_LATIN_MIN = 3
const MAX_RAW_TERMS = 12

/**
 * Literal terms the user actually typed, independent of the concept dictionary.
 *
 * Concepts answer "what did they mean"; this answers "did they type a word that
 * appears in the plugin's own name or description". Without it, `trending` is
 * reduced to the 订阅 concept and a plugin whose name contains the literal word
 * ranks no higher than any other subscription plugin.
 */
function buildRawKeywords(description) {
  const text = normalize(description)
  const terms = []
  const seen = new Set()
  const add = (raw, lang) => {
    const term = raw.trim()
    if (term.length < 2 || seen.has(term)) return
    if (STOPWORDS.has(term)) return
    if (lang === 'en' && term.length < RAW_LATIN_MIN) return
    seen.add(term)
    terms.push({
      id: `raw:${term}`,
      label: term,
      en: lang === 'en' ? [term] : [],
      zh: lang === 'zh' ? [term] : [],
      raw: true,
      weight: 1,
      enRegex: null,
      zhRegex: null,
    })
  }
  for (const token of text.match(/[a-z][a-z0-9+.#_-]*/gu) ?? []) {
    add(token.replace(/^[-.]+|[-.]+$/gu, ''), 'en')
  }
  for (const run of text.match(/[\u4e00-\u9fff]{2,}/gu) ?? []) {
    // Bigrams catch "发布"; 4-grams catch the compounds that actually
    // disambiguate it ("插件发布", "发布流程"). Odd 3-grams split words at
    // wrong edges ("布流") and never match real text, so they are skipped.
    for (const size of [4, 2]) {
      for (let index = 0; index + size <= run.length; index += 1) add(run.slice(index, index + size), 'zh')
    }
  }
  terms.sort((a, b) => b.label.length - a.label.length)
  return terms.slice(0, MAX_RAW_TERMS)
}

/** Exact-text evidence for one literal term (name hits dominate description hits). */
function scoreRaw(facts, keyword, idfMult) {
  const term = keyword.en[0] ?? keyword.zh[0] ?? ''
  if (term === '') return null
  const mult = idfMult.get(term) ?? 1
  // Longer literal matches are stronger evidence: "插件发布" outranks "发布"
  // even before the frequency weighting below dampens the ubiquitous one.
  const extra = 1 + 0.9 * Math.max(0, term.length - 2)
  const terms = []
  let score = 0
  if (facts.name.includes(term)) {
    score += 14 * extra
    terms.push(term)
  }
  if (facts.enText.includes(term) || facts.zhText.includes(term)) {
    score += 5 * extra
    if (terms.length === 0) terms.push(term)
  }
  if (score === 0) return null
  return { score: score * mult, terms }
}
/** Rail capabilities, in the order the filter should present them. */
export const CAPABILITY_IDS = [
  'fs-read', 'fs-write', 'shell', 'network', 'env', 'credentials', 'llm', 'subagent',
  'dynamic-code', 'host-runtime',
]
const UPDATED_WINDOWS = [7, 30, 90]
const STAR_THRESHOLDS = [10, 100, 1000]

/** Catalog `added` is a plain date; compare in whole days. */
function addedTimeOf(plugin) {
  const raw = typeof plugin.added === 'string' ? plugin.added : ''
  if (raw.length !== 10 || raw.charAt(4) !== '-' || raw.charAt(7) !== '-') return 0
  const ms = Date.parse(`${raw}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : 0
}

/** Fields every score reads, computed once per catalog entry (catalog is stable). */
const factsCache = new WeakMap()

function factsOf(plugin) {
  const cached = factsCache.get(plugin)
  if (cached !== undefined) return cached
  const description = plugin.description !== null && typeof plugin.description === 'object' ? plugin.description : {}
  const zhText = normalize(description.zh)
  const enText = normalize(description.en)
  const name = normalize(plugin.name)
  const categories = Array.isArray(plugin.category) ? plugin.category.slice() : (plugin.category ? [plugin.category] : [])
  const facts = {
    name,
    nameTokens: name.split(NAME_SPLIT).filter((token) => token !== ''),
    zhText,
    enText,
    textAll: `${enText} ${zhText} ${name}`,
    domain: classifyDomain(enText + ' ' + zhText + ' ' + name),
    categories,
    descLength: zhText.length + enText.length,
    stars: typeof plugin.stars === 'number' ? plugin.stars : 0,
    capabilities: Array.isArray(plugin.capabilities)
      ? plugin.capabilities.filter((id) => typeof id === 'string' && id !== '')
      : [],
    addedMs: addedTimeOf(plugin),
  }
  factsCache.set(plugin, facts)
  return facts
}

/**
 * Inverse document frequency per search term, cached per catalog object.
 * df counts catalog entries whose combined text contains the term; the
 * multiplier maps rare terms to ~1.0 and ubiquitous ones (发布/publish hit
 * thousands of entries) down to ~0.35, so a generic verb match can no longer
 * sit at the table with a specific compound. Only the terms of the current
 * query are resolved, once per catalog, before scoring starts.
 */
const idfCache = new WeakMap()

function computeIdfMults(plugins, terms) {
  let map = idfCache.get(plugins)
  if (map === undefined) {
    map = new Map()
    idfCache.set(plugins, map)
  }
  const todo = []
  const queued = new Set()
  for (const term of terms) {
    if (typeof term !== 'string' || term.length < 2) continue
    if (map.has(term) || queued.has(term)) continue
    queued.add(term)
    todo.push(term)
  }
  if (todo.length === 0) return map
  const total = plugins.length || 1
  const denom = Math.log(1 + total / 2)
  for (const term of todo) {
    const cjk = /[\u4e00-\u9fff]/u.test(term)
    const phrase = term.includes(' ')
    const re = cjk || phrase
      ? null
      : new RegExp('(?<![a-z0-9])' + escapeRegExp(term) + '(?:s|es|ing|ed)?(?![a-z0-9])', 'u')
    let df = 0
    for (const plugin of plugins) {
      if (plugin === null || typeof plugin !== 'object') continue
      const text = factsOf(plugin).textAll
      if (re !== null ? re.test(text) : text.includes(term)) df += 1
    }
    const rarity = Math.min(1, Math.log(1 + total / (1 + df)) / denom)
    map.set(term, 0.35 + 0.65 * rarity)
  }
  return map
}

/** Whether an English search term hits the plugin name itself. */
function nameHit(facts, term) {
  if (term.length < 2) return false
  for (const token of facts.nameTokens) {
    if (token === term) return true
    if (term.length >= 4 && token.startsWith(term)) return true
    if (token.length >= 4 && term.startsWith(token)) return true
  }
  return false
}

/** Map a matched English surface form back to the dictionary term. */
function baseEnglishTerm(terms, match) {
  const lower = match.toLowerCase()
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    if (lower === term) return term
    if (lower.startsWith(term)) return term
  }
  return lower
}

/** Score one keyword against one entry. */
function scoreKeyword(facts, keyword, idfMult) {
  let score = 0
  const terms = []
  const mult = (term) => idfMult.get(term) ?? 1
  let categoryHit = false

  if (keyword.cats.length > 0) {
    for (const category of facts.categories) {
      if (keyword.cats.includes(category)) { categoryHit = true; break }
    }
    if (categoryHit) score += 3
  }

  if (keyword.enRegex !== null) {
    const matches = facts.textAll.match(keyword.enRegex) ?? []
    if (matches.length > 0) {
      const counts = new Map()
      for (const raw of matches) {
        const term = baseEnglishTerm(keyword.en, raw)
        if (!counts.has(term)) { counts.set(term, 0); terms.push(term) }
        counts.set(term, counts.get(term) + 1)
      }
      for (const [term, count] of counts) score += Math.min(3, count) * 2.2 * mult(term)
    }
    for (const term of keyword.en) {
      if (nameHit(facts, term)) {
        if (!terms.includes(term)) terms.push(term)
        score += 7
        break
      }
    }
  }

  if (keyword.zhRegex !== null) {
    const matches = facts.zhText.match(keyword.zhRegex) ?? []
    if (matches.length > 0) {
      const counts = new Map()
      for (const raw of matches) {
        if (!counts.has(raw)) { counts.set(raw, 0); terms.push(raw) }
        counts.set(raw, counts.get(raw) + 1)
      }
      for (const [term, count] of counts) score += Math.min(3, count) * 3.2 * mult(term)
    }
    for (const term of keyword.zh) {
      if (facts.name.includes(term)) {
        if (!terms.includes(term)) terms.push(term)
        score += 5
        break
      }
    }
  }

  if (score === 0) return null
  // A shared category alone is not evidence of intent: a music app does not
  // match database by sitting in ai. Drop the keyword unless something
  // beyond the category pointed at it.
  if (score - (categoryHit ? 3 : 0) <= 0) return null
  // Domain disagreement: 插件发布流程 against a douyin publisher — or the
  // reverse — keeps only a thin tail through the generic verb. Damp it and
  // refuse it coverage credit, so wrong-domain entries sink without lifting
  // the right-domain ones.
  const mismatch = Array.isArray(keyword.domains)
    && keyword.queryDomain !== null
    && facts.domain !== null
    && keyword.queryDomain !== facts.domain
  if (mismatch) score *= 0.3
  // The chip row shows at most MAX_MATCHED_TERMS words: rarest first, so an
  // incidental generic hit never crowds out the compound that justified it.
  terms.sort((a, b) => mult(a) - mult(b))
  return { score: score * keyword.weight, terms: terms.slice(0, MAX_MATCHED_TERMS), mismatch }
}

/** Category label in one language, falling back to the raw id. */
function categoryLabel(categories, id, lang) {
  const meta = categories !== null && typeof categories === 'object' ? categories[id] : undefined
  if (meta !== null && typeof meta === 'object') {
    const label = lang === 'zh' ? meta.zh : meta.en
    if (typeof label === 'string' && label !== '') return label
  }
  return id
}

/** Public, UI-facing shape of one catalog entry. */
function projectEntry(plugin, facts, score, matched, options) {
  const lang = options.lang === 'zh' ? 'zh' : 'en'
  const categories = options.categories ?? {}
  const description = plugin.description !== null && typeof plugin.description === 'object' ? plugin.description : {}
  const primary = facts.categories[0] ?? ''
  return {
    name: plugin.name ?? '',
    owner: plugin.owner ?? '',
    url: plugin.url ?? '',
    page: plugin.page ?? '',
    install: plugin.install ?? '',
    npm: plugin.npm ?? null,
    version: plugin.version ?? null,
    category: primary,
    categories: facts.categories,
    categoryLabel: primary === '' ? '' : categoryLabel(categories, primary, lang),
    description: {
      en: typeof description.en === 'string' ? description.en : '',
      zh: typeof description.zh === 'string' ? description.zh : '',
    },
    stars: typeof plugin.stars === 'number' ? plugin.stars : null,
    added: typeof plugin.added === 'string' ? plugin.added : '',
    capabilities: facts.capabilities.slice(),
    downloads: typeof plugin.downloads === 'number' ? plugin.downloads : null,
    githubReleaseDownloads: typeof plugin.githubReleaseDownloads === 'number' ? plugin.githubReleaseDownloads : null,
    icon: typeof plugin.icon === 'string' ? plugin.icon : null,
    screenshots: Array.isArray(plugin.screenshots)
      ? plugin.screenshots.filter((url) => typeof url === 'string' && /^https?:\/\//u.test(url)).slice(0, 6)
      : [],
    deprecated: plugin.deprecated === true,
    replacement: typeof plugin.replacement === 'string' ? plugin.replacement : null,
    score: Math.round(score * 100) / 100,
    matched,
  }
}

/** Popularity of one entry, used for every "by downloads" ordering. */
export function popularityOf(entry) {
  const downloads = typeof entry.downloads === 'number' ? entry.downloads : null
  const git = typeof entry.githubReleaseDownloads === 'number' ? entry.githubReleaseDownloads : null
  const stars = typeof entry.stars === 'number' ? entry.stars : 0
  return {
    // npm-published entries first: an absent npm package is a coverage gap, not a zero.
    tier: downloads !== null ? 0 : (git !== null ? 1 : 2),
    primary: downloads !== null ? downloads : (git !== null ? git : 0),
    stars,
  }
}

/** Compare two projected entries by downloads, then GitHub downloads, then stars. */
export function compareByDownloads(left, right) {
  const a = popularityOf(left)
  const b = popularityOf(right)
  if (a.tier !== b.tier) return a.tier - b.tier
  if (a.primary !== b.primary) return b.primary - a.primary
  if (a.stars !== b.stars) return b.stars - a.stars
  return (right.score ?? 0) - (left.score ?? 0)
}

/**
 * Mild adoption boost: between two plugins that match the description equally,
 * the one the community actually downloads should win. Deliberately sublinear
 * (max +40% from downloads, +12% from stars) so relevance still dominates.
 */
function adoptionOf(plugin) {
  const popularity = popularityOf(plugin)
  const downloads = Math.min(1, Math.log10(1 + popularity.primary) / 7)
  const stars = Math.min(1, Math.log10(1 + popularity.stars) / 4)
  return 1 + 0.4 * downloads + 0.12 * stars
}

/** Coerce the request's filter object into the narrow shape the rail sends. */
export function normalizeFilters(input, legacyCategory) {
  const source = input !== null && typeof input === 'object' ? input : {}
  const categories = []
  for (const id of Array.isArray(source.categories) ? source.categories : []) {
    if (typeof id === 'string' && id !== '' && !categories.includes(id)) categories.push(id)
  }
  const single = typeof source.category === 'string' && source.category !== '' ? source.category : legacyCategory
  if (typeof single === 'string' && single !== '' && !categories.includes(single)) categories.push(single)
  const capabilities = []
  for (const id of Array.isArray(source.capabilities) ? source.capabilities : []) {
    if (typeof id === 'string' && CAPABILITY_IDS.includes(id) && !capabilities.includes(id)) capabilities.push(id)
  }
  const updatedWithin = UPDATED_WINDOWS.includes(source.updatedWithin) ? source.updatedWithin : 0
  const starsMin = STAR_THRESHOLDS.includes(source.starsMin) ? source.starsMin : 0
  return {
    categories: categories.slice(0, 8),
    capabilities: capabilities.slice(0, 8),
    updatedWithin,
    starsMin,
  }
}

/** Whether one scored entry survives the rail filters. */
function matchesFilters(facts, filters, now) {
  if (filters.categories.length > 0) {
    let hit = false
    for (const id of filters.categories) {
      if (facts.categories.includes(id)) { hit = true; break }
    }
    if (!hit) return false
  }
  if (filters.capabilities.length > 0) {
    for (const id of filters.capabilities) {
      if (!facts.capabilities.includes(id)) return false
    }
  }
  if (filters.updatedWithin > 0) {
    if (facts.addedMs === 0) return false
    if (now - facts.addedMs > filters.updatedWithin * DAY_MS) return false
  }
  if (filters.starsMin > 0 && facts.stars < filters.starsMin) return false
  return true
}

/** Rail counts, computed over every text match before the filters narrow it. */
function buildFacets(scored, categoryMap, lang, now) {
  const categoryCounts = new Map()
  const capabilityCounts = new Map()
  const updated = Object.fromEntries(UPDATED_WINDOWS.map((days) => [days, 0]))
  const stars = Object.fromEntries(STAR_THRESHOLDS.map((floor) => [floor, 0]))
  for (const item of scored) {
    const facts = item.facts
    for (const id of facts.categories) categoryCounts.set(id, (categoryCounts.get(id) ?? 0) + 1)
    for (const id of facts.capabilities) {
      if (CAPABILITY_IDS.includes(id)) capabilityCounts.set(id, (capabilityCounts.get(id) ?? 0) + 1)
    }
    if (facts.addedMs > 0) {
      const age = now - facts.addedMs
      for (const days of UPDATED_WINDOWS) if (age <= days * DAY_MS) updated[days] += 1
    }
    for (const floor of STAR_THRESHOLDS) if (facts.stars >= floor) stars[floor] += 1
  }
  const categories = [...categoryCounts.entries()]
    .map(([id, count]) => ({ id, label: categoryLabel(categoryMap, id, lang), count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
  const capabilities = CAPABILITY_IDS
    .filter((id) => (capabilityCounts.get(id) ?? 0) > 0)
    .map((id) => ({ id, count: capabilityCounts.get(id) }))
  return {
    categories,
    capabilities,
    updated: UPDATED_WINDOWS.map((days) => ({ id: String(days), count: updated[days] })),
    stars: STAR_THRESHOLDS.map((floor) => ({ id: String(floor), count: stars[floor] })),
  }
}

/**
 * Score every catalog entry against a description and return the best matches.
 *
 * `options.sort` is 'relevance' (default) or 'downloads'. `options.filters` is
 * the faceted rail: `{ category, categories, capabilities, updatedWithin, starsMin }`.
 * Filters narrow the ranked set; `facets` always describes the unfiltered text
 * matches so the rail can show how many results each option would keep.
 *
 * Returns `{ keywords, entries, scanned, matched, totalMatched, sort, filters, facets }`.
 */
export function searchCatalog(plugins, description, options = {}) {
  const lang = options.lang === 'zh' ? 'zh' : 'en'
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? Math.min(200, options.limit) : 60
  const sort = options.sort === 'downloads' ? 'downloads' : 'relevance'
  const filters = normalizeFilters(options.filters, options.category)
  const keywords = buildKeywordSet(description, { lang })
  const rawKeywords = buildRawKeywords(description)
  const categories = options.categories ?? {}
  const resolved = { lang, categories }
  if (keywords.length === 0 && rawKeywords.length === 0) {
    if (options.browse !== true) {
      return {
        keywords: [],
        entries: [],
        scanned: plugins.length,
        matched: 0,
        totalMatched: 0,
        sort,
        filters,
        facets: {
          categories: [],
          capabilities: [],
          updated: [],
          stars: [],
        },
      }
    }
    // Browse mode (rail double-click): no query, so there is no relevance to
    // rank — list everything the filters keep, ordered by downloads outright
    // (no DOWNLOAD_POOL: the whole category is the candidate set here).
    // Rail facets describe the full catalog, since every entry "matches".
    const nowBrowse = Date.now()
    const browsed = []
    for (const plugin of plugins) {
      if (plugin === null || typeof plugin !== 'object') continue
      browsed.push({ plugin, facts: factsOf(plugin) })
    }
    const browseFacets = buildFacets(browsed, categories, lang, nowBrowse)
    const browseKept = browsed.filter((item) => matchesFilters(item.facts, filters, nowBrowse))
    const browseRanked = browseKept.slice().sort((left, right) => compareByDownloads(
      projectEntryDummy(left.plugin, left.facts, 0),
      projectEntryDummy(right.plugin, right.facts, 0),
    ))
    return {
      keywords: [],
      entries: browseRanked.slice(0, limit).map((item) => projectEntry(item.plugin, item.facts, 0, [], resolved)),
      scanned: plugins.length,
      matched: browseKept.length,
      totalMatched: browsed.length,
      sort,
      filters,
      facets: browseFacets,
    }
  }

  // One dictionary-frequency pass over the visible catalog powers the rarity
  // weights below; cached on the plugins array until the catalog refreshes.
  const dfTerms = []
  for (const keyword of keywords) dfTerms.push(...keyword.en, ...keyword.zh)
  for (const keyword of rawKeywords) dfTerms.push(keyword.en[0] ?? keyword.zh[0] ?? '')
  const idfMult = computeIdfMults(plugins, dfTerms)
  // Global domain gate: the per-keyword damp alone still lets a wrong-domain
  // entry leak into the top 5 through unrelated concepts (a WeChat publisher
  // matched 流程 as much as a dev tool did). When the query clearly asks for
  // one flavour of a polysemous activity and the entry clearly belongs to
  // the other, halve the final score too.
  const queryDomain = classifyDomain(normalize(description))

  const now = Date.now()
  const scored = []
  for (const plugin of plugins) {
    if (plugin === null || typeof plugin !== 'object') continue
    const facts = factsOf(plugin)
    let conceptRaw = 0
    let rawBoost = 0
    let conceptMatched = 0
    const matched = []
    for (const keyword of keywords) {
      const result = scoreKeyword(facts, keyword, idfMult)
      if (result === null) continue
      conceptRaw += result.score
      if (result.mismatch !== true) conceptMatched += 1
      matched.push({ id: keyword.id, label: keyword.label, terms: result.terms, score: Math.round(result.score * 100) / 100 })
    }
    for (const keyword of rawKeywords) {
      const result = scoreRaw(facts, keyword, idfMult)
      if (result === null) continue
      rawBoost += result.score
      matched.push({ id: keyword.id, label: keyword.label, terms: result.terms, score: Math.round(result.score * 100) / 100 })
    }
    if (conceptRaw === 0 && rawBoost === 0) continue
    const coverage = keywords.length > 0 ? conceptMatched / keywords.length : 1
    // Long, rich descriptions should not be punished into oblivion (the market's
    // best-documented plugins are often the most detailed ones), so this is a
    // gentle 2x-at-most dampening instead of the harsher curve used before.
    const lengthPenalty = 1 + Math.min(1, facts.descLength / 1600)
    const deprecatedPenalty = plugin.deprecated === true ? 0.8 : 1
    const score = ((conceptRaw * (0.55 + 0.45 * coverage) + rawBoost * 1.15) / lengthPenalty) * deprecatedPenalty * adoptionOf(plugin)
      * (queryDomain !== null && facts.domain !== null && facts.domain !== queryDomain ? 0.55 : 1)
    scored.push({ plugin, facts, score, matched })
  }

  const totalMatched = scored.length
  const facets = buildFacets(scored, categories, lang, now)
  const narrowed = scored.filter((item) => matchesFilters(item.facts, filters, now))

  let ranked = narrowed
  if (sort === 'downloads') {
    // "Sort by downloads" means the most downloaded among the entries that are
    // actually relevant, so popularity cannot drag an unrelated plugin to the
    // top: rank by relevance first, keep a generous pool, then order it by downloads.
    ranked = narrowed.slice()
      .sort((left, right) => right.score - left.score
        || compareByDownloads(projectEntryDummy(left.plugin, left.facts, left.score), projectEntryDummy(right.plugin, right.facts, right.score)))
      .slice(0, Math.max(limit, DOWNLOAD_POOL))
    ranked.sort((left, right) => compareByDownloads(
      projectEntryDummy(left.plugin, left.facts, left.score),
      projectEntryDummy(right.plugin, right.facts, right.score),
    ))
  } else {
    ranked = narrowed.slice().sort((left, right) => right.score - left.score
      || compareByDownloads(projectEntryDummy(left.plugin, left.facts, left.score), projectEntryDummy(right.plugin, right.facts, right.score)))
  }

  const entries = ranked.slice(0, limit).map((item) => projectEntry(item.plugin, item.facts, item.score, item.matched, resolved))
  return {
    keywords: keywords.map((keyword) => ({ id: keyword.id, label: keyword.label, weight: keyword.weight, concepts: keyword.cats.slice() })),
    entries,
    scanned: plugins.length,
    matched: narrowed.length,
    totalMatched,
    sort,
    filters,
    facets,
  }
}

/** Lightweight stand-in used only for the downloads tie-break inside the sort. */
function projectEntryDummy(plugin, facts, score) {
  return {
    downloads: typeof plugin.downloads === 'number' ? plugin.downloads : null,
    githubReleaseDownloads: typeof plugin.githubReleaseDownloads === 'number' ? plugin.githubReleaseDownloads : null,
    stars: typeof plugin.stars === 'number' ? plugin.stars : 0,
    score,
  }
}