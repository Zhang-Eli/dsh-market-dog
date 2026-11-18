/**
 * Market Dog — plugin search for the DSH Web UI.
 *
 * Layout: a Swiss grid. A fixed masthead carries the query field; a narrow
 * fixed filter rail sits in the left column; the right column is a single
 * editorial list of results whose metadata columns are monospaced so rows can
 * be compared vertically. No card grid, no hero, no entrance animation.
 */

window.__ModuleLoader__.load({
  id: 'dsh-market-dog',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React
    const h = React.createElement

    const NS = 'marketDog'
    const PANEL_ID = 'market-dog'
    const API_PREFIX = 'market-dog/api/'
    const ASSET_PREFIX = 'market-dog/assets/'
    const ORDER = 22
    const AUTHOR_NAME = 'wzvx'
    const AUTHOR_URL = 'https://github.com/wzvx'
    const REPO_URL = 'https://github.com/wzvx/dsh-market-dog'
    const ISSUES_URL = `${REPO_URL}/issues`
    const STORAGE_DESCRIPTION = 'market-dog:description'
    const STORAGE_SORT = 'market-dog:sort'
    const STORAGE_FILTERS = 'market-dog:filters'
    const STORAGE_RAIL_WIDTH = 'market-dog:rail-width'
    const STORAGE_RAIL_COLLAPSED = 'market-dog:rail-collapsed'
    const LIMIT = 80
    const SKELETON_ROWS = 10
    const CATEGORY_VISIBLE = 7
    const UPDATED_WINDOWS = [7, 30, 90]
    const STAR_THRESHOLDS = [10, 100, 1000]
    const EMPTY_FILTERS = { category: '', updatedWithin: 0, starsMin: 0, capabilities: [] }
    const RAIL_MIN_WIDTH = 200
    const RAIL_MAX_WIDTH = 440
    const RAIL_DEFAULT_WIDTH = 256

    const EN = {
      'nav.label': 'Market Dog',
      'query.label': 'Search the plugin catalog',
      'query.placeholder': 'Describe the plugin you need — Enter to search',
      'query.submit': 'Search',
      'query.clear': 'Clear',
      'query.examples': 'Try one',
      'meta.loading': 'Loading catalog',
      'meta.stale': 'cached copy',
      'results.loadingHint': 'Downloading the plugin catalog — the first load can take a minute on a slow link.',
      'meta.entries': 'entries',
      'meta.refresh': 'Refresh catalog',
      'toast.indexing': 'Building the index — this can take a moment…',
      'toast.indexFailed': 'Catalog refresh failed',
      'sort.label': 'Sort',
      'sort.relevance': 'Relevance',
      'sort.downloads': 'Downloads',
      'filters.title': 'Filters',
      'filters.reset': 'Reset',
      'filters.show': 'Filters',
      'filters.hide': 'Hide filters',
      'filters.resize': 'Drag to resize · double-click to reset',
      'filters.category': 'Category',
      'filters.browseHint': 'Double-click to browse this category by downloads',
      'filters.updated': 'Updated',
      'filters.stars': 'Stars',
      'filters.capabilities': 'Capabilities',
      'filters.all': 'All',
      'filters.more': 'More ({n})',
      'filters.less': 'Less',
      'filters.updated.7': 'Last 7 days',
      'filters.updated.30': 'Last 30 days',
      'filters.updated.90': 'Last 90 days',
      'results.matches': 'matches',
      'results.catalogued': 'of {n} catalogued',
      'results.filtered': 'filtered from {n}',
      'results.understood': 'Matched terms',
      'results.refreshing': 'updating',
      'col.package': 'Package',
      'col.stars': 'Stars',
      'col.downloads': 'Downloads',
      'card.install': 'Install',
      'card.copied': 'Copied',
      'card.copy': 'Copy',
      'card.installing': 'Installing',
      'card.installed': 'Installed',
      'card.retry': 'Retry',
      'card.buildPending': 'Build scripts need approval in the plugin manager.',
      'card.added': 'added',
      'shots.label': 'Screenshots',
      'shots.empty': 'No preview',
      'shots.close': 'Close',
      'shots.prev': 'Previous',
      'shots.next': 'Next',
      'shots.hint': '← → switch · Esc close',
      'card.deprecated': 'deprecated',
      'card.author': 'My work',
      'card.authorTitle': 'developed by me',
      'card.market': 'Listing',
      'card.github': 'GitHub',
      'card.npm': 'npm',
      'empty.title': 'Find what you want',
      'empty.body': 'One sentence — give the hound a scent…',
      'none.title': 'No plugins match',
      'none.body': 'Try different wording, or loosen the filters.',
      'none.clear': 'Clear filters',
      'error.title': 'Search failed',
      'error.retry': 'Retry',
      'footer.feedback': 'Report an issue',
      'footer.dev': 'Developed by',
    }

    const ZH = {
      'nav.label': 'Market Dog',
      'query.label': '检索插件目录',
      'query.placeholder': '描述你要的插件 —— 回车检索',
      'query.submit': '检索',
      'query.clear': '清空',
      'query.examples': '试试这些',
      'meta.loading': '目录读取中',
      'meta.stale': '本地缓存',
      'results.loadingHint': '正在下载插件目录；网络较慢时首次加载需要约一分钟。',
      'meta.entries': '条',
      'meta.refresh': '刷新目录',
      'toast.indexing': '索引建立中，需要一点时间…',
      'toast.indexFailed': '目录刷新失败',
      'sort.label': '排序',
      'sort.relevance': '相关度',
      'sort.downloads': '下载量',
      'filters.title': '筛选',
      'filters.reset': '重置',
      'filters.show': '筛选',
      'filters.hide': '收起筛选',
      'filters.resize': '拖动调整宽度 · 双击恢复默认',
      'filters.category': '类别',
      'filters.browseHint': '双击按下载量浏览该分类全部插件',
      'filters.updated': '更新时间',
      'filters.stars': 'Star 数',
      'filters.capabilities': '权限',
      'filters.all': '全部',
      'filters.more': '更多 ({n})',
      'filters.less': '收起',
      'filters.updated.7': '近 7 天',
      'filters.updated.30': '近 30 天',
      'filters.updated.90': '近 90 天',
      'results.matches': '个匹配',
      'results.catalogued': '共 {n} 条',
      'results.filtered': '筛自 {n} 条',
      'results.understood': '已理解',
      'results.refreshing': '更新中',
      'col.package': '包名',
      'col.stars': 'Star',
      'col.downloads': '下载',
      'card.install': '安装',
      'card.copied': '已复制',
      'card.copy': '复制',
      'card.installing': '安装中…',
      'card.installed': '已安装',
      'card.retry': '重试',
      'card.buildPending': '需要在插件管理里批准构建脚本。',
      'card.added': '加入于',
      'shots.label': '截图',
      'shots.empty': '无法预览',
      'shots.close': '关闭',
      'shots.prev': '上一张',
      'shots.next': '下一张',
      'shots.hint': '← → 切换 · Esc 关闭',
      'card.deprecated': '已停用',
      'card.author': 'My work',
      'card.authorTitle': 'developed by me',
      'card.market': '市场页',
      'card.github': 'GitHub',
      'card.npm': 'npm',
      'empty.title': '寻你所想',
      'empty.body': '一句话即可，给猎犬一条线索…',
      'none.title': '没有匹配的插件',
      'none.body': '换个说法，或减少筛选条件。',
      'none.clear': '清除筛选',
      'error.title': '检索失败',
      'error.retry': '重试',
      'footer.feedback': '反馈问题',
      'footer.dev': 'Developed by',
    }

    const EXAMPLES = {
      en: [
        'Claude-style theme',
        'quadrant todo list with a sidebar',
        'GitHub Trending waterfall feed',
        'plugin publish flow checker',
        'context compression to save tokens',
      ],
      zh: [
        '仿 Claude 样式的主题',
        '带侧边栏的四象限待办',
        'GitHub Trending 瀑布流',
        '插件发布流程校验工具',
        '上下文压缩来节省 token',
      ],
    }

    /* ------------------------------------------------------------------ */
    /* storage + small helpers                                             */
    /* ------------------------------------------------------------------ */

    function readStored(key, fallback) {
      try {
        const value = window.localStorage.getItem(key)
        return value === null ? fallback : value
      } catch {
        return fallback
      }
    }

    function writeStored(key, value) {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        /* storage can be unavailable; preferences are best-effort */
      }
    }

    function clampRailWidth(value) {
      const width = Number.isFinite(value) ? Math.round(value) : RAIL_DEFAULT_WIDTH
      return Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, width))
    }

    function readFilters() {
      const raw = readStored(STORAGE_FILTERS, '')
      if (typeof raw !== 'string' || raw === '') return { ...EMPTY_FILTERS, capabilities: [] }
      try {
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return { ...EMPTY_FILTERS, capabilities: [] }
        // capabilities are no longer exposed as a filter; never let a stale
        // stored value keep narrowing results invisibly.
        const capabilities = []
        return {
          category: typeof parsed.category === 'string' ? parsed.category : '',
          updatedWithin: UPDATED_WINDOWS.includes(parsed.updatedWithin) ? parsed.updatedWithin : 0,
          starsMin: STAR_THRESHOLDS.includes(parsed.starsMin) ? parsed.starsMin : 0,
          capabilities,
        }
      } catch {
        return { ...EMPTY_FILTERS, capabilities: [] }
      }
    }

    function localeCodeOf(snapshot) {
      if (typeof snapshot === 'string') return snapshot
      if (snapshot === null || snapshot === undefined) return ''
      if (typeof snapshot.active === 'string') return snapshot.active
      if (typeof snapshot.locale === 'string') return snapshot.locale
      if (typeof snapshot.code === 'string') return snapshot.code
      if (typeof snapshot.language === 'string') return snapshot.language
      return ''
    }

    function languageOf(code) {
      return /^zh/iu.test(String(code ?? '')) ? 'zh' : 'en'
    }

    /** Read the host theme's base background and decide which palette to use. */
    function parseLightness(value) {
      const text = String(value ?? '').trim()
      if (text === '') return null
      let red = null
      let green = null
      let blue = null
      const hex = /^#([0-9a-f]{3,8})$/iu.exec(text)
      if (hex !== null) {
        let digits = hex[1]
        if (digits.length === 3 || digits.length === 4) {
          digits = digits.split('').map((digit) => digit + digit).join('')
        }
        if (digits.length !== 6 && digits.length !== 8) return null
        red = Number.parseInt(digits.slice(0, 2), 16)
        green = Number.parseInt(digits.slice(2, 4), 16)
        blue = Number.parseInt(digits.slice(4, 6), 16)
      }
      const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/iu.exec(text)
      if (rgb !== null) {
        red = Number(rgb[1])
        green = Number(rgb[2])
        blue = Number(rgb[3])
      }
      if (red === null || green === null || blue === null) return null
      if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) return null
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    }

    function detectScheme() {
      try {
        const roots = [document.documentElement, document.body]
        for (const root of roots) {
          if (root === null) continue
          const probe = window.getComputedStyle(root).getPropertyValue('--dsw-alias-bg-base')
          const lightness = parseLightness(probe)
          if (lightness !== null) return lightness > 140 ? 'light' : 'dark'
        }
        const attribute = document.documentElement?.getAttribute('data-theme')
          ?? document.documentElement?.getAttribute('data-color-mode')
          ?? ''
        if (/light/iu.test(attribute)) return 'light'
        if (/dark/iu.test(attribute)) return 'dark'
        if (window.matchMedia !== undefined && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
      } catch {
        /* fall through */
      }
      return 'dark'
    }

    function useColorScheme() {
      const [scheme, setScheme] = useState(detectScheme)
      useEffect(() => {
        if (typeof MutationObserver !== 'function') return undefined
        const observer = new MutationObserver(() => setScheme(detectScheme()))
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] })
        if (document.body !== null) observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] })
        return () => observer.disconnect()
      }, [])
      return scheme
    }

    function formatCount(value) {
      if (value === null || value === undefined || !Number.isFinite(value)) return '—'
      if (value < 1000) return String(Math.round(value))
      if (value < 1000000) {
        const digits = value < 10000 ? 1 : 0
        return `${(value / 1000).toFixed(digits)}k`
      }
      return `${(value / 1000000).toFixed(1)}M`
    }

    function formatNumber(value) {
      if (value === null || value === undefined || !Number.isFinite(value)) return '—'
      return Math.round(value).toLocaleString('en-US')
    }

    /** `1.2.3` -> `v1.2.3`; missing -> em dash. */
    function versionText(entry) {
      const version = entry?.version
      if (version === null || version === undefined || version === '') return '—'
      return `v${String(version)}`
    }

    /** `2026-11-11` -> `11-11`; anything else -> em dash. */
    function shortDate(value) {
      if (typeof value !== 'string') return '—'
      const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value)
      return match === null ? '—' : `${match[2]}-${match[3]}`
    }

    function localizedDescription(entry, lang) {
      const description = entry?.description
      if (description === null || typeof description !== 'object') return ''
      const preferred = lang === 'zh' ? description.zh : description.en
      const fallback = lang === 'zh' ? description.en : description.zh
      const text = typeof preferred === 'string' && preferred.trim() !== '' ? preferred : fallback
      return typeof text === 'string' ? text.trim() : ''
    }

    function entryKey(entry) {
      return `${entry.owner}/${entry.name}`
    }

    function copyText(value) {
      if (navigator.clipboard !== undefined && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(value).catch(() => fallbackCopy(value))
      }
      return fallbackCopy(value)
    }

    function fallbackCopy(value) {
      return new Promise((resolve, reject) => {
        try {
          const area = document.createElement('textarea')
          area.value = value
          area.setAttribute('readonly', 'readonly')
          area.style.position = 'fixed'
          area.style.top = '-1000px'
          document.body.appendChild(area)
          area.select()
          const done = document.execCommand('copy')
          document.body.removeChild(area)
          if (done) resolve(undefined)
          else reject(new Error('copy failed'))
        } catch (error) {
          reject(error)
        }
      })
    }

    async function fetchApi(method, payload, lang, signal) {
      const url = new URL(`${API_PREFIX}${method}?lang=${lang === 'zh' ? 'zh' : 'en'}`, document.baseURI)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
        signal,
        credentials: 'same-origin',
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok || body === null || body.ok !== true) {
        const message = body?.error?.message
        const failure = new Error(typeof message === 'string' && message !== '' ? message : `Request failed (${response.status})`)
        failure.code = body?.error?.code ?? `http-${response.status}`
        if (typeof body?.error?.detail === 'string') failure.detail = body.error.detail
        throw failure
      }
      return body.result
    }

    /**
     * Background catalog refresh. The job lives at module scope, so switching
     * to another panel (which unmounts this page) or reloading the GUI never
     * stops it — and the host-side job survives even that. Once the wait
     * passes 3 seconds a small floating toast appears until it lands.
     */
    const REFRESH_TOAST_DELAY_MS = 3000
    const REFRESH_POLL_MS = 1200
    const REFRESH_GIVE_UP_MS = 5 * 60 * 1000
    let catalogJob = { running: false, slow: false, startedAt: 0, finishedAt: 0, seq: 0, meta: null, error: '' }
    const catalogJobListeners = new Set()
    let catalogJobTimer = null
    let catalogJobHideTimer = null
    function notifyCatalogJob() {
      for (const listener of catalogJobListeners) listener()
    }
    function patchCatalogJob(patch) {
      catalogJob = { ...catalogJob, ...patch }
      notifyCatalogJob()
    }
    function subscribeCatalogJob(listener) {
      catalogJobListeners.add(listener)
      return () => catalogJobListeners.delete(listener)
    }
    function getCatalogJob() {
      return catalogJob
    }
    function stopCatalogJobTimers() {
      if (catalogJobTimer !== null) { clearTimeout(catalogJobTimer); catalogJobTimer = null }
      if (catalogJobHideTimer !== null) { clearTimeout(catalogJobHideTimer); catalogJobHideTimer = null }
    }
    function finishCatalogJob(meta, error) {
      if (catalogJobTimer !== null) { clearTimeout(catalogJobTimer); catalogJobTimer = null }
      if (catalogJobHideTimer !== null) clearTimeout(catalogJobHideTimer)
      patchCatalogJob({
        running: false,
        slow: error !== '',
        finishedAt: Date.now(),
        seq: catalogJob.seq + 1,
        meta,
        error,
      })
      if (error !== '') {
        // leave a failed refresh visible for a while, then fade out
        catalogJobHideTimer = setTimeout(() => patchCatalogJob({ slow: false }), 8000)
      }
    }
    function pollCatalogJob(lang) {
      if (catalogJobTimer !== null) clearTimeout(catalogJobTimer)
      catalogJobTimer = setTimeout(async () => {
        if (!catalogJob.running) return
        let status = null
        try {
          status = await fetchApi('refresh-status', {}, lang)
        } catch {
          if (Date.now() - catalogJob.startedAt > REFRESH_GIVE_UP_MS) finishCatalogJob(null, '')
          else pollCatalogJob(lang)
          return
        }
        if (!catalogJob.running) return
        if (status?.status === 'running') {
          const startedAt = typeof status.startedAt === 'number' && status.startedAt > 0 ? status.startedAt : catalogJob.startedAt
          patchCatalogJob({ startedAt, slow: Date.now() - startedAt > REFRESH_TOAST_DELAY_MS })
          if (Date.now() - startedAt > REFRESH_GIVE_UP_MS) {
            fetchApi('meta', { refresh: false }, lang).then((meta) => finishCatalogJob(meta, '')).catch(() => finishCatalogJob(null, ''))
            return
          }
          pollCatalogJob(lang)
          return
        }
        const failure = status?.status === 'error' && typeof status.message === 'string' ? status.message : ''
        fetchApi('meta', { refresh: false }, lang)
          .then((meta) => finishCatalogJob(meta, failure))
          .catch(() => finishCatalogJob(null, failure))
      }, REFRESH_POLL_MS)
    }
    function beginCatalogRefresh(lang) {
      if (catalogJob.running) return
      patchCatalogJob({ running: true, slow: false, startedAt: Date.now(), finishedAt: 0, meta: null, error: '' })
      // kick the host-side job; the reply only confirms it started, and any
      // failure still surfaces through the status poll below.
      fetchApi('meta', { refresh: true }, lang).catch(() => {})
      pollCatalogJob(lang)
    }
    function adoptCatalogRefresh(lang, startedAt) {
      if (catalogJob.running) return
      patchCatalogJob({ running: true, slow: Date.now() - startedAt > REFRESH_TOAST_DELAY_MS, startedAt, finishedAt: 0, meta: null, error: '' })
      pollCatalogJob(lang)
    }

    function facetCount(rows, id) {
      if (!Array.isArray(rows)) return null
      const row = rows.find((item) => item.id === id)
      return row === undefined ? null : row.count
    }

    /* ------------------------------------------------------------------ */
    /* icons                                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Market Dog sidebar mark: a reticle / scope crosshair — "lock onto the
     * target", matching the other line-art plugin icons (16px, 1.4 stroke,
     * currentColor). The illustrated hound is used in the masthead and the
     * marketplace icon instead, where it has room to read.
     */
    function ScopeIcon(props) {
      const options = props !== null && typeof props === 'object' ? props : {}
      const size = typeof options.size === 'number' ? options.size : 16
      const stroke = { stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true', focusable: 'false',
        style: { display: 'block' },
      },
        h('circle', { cx: 8, cy: 8, r: 4.9, ...stroke }),
        h('path', { d: 'M8 1.2v2.4M8 12.4v2.4M1.2 8h2.4M12.4 8h2.4', ...stroke }),
        h('circle', { cx: 8, cy: 8, r: 1.05, fill: 'currentColor' }),
      )
    }

    function PanelIcon() {
      return h(ScopeIcon, { size: 16 })
    }

    /* Author badge: entries published under the plugin author's GitHub
       account get a small nameless mark next to the title. The account was
       renamed from `zhang-eli` to `wzvx`; catalog entries under either
       login (any casing) still count as mine. */
    const AUTHOR_LOGINS = ['wzvx', 'zhang-eli']

    function isAuthorPlugin(entry) {
      return typeof entry.owner === 'string' && AUTHOR_LOGINS.includes(entry.owner.toLowerCase())
    }

    /* ------------------------------------------------------------------ */
    /* result row                                                         */
    /* ------------------------------------------------------------------ */

    function ResultRow(props) {
      const { entry, index, lang, selected, copied, t, onSelect, onCopy, installState, onInstall, onPreview } = props
      const key = entryKey(entry)
      const installInfo = installState !== null && typeof installState === 'object' ? installState : null
      const installStatus = installInfo !== null && typeof installInfo.status === 'string' ? installInfo.status : 'idle'
      const installMessage = installInfo !== null && typeof installInfo.message === 'string' ? installInfo.message : ''
      const installLabel = installStatus === 'installed'
        ? t('card.installed')
        : installStatus === 'installing'
          ? t('card.installing')
          : installStatus === 'failed'
            ? t('card.retry')
            : t('card.install')
      const description = localizedDescription(entry, lang)
      const downloads = entry.downloads === null || entry.downloads === undefined ? entry.githubReleaseDownloads : entry.downloads
      const meta = [h('span', { className: 'ps-owner', key: 'owner', title: entry.owner }, entry.owner)]
      const categoryLabel = entry.categoryLabel === undefined || entry.categoryLabel === '' ? entry.category : entry.categoryLabel
      if (categoryLabel) {
        meta.push(h('span', { className: 'ps-meta-div', key: 'div-cat' }))
        meta.push(h('span', { className: 'ps-cat', key: 'cat' }, categoryLabel))
      }
      return h('li', {
        className: `ps-row${selected ? ' is-selected' : ''}`,
        onClick: () => onSelect(key),
        'data-key': key,
      },
        h('span', { className: 'ps-rank' }, String(index + 1).padStart(2, '0')),
        h('div', { className: 'ps-row-main' },
          h('div', { className: 'ps-row-title' },
            h('a', {
              className: 'ps-name',
              href: entry.page || entry.url,
              target: '_blank',
              rel: 'noreferrer noopener',
              onClick: (event) => event.stopPropagation(),
            }, entry.name),
            entry.deprecated === true ? h('span', { className: 'ps-flag' }, t('card.deprecated')) : null,
            isAuthorPlugin(entry) ? h('span', { className: 'ps-author', title: t('card.authorTitle') }, t('card.author')) : null,
          ),
          h('p', { className: 'ps-row-desc', title: description }, description),
          h('div', { className: 'ps-row-meta' }, meta),
        ),
        h('span', { className: 'ps-stat' }, formatCount(entry.stars)),
        h('span', { className: 'ps-stat' }, formatCount(downloads)),
        h('button', {
          className: `ps-row-action${
            installStatus === 'installed' ? ' is-done' : ''
          }${installStatus === 'installing' ? ' is-busy' : ''}${installStatus === 'failed' ? ' is-failed' : ''
          }`,
          type: 'button',
          disabled: installStatus === 'installing',
          title: installMessage === '' ? undefined : installMessage,
          onClick: (event) => { event.stopPropagation(); onInstall(entry) },
        }, installLabel),
        selected
          ? h('div', { className: 'ps-row-detail' },
            h('div', { className: 'ps-detail-cmd' },
              h('code', null, entry.install ?? ''),
              h('button', {
                className: 'ps-detail-copy',
                type: 'button',
                onClick: (event) => { event.stopPropagation(); onCopy(entry) },
              }, copied ? t('card.copied') : t('card.copy')),
            ),
            Array.isArray(entry.screenshots) && entry.screenshots.length > 0
              ? h('div', { className: 'ps-shots' },
                h('span', { className: 'ps-shots-label' }, `${t('shots.label')} ${entry.screenshots.length}`),
                entry.screenshots.map((src, shotIndex) => h('button', {
                  className: 'ps-shot',
                  type: 'button',
                  key: `${src}#${shotIndex}`,
                  'data-empty': t('shots.empty'),
                  title: `${entry.name} · ${shotIndex + 1}/${entry.screenshots.length}`,
                  onClick: (event) => { event.stopPropagation(); onPreview(entry, shotIndex) },
                }, h('img', {
                  src,
                  alt: '',
                  loading: 'lazy',
                  decoding: 'async',
                  onError: (event) => {
                    const image = event.currentTarget
                    image.style.display = 'none'
                    if (image.parentElement !== null) image.parentElement.classList.add('is-broken')
                  },
                }))),
              )
              : null,
            h('div', { className: 'ps-detail-bottom' },
            h('div', { className: 'ps-detail-meta' },
              h('span', null, versionText(entry)),
              h('span', { className: 'ps-detail-dot' }, '·'),
              h('span', null, `${t('card.added')} ${typeof entry.added === 'string' ? shortDate(entry.added) : '—'}`),
            ),
            h('div', { className: 'ps-detail-links' },
              h('a', {
                className: 'ps-detail-link',
                href: entry.url,
                target: '_blank',
                rel: 'noreferrer noopener',
                onClick: (event) => event.stopPropagation(),
              }, t('card.github')),
              entry.npm === null || entry.npm === undefined
                ? null
                : h('a', {
                  className: 'ps-detail-link',
                  href: `https://www.npmjs.com/package/${entry.npm}`,
                  target: '_blank',
                  rel: 'noreferrer noopener',
                  onClick: (event) => event.stopPropagation(),
                }, t('card.npm')),
              h('a', {
                className: 'ps-detail-link',
                href: entry.page || entry.url,
                target: '_blank',
                rel: 'noreferrer noopener',
                onClick: (event) => event.stopPropagation(),
              }, t('card.market')),
            ),
            ),
          )
          : null,
        installStatus === 'failed' && installMessage !== ''
          ? h('div', { className: 'ps-row-failure' }, installMessage)
          : null,
      )
    }

    function ColumnHeader({ t }) {
      return h('div', { className: 'ps-cols' },
        h('span', null, '#'),
        h('span', null, t('col.package')),
        h('span', null, t('col.stars')),
        h('span', null, t('col.downloads')),
        h('span', null, ''),
      )
    }

    function SkeletonRows({ count }) {
      const rows = []
      for (let index = 0; index < count; index += 1) {
        rows.push(h('li', { className: 'ps-row is-skeleton', key: `skeleton-${index}` },
          h('span', { className: 'ps-skel is-rank' }),
          h('div', { className: 'ps-row-main' },
            h('span', { className: 'ps-skel is-name' }),
            h('span', { className: 'ps-skel is-desc' }),
            h('span', { className: 'ps-skel is-meta' }),
          ),
          h('span', { className: 'ps-skel is-stat' }),
          h('span', { className: 'ps-skel is-stat' }),
          h('span', { className: 'ps-skel is-stat' }),
          h('span', { className: 'ps-skel is-action' }),
        ))
      }
      return h('ul', { className: 'ps-list ps-skeleton', 'aria-hidden': 'true' }, rows)
    }

    /* ------------------------------------------------------------------ */
    /* page                                                               */
    /* ------------------------------------------------------------------ */

    function ScoutPage({ t, localeSource }) {
      const snapshot = useSyncExternalStore(localeSource.subscribe, localeSource.getSnapshot)
      const lang = languageOf(localeCodeOf(snapshot))
      const scheme = useColorScheme()

      const [text, setText] = useState(() => readStored(STORAGE_DESCRIPTION, ''))
      const [sort, setSort] = useState(() => (readStored(STORAGE_SORT, 'relevance') === 'downloads' ? 'downloads' : 'relevance'))
      const [filters, setFilters] = useState(readFilters)
      const [results, setResults] = useState(null)
      const [phase, setPhase] = useState('idle')
      const [refreshing, setRefreshing] = useState(false)
      const [error, setError] = useState(null)
      const [meta, setMeta] = useState(null)
      const [metaBusy, setMetaBusy] = useState(false)
      const [selected, setSelected] = useState('')
      const [copied, setCopied] = useState('')
      const [showAllCategories, setShowAllCategories] = useState(false)
      const [railWidth, setRailWidth] = useState(() => {
        const stored = Number.parseInt(readStored(STORAGE_RAIL_WIDTH, ''), 10)
        return Number.isFinite(stored) ? clampRailWidth(stored) : RAIL_DEFAULT_WIDTH
      })
      const [railCollapsed, setRailCollapsed] = useState(() => readStored(STORAGE_RAIL_COLLAPSED, '0') === '1')
      const [railDragging, setRailDragging] = useState(false)
      const [installs, setInstalls] = useState({})
      const [preview, setPreview] = useState(null)
      const [installed, setInstalled] = useState(null)

      const abortRef = useRef(null)
      const searchSeq = useRef(0)
      const copyTimer = useRef(null)
      const lastRun = useRef({ text: '', sort: 'relevance', filters: { ...EMPTY_FILTERS, capabilities: [] } })
      const booted = useRef(false)
      const catalogSnapshot = useSyncExternalStore(subscribeCatalogJob, getCatalogJob)
      const jobSeqSeen = useRef(catalogSnapshot.seq)

      const runSearch = useCallback((options = {}) => {
        // Browse (rail double-click) has no query; it sticks until a caller
        // supplies text or an explicit browse flag, so facet/sort tweaks keep it.
        const browsing = options.browse === true
          || (options.browse === undefined && options.text === undefined && lastRun.current.browse === true)
        const nextText = typeof options.text === 'string' ? options.text : (browsing ? '' : text)
        const nextSort = options.sort === 'downloads' || options.sort === 'relevance' ? options.sort : sort
        const nextFilters = options.filters === undefined ? filters : options.filters
        lastRun.current = { text: nextText, sort: nextSort, filters: nextFilters, browse: browsing }
        setSelected('')

        if (!browsing && nextText.trim() === '') {
          if (abortRef.current !== null) abortRef.current.abort()
          setPhase('idle')
          setResults(null)
          setError(null)
          setRefreshing(false)
          return
        }

        if (abortRef.current !== null) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller
        const sequence = searchSeq.current + 1
        searchSeq.current = sequence
        setError(null)
        setRefreshing(true)
        setPhase((previous) => (previous === 'done' ? previous : 'loading'))

        fetchApi('search', {
          description: nextText,
          browse: browsing ? true : undefined,
          limit: LIMIT,
          sort: nextSort,
          filters: {
            category: nextFilters.category,
            capabilities: [],
            updatedWithin: nextFilters.updatedWithin,
            starsMin: nextFilters.starsMin,
          },
          refresh: options.refresh === true,
        }, lang, controller.signal).then((result) => {
          if (sequence !== searchSeq.current) return
          setResults(result)
          setPhase('done')
          setRefreshing(false)
          writeStored(STORAGE_DESCRIPTION, nextText)
          writeStored(STORAGE_FILTERS, JSON.stringify(nextFilters))
        }).catch((failure) => {
          if (sequence !== searchSeq.current) return
          if (failure?.name === 'AbortError') return
          setError({
            message: failure instanceof Error ? failure.message : String(failure),
            detail: typeof failure?.detail === 'string' ? failure.detail : '',
          })
          setPhase('error')
          setRefreshing(false)
        })
      }, [text, sort, filters, lang])

      /* catalog meta once per language */
      useEffect(() => {
        let cancelled = false
        const controller = new AbortController()
        setMetaBusy(true)
        fetchApi('meta', { refresh: false }, lang, controller.signal)
          .then((result) => { if (!cancelled) setMeta(result) })
          .catch(() => {})
          .finally(() => { if (!cancelled) setMetaBusy(false) })
        return () => { cancelled = true; controller.abort() }
      }, [lang])

      /* adopt a refresh that the host is still running (started from another
         view, another window, or before this page was reloaded) */
      useEffect(() => {
        if (catalogJob.running) return undefined
        let cancelled = false
        const controller = new AbortController()
        fetchApi('refresh-status', {}, lang, controller.signal)
          .then((status) => {
            if (cancelled || status?.status !== 'running') return
            adoptCatalogRefresh(lang, typeof status.startedAt === 'number' && status.startedAt > 0 ? status.startedAt : Date.now())
          })
          .catch(() => {})
        return () => { cancelled = true; controller.abort() }
      }, [lang])

      /* when a background refresh lands: update the catalog line, then
         re-run the last query against the freshly built index */
      useEffect(() => {
        if (catalogSnapshot.seq === jobSeqSeen.current) return
        jobSeqSeen.current = catalogSnapshot.seq
        if (catalogSnapshot.meta !== null && catalogSnapshot.meta !== undefined) setMeta(catalogSnapshot.meta)
        if (catalogSnapshot.running) return
        const previous = lastRun.current
        if (previous.text.trim() !== '') {
          runSearch({ text: previous.text, sort: previous.sort, filters: previous.filters, browse: previous.browse === true })
        }
      }, [catalogSnapshot])

      /* which catalog packages the profile already has installed */
      useEffect(() => {
        let cancelled = false
        const controller = new AbortController()
        fetchApi('installed', {}, lang, controller.signal)
          .then((result) => {
            if (cancelled) return
            const names = Array.isArray(result?.names) ? result.names.filter((name) => typeof name === 'string') : []
            setInstalled(new Set(names))
          })
          .catch(() => {})
        return () => { cancelled = true; controller.abort() }
      }, [lang])

      /* resume the last query on first mount */
      useEffect(() => {
        if (booted.current) return
        booted.current = true
        if (text.trim() !== '') runSearch({ text, sort, filters })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      useEffect(() => () => {
        if (copyTimer.current !== null) clearTimeout(copyTimer.current)
      }, [])

      /* preview overlay: Esc closes, arrows step */
      useEffect(() => {
        if (preview === null) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setPreview(null)
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            stepPreview(-1)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            stepPreview(1)
          }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [preview])

      function openPreview(entry, index) {
        const total = Array.isArray(entry.screenshots) ? entry.screenshots.length : 0
        if (total === 0) return
        setPreview({ entry, index: Math.min(Math.max(index, 0), total - 1) })
      }

      function closePreview() {
        setPreview(null)
      }

      /* scrollbars stay invisible until the column actually scrolls */
      function flashScroll(event) {
        const el = event.currentTarget
        el.classList.add('is-scrolling')
        if (el._scrollFlash !== undefined) clearTimeout(el._scrollFlash)
        el._scrollFlash = window.setTimeout(() => {
          el.classList.remove('is-scrolling')
          el._scrollFlash = undefined
        }, 700)
      }

      function stepPreview(delta) {
        setPreview((current) => {
          if (current === null) return null
          const total = Array.isArray(current.entry.screenshots) ? current.entry.screenshots.length : 0
          if (total === 0) return null
          return { entry: current.entry, index: (current.index + delta + total) % total }
        })
      }

      const submitQuery = (event) => {
        if (event !== undefined && typeof event.preventDefault === 'function') event.preventDefault()
        runSearch({ text })
      }

      const clearQuery = () => {
        setText('')
        setSelected('')
        setError(null)
        setPhase('idle')
        setResults(null)
        setRefreshing(false)
        lastRun.current = { text: '', sort, filters, browse: false }
        writeStored(STORAGE_DESCRIPTION, '')
      }

      const pickExample = (example) => {
        setText(example)
        runSearch({ text: example })
      }

      const changeSort = (next) => {
        if (next === sort) return
        // browsing has no query to be "relevant" to; downloads is the only order
        if (lastRun.current.browse === true && next === 'relevance') return
        setSort(next)
        writeStored(STORAGE_SORT, next)
        runSearch({ sort: next })
      }

      const applyFilters = (patch) => {
        const next = { ...filters, ...patch }
        setFilters(next)
        setSelected('')
        runSearch({ filters: next })
      }

      /* Double-clicking a category browses the whole category by downloads. The
      plain click still toggles the facet but waits a beat so the second click
      of a double-click can cancel it. */
      const categoryClickTimer = useRef(null)
      const clearCategoryClick = () => {
        if (categoryClickTimer.current !== null) { clearTimeout(categoryClickTimer.current); categoryClickTimer.current = null }
      }
      const pickCategory = (id) => {
        clearCategoryClick()
        categoryClickTimer.current = setTimeout(() => {
          categoryClickTimer.current = null
          applyFilters({ category: id })
        }, 220)
      }
      const browseCategory = (id) => {
        clearCategoryClick()
        const next = { ...filters, category: id }
        setFilters(next)
        setSort('downloads')
        writeStored(STORAGE_SORT, 'downloads')
        runSearch({ browse: true, text: '', sort: 'downloads', filters: next })
      }

      const resetFilters = () => {
        const next = { category: '', updatedWithin: 0, starsMin: 0, capabilities: [] }
        setFilters(next)
        setSelected('')
        runSearch({ filters: next })
      }

      const refreshCatalog = () => {
        // the job runs at module scope: switching views or reloading keeps it going
        beginCatalogRefresh(lang)
      }

      const copyInstall = (entry) => {
        copyText(entry.install ?? entry.name).then(() => {
          setCopied(entryKey(entry))
          if (copyTimer.current !== null) clearTimeout(copyTimer.current)
          copyTimer.current = setTimeout(() => setCopied(''), 1600)
        }).catch(() => {})
      }

      const installPlugin = (entry) => {
        const key = entryKey(entry)
        const previous = installs[key]
        if (previous !== undefined && (previous.status === 'installing' || previous.status === 'installed')) return
        setInstalls((state) => ({ ...state, [key]: { status: 'installing', message: '' } }))
        fetchApi('install', { name: entry.name }, lang)
          .then((result) => {
            const failure = result !== null && typeof result === 'object' ? result.error : null
            const pending = result !== null && typeof result === 'object' && Array.isArray(result.pendingBuilds) ? result.pendingBuilds : []
            if (failure !== null && failure !== undefined) {
              const message = [failure.diagnostic, failure.message].filter((value) => typeof value === 'string' && value !== '').join(' · ')
              setInstalls((state) => ({ ...state, [key]: { status: 'failed', message } }))
              return
            }
            if (result.application === 'failed' || result.application === 'cancelled') {
              const warnings = Array.isArray(result.warnings) ? result.warnings.filter((value) => typeof value === 'string' && value !== '').join(' · ') : ''
              setInstalls((state) => ({ ...state, [key]: { status: 'failed', message: warnings } }))
              return
            }
            setInstalls((state) => ({ ...state, [key]: { status: 'installed', message: pending.length > 0 ? t('card.buildPending') : '' } }))
            setInstalled((state) => {
              const next = new Set(state ?? [])
              if (typeof result.bundle === 'string' && result.bundle !== '') next.add(result.bundle)
              next.add(entry.name)
              if (typeof entry.npm === 'string' && entry.npm !== '') next.add(entry.npm)
              return next
            })
          })
          .catch((err) => {
            const detail = err !== null && typeof err === 'object' && typeof err.detail === 'string' ? err.detail : ''
            const message = detail !== '' ? detail : (err instanceof Error ? err.message : '')
            setInstalls((state) => ({ ...state, [key]: { status: 'failed', message } }))
          })
      }

      const entries = results !== null && Array.isArray(results.entries) ? results.entries : []
      const facets = results !== null && results.facets !== null && typeof results.facets === 'object'
        ? results.facets
        : { categories: [], capabilities: [], updated: [], stars: [] }
      const totalMatched = typeof results?.totalMatched === 'number'
        ? results.totalMatched
        : (typeof results?.matched === 'number' ? results.matched : 0)
      const matched = typeof results?.matched === 'number' ? results.matched : 0
      const catalogCount = typeof meta?.count === 'number'
        ? meta.count
        : (typeof results?.catalogCount === 'number' ? results.catalogCount : 0)
      const narrowed = totalMatched > matched
      const activeFilterCount = (filters.category === '' ? 0 : 1)
        + (filters.updatedWithin > 0 ? 1 : 0)
        + (filters.starsMin > 0 ? 1 : 0)

      const metaText = meta === null
        ? t('meta.loading')
        : `${typeof meta.updated === 'string' ? meta.updated : '—'} / ${formatNumber(meta.count)} ${t('meta.entries')}${meta.stale === true ? ` · ${t('meta.stale')}` : ''}`

      const categoriesSource = facets.categories.length > 0
        ? facets.categories
        : (meta !== null && Array.isArray(meta.categories)
          ? meta.categories.map((row) => ({ id: row.id, label: row.label, count: null }))
          : [])
      const categoryTotal = categoriesSource.length
      const categoriesShown = showAllCategories ? categoriesSource : categoriesSource.slice(0, CATEGORY_VISIBLE)

      const catalogFallback = meta === null || typeof meta.count !== 'number' ? null : meta.count

      const filterGroup = (key, label, options, isActive, onPick, mono, extra, onDoublePick, doubleTitle) => h('div', { className: 'ps-group', key },
        h('span', { className: 'ps-group-label' }, label),
        options.map((option) => h('button', {
          className: `ps-opt${isActive(option.id) ? ' is-on' : ''}${mono ? ' ps-opt-mono' : ''}`,
          key: `${key}-${option.id === '' ? 'all' : option.id}`,
          type: 'button',
          'aria-pressed': isActive(option.id),
          onClick: () => onPick(option.id),
          onDoubleClick: onDoublePick === undefined ? undefined : (event) => { event.preventDefault(); onDoublePick(option.id) },
          title: onDoublePick === undefined || doubleTitle === undefined ? undefined : doubleTitle,
        },
          h('span', { className: 'ps-opt-label' }, option.label),
          option.count === null || option.count === undefined
            ? null
            : h('span', { className: 'ps-opt-count' }, formatNumber(option.count)),
        )),
        extra ?? null,
      )

      const categoryOptions = [
        { id: '', label: t('filters.all'), count: results === null ? catalogFallback : totalMatched },
        ...categoriesShown.map((row) => ({ id: row.id, label: row.label, count: row.count })),
      ]
      const updatedOptions = [
        { id: '0', label: t('filters.all'), count: results === null ? catalogFallback : totalMatched },
        ...UPDATED_WINDOWS.map((days) => ({
          id: String(days),
          label: t(`filters.updated.${days}`),
          count: facetCount(facets.updated, String(days)),
        })),
      ]
      const starOptions = [
        { id: '0', label: t('filters.all'), count: results === null ? catalogFallback : totalMatched },
        ...STAR_THRESHOLDS.map((floor) => ({
          id: String(floor),
          label: `${formatNumber(floor)}+`,
          count: facetCount(facets.stars, String(floor)),
        })),
      ]
      const keywordLabels = results !== null && Array.isArray(results.keywords)
        ? results.keywords.map((keyword) => keyword.label).filter((label) => typeof label === 'string' && label !== '')
        : []
      const keywordShown = keywordLabels.slice(0, 5)

      const examples = Array.isArray(EXAMPLES[lang]) ? EXAMPLES[lang] : EXAMPLES.en
      const busy = refreshing && entries.length > 0

      const searchForm = h('form', { className: 'ps-search', onSubmit: submitQuery, role: 'search' },
        h('input', {
          className: 'ps-search-input',
          type: 'text',
          value: text,
          placeholder: t('query.placeholder'),
          'aria-label': t('query.label'),
          autoComplete: 'off',
          spellCheck: false,
          onChange: (event) => setText(event.target.value),
        }),
        text === ''
          ? null
          : h('button', {
            className: 'ps-search-clear',
            type: 'button',
            onClick: clearQuery,
            'aria-label': t('query.clear'),
            title: t('query.clear'),
          }, '×'),
        h('button', { className: 'ps-search-go', type: 'submit' }, t('query.submit')),
      )

      const catalogBlock = h('div', { className: 'ps-catalog' },
        h('span', { className: 'ps-catalog-text', title: typeof meta?.catalogUrl === 'string' ? meta.catalogUrl : '' }, metaText),
        h('button', {
          className: 'ps-refresh',
          type: 'button',
          onClick: refreshCatalog,
          disabled: metaBusy || catalogSnapshot.running,
          title: t('meta.refresh'),
          'aria-label': t('meta.refresh'),
        }, metaBusy || catalogSnapshot.running ? '···' : '⟳'),
      )

      const toggleRail = useCallback(() => {
        setRailCollapsed((value) => {
          const next = !value
          writeStored(STORAGE_RAIL_COLLAPSED, next ? '1' : '0')
          return next
        })
      }, [])

      const resetRailWidth = useCallback(() => {
        setRailWidth(RAIL_DEFAULT_WIDTH)
        writeStored(STORAGE_RAIL_WIDTH, String(RAIL_DEFAULT_WIDTH))
      }, [])

      const nudgeRailWidth = useCallback((delta) => {
        const next = clampRailWidth(railWidth + delta)
        setRailWidth(next)
        writeStored(STORAGE_RAIL_WIDTH, String(next))
      }, [railWidth])

      const startRailResize = useCallback((event) => {
        if (event === null || typeof event !== 'object' || event.button !== 0) return
        event.preventDefault()
        const startX = event.clientX
        const startWidth = railWidth
        let latest = startWidth
        setRailDragging(true)
        const onMove = (moveEvent) => {
          latest = clampRailWidth(startWidth + (moveEvent.clientX - startX))
          setRailWidth(latest)
        }
        const finish = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', finish)
          window.removeEventListener('pointercancel', finish)
          setRailDragging(false)
          writeStored(STORAGE_RAIL_WIDTH, String(latest))
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', finish)
        window.addEventListener('pointercancel', finish)
      }, [railWidth])

      const railToggleLabel = railCollapsed
        ? `${t('filters.show')}${activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}`
        : t('filters.hide')

      const toolbar = h('div', { className: 'ps-toolbar' },
        h('button', {
          className: 'ps-rail-toggle',
          type: 'button',
          onClick: toggleRail,
          'aria-expanded': railCollapsed ? 'false' : 'true',
          'aria-controls': 'ps-rail',
          title: railToggleLabel,
        }, railToggleLabel),
        h('div', { className: 'ps-summary', role: 'status' },
          results === null ? null : h('b', null, formatNumber(matched)),
          results === null ? null : h('span', null, t('results.matches')),
          narrowed
            ? h('span', { className: 'ps-summary-sub' }, t('results.filtered').replace('{n}', formatNumber(totalMatched)))
            : null,
          catalogCount > 0
            ? h('span', { className: results === null ? 'ps-summary-sub ps-summary-lead' : 'ps-summary-sub' }, t('results.catalogued').replace('{n}', formatNumber(catalogCount)))
            : null,
          busy ? h('span', { className: 'ps-summary-live' }, t('results.refreshing')) : null,
        ),
        keywordShown.length === 0
          ? null
          : h('div', { className: 'ps-terms' },
            h('span', { className: 'ps-terms-label' }, t('results.understood')),
            keywordShown.map((label) => h('span', { className: 'ps-term', key: label }, label)),
            keywordLabels.length > keywordShown.length
              ? h('span', { className: 'ps-term' }, `+${keywordLabels.length - keywordShown.length}`)
              : null,
          ),
        h('div', { className: 'ps-sort', role: 'group', 'aria-label': t('sort.label') },
          h('button', {
            className: `ps-sort-btn${sort === 'relevance' ? ' is-on' : ''}`,
            type: 'button',
            onClick: () => changeSort('relevance'),
          }, t('sort.relevance')),
          h('button', {
            className: `ps-sort-btn${sort === 'downloads' ? ' is-on' : ''}`,
            type: 'button',
            onClick: () => changeSort('downloads'),
          }, t('sort.downloads')),
        ),
      )

      const errorBox = error === null || phase !== 'error'
        ? null
        : h('div', { className: 'ps-error', role: 'alert' },
          h('div', { className: 'ps-error-body' },
            h('p', { className: 'ps-error-title' }, t('error.title')),
            h('p', { className: 'ps-error-msg' }, error.message),
            error.detail === '' ? null : h('p', { className: 'ps-error-detail' }, error.detail),
          ),
          h('button', {
            className: 'ps-error-retry',
            type: 'button',
            onClick: () => runSearch({ ...lastRun.current }),
          }, t('error.retry')),
        )

      let content = null
      if (phase === 'idle') {
        content = h('section', { className: 'ps-empty' },
          h('div', { className: 'ps-empty-main' },
            h('h2', { className: 'ps-empty-title' }, t('empty.title')),
            h('p', { className: 'ps-empty-body' }, t('empty.body')),
          ),
          h('div', { className: 'ps-empty-aside' },
            h('span', { className: 'ps-empty-label' }, t('query.examples')),
            h('ol', { className: 'ps-examples' },
              examples.map((example, index) => h('li', { key: example },
                h('button', {
                  className: 'ps-example',
                  type: 'button',
                  onClick: () => pickExample(example),
                },
                  h('span', { className: 'ps-example-index' }, String(index + 1).padStart(2, '0')),
                  h('span', { className: 'ps-example-text' }, example),
                ),
              )),
            ),
          ),
        )
      } else if (entries.length > 0) {
        content = h('ul', { className: 'ps-list' },
          entries.map((entry, index) => h(ResultRow, {
            key: entryKey(entry),
            entry,
            index,
            lang,
            t,
            selected: selected === entryKey(entry),
            copied: copied === entryKey(entry),
            installState: installs[entryKey(entry)] ?? (
              installed !== null && (installed.has(entry.name) || (typeof entry.npm === 'string' && installed.has(entry.npm)))
                ? { status: 'installed', message: '' }
                : undefined
            ),
            onSelect: (key) => setSelected((current) => (current === key ? '' : key)),
            onCopy: copyInstall,
            onInstall: installPlugin,
            onPreview: openPreview,
          })),
        )
      } else if (phase === 'loading') {
        content = h('div', null,
          h('p', { className: 'ps-loading-hint' }, t('results.loadingHint')),
          h(SkeletonRows, { count: SKELETON_ROWS }),
        )
      } else if (phase === 'done') {
        content = h('section', { className: 'ps-none' },
          h('h2', { className: 'ps-none-title' }, t('none.title')),
          h('p', { className: 'ps-none-body' }, t('none.body')),
          activeFilterCount > 0
            ? h('button', { className: 'ps-none-clear', type: 'button', onClick: resetFilters }, t('none.clear'))
            : null,
        )
      } else {
        content = h(SkeletonRows, { count: 6 })
      }

      const showColumns = phase !== 'idle' && phase !== 'error'

      return h('div', { className: `ps-page is-${scheme}`, style: { '--ps-rail-user': `${railWidth}px` } },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h('div', { className: 'ps-shell' },
          h('header', { className: 'ps-top' },
            h('div', { className: 'ps-brand' },
              h('span', { className: 'ps-brand-mark', 'aria-hidden': 'true' },
                h('img', {
                  className: 'ps-brand-logo',
                  src: new URL(`${ASSET_PREFIX}logo.png`, document.baseURI).href,
                  width: 44, height: 44, alt: '',
                }),
              ),
              h('span', { className: 'ps-brand-text' },
                h('span', { className: 'ps-brand-name' }, t('nav.label')),
              ),
            ),
            h('div', { className: 'ps-top-right' }, searchForm, catalogBlock),
          ),
          h('div', { className: `ps-body${railCollapsed ? ' is-collapsed' : ''}` },
            h('aside', { className: 'ps-rail', id: 'ps-rail', 'aria-label': t('filters.title') },
              h('div', {
                className: `ps-rail-grip${railDragging ? ' is-dragging' : ''}`,
                role: 'separator',
                'aria-orientation': 'vertical',
                'aria-label': t('filters.resize'),
                'aria-valuemin': RAIL_MIN_WIDTH,
                'aria-valuemax': RAIL_MAX_WIDTH,
                'aria-valuenow': Math.round(railWidth),
                tabIndex: 0,
                title: t('filters.resize'),
                onPointerDown: startRailResize,
                onDoubleClick: resetRailWidth,
                onKeyDown: (keyEvent) => {
                  if (keyEvent.key !== 'ArrowLeft' && keyEvent.key !== 'ArrowRight') return
                  keyEvent.preventDefault()
                  nudgeRailWidth(keyEvent.key === 'ArrowLeft' ? -16 : 16)
                },
              }),
              h('div', { className: 'ps-rail-scroll', onScroll: flashScroll },
                h('div', { className: 'ps-rail-head' },
                  h('h2', { className: 'ps-rail-title' }, t('filters.title')),
                  activeFilterCount === 0
                    ? null
                    : h('button', { className: 'ps-rail-reset', type: 'button', onClick: resetFilters }, `${t('filters.reset')} ${activeFilterCount}`),
                ),
                filterGroup('category', t('filters.category'), categoryOptions,
                  (id) => filters.category === id,
                  (id) => pickCategory(id),
                  false,
                  categoryTotal > CATEGORY_VISIBLE
                    ? h('button', {
                      className: 'ps-opt-more',
                      type: 'button',
                      key: 'category-more',
                      onClick: () => setShowAllCategories((value) => !value),
                    }, showAllCategories ? t('filters.less') : t('filters.more').replace('{n}', String(categoryTotal - CATEGORY_VISIBLE)))
                    : null,
                  (id) => browseCategory(id),
                  t('filters.browseHint')),
                filterGroup('updated', t('filters.updated'), updatedOptions,
                  (id) => String(filters.updatedWithin) === id,
                  (id) => applyFilters({ updatedWithin: Number(id) })),
                filterGroup('stars', t('filters.stars'), starOptions,
                  (id) => String(filters.starsMin) === id,
                  (id) => applyFilters({ starsMin: Number(id) })),
              ),
            ),
            h('main', { className: `ps-results${busy ? ' is-busy' : ''}`, onScroll: flashScroll },
              errorBox,
              toolbar,
              showColumns ? h(ColumnHeader, { t }) : null,
              content,
            ),
          ),
        ),
        catalogSnapshot.slow
          ? h('div', {
            className: 'ps-toast' + (!catalogSnapshot.running && catalogSnapshot.error !== '' ? ' is-error' : ''),
            role: 'status',
          },
            h('span', { className: 'ps-toast-dot', 'aria-hidden': 'true' }),
            h('span', { className: 'ps-toast-text' },
              catalogSnapshot.running
                ? t('toast.indexing')
                : t('toast.indexFailed') + ': ' + catalogSnapshot.error))
          : null,
        preview === null
          ? null
          : h('div', {
            className: 'ps-lb',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': `${t('shots.label')} ${preview.entry.name}`,
            onClick: closePreview,
          },
            h('div', { className: 'ps-lb-bar', onClick: (event) => event.stopPropagation() },
              h('span', { className: 'ps-lb-name' }, preview.entry.name),
              h('span', {
                className: 'ps-lb-count',
              }, `${preview.index + 1} / ${preview.entry.screenshots.length}`),
              h('button', {
                className: 'ps-lb-close',
                type: 'button',
                onClick: closePreview,
              }, `× ${t('shots.close')}`),
            ),
            h('div', {
              className: 'ps-lb-stage',
              'data-fail': t('shots.empty'),
              onClick: (event) => event.stopPropagation(),
            },
              h('img', {
                className: 'ps-lb-img',
                src: preview.entry.screenshots[preview.index],
                alt: '',
                decoding: 'async',
                onError: (event) => {
                  const stage = event.currentTarget.parentElement
                  if (stage !== null) stage.classList.add('is-failed')
                },
              }),
            ),
            preview.entry.screenshots.length > 1
              ? h('button', {
                className: 'ps-lb-nav is-prev',
                type: 'button',
                'aria-label': t('shots.prev'),
                onClick: (event) => { event.stopPropagation(); stepPreview(-1) },
              }, '‹')
              : null,
            preview.entry.screenshots.length > 1
              ? h('button', {
                className: 'ps-lb-nav is-next',
                type: 'button',
                'aria-label': t('shots.next'),
                onClick: (event) => { event.stopPropagation(); stepPreview(1) },
              }, '›')
              : null,
            h('p', { className: 'ps-lb-hint' }, t('shots.hint')),
          ),
      )
    }

    /* ------------------------------------------------------------------ */
    /* stylesheet                                                         */
    /* ------------------------------------------------------------------ */

    const CSS = `
.ps-page {
  --ps-sans: "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI Variable Text", "Aptos", "Helvetica Neue", "PingFang SC", sans-serif;
  --ps-mono: "Cascadia Mono", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --ps-display: "Bahnschrift", "Segoe UI Semibold", "Segoe UI", "Franklin Gothic Medium", "Helvetica Neue", sans-serif;
  --ps-serif: "Constantia", "Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif;
  --ps-top: 62px;
  --ps-rail: var(--ps-rail-user, 256px);
  --ps-row: 36px minmax(0, 1fr) 78px 88px 92px;
  --ps-pad: 20px;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--ps-bg);
  color: var(--ps-ink);
  font-family: var(--ps-sans);
  font-size: 14.9px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}
/* app shell: header and footer stay put, each column scrolls on its own */
.ps-shell {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  border-left: 1px solid var(--ps-hairline);
  border-right: 1px solid var(--ps-hairline);
}
.ps-page.is-dark {
  --ps-bg: var(--dsw-alias-bg-base, #16181B);
  --ps-surface: var(--dsw-alias-bg-layer-1, #1B1E21);
  --ps-surface-hover: var(--dsw-alias-bg-layer-2, #202429);
  --ps-hairline: var(--dsw-alias-border-l1, #2A2F33);
  --ps-hairline-strong: var(--dsw-alias-border-l2, #3A4045);
  --ps-ink: var(--dsw-alias-label-primary, #E8EAE7);
  --ps-ink-2: var(--dsw-alias-label-secondary, #A9AFA8);
  --ps-ink-3: color-mix(in srgb, var(--dsw-alias-label-secondary, #A9AFA8) 66%, transparent);
  --ps-accent: #C3A161;
  --ps-accent-ink: #17130C;
  --ps-error: #C97B6B;
  --ps-warn: #C9A96B;
  --ps-ok: #8FA47E;
}
.ps-page.is-light {
  --ps-bg: var(--dsw-alias-bg-base, #F7F7F4);
  --ps-surface: var(--dsw-alias-bg-layer-1, #FFFFFF);
  --ps-surface-hover: var(--dsw-alias-bg-layer-2, #EFEFEA);
  --ps-hairline: var(--dsw-alias-border-l1, #DFDFD9);
  --ps-hairline-strong: var(--dsw-alias-border-l2, #C6C6BE);
  --ps-ink: var(--dsw-alias-label-primary, #1A1C19);
  --ps-ink-2: var(--dsw-alias-label-secondary, #55594F);
  --ps-ink-3: color-mix(in srgb, var(--dsw-alias-label-secondary, #55594F) 70%, transparent);
  --ps-accent: #7A5B24;
  --ps-accent-ink: #FBF6E9;
  --ps-error: #9C4534;
  --ps-warn: #7E5F24;
  --ps-ok: #4E6B44;
}
.ps-page *, .ps-page *::before, .ps-page *::after { box-sizing: border-box; }
.ps-page :focus-visible { outline: 2px solid var(--ps-accent); outline-offset: 2px; }
.ps-page ::selection { background: color-mix(in srgb, var(--ps-accent) 32%, transparent); color: var(--ps-ink); }
.ps-page ::-webkit-scrollbar { width: 10px; height: 10px; }
.ps-page ::-webkit-scrollbar-thumb { background: var(--ps-hairline-strong); border: 3px solid var(--ps-bg); }
.ps-page ::-webkit-scrollbar-track { background: transparent; }
.ps-top {
  position: relative;
  flex: 0 0 auto;
  z-index: 5;
  display: grid;
  grid-template-columns: var(--ps-rail) minmax(0, 1fr);
  align-items: stretch;
  height: var(--ps-top);
  background: var(--ps-bg);
  border-bottom: 1px solid var(--ps-hairline-strong);
}
.ps-top::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 3px;
  height: 1px;
  background: var(--ps-hairline);
  pointer-events: none;
}
.ps-brand {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0 20px;
  border-right: 1px solid var(--ps-hairline);
}
.ps-brand-mark {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--ps-ink);
}
.ps-brand-logo {
  display: block;
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.ps-brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ps-brand-name {
  font-family: "Cambria", var(--ps-serif);
  font-size: 20px;
  font-weight: 400;
  line-height: 1.32;
  letter-spacing: 0.012em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ps-top-right {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
  padding: 0 var(--ps-pad);
}
.ps-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  border-bottom: 1px solid var(--ps-hairline-strong);
  transition: border-color 0.12s ease;
}
.ps-search:focus-within { border-bottom-color: var(--ps-accent); }
.ps-search-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ps-ink);
  font-family: var(--ps-mono);
  font-size: 13.8px;
  letter-spacing: 0.01em;
  padding: 9px 0;
  outline: none;
  caret-color: var(--ps-accent);
}
.ps-search-input::placeholder { color: var(--ps-ink-3); }
.ps-search-clear {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--ps-ink-3);
  font-family: var(--ps-mono);
  font-size: 16.1px;
  line-height: 1;
  padding: 4px 2px;
  cursor: pointer;
}
.ps-search-clear:hover { color: var(--ps-ink); }
.ps-search-go {
  flex: 0 0 auto;
  border: 1px solid var(--ps-hairline-strong);
  background: transparent;
  color: var(--ps-ink);
  font-family: var(--ps-mono);
  font-size: 10.9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 6px 10px;
  cursor: pointer;
}
.ps-search-go:hover { background: var(--ps-accent); border-color: var(--ps-accent); color: var(--ps-accent-ink); }
.ps-catalog { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.ps-catalog-text {
  font-family: var(--ps-mono);
  font-size: 10.9px;
  letter-spacing: 0.04em;
  color: var(--ps-ink-3);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.ps-refresh {
  border: 1px solid transparent;
  background: transparent;
  color: var(--ps-ink-2);
  font-family: var(--ps-mono);
  font-size: 13.8px;
  line-height: 1;
  padding: 4px 6px;
  cursor: pointer;
}
.ps-refresh:hover { color: var(--ps-ink); border-color: var(--ps-hairline-strong); }
.ps-refresh[disabled] { opacity: 0.5; cursor: default; }
.ps-toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 120;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(480px, 80vw);
  padding: 8px 14px 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--ps-hairline-strong);
  background: var(--ps-surface);
  color: var(--ps-ink);
  font-size: 12.5px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  animation: ps-toast-in 0.22s ease-out;
}
.ps-toast.is-error { border-color: color-mix(in srgb, #C4553B 55%, var(--ps-hairline-strong)); }
.ps-toast-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ps-accent);
  animation: ps-toast-pulse 1.1s ease-in-out infinite;
}
.ps-toast.is-error .ps-toast-dot { background: #C4553B; animation: none; }
.ps-toast.is-error ~ .ps-toast-text { color: #C4553B; }
.ps-toast-text { overflow-wrap: anywhere; }
@keyframes ps-toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes ps-toast-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.ps-body {
  display: grid;
  grid-template-columns: var(--ps-rail) minmax(0, 1fr);
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
/* the aside never scrolls, so the grip can sit on the divider instead of under the scrollbar */
.ps-rail {
  position: relative;
  align-self: stretch;
  min-height: 0;
  overflow: visible;
  border-right: 1px solid var(--ps-hairline);
}
.ps-rail-scroll {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px 0 22px;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.ps-rail-scroll::-webkit-scrollbar-thumb { background: transparent; border: 3px solid var(--ps-bg); }
.ps-rail-scroll.is-scrolling,
.ps-results.is-scrolling { scrollbar-color: var(--ps-hairline-strong) transparent; }
.ps-rail-scroll.is-scrolling::-webkit-scrollbar-thumb,
.ps-results.is-scrolling::-webkit-scrollbar-thumb { background: var(--ps-hairline-strong); border: 3px solid var(--ps-bg); }
.ps-body.is-collapsed { grid-template-columns: minmax(0, 1fr); }
.ps-body.is-collapsed .ps-rail { display: none; }
.ps-rail-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 0 20px 14px;
}
.ps-rail-title {
  margin: 0;
  font-family: var(--ps-mono);
  font-size: 10.9px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ps-ink-2);
}
.ps-rail-reset {
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--ps-ink-3);
  font-family: var(--ps-mono);
  font-size: 10.3px;
  letter-spacing: 0.08em;
  padding: 2px 0;
  cursor: pointer;
  white-space: nowrap;
}
.ps-rail-reset:hover { color: var(--ps-accent); border-bottom-color: var(--ps-accent); }
.ps-rail-grip {
  position: absolute;
  top: 0;
  right: -6px;
  bottom: 0;
  width: 12px;
  z-index: 3;
  cursor: col-resize;
  touch-action: none;
  /* the container must not swallow scrollbar drags; only the strip right of the divider is interactive */
  pointer-events: none;
}
.ps-rail-grip::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 7px;
  pointer-events: auto;
  cursor: col-resize;
}
.ps-rail-grip::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 2px;
  background: transparent;
}
.ps-rail-grip:hover::after,
.ps-rail-grip:focus-visible::after,
.ps-rail-grip.is-dragging::after { background: var(--ps-accent); }
.ps-rail-toggle {
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  padding: 2px 0;
  font-family: var(--ps-mono);
  font-size: 11.5px;
  letter-spacing: 0.03em;
  color: var(--ps-ink-3);
  cursor: pointer;
  white-space: nowrap;
}
.ps-rail-toggle:hover { color: var(--ps-accent); border-bottom-color: var(--ps-accent); }
.ps-group { padding: 12px 0 7px; border-top: 1px solid var(--ps-hairline); }
.ps-group-label {
  display: block;
  padding: 0 20px 6px;
  font-family: var(--ps-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ps-ink-3);
}
.ps-opt {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--ps-ink-2);
  font-family: var(--ps-sans);
  font-size: 13.5px;
  line-height: 1.35;
  text-align: left;
  padding: 6px 18px 6px 16px;
  cursor: pointer;
}
.ps-opt:hover { background: var(--ps-surface-hover); color: var(--ps-ink); }
.ps-opt.is-on { background: color-mix(in srgb, var(--ps-accent) 8%, transparent); border-left-color: var(--ps-accent); color: var(--ps-ink); }
.ps-opt-mono .ps-opt-label { font-family: var(--ps-mono); font-size: 12.4px; letter-spacing: 0.02em; }
.ps-opt-label { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ps-opt-count {
  font-family: var(--ps-mono);
  font-size: 11px;
  color: var(--ps-ink-3);
  font-variant-numeric: tabular-nums;
}
.ps-opt.is-on .ps-opt-count { color: var(--ps-accent); }
.ps-opt-more {
  display: block;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--ps-ink-3);
  font-family: var(--ps-mono);
  font-size: 10.3px;
  letter-spacing: 0.08em;
  text-align: left;
  padding: 5px 18px 3px 16px;
  cursor: pointer;
}
.ps-opt-more:hover { color: var(--ps-accent); }
.ps-results {
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 40px;
  transition: opacity 0.12s ease;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
.ps-results::-webkit-scrollbar-thumb { background: transparent; border: 3px solid var(--ps-bg); }
.ps-results.is-busy .ps-list { opacity: 0.45; }
.ps-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  min-height: 56px;
  padding: 14px var(--ps-pad);
  font-family: var(--ps-mono);
  font-size: 11.5px;
  letter-spacing: 0.03em;
  color: var(--ps-ink-2);
}
.ps-summary {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11.5px;
  white-space: nowrap;
}
.ps-summary b {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ps-ink);
  font-variant-numeric: tabular-nums;
}
.ps-summary-sub { color: var(--ps-ink-3); font-size: 11.5px; letter-spacing: 0.03em; }
.ps-summary-sub::before { content: "/"; margin-right: 6px; color: var(--ps-hairline-strong); }
.ps-summary-lead::before { content: none; }
.ps-summary-live { color: var(--ps-accent); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
.ps-terms {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
  max-height: 20px;
  overflow: hidden;
}
.ps-terms-label {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: var(--ps-ink-3);
  white-space: nowrap;
}
.ps-term {
  font-size: 11px;
  line-height: 16px;
  color: var(--ps-ink-2);
  border: 1px solid var(--ps-hairline-strong);
  padding: 1px 5px;
  white-space: nowrap;
}
.ps-sort {
  display: flex;
  align-items: center;
  margin-left: auto;
  border: 1px solid var(--ps-hairline-strong);
}
.ps-sort-btn {
  border: 0;
  background: transparent;
  color: var(--ps-ink-3);
  font-family: var(--ps-mono);
  font-size: 10.8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 7px 13px;
  cursor: pointer;
  white-space: nowrap;
}
.ps-sort-btn + .ps-sort-btn { border-left: 1px solid var(--ps-hairline-strong); }
.ps-sort-btn:hover { color: var(--ps-ink); }
.ps-sort-btn.is-on { background: color-mix(in srgb, var(--ps-accent) 13%, transparent); color: var(--ps-accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ps-accent) 55%, transparent); }
.ps-cols {
  display: grid;
  grid-template-columns: var(--ps-row);
  column-gap: 12px;
  align-items: center;
  padding: 8px var(--ps-pad) 9px;
  border-top: 1px solid var(--ps-hairline-strong);
  border-bottom: 1px solid var(--ps-hairline);
  font-family: var(--ps-mono);
  font-size: 10.4px;
  letter-spacing: 0.17em;
  text-transform: uppercase;
  color: var(--ps-ink-3);
}
.ps-cols span:nth-child(n + 3) { text-align: right; margin-right: -0.14em; }
.ps-list { list-style: none; margin: 0; padding: 0; }
.ps-row {
  display: grid;
  grid-template-columns: var(--ps-row);
  column-gap: 12px;
  align-items: center;
  min-height: 94px;
  padding: 12px var(--ps-pad);
  border-bottom: 1px solid var(--ps-hairline);
  cursor: pointer;
}
.ps-row:hover { background: var(--ps-surface-hover); }
.ps-row.is-selected { background: color-mix(in srgb, var(--ps-accent) 7%, var(--ps-bg)); box-shadow: inset 2px 0 0 var(--ps-accent); }
.ps-row.is-selected:hover { background: color-mix(in srgb, var(--ps-accent) 11%, var(--ps-bg)); }
.ps-rank {
  font-family: var(--ps-mono);
  font-size: 12px;
  color: var(--ps-ink-3);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.ps-row-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ps-row-title { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.ps-name {
  font-family: var(--ps-display);
  font-size: 17.4px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0;
  color: var(--ps-ink);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px solid transparent;
}
.ps-name:hover { color: var(--ps-accent); border-bottom-color: var(--ps-accent); }
.ps-flag {
  flex: 0 0 auto;
  font-family: var(--ps-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ps-warn);
  border: 1px solid currentColor;
  padding: 0 4px;
}
.ps-author {
  flex: 0 0 auto;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: color-mix(in oklab, var(--ps-accent) 62%, var(--ps-ink));
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0 6px;
}
.ps-row-desc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--ps-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ps-row-meta {
  display: flex;
  align-items: center;
  min-width: 0;
  font-family: var(--ps-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--ps-ink-3);
  white-space: nowrap;
  overflow: hidden;
}
.ps-owner { max-width: 180px; overflow: hidden; text-overflow: ellipsis; color: var(--ps-ink-2); }
.ps-meta-div { flex: 0 0 auto; width: 1px; height: 10px; margin: 0 9px; background: var(--ps-hairline-strong); }
.ps-cap { color: var(--ps-ink-3); }
.ps-stat {
  font-family: var(--ps-mono);
  font-size: 13px;
  letter-spacing: 0.02em;
  color: var(--ps-ink-2);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ps-row:hover .ps-stat { color: var(--ps-ink); }
.ps-row-action {
  justify-self: end;
  border: 1px solid var(--ps-hairline-strong);
  border-color: color-mix(in srgb, var(--ps-accent) 38%, var(--ps-hairline-strong));
  background: transparent;
  color: var(--ps-accent);
  font-family: var(--ps-mono);
  font-size: 10.8px;
  line-height: 1.2;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.ps-row:hover .ps-row-action { border-color: color-mix(in srgb, var(--ps-accent) 62%, var(--ps-hairline-strong)); }
.ps-row-action:hover { background: var(--ps-accent); border-color: var(--ps-accent); color: var(--ps-accent-ink); }
.ps-row-action.is-done { background: var(--ps-accent); border-color: var(--ps-accent); color: var(--ps-accent-ink); }
.ps-row-action.is-busy,
.ps-row-action:disabled { cursor: progress; opacity: 0.6; }
.ps-row-action.is-failed { color: var(--ps-error); border-color: var(--ps-error); }
.ps-row-detail {
  grid-column: 2 / -1;
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding-top: 11px;
  border-top: 1px solid var(--ps-hairline);
}
.ps-detail-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 18px;
  flex-wrap: wrap;
}
.ps-row-failure {
  grid-column: 2 / -1;
  margin-top: 8px;
  font-family: var(--ps-mono);
  font-size: 10.8px;
  line-height: 1.5;
  color: var(--ps-error);
  overflow-wrap: anywhere;
}
.ps-detail-cmd {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  background: var(--ps-bg);
  border: 1px solid var(--ps-hairline);
}
.ps-detail-cmd code {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--ps-mono);
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ps-ink-2);
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.ps-detail-copy {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--ps-ink-3);
  font-family: var(--ps-mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 4px;
  cursor: pointer;
}
.ps-detail-copy:hover { color: var(--ps-accent); }
.ps-detail-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--ps-mono);
  font-size: 11px;
  color: var(--ps-ink-3);
  letter-spacing: 0.02em;
}
.ps-detail-dot { color: var(--ps-hairline-strong); }
.ps-detail-links { display: flex; flex: 0 0 auto; gap: 10px; }
.ps-detail-link {
  font-family: var(--ps-mono);
  font-size: 11px;
  letter-spacing: 0.03em;
  color: var(--ps-ink-2);
  text-decoration: none;
  border-bottom: 1px solid var(--ps-hairline-strong);
  padding-bottom: 1px;
}
.ps-detail-link:hover { color: var(--ps-accent); border-bottom-color: var(--ps-accent); }
.ps-skeleton .ps-row { cursor: default; }
.ps-skeleton .ps-row:hover { background: transparent; }
.ps-skel { display: block; background: var(--ps-surface-hover); animation: ps-pulse 1.5s ease-in-out infinite; }
.ps-skel.is-rank { width: 14px; height: 9px; }
.ps-skel.is-name { width: min(200px, 55%); height: 12px; }
.ps-skel.is-desc { width: min(420px, 86%); height: 8px; }
.ps-skel.is-meta { width: 150px; height: 7px; }
.ps-skel.is-stat { width: 30px; height: 9px; margin-left: auto; }
.ps-skel.is-action { width: 52px; height: 20px; margin-left: auto; }
@keyframes ps-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.22; }
}
@media (prefers-reduced-motion: reduce) {
  .ps-skel { animation: none; opacity: 0.4; }
  .ps-results, .ps-row-action { transition: none; }
}
.ps-empty {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 48px;
  align-items: start;
  max-width: 880px;
  padding: 56px var(--ps-pad) 24px;
}
.ps-empty-title {
  margin: 0 0 10px;
  font-family: var(--ps-serif);
  font-size: 34px;
  font-weight: 400;
  line-height: 1.14;
  letter-spacing: 0.005em;
  color: var(--ps-ink);
}
.ps-empty-body { margin: 0; max-width: 36ch; font-size: 14.2px; line-height: 1.6; color: var(--ps-ink-2); }
.ps-empty-label {
  display: block;
  margin-bottom: 8px;
  font-family: var(--ps-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ps-ink-3);
}
.ps-examples { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--ps-hairline-strong); }
.ps-example {
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--ps-hairline);
  background: transparent;
  color: var(--ps-ink-2);
  font-family: var(--ps-sans);
  font-size: 13.2px;
  line-height: 1.4;
  text-align: left;
  padding: 7px 2px;
  cursor: pointer;
}
.ps-example:hover { background: var(--ps-surface-hover); color: var(--ps-ink); }
.ps-example-index {
  flex: 0 0 18px;
  font-family: var(--ps-mono);
  font-size: 10.3px;
  color: var(--ps-ink-3);
  font-variant-numeric: tabular-nums;
}
.ps-example-text { flex: 1 1 auto; min-width: 0; }
.ps-none { max-width: 440px; padding: 64px var(--ps-pad); }
.ps-none-title {
  margin: 0 0 8px;
  font-family: var(--ps-serif);
  font-size: 27px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 0.005em;
  color: var(--ps-ink);
}
.ps-none-body { margin: 0 0 16px; font-size: 13.8px; line-height: 1.6; color: var(--ps-ink-2); }
.ps-none-clear {
  border: 1px solid var(--ps-hairline-strong);
  background: transparent;
  color: var(--ps-ink);
  font-family: var(--ps-mono);
  font-size: 10.3px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 6px 10px;
  cursor: pointer;
}
.ps-none-clear:hover { background: var(--ps-accent); border-color: var(--ps-accent); color: var(--ps-accent-ink); }
.ps-error {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 660px;
  margin: 16px var(--ps-pad) 0;
  padding: 12px 14px;
  border: 1px solid var(--ps-error);
}
.ps-error-body { flex: 1 1 auto; min-width: 0; }
.ps-error-title {
  margin: 0 0 3px;
  font-family: var(--ps-mono);
  font-size: 10.9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ps-error);
}
.ps-error-msg { margin: 0; font-size: 13.2px; line-height: 1.5; color: var(--ps-ink-2); }
.ps-error-detail {
  margin: 4px 0 0;
  font-family: var(--ps-mono);
  font-size: 10.8px;
  line-height: 1.5;
  color: var(--ps-ink-3);
  overflow-wrap: anywhere;
}
.ps-loading-hint {
  margin: 0;
  padding: 12px var(--ps-pad) 4px;
  font-family: var(--ps-mono);
  font-size: 11px;
  letter-spacing: 0.01em;
  color: var(--ps-ink-3);
}
.ps-error-retry {
  flex: 0 0 auto;
  border: 1px solid currentColor;
  background: transparent;
  color: var(--ps-error);
  font-family: var(--ps-mono);
  font-size: 10.3px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 4px 8px;
  cursor: pointer;
}
.ps-error-retry:hover { background: var(--ps-error); color: var(--ps-bg); }
@media (max-width: 1080px) {
  .ps-page { --ps-rail: min(var(--ps-rail-user, 228px), 244px); --ps-row: 34px minmax(0, 1fr) 72px 84px 88px; }
  .ps-empty { grid-template-columns: minmax(0, 1fr); gap: 28px; padding-top: 40px; }
}
@media (max-width: 860px) {
  .ps-top { position: static; grid-template-columns: minmax(0, 1fr); height: auto; }
  .ps-brand { flex-direction: row; align-items: center; justify-content: flex-start; gap: 10px; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--ps-hairline); }
  .ps-top-right { padding: 10px 16px; }
  .ps-body { display: block; overflow-x: hidden; overflow-y: auto; }
  .ps-results { overflow: visible; padding-bottom: 24px; }
  .ps-rail {
    position: static;
    display: block;
    max-height: none;
    border-right: 0;
    border-bottom: 1px solid var(--ps-hairline-strong);
    overflow: visible;
  }
  .ps-rail-scroll {
    height: auto;
    overflow: visible;
    padding: 0 0 4px;
  }
  .ps-rail-grip { display: none; }
  .ps-rail-head { padding: 8px 16px; border-bottom: 1px solid var(--ps-hairline); }
  .ps-group {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 3px;
    padding: 8px 16px 6px;
  }
  .ps-group-label { width: 100%; padding: 0 0 4px; }
  .ps-opt {
    width: auto;
    gap: 7px;
    padding: 4px 8px;
  }
  .ps-opt-more { width: auto; padding: 2px 16px 8px; }
  .ps-toolbar { padding: 10px 16px; }
  .ps-cols { padding: 8px 16px 9px; }
  .ps-row { padding: 12px 16px; }
  .ps-empty { padding: 32px 16px 16px; }
  .ps-error { margin: 12px 16px 0; }
}
/* screenshot strip in the expanded row */
.ps-shots {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.ps-shots-label {
  font-family: var(--ps-mono);
  font-size: 9.8px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ps-ink-3);
  margin-right: 2px;
}
.ps-shot {
  position: relative;
  width: 148px;
  height: 84px;
  padding: 0;
  border: 1px solid var(--ps-hairline-strong);
  background: var(--ps-surface);
  overflow: hidden;
  cursor: zoom-in;
  transition: border-color 120ms ease;
}
.ps-shot img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}
.ps-shot:hover { border-color: var(--ps-accent); }
.ps-shot:focus-visible {
  outline: 2px solid var(--ps-accent);
  outline-offset: 1px;
}
.ps-shot.is-broken::after {
  content: attr(data-empty);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--ps-mono);
  font-size: 10.2px;
  color: var(--ps-ink-3);
}
/* preview overlay: covers the panel only, so the window chrome and app sidebar stay usable */
.ps-lb {
  position: absolute;
  inset: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  padding: 0;
  background: rgba(10, 9, 8, 0.96);
  color: #ede6d6;
}
.ps-lb-bar {
  display: flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 14px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(237, 230, 214, 0.16);
}
.ps-lb-name {
  font-family: var(--ps-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #f4eee2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ps-lb-count {
  font-family: var(--ps-mono);
  font-size: 11px;
  color: #c8bda6;
  font-variant-numeric: tabular-nums;
}
.ps-lb-close {
  margin-left: auto;
  border: 1px solid rgba(237, 230, 214, 0.28);
  background: transparent;
  color: inherit;
  font-family: var(--ps-mono);
  font-size: 10.8px;
  letter-spacing: 0.04em;
  padding: 5px 10px;
  cursor: pointer;
}
.ps-lb-close:hover {
  border-color: var(--ps-accent);
  color: var(--ps-accent);
}
.ps-lb-stage {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 56px;
}
.ps-lb-stage.is-failed::after {
  content: attr(data-fail);
  font-family: var(--ps-mono);
  font-size: 12px;
  color: #a49b88;
}
.ps-lb-img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border: 1px solid rgba(237, 230, 214, 0.18);
  background: #141310;
}
.ps-lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 68px;
  border: 1px solid rgba(237, 230, 214, 0.18);
  background: rgba(237, 230, 214, 0.04);
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.ps-lb-nav.is-prev { left: 6px; }
.ps-lb-nav.is-next { right: 6px; }
.ps-lb-nav:hover {
  border-color: var(--ps-accent);
  color: var(--ps-accent);
}
.ps-lb-hint {
  margin: 0;
  flex: 0 0 auto;
  padding: 6px 20px 12px;
  text-align: center;
  font-family: var(--ps-mono);
  font-size: 10.6px;
  letter-spacing: 0.06em;
  color: #9a9080;
}
@media (max-width: 860px) {
  .ps-shot { width: 112px; height: 64px; }
  .ps-lb-stage { padding: 14px 12px; }
  .ps-lb-nav { width: 36px; height: 52px; }
}

`

    /* ------------------------------------------------------------------ */
    /* plugin                                                             */
    /* ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'market-dog: dictionaries')
        const t = ctx.locale.bind(NS)

        const localeSource = {
          subscribe: (listener) => ctx.locale.subscribe(listener),
          getSnapshot: () => (typeof ctx.locale.getSnapshot === 'function'
            ? ctx.locale.getSnapshot()
            : ctx.locale.getLocale()),
        }

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: ORDER,
          label: () => t('nav.label'),
          locale: NS,
        }, PanelIcon))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ t, localeSource }),
        }, ScoutPage))
      },
    }
  },
})