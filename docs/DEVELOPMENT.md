# Market Dog 开发交接

> 给下一个开发 session 的「项目记忆」。发版或收工时更新；新 session 开场先读这份文档，
> 再读 `CHANGELOG.md` 与 `git log --oneline -10`。
> 最后更新：2026-11-13（**0.4.5 已发布**：GitHub `Zhang-Eli/dsh-market-dog` + tag `v0.4.5` + npm `dsh-market-dog@0.4.5`。本版本内容：搜索质量三改（IDF 稀有度加权/域消歧/字面升级）、刷新目录后台化+3 秒浮窗、双击类别按下载量浏览、作者徽标、用户向 README 重写。明细见 CHANGELOG.md。市场条目 PR 未提——上游门禁要求仓库 ≥1 天，2026-11-14 后提）。

## 1. 当前状态

| 项目 | 现状 |
| --- | --- |
| 仓库路径 | `C:\\Users\\Administrator\\Documents\\dsh-plugins-filter`（开发工作区） |
| git | 已初始化：远端 `https://github.com/Zhang-Eli/dsh-market-dog`（public，main）；`9866452` Release 0.4.5（tag `v0.4.5` 指此处）→ `fa8b197` screenshots.json |
| npm | **已发布 0.4.5**（staged 审核放行，`latest`=0.4.5；registry 里另有自动占位版本 `0.0.0-stage`，非本插件产物、忽略）。`dsh-plugin-scout`、`dsh-plugin-finder` 已被别人占用，勿改回旧名 |
| 版本 | 0.4.5 三处同步：`package.json`、`index.js` `const VERSION = '0.4.5'`、CHANGELOG 顶部 |
| 本地安装 | profile `desktop`，以 `link:C:/Users/Administrator/Documents/dsh-plugins-filter` 依赖安装；`plugin_manager install_bundle` 返回 `application: applied`；link 安装，bundle 版本始终 = 本目录代码版本（当前 0.4.5） |
| 运行时状态 | 重装后需要**刷新页面**（URL 以运行时提示 / `dsh web` 输出为准，每次重启端口会变）才会加载新的客户端 bundle；刷新后用第 3 节的 Slots inspect 确认 `sidebar.panellist` 有 `{"id":"market-dog","order":22,"active":true}`、`main` 有 key `market-dog` |
| 测试 | 仓库内没有测试文件；本轮验证用 `/tmp/ms-test/` 下的 `searchtest.mjs`（筛选/分面）、`qualitybench.mjs`（搜索质量双向回归，改 lib/search.js 必跑）、`hosttest.mjs`（Host 路由 + 错误码 + **安装接口**：200/spec 推导、未知插件 404、缺 name 400、无 pluginManager 501；**已安装接口**：只返回 `installed: true` 的 bundle 名、无 pluginManager 501）、`cachetest.mjs`（目录下载失败/磁盘缓存/离线 stale/304 校验，12 项断言）、`refreshjobtest.mjs`（后台刷新：`meta refresh:true` 秒回 + `refresh-status` running→idle、并发搜索单飞合并、离开界面后任务自行完成、源 500 时 stale 兜底，14 断言）、`registertest.mjs`（client 模块槽位注册契约：侧栏 `name/id`、主面板 `name/key`）、`applyrender.mjs`（真 `apply()` + 真 localeSource + React 桩渲染，防黑屏回归）、`browserowsetest.mjs`（浏览模式：`browse:true` 空查询返回全类别条目、按下载量全量排序、`totalMatched`=全目录、类别筛选成员校验、facets 不被自身筛选收窄、非法空查询仍 400）、`render.mjs`（真 client.js → 静态 HTML，供截图；含 `results-install` 安装状态、`results-installed` 已安装行与 `results-preview` 全屏预览镜头），加上 `node --check`。无 e2e |
| 发布门禁 | `publish_gate` 工具未注入本会话，走手动：`npm pack --dry-run` 25 文件核对 + 发布后 registry tarball sha1 `e04d52354208a63af6c68781a2be022fd026a1f9` 与本地一致；GitHub 已 public；市场 PR 未提（age gate，明天提，条目草稿 `C:/Users/Administrator/AppData/Local/Temp/ms-test/Zhang-Eli__dsh-market-dog.yml`；`screenshots.json` 已推仓库根，市场构建探针会自动读取） |

## 2. 架构地图

| 文件 | 职责 |
| --- | --- |
| `index.js`（Host 入口，约 445 行） | `export const name`/`inject=['webServer']`；目录加载见下节：`downloadCatalogText`（流式 + 空闲超时）/`refreshOverNetwork`（2 次重试 + 304）/`ensureCatalog`（内存 6h、磁盘缓存优先）、`startRefreshJob`（单飞后台刷新任务：模块状态 + `refresh-status` 路由，客户端切换界面不影响任务）；`ctx.webServer.register({kind:'prefix', path:'/market-dog/api'})` 暴露 POST `search` / `meta`；`runSearch` 把 `body.filters` 原样交给 `searchCatalog`；同源防护用 `ctx.get('connection').requestRejection`，兜底 loopback + Host/origin/sec-fetch-site 检查；返回 `{ok:true,result}` / `{ok:false,error:{code,message,detail}}` |
| `lib/search.js`（纯函数，约 800 行） | `buildKeywordSet`（STOPWORDS + 56 个 CONCEPTS 意图 + 拉丁 token 兜底 + DOMAIN_MARKERS 域消歧；idf 见 computeIdfMults）、`searchCatalog`（打关键词分 → 采用度加权 → 按 filters 过滤 → 排序 → slice）、`projectEntry`（UI 条目形状，含 `added`/`capabilities`；0.3.0 的 UI 不再展示/筛选 capabilities，API 仍保留该字段与 `filters.capabilities`）、`popularityOf`/`compareByDownloads`/`adoptionOf`；0.3.0 新增 `CAPABILITY_IDS`、`UPDATED_WINDOWS=[7,30,90]`、`STAR_THRESHOLDS=[10,100,1000]`、`normalizeFilters`、`matchesFilters`、`buildFacets`；0.4.5 浏览模式：空关键词且 `options.browse===true` 时走全目录 listing（分面=全目录、筛选后按下载量全量排，无相关度池）。不依赖 DOM、不依赖 Host |
| `client.js`（UI，约 1,750 行含 CSS） | `window.__ModuleLoader__.load` 工厂；中英文案字典；`fetchApi` POST 到 `market-dog/api/*`（`search` / `meta` / `install`）；`ScoutPage`（masthead / 筛选栏 / 工具栏 / 结果行 / 骨架屏 / 页脚）；`PanelIcon`（矢量 `ScopeIcon`）；`ResultRow` / `ColumnHeader` / `Skeleton`；`.ps-page` 的 `--ps-*` 变量在 0.4.2 起映射到 DSH 主题变量（黄铜强调色保留）；0.3.3 起筛选栏可拖宽/收起（`.ps-rail-grip` 把手 + `.ps-rail-toggle` 按钮）；0.4.2 起安装按钮直接调用宿主，按钮三态 + 行下失败原因；0.4.3 起展开行含截图画廊（`.ps-shots` / `.ps-shot`）与全屏预览遮罩（`.ps-lb*`，`←/→/Esc`）；0.4.4 起 `installed` 状态（`fetchApi('installed')` → 行尾直接「已安装」） |
| `cordis.patch.yml` | 只插入一行 bundle：`id: market-dog` → `dsh-market-dog` |
| `locale/{en,zh}.json` | 面板名（Market Dog）与描述，供插件管理界面显示 |
| `icon.svg` | 侧边栏图标（戴帽子的狗头 + 放大镜） |
| `docs/screenshots/` | 0.4.3 版式截图：`results.png`（1280×820 默认结果）、`detail.png`（1180×760 展开安装命令）、`install.png`（1280×820 安装失败/安装中状态）、`installed.png`（1280×820 打开即「已安装」的行）、`preview.png`（1280×820 全屏截图预览）、`filters.png`（筛选组合）、`light.png`（浅色主题）、`narrow.png`（760×900 窄屏）、`loading.png`（骨架屏）、`empty.png`（空状态）、`panel.png`（1000×780 小面板）、`brand.png`（masthead 2× 裁切）。README 引用 results / detail / install / preview / filters / light；`package.json` 的 `files` 已包含 `docs/screenshots/`。改配色/字号/品牌字后必须整套重出，否则 README 与实机不符 |
| `README.md` / `CHANGELOG.md` | 用户向说明 / 版本记录 |

数据落点：目录有两级缓存——Host 内存（6 小时，`CATALOG_TTL_MS`）和磁盘 `<DSH 数据目录>/market-dog/catalog.json`（`{format:1, etag, catalog}`，原子写：临时文件 + rename；`cacheFile` 配置可覆盖路径）。客户端 `localStorage` 五项：`market-dog:description`（上次描述）、`market-dog:sort`（排序偏好）、`market-dog:filters`（筛选条件）、`market-dog:rail-width`（筛选栏宽度 px）、`market-dog:rail-collapsed`（筛选栏是否收起，取值为 1 或 0）。真实目录同时在本机留有一份旧快照 `C:\\Users\\Administrator\\AppData\\Local\\Temp\\plugins.json`（10,365 条，仅调试用，别把它当数据源；线上目录会继续增长）。

### 目录加载（0.3.1 起）

目录是约 3.5 MB gzip / 14 MB JSON，在 30 KB/s 的链路上要下 1 分多钟，所以**不能按整体超时判断失败**：

- `downloadCatalogText(url, etag)`：`AbortController` + 每次收到数据就重置的 **60 秒空闲超时**（`CATALOG_IDLE_TIMEOUT_MS`），总上限 10 分钟（`CATALOG_TOTAL_TIMEOUT_MS`）；流式 `response.body.getReader()` 拼接，超过 `MAX_CATALOG_BYTES`(64 MB) 报错；带 `if-none-match` 做 304 校验，304 返回 `{notModified:true}`。
- `refreshOverNetwork`：最多 `CATALOG_RETRIES = 2` 次，间隔 1.5 秒；成功后 `writeDiskCatalog`。失败时若磁盘有旧目录，就用旧的（`stale:true`）。
- `ensureCatalog`：内存新鲜（6h）直接用；否则**磁盘有缓存就先返回 stale 并起一次后台刷新**，所以面板永远不会被一次慢下载卡住。0.4.5 起所有刷新都走 `startRefreshJob`：Host 端单飞的模块级任务（同 URL 的并发刷新/搜索合并为一次下载），`meta` 带 `refresh:true` 只踢任务、立即用缓存作答（冷启动回 `refreshing:true` 占位元信息），进度用 `POST /market-dog/api` 的 `refresh-status` action 查（`running|error|idle` + `startedAt/finishedAt`）。客户端浮窗状态挂在**模块作用域的 catalogJob 驱动**上而非组件——切换界面、甚至刷新页面后重进面板，只要任务还在跑就轮询认领、浮窗重新挂上；等待超 3 秒（`REFRESH_TOAST_DELAY_MS`）才显示「索引建立中…」浮窗，完成后自动重查当前搜索。
- 响应里多一个 `stale` 布尔值；为 true 时面板元信息追加「本地缓存」，搜索照常可用。错误 envelope 现在是 `{ok:false,error:{code,message,detail}}`，`message` 是本地化文案，`detail` 是底层原因（如 `Catalog download failed (HTTP 500)`），面板用小号等宽字显示在提示下方。
- 网络实测：`curl` 与 Node `fetch` 都能拿到 200，但整包下载在本机会被中途 reset 或超过 25 秒；改为空闲超时后，Node 流式下载 14 MB 用 38–60 秒完成（实测 235 KB/s、`plugins: 10581`）。**测网络别用 `curl --compressed`**：这台机器的 MSYS curl 没编 zlib，会直接报错；用 `-H 'Accept-Encoding: gzip'`。

### 筛选 API（0.3.0 起）

`POST /market-dog/api/search` 的 body 增加可选 `filters`：

```json
{ "description": "读取本地文件的插件", "limit": 80, "sort": "relevance",
  "filters": { "category": "ui", "updatedWithin": 30, "starsMin": 100, "capabilities": ["fs-read"] } }
```

- `normalizeFilters` 白名单：`category` 任意字符串（单值，兼容旧参数 `body.category`）、`updatedWithin` 只接受 7/30/90、`starsMin` 只接受 10/100/1000、`capabilities` 最多 8 个且必须是 `CAPABILITY_IDS`；非法值静默丢弃，不会报 400。
- 语义：类别 OR 内的单值匹配；capabilities 为 AND（插件必须声明全部选中能力）；`updatedWithin` 用条目 `added` 日期；`starsMin` 用 `stars`。
- 返回增加 `totalMatched`（未筛前文本命中数）、`filters`（归一化后的回显）、`facets{categories,capabilities,updated,stars}`。**分面计数基于文本命中集、不随当前筛选变化**：面板上每个选项显示的是「这个关键词下该选项能捞到多少条」，而不是「再叠加当前条件后剩多少条」——否则选中项会把自己的数字越筛越小。双击类别进入的下载量浏览态在后续筛选/刷新下持续有效（`lastRun.browse` 随请求传递）。
- `sort: 'downloads'` 仍是「相关度前 `DOWNLOAD_POOL=120` 再按下载量」，现在这 120 条是**筛选后**的池子。

### 筛选栏宽度与收起（0.3.3 起）

- 宽度是 CSS 变量：`.ps-page { --ps-rail: var(--ps-rail-user, 256px) }`，React 在根节点内联写 `--ps-rail-user`（自定义属性，React 直接支持）。`--ps-row` 与 `--ps-rail` 相互独立，拖宽只影响左栏。
- 拖动把手：`aside.ps-rail` 内绝对定位的 `.ps-rail-grip`（`role="separator"`、`tabIndex=0`、`aria-valuenow` 同步）。pointerdown 后挂 window 的 pointermove/pointerup/pointercancel；宽度夹在 `RAIL_MIN_WIDTH=200` / `RAIL_MAX_WIDTH=440`；键盘左右方向键每次 16px；双击回到 `RAIL_DEFAULT_WIDTH=256`。**只在 pointerup 或键盘操作时写 localStorage**，拖动过程不写，避免每帧写盘。
- 收起：`railCollapsed` 给 `.ps-body` 加 `is-collapsed`（`grid-template-columns: minmax(0,1fr)`，`.ps-rail { display:none }`）；按钮 `.ps-rail-toggle` 是工具栏第一个子节点，`aria-controls="ps-rail"`、`aria-expanded` 同步，收起时文案带当前生效条件数。
- 窄面板保护：`@media (max-width:1080px)` 里 `--ps-rail: min(var(--ps-rail-user, 228px), 244px)`，用户拖到 440 也不会挤死结果区；`@media (max-width:860px)` 布局改为纵向堆叠、把手隐藏（收起按钮仍在）。改这两个断点前先跑 `render.mjs` 出 760/1000/1280 三张图。
- 状态钩子追加在 `showAllCategories` 之后：`railWidth` / `railCollapsed` / `railDragging` / `installs` / `preview`（0.4.3 起）。改 hooks 顺序必须同步 `/tmp/ms-test/render.mjs` 里每条 shot 的 `states` 数组，否则桩渲染会把值喂错位置。

### 品牌与图标（0.4.0 起）

- 命名链路必须一致：`package.json` name `dsh-market-dog` = `index.js` `export const name` = `cordis.patch.yml` 的 `name` = `client.js` 里 `window.__ModuleLoader__.load({ id })`；`cordis.patch.yml` 的 insert `id`、client `PANEL_ID`、宿主 `PREFIX`/注册 path 都是 `market-dog`。任一处没改，客户端模块不会被加载或面板注册不上。
- 品牌图形分两份：**面板左上角**用 `logo.png`（256×256、透明背景、62 KB），由宿主静态路由 `/market-dog/assets/*` 提供，客户端用 `new URL("market-dog/assets/logo.png", document.baseURI)` 取绝对地址，尺寸 **44px**、`object-fit: contain`（masthead 高 62px，44 是「填满但不顶边」的尺寸），左侧距边 16px、图标与文字间距 10px；旁边只有 `Market Dog` 一词（21px，`--ps-serif` 衬线、weight 400），没有副标（副标与品牌名语义重复，已删）。**侧边栏 16px** 不用插画，用内联 SVG `ScopeIcon` 准星（16 网格：`r=4.9` 圆环 + 四向刻度 + 中心实心点，`stroke-width=1.4`、`currentColor`），与商店里其他插件图标的线稿风格一致，语义是「锁定目标」；插画缩到 16px 会糊成一团，这是分工的原因。
- 宿主路由在 `index.js` 末尾单独注册：`{kind:"prefix", path:"/market-dog/assets"}`，白名单 `ASSETS = { "logo.png": "image/png", "icon.svg": "image/svg+xml" }`，只允许 GET/HEAD，带 1 天缓存与 nosniff；文件从 `PLUGIN_DIR`（`fileURLToPath(import.meta.url)` 所在目录）读取，新增静态资源要同时加进 `package.json` 的 `files`。
- `icon.svg` 是 96 方形深底（`#16181B`，圆角 20 的 `clipPath`）+ base64 内嵌 `logo.png`，不再手写矢量；插件管理界面读的是这个文件。换插画只改 `logo.png` 然后重跑内嵌脚本，两处自然一致。
- **logo.png 的视觉中心必须是绿色椭圆中心，不是画布中心。** 插画里帽子/耳朵会伸到椭圆上方，若按画布居中，文字看起来就会「比图片高一点」。现处理：取绿色椭圆（sage）像素的包围盒中心，平移内容让该中心落在 256 画布正中（当前偏移 dy=-7），再重嵌 `icon.svg`。改完用 3 倍缩放截图裁出 masthead 核对：椭圆中线与 `Market Dog` 字面中线应重合。
- 本地数据不自动迁移：0.4.0 起缓存目录是 `<DSH 数据目录>/market-dog/catalog.json`，localStorage 前缀是 `market-dog:`。想保留旧数据就手工把 `~/.dsh/market-scout/catalog.json` 复制到 `~/.dsh/market-dog/catalog.json`（面板会直接 stale 命中，省一次 14MB 下载），旧 localStorage 键可以不管。

### 安装接口（0.4.2 起）

`POST /market-dog/api/install`，body `{ name: string }`（市场条目 `name`，如 `dsh-file-share`；带 `#` 的变体也按完整 name 匹配）。

- 同源防护与 `search`/`meta` 一致（`refusalOf`，非 POST 405，非法 body 400）。
- `installSpecOf(entry)` 推导安装 spec，优先级：`entry.install` 里 `add <spec>` 的最后一个词（线上目录 10,581 条都是 `dsh plugin --profile web add <spec>` 格式）→ `entry.npm` → `github:<owner>/<repo>`（从 `entry.url` 解析）→ 空（500）。
- 宿主必须能取到 `ctx.get('pluginManager')` 且带 `installBundle` 函数：`await manager.installBundle(spec, { enabled: true })`。取不到时返回 **501 `install-unavailable`**（插件管理服务不可用，面板显示重试）。
- 返回 `{ ok:true, result: { name, spec, changed, application, bundle, version, pendingBuilds, warnings, error: { message, diagnostic } | null } }`；`ChangeResult.application` 透传（`applied` / `restart-required` / `overridden` / `failed` / `cancelled`）。
### 已安装接口（0.4.4 起）

`POST /market-dog/api/installed`，body 忽略，返回 `{ ok:true, result: { names: string[], fetchedAt } }`。

- 走宿主的 `ctx.get('pluginManager').listBundles()`，只收集 `installed === true` 的 `name` 并排序；没有 `pluginManager`（或 `listBundles`）时 501 `install-unavailable`，读取失败 500。
- 客户端在语言变化时拉一次，得到名字集合；结果行渲染时 `installs[key] ?? (installed.has(entry.name) || installed.has(entry.npm) ? 已安装 : 未装)`，所以打开面板就能看见哪些目录插件已经装过。会话内安装成功后把 `bundle` / `name` / `npm` 补进集合。
- 匹配是**按包名**：目录里 GitHub 安装的条目只要包名与 profile 的 bundle 名一致就能对上；包名被改过的例外。

- 这是真正会改 profile 依赖的写操作，和插件管理界面走同一条链路：慢网络下 `installBundle` 内部 pnpm/GitHub 检查可能几十秒，面板上「安装中…」是正常等待；有构建脚本没批准时 `pendingBuilds` 非空，客户端提示去插件管理批准（本插件不代批）。服务端不做并发去重，客户端按行置灰防重复点击。

## 3. 常用命令

```bash
cd /c/Users/Administrator/Documents/dsh-plugins-filter

# 语法检查（三个 JS 全部要过）
node --check index.js && node --check client.js && node --check lib/search.js

# 数据层：筛选语义 / 分面计数 / 排序（真实 10,365 条快照）
node C:/Users/Administrator/AppData/Local/Temp/ms-test/searchtest.mjs

# Host 路由冒烟：桩 ctx + 假 req/res，起本地 http server 供目录
node C:/Users/Administrator/AppData/Local/Temp/ms-test/hosttest.mjs

# 目录加载：下载失败统一 502、磁盘缓存写入、离线 stale、304 校验（12 项断言）
node C:/Users/Administrator/AppData/Local/Temp/ms-test/cachetest.mjs

# client 模块槽位注册契约（侧栏 name/id、主面板 name/key，别写成面板 id）
node C:/Users/Administrator/AppData/Local/Temp/ms-test/registertest.mjs

# 严格渲染冒烟：真 apply() + 真 localeSource + React 桩渲染面板（防黑屏）
node C:/Users/Administrator/AppData/Local/Temp/ms-test/applyrender.mjs

# 真 client.js → 静态 HTML（React 桩 + 真 searchCatalog），供截图
node C:/Users/Administrator/AppData/Local/Temp/ms-test/render.mjs
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu \
  --no-sandbox --hide-scrollbars --virtual-time-budget=4000 \
  --window-size=1440,1000 \
  --screenshot="C:\\Users\\Administrator\\AppData\\Local\\Temp\\ms-test\\out\\results-dark.png" \
  "file:///C:/Users/Administrator/AppData/Local/Temp/ms-test/out/results-dark.html"
```

`render.mjs` 要点（改 client.js 时同步维护）：React 桩用 `hook.states` 数组按调用顺序喂 state，`ScoutPage` 的 state 顺序是
`[scheme, text, sort, filters, results, phase, refreshing, error, meta, metaBusy, selected, copied, showAllCategories, railWidth, railCollapsed, railDragging, installs, preview]`（18 个；`preview` 为 `{ entry, index } | null`）
（0.4.2 加了 `installs` 安装状态表；每加一个 `useState` 都要同步所有镜头的 `states` 数组，否则后面的 state 会整体错位）；
`slots.register(spec, Component)` 的组件在**第二个参数**；Node 24 的 `globalThis.navigator` 是只读 getter，别去 stub。
`spec.name` 必须是**槽位键**，不是面板 id：侧栏那条写 `name: 'sidebar.panellist'`、`id: 'market-dog'`；主面板写 `name: 'main'`、`key: 'market-dog'`。写成 `name: 'market-dog'` 时宿主不报错，主面板照常注册，但**侧栏图标静默丢失**（0.3.0 踩过一次）。
改完 `apply()` 后用 `node C:/Users/Administrator/AppData/Local/Temp/ms-test/registertest.mjs` 断言两条注册的 slot 名与 id/key。

**`ctx.locale` 的同步契约。** 客户端 locale Service 只暴露 `getLocale()`、`getSnapshot()`（返回 `{active, locales[], revision}`）和 `subscribe()`，**没有 `snapshot()`**。`useSyncExternalStore` 必须绑定 `getSnapshot`；判断当前语言读快照的 `active` 字段。0.3.0 首次上线时主面板黑屏，就是 `ctx.locale.snapshot()` 在渲染期抛 TypeError、被 React 错误边界吞掉；而旧的 `render.mjs` 自己造了 localeSource，绕过了 `apply()`，所以没测出来。改完 `apply()` / locale 相关代码后必须跑严格冒烟：

```text
node C:/Users/Administrator/AppData/Local/Temp/ms-test/applyrender.mjs
```

重载/安装（改了 Host 或 client 后；重装会重新打包客户端 bundle）：

```text
plugin_manager remove_bundle  target: dsh-market-dog
plugin_manager install_bundle target: C:\\Users\\Administrator\\Documents\\dsh-plugins-filter
```

然后刷新页面。验证注册（默认树只列 slot 声明，**必须传 root** 才看得到注册项）：

```text
cordis_inspect_query platform=client provider=Slots method=listSubTree input={"root":"sidebar.panellist"}
cordis_inspect_query platform=client provider=Slots method=listSubTree input={"root":"main"}
```

## 4. 发布流程（简版）

0.4.5 已完成：版本三处同步（package.json / `index.js` VERSION / CHANGELOG）、GitHub 建仓+tag、`npm publish`（staged 审核放行）、tarball sha1 校验、`screenshots.json` 推送。完整坑表见技能 `dsh-plugin-publish`。

1. 待办：把 `/tmp/ms-test` 脚本（searchtest / qualitybench / hosttest / cachetest / refreshjobtest / registertest / applyrender / browserowsetest）固化进仓库 `test/`，加 `npm test`，记录通过数。
2. `publish_gate` 工具未注入本会话；下个版本若装上门禁工具，发布前跑全量（0 blocker）。
3. 市场条目 PR：上游 `check-submission.mjs` 要求仓库 ≥1 天（MIN_AGE_DAYS=1），2026-11-14 之后才能提；条目草稿在 `C:/Users/Administrator/AppData/Local/Temp/ms-test/Zhang-Eli__dsh-market-dog.yml`。合并后市场构建自动读仓库根 `screenshots.json`，无需再为截图提 PR。
4. 每次发版回到第 1 节更新版本、tag、shasum、状态行。

## 5. 关键设计与坑

**视觉方向（用户拍板，不要自行改风格）。** 瑞士网格骨架 + 编辑排版结果卡片：深色开发者工具语境、中性灰阶承担 90% 界面、只有一个低饱和强调色；左侧固定窄筛选栏 + 右侧单列结果列表；禁止均匀卡片网格、紫色渐变/霓虹/玻璃拟态、入场动画与装饰性动效、大 Hero 落地页套路。字体必须是中性 grotesque + 等宽元信息 + 有辨识度的包名展示字体，**禁止 Inter/Roboto/Arial 做正文字体**，也不许引远程字体（离线应用）。

**字体栈要留真实回退。** 本机探测（canvas measureText）结果：`Aptos`、`Segoe UI Variable Text`、`Helvetica Neue`、`PingFang SC`、`Microsoft YaHei`、`Noto Sans SC`、`JetBrains Mono`、`Menlo`、`Aptos Display` **都不存在**；存在的是 `Segoe UI`、`Bahnschrift`/`Bahnschrift SemiCondensed`、`Franklin Gothic Medium`、`Cascadia Mono`、`Consolas`、`DengXian`、`SimSun`、`Tahoma`、`Arial`。所以 `--ps-sans` 必须显式接 `"Segoe UI"`，否则会掉到 Arial（违反 brief）。衬线只在 wordmark / 空状态标题用：wordmark 0.4.2 起固定 `Cambria` 20px（见品牌章节），`--ps-serif` 走 `Constantia` 供空状态/无结果标题（本机存在；`Goudy Old Style`、`Baskerville`、`Lucida Bright` 不存在，别加）。当前栈：

```css
--ps-sans: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI Variable Text", "Aptos", "Helvetica Neue", "PingFang SC", sans-serif;
--ps-mono: "Cascadia Mono", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
--ps-display: "Bahnschrift", "Segoe UI Semibold", "Segoe UI", "Franklin Gothic Medium", "Helvetica Neue", sans-serif;
--ps-serif: "Constantia", "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif;
```

**全屏预览要让开宿主窗口按钮。** DSH 桌面窗口的 −□× 在右上角约 40px 高的区域，是本插件 DOM 之上的宿主层；`.ps-lb` 若 `inset:0` 直接贴边，图片和 `× 关闭` 会钻到按钮下面，用户点「关闭预览」会点到窗口关闭。现规则：`.ps-lb { padding: 46px 56px 40px }`（≤860px 为 40px 16px 30px），`.ps-lb-bar` 在留白之下、箭头贴内容区两侧（`left/right: 6px`）。改遮罩布局必须保持这块安全区。

**截图预览（0.4.3 起）。** 目录里只有 2,454 / 10,365 条插件带 `screenshots`（多为 raw.githubusercontent.com 的用户附件）。`lib/search.js` 的 `projectEntry` 过滤成最多 6 个 http(s) URL，客户端只在**展开行**渲染缩略图（`loading="lazy"`，加载失败 `onError` 加 `.is-broken` 显示「无法预览」占位）；点缩略图打开 `.ps-lb` 全屏遮罩，`←/→` 循环、`Esc` 关闭，单张时隐藏箭头。遮罩固定深色（看图语境，不跟随浅色主题）；窄屏缩略图降到 112×64。价格：无截图的插件展开后不显示画廊，不要因此以为功能坏了。

**底色跟随 DSH，强调色属于品牌。** DSH 深色下 `brand-primary` 是单色白（#f9fafb），没有可用的强调色 token，所以 0.4.2 起：`.ps-page.is-dark` 的 `--ps-bg / --ps-surface / --ps-surface-hover / --ps-hairline / --ps-hairline-strong / --ps-ink / --ps-ink-2` 分别映射到 `--dsw-alias-bg-base / bg-layer-1 / bg-layer-2 / border-l1 / border-l2 / label-primary / label-secondary`，`--ps-ink-3` 用 `color-mix(in srgb, var(--dsw-alias-label-secondary) 66%, transparent)`；`.ps-page.is-light` 同构。`var()` 的 fallback 写中性 slate / 纸白值（深 `#16181B`、浅 `#F7F7F4` 一带），这样离线 `render.mjs` 截图也接近真实主题。**黄铜仍是唯一强调色**（深 #C3A161 / 浅 #7A5B24），用于选中、可点链接、安装按钮和 hover；插画里的苔绿只留在 logo。运行时 `detectScheme()` 读 `--dsw-alias-bg-base` 的亮度（html → body → data-theme/data-color-mode → `prefers-color-scheme` 回退）加 `.is-dark` / `.is-light`，并用 `MutationObserver` 跟随主题切换。用户明确说过「不必和背景完全一样，但不能差太多」，所以别再换回暖褐大底；新增颜色一律进这两套变量。

**视觉语言约定（0.4.1 起，0.4.2 调整，改细节前先读）。** 品牌 wordmark 是 `Market Dog` / **Cambria 20px / weight 400 / letter-spacing .012em**（不走 `--ps-serif`：Constantia 21px 在 200px 最窄筛选栏里实测 110.7px、可用只有 106px，会出省略号；Cambria 20px 实测 101px）；`--ps-serif` 只留给空状态标题（34px）/无结果标题（27px）。包名**不用**衬线（试过，连字符包名变成报纸标题，扫读变慢，已回退）。Masthead 底部是「双线」：`border-bottom: 1px strong` + `.ps-top::after` 在 `bottom:3px` 画一条 hairline。选中态统一用黄铜：结果行 `color-mix(accent 7%)` 底 + 左侧 2px 实线，hover 加到 11%；筛选栏 active 项 `8%` 底 + 左侧 2px 线；排序分段按钮 active 用 `13%` 底 + 55% 边框 + 黄铜字，**不要**用实心黄铜块（太抢眼）。空状态文案只允许一处侦探梗（`给猎犬一条线索 / give the hound a scent`），其他文案保持中性。包名 Bahnschrift 500 / 17.4px：0.4.1 从 600 降下来配衬线 wordmark，再重会压过描述层级。展开区固定两行：第一行整行命令 + 行内复制，第二行左边版本/收录日期、右边 GitHub/npm/市场页（`.ps-detail-bottom` 用 `justify-content: space-between` + `flex-wrap: wrap`），不要再挤回一行；失败原因用行下的 `.ps-row-failure`（错误色等宽小字，`grid-column: 2/-1`）。

**结果行是 CSS Grid，列宽只在一处定义。** `--ps-row` 模板：`36px minmax(0,1fr) 78px 88px 92px`（排名 / 包名 / Star / 下载 / 安装）。行 `.ps-row` 与表头 `.ps-cols` 共用同一个模板和 `--ps-pad`，所以右侧等宽数字与表头严格对齐；`<=1080px` 时模板一起改（`--ps-rail: 228px`）。版本号和收录日期 0.3.2 起不再占列，只放在展开区（`.ps-detail-meta`）；想加回列必须同时改 `--ps-row`、表头、行、骨架屏四处。安装列（最后一列）是按钮：idle → installing（禁用 + opacity .6 + 「安装中…」）→ installed（`is-done`，实心/黄铜）或 failed（`is-failed`，错误色 + 「重试」），失败原因写在行下；点击发 `POST /market-dog/api/install`，不再复制命令。

**骨架屏与真行同构。** `Skeleton` 渲染 10 条 `.ps-row.is-skeleton`，用同一套 grid 列、同样的高度，只把内容换成灰条 + `ps-pulse` 透明呼吸；不要退回居中 spinner。

**窄屏筛选栏是横向 chip 行，不是两列网格。** `<=860px` 时 `.ps-rail` 变 block，`.ps-group` 变 `flex-wrap`（label 占满一行，选项变 auto 宽 chip），`.ps-opt` 保留 base 的 `padding: 4px 20px 4px 18px` 以免 2px 强调边框压到文字；`.ps-opt-more`（「更多 (16)」）在 JSX 里是 `filterGroup` 的 `extra` 参数、属于类别组内部，所以会自动跟在 chip 行末尾。曾用两列 grid 实现，导致强调边框压字、更多按钮飞到右上角，已废弃。

**筛选栏「更多」按钮的位置。** `filterGroup(key, label, options, isActive, onPick, mono, extra)` 的第 7 个参数是额外节点；类别组的「更多/收起」走这个口子，不要再作为 `.ps-rail` 的直接子节点渲染。

**下载量排序 = 筛选后的相关度前 120 再按下载量。** 全量按下载量排会让擦边高下载插件霸榜（历史事故）；`DOWNLOAD_POOL = 120`，排序在 Host 侧完成后再 `slice(limit)`。客户端切排序必须带 `sort` 重新请求，不要只重排已加载的 80 条。

**相关度 = (概念分 × 覆盖度 + 原文分 × 1.15) / 长度惩罚 × 废弃惩罚 × 采用度。** 概念分来自 `buildKeywordSet` 的意图词典；**原文分**来自 0.4.4 的 `buildRawKeywords` / `scoreRaw`：查询里的拉丁词（≥3 字符、非停用词）和中文二元组各算一个 raw 关键词，每个命中词再按 BM25 风格稀有度缩放（`computeIdfMults`），字面命中包名基础 +14、描述 +5，长组合按长度加成。用户原话（例如 `trending`）即使被概念词典归并成「订阅」，也不会再和所有同义插件平权。raw 关键词**不进入覆盖度分母**（`coverage = conceptMatched / keywords.length`），只做加性加分，否则中文长句会被二元组稀释；域不一致（发布类 dev/social，`classifyDomain` 判定）的命中打 3 折且不记 coverage。采用度 `adoptionOf` 用下载/星标的对数，最多 +40% / +12%，只在同等相关时起作用；长度惩罚是 `1 + min(1, descLength/1600)`。

**召回由词典决定，不靠模型。** 中文说法必须同时给出英文词族，因为插件名只按英文 term 匹配（`nameHit` 只吃英文 base term）。加 concept 时 zh/en 两侧都要写全，并跑词表回归。中文是子串匹配，新增词必查冲突（已踩过：`浏览` 命中「浏览器」、`记录` 同时出现在 chat 与 note、`能力` 同时出现在 skill 与 toolkit；`流程图` 仍会命中「流程」）。

**没有「语言」字段。** 市场目录里 10,365 条**全部**同时带 en/zh 描述，没有任何语言标记，所以做不出有区分度的「语言」筛选。0.3.0 曾用「权限/capabilities」顶替语言筛选，2026-11-11 用户看过真实界面后认为「权限一类不明所以，去掉」，因此**筛选栏现在只有类别 / 更新时间 / Star 三组**；`lib/search.js` 与 Host API 仍接受 `filters.capabilities`（能力字段本身留着，属主数据），`client.js` 固定发空数组，`readFilters()` 也会丢弃本地存的旧 capability 筛选，避免出现「看不见却仍在筛」的状态。若以后数据源补了 `language`，在 `normalizeFilters` + `matchesFilters` + `buildFacets` + 筛选栏各加一组即可。

**「更新时间」是收录日期。** 目录只有条目级 `added`（YYYY-MM-DD）和目录级 `updated`；没有仓库最后提交时间。`addedTimeOf` 只接受 10 位日期串、解析失败返回 0（0 不参与时间筛选）。别把它当成「最近发布」。

**结果条目的 `version`/`downloads` 可能为 null。** 5,324/10,365 有 npm 包，其余是 GitHub 安装；UI 统一显示 `—`，排序时 `null` 不能当 0 处理（`compareByDownloads` 已处理）。

**插件路由对 curl 一定是 403，不是 bug。** Host 的 `connection.requestRejection` 要求浏览器鉴权 cookie。GUI 页面 URL 需要 auth token，所以**无法**用无头 Chrome 截真实页面；视觉验证靠 `render.mjs` 生成静态 HTML 再截图（这不算 e2e，交互只能靠人点）。

**面板通常不是全屏，字号要按「面板里的一屏」调。** DSH 左侧还有 280px 侧边栏，1280 宽的窗口里面板只有约 1000px。0.3.0 首版按 1440 全屏设计，用户反馈「字太小」。现基准（2026-11-12 用户第二轮反馈后）：正文 15px / 描述 13.5px / 元信息 11px / 包名 17.5px（Bahnschrift **非压缩**、weight 600，不要退回 SemiCondensed——压缩字形在小字号下更难读）/ 数字列 13px，标签类最小 10.5px；行高 **94px**，1280×820 的面板里一屏恰好 7 条（153 + 7×94 = 811 < 820）。`--ps-row: 36px minmax(0, 1fr) 78px 88px 92px`，`--ps-rail: 256px`（≤1080px 时 228px）。改字号/行高必须同步改这三个值，否则数字列会挤爆包名列、或第 7 行被裁掉。截图验证用 `render.mjs` 的 `results-panel`（1000×780）和 `results-dark`（1280×820）两张。

**客户端代码改动要重装 + 刷新页面才生效。** 重装走 `remove_bundle → install_bundle`；若面板还是旧样子，让用户刷新当前 GUI URL（`dsh web` 每次重启会换端口，以 runtime context 为准）。重装后立刻用 Slots inspect 查不到 `market-dog` 是正常的（页面还没重新加载 bundle）。

**dsh-ops 的 bash 偶尔整段失效。** 报 `EXECUTOR_UNAVAILABLE: Niubash preparation failed ... link ...awk.exe`，与插件无关，稍后自愈；期间仍可用 ops_* 文件工具、`plugin_manager`、`cordis_inspect_*`。另外**不要在同一条消息里发两个 ops_bash**，并发很容易触发这个 exec-tree 损坏。

## 6. 已知限制与下一步候选

- [ ] **仓库无 git、无测试**：`/tmp/ms-test` 的脚本是一次性的，重启或清临时目录即丢。优先建仓库并固化到 `test/`，加 `npm test`（阻塞：用户要求暂不发布，建库需另行确认）。
- [ ] **没有真机截图**：GUI 需要 auth token，只能静态渲染截图；真实交互（hover、点击、滚动、主题切换）没有自动化覆盖。
- [ ] **无分页**：一次最多返回 80 条（`limit` 上限 200），没有「加载更多」；筛选后仍可能多于 80 条。
- [ ] **词典是静态词表**：中文 OOV 词只能退回 Latin token（权重 0.8），不会语义泛化。可选方案：Host 侧 `llm` 服务做关键词兜底，必须带本地降级。0.4.5 的 IDF 稀有度加权已缓解泛词噪声，词表本身仍需人工扩。
- [ ] **短查询歧义**：「插件发布」会带出内容发布类插件；「流程图」命中「流程」。
- [ ] **语言筛选缺数据**：见第 5 节；等市场目录补字段。
- [ ] **筛选都是单值**：类别/时间/Star 不支持多选（UI 与 API 都是单值；API 另有多选 `capabilities`，但 UI 已不暴露）。若要改成多选，`normalizeFilters` 与 `matchesFilters` 的 OR/AND 语义要一起改，别只改前端。

## 7. 新 session 开场清单

1. 读本文件、`CHANGELOG.md` 最近两条；仓库目前无 git，用目录内文件 mtime 代替 `git log`。
2. 跑第 3 节三条 `node --check`；若 `/tmp/ms-test` 还在，跑 searchtest + hosttest + render。
3. 用 `cordis_inspect_query` 确认 `sidebar.panellist` 有 `market-dog` / order 22 / active，且 `main` 有 key `market-dog`；与 `package.json` 版本、`index.js` VERSION 三者对齐。
4. 向用户复述：当前版本 0.3.0、未发布、已验证项与第 6 节未完成项，再确认本次任务属于「发布」还是「继续改 UI / 匹配」。
5. 收工前更新第 1 节事实与第 6 节清单；若做了版本变更，同步 CHANGELOG 与三处版本号。