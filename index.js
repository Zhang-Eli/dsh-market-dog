/** Host half of the market-dog bundle: catalog fetch + JSON search route. */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { searchCatalog } from './lib/search.js'

export const name = 'dsh-market-dog'
export const inject = ['webServer']

const VERSION = '0.4.6'
const DEFAULT_CATALOG_URL = 'https://awesome-dsh-plugin.com/plugins.json'
const PREFIX = '/market-dog/api/'
const ASSET_PREFIX = '/market-dog/assets/'
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const ASSETS = { 'logo.png': 'image/png', 'icon.svg': 'image/svg+xml' }
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000
/* The catalog is ~14 MB of JSON (~3.5 MB gzipped); on a slow link a single
 * request can take a minute. Abort only when the stream genuinely stalls, and
 * keep the last good copy on disk so the panel survives a bad network. */
const CATALOG_IDLE_TIMEOUT_MS = 60_000
const CATALOG_TOTAL_TIMEOUT_MS = 10 * 60 * 1000
const CATALOG_RETRIES = 2
const MAX_CATALOG_BYTES = 64 * 1024 * 1024
const CACHE_FORMAT = 1
const MAX_DESCRIPTION = 2000
const MAX_LIMIT = 200
const DEFAULT_LIMIT = 60
const STATUS = { 'invalid-input': 400, 'not-found': 404, 'io-error': 500, 'install-unavailable': 501, 'source-unavailable': 502 }

const MESSAGES = {
  zh: {
    'invalid-description': '先描述一下你想要的插件功能，再开始搜索。',
    'invalid-body': '请求内容格式不正确。',
    'source-unavailable': '插件目录暂时下载失败，请稍后重试。',
    'catalog-invalid': '插件目录的格式无法识别，请稍后重试。',
    'unknown-action': '未知接口。',
    'method': '只支持 POST 请求。',
    'invalid-name': '缺少要安装的插件名。',
    'unknown-plugin': '目录里没有这个插件。',
    'install-unavailable': '当前环境不支持直接安装——展开该行复制命令即可。',
    'install-failed': '安装没有完成。',
    'forbidden': '请求来源不受信任。',
    internal: 'Market Dog 处理请求失败。',
  },
  en: {
    'invalid-description': 'Describe the plugin you want before searching.',
    'invalid-body': 'The request body is not valid.',
    'source-unavailable': 'The plugin catalog could not be downloaded. Try again shortly.',
    'catalog-invalid': 'The plugin catalog could not be parsed.',
    'unknown-action': 'Unknown endpoint.',
    method: 'Only POST is supported.',
    'invalid-name': 'Missing the plugin to install.',
    'unknown-plugin': 'That plugin is not in the catalog.',
    'install-unavailable': 'Direct install is not available here — expand the row and copy the command.',
    'install-failed': 'The install did not finish.',
    forbidden: 'Untrusted request origin.',
    internal: 'Market Dog failed to handle the request.',
  },
}

function messageFor(lang, key) {
  const table = MESSAGES[lang] ?? MESSAGES.en
  return table[key] ?? MESSAGES.en[key] ?? key
}

class ScoutError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function sendJson(res, status, body, extraHeaders) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  })
  res.end(text)
}

/** Body is JSON; an empty body and malformed JSON both count as {}. */
async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

function isLoopbackPeer(address) {
  if (address === undefined) return false
  const plain = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  return plain === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(plain)
}

/**
 * Same-origin / loopback fence. The connection service is authoritative when present;
 * otherwise fall back to the same checks the harness engine uses for local routes.
 * Returns undefined when allowed, or the HTTP status of the refusal.
 */
function refusalOf(ctx, req) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection === 'function') return connection.requestRejection(req)
  if (!isLoopbackPeer(req.socket?.remoteAddress)) return 403
  const host = req.headers.host
  if (host !== undefined) {
    if (!URL.canParse(`http://${host}`)) return 403
    const name = new URL(`http://${host}`).hostname
    if (name !== 'localhost' && name !== '[::1]' && !/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name)) return 403
  }
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return 403
  const origin = req.headers.origin
  if (origin === undefined) return undefined
  if (!URL.canParse(origin)) return 403
  return new URL(origin).host === host ? undefined : 403
}

/** Read the catalog body as a stream so a slow link only fails when bytes stop arriving. */
async function downloadCatalogText(url, etag) {
  const controller = new AbortController()
  let idle = null
  const arm = (ms) => {
    if (idle !== null) clearTimeout(idle)
    idle = setTimeout(() => controller.abort(new Error(`Catalog download stalled (${Math.round(ms / 1000)}s)`)), ms)
  }
  const total = setTimeout(() => controller.abort(new Error('Catalog download timed out')), CATALOG_TOTAL_TIMEOUT_MS)
  arm(CATALOG_IDLE_TIMEOUT_MS)
  try {
    const headers = { accept: 'application/json', 'user-agent': `dsh-market-dog/${VERSION}` }
    if (typeof etag === 'string' && etag !== '') headers['if-none-match'] = etag
    const response = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' })
    if (response.status === 304) return { notModified: true, etag }
    if (!response.ok) throw new ScoutError('source-unavailable', `Catalog download failed (HTTP ${response.status})`)
    const body = response.body
    if (body === null || typeof body.getReader !== 'function') {
      const text = await response.text()
      arm(CATALOG_IDLE_TIMEOUT_MS)
      return { text, etag: response.headers.get('etag') ?? '' }
    }
    const reader = body.getReader()
    const chunks = []
    let bytes = 0
    for (;;) {
      const step = await reader.read()
      if (step.done) break
      arm(CATALOG_IDLE_TIMEOUT_MS)
      chunks.push(step.value)
      bytes += step.value.length
      if (bytes > MAX_CATALOG_BYTES) throw new ScoutError('catalog-invalid', 'Catalog is unexpectedly large')
    }
    const buffer = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.length
    }
    return { text: new TextDecoder().decode(buffer), etag: response.headers.get('etag') ?? '' }
  } catch (err) {
    if (err instanceof ScoutError) throw err
    const detail = err instanceof Error && err.message !== '' ? err.message : 'network error'
    throw new ScoutError('source-unavailable', `Catalog download failed (${detail})`)
  } finally {
    if (idle !== null) clearTimeout(idle)
    clearTimeout(total)
  }
}

/** Validate and normalize a catalog document (network body or disk cache). */
function normalizeCatalog(parsed, url) {
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.plugins)) {
    throw new ScoutError('catalog-invalid', 'Catalog has no plugins array')
  }
  const plugins = parsed.plugins.filter((plugin) => (
    plugin !== null
    && typeof plugin === 'object'
    && typeof plugin.name === 'string'
    && plugin.name !== ''
  ))
  const categories = parsed.categories !== null && typeof parsed.categories === 'object' ? parsed.categories : {}
  return {
    url,
    plugins,
    categories,
    updated: typeof parsed.updated === 'string' ? parsed.updated : '',
    count: typeof parsed.count === 'number' ? parsed.count : plugins.length,
    fetchedAt: Date.now(),
  }
}

/** Download and validate the public catalog. Returns a catalog or a not-modified marker. */
async function loadCatalog(url, options = {}) {
  if (typeof fetch !== 'function') {
    throw new ScoutError('source-unavailable', 'This runtime has no fetch implementation.')
  }
  const downloaded = await downloadCatalogText(url, options.etag)
  if (downloaded.notModified === true) return { notModified: true, etag: options.etag }
  let parsed
  try {
    parsed = JSON.parse(downloaded.text)
  } catch {
    throw new ScoutError('catalog-invalid', 'Catalog is not valid JSON')
  }
  return { notModified: false, catalog: normalizeCatalog(parsed, url), etag: downloaded.etag }
}

function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

/** Where the last good catalog is kept so the panel still works while the source is slow. */
function resolveCachePath(ctx, config) {
  if (typeof config.cacheFile === 'string' && config.cacheFile !== '') return config.cacheFile
  try {
    const dshHomePath = typeof ctx?.get === 'function' ? ctx.get('dshHomePath') : undefined
    if (typeof dshHomePath === 'function') return dshHomePath('market-dog', 'catalog.json')
  } catch {}
  return join(homedir(), '.dsh', 'market-dog', 'catalog.json')
}

async function readDiskCatalog(cachePath) {
  if (typeof cachePath !== 'string' || cachePath === '') return null
  try {
    const parsed = JSON.parse(await readFile(cachePath, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || parsed.format !== CACHE_FORMAT) return null
    const stored = parsed.catalog
    if (stored === null || typeof stored !== 'object' || !Array.isArray(stored.plugins)) return null
    const catalog = normalizeCatalog(stored, typeof stored.url === 'string' ? stored.url : '')
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0
    return {
      catalog: { ...catalog, fetchedAt: typeof stored.fetchedAt === 'number' ? stored.fetchedAt : savedAt },
      savedAt,
      etag: typeof parsed.etag === 'string' ? parsed.etag : '',
    }
  } catch {
    return null
  }
}

async function writeDiskCatalog(cachePath, catalog, etag, logger) {
  if (typeof cachePath !== 'string' || cachePath === '') return
  try {
    await mkdir(dirname(cachePath), { recursive: true })
    const temp = `${cachePath}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify({ format: CACHE_FORMAT, savedAt: Date.now(), etag: etag ?? '', catalog }))
    await rename(temp, cachePath)
  } catch (err) {
    logger?.warn?.(`dsh-market-dog: could not cache the catalog at ${cachePath} (${err instanceof Error ? err.message : String(err)})`)
  }
}

async function refreshOverNetwork(url, options = {}) {
  const cachePath = typeof options.cachePath === 'string' ? options.cachePath : ''
  const logger = options.logger
  const disk = options.disk ?? null
  let lastError = null
  for (let attempt = 1; attempt <= CATALOG_RETRIES; attempt += 1) {
    try {
      const outcome = await loadCatalog(url, { etag: disk !== null ? disk.etag : catalogCache.etag })
      if (outcome.notModified === true) {
        if (disk === null) {
          lastError = new ScoutError('source-unavailable', 'Catalog revalidation returned 304 without a cached copy.')
        } else {
          const catalog = { ...disk.catalog, stale: false, fetchedAt: Date.now() }
          catalogCache.catalog = catalog
          catalogCache.url = url
          catalogCache.fetchedAt = Date.now()
          catalogCache.etag = disk.etag
          return catalog
        }
      } else {
        const catalog = { ...outcome.catalog, stale: false }
        catalogCache.catalog = catalog
        catalogCache.url = url
        catalogCache.fetchedAt = Date.now()
        catalogCache.etag = outcome.etag
        await writeDiskCatalog(cachePath, catalog, outcome.etag, logger)
        return catalog
      }
    } catch (err) {
      lastError = err
      logger?.warn?.(`dsh-market-dog: catalog attempt ${attempt}/${CATALOG_RETRIES} failed (${err instanceof Error ? err.message : String(err)})`)
    }
    if (attempt < CATALOG_RETRIES) await delay(attempt * 1500)
  }
  if (catalogCache.catalog !== null) {
    catalogCache.catalog = { ...catalogCache.catalog, stale: true }
    catalogCache.fetchedAt = Date.now()
    return catalogCache.catalog
  }
  throw lastError ?? new ScoutError('source-unavailable', 'Catalog download failed')
}

/** Shared cache so repeated searches do not re-download ~14 MB. */
const catalogCache = { url: '', catalog: null, fetchedAt: 0, etag: '' }

/**
 * Single-flight catalog refresh. An explicit ⟳ click starts this job and its
 * HTTP request answers right away; the job keeps running in the host even if
 * the panel unmounts, the view switches, or the GUI reloads. Concurrent
 * callers join the running job instead of starting a second ~14 MB download.
 */
const refreshJob = { running: false, url: '', startedAt: 0, finishedAt: 0, errorCode: '', error: '', promise: null }

function startRefreshJob(url, options = {}) {
  if (refreshJob.running) {
    if (refreshJob.url === url) return refreshJob.promise
    return refreshJob.promise.then(() => startRefreshJob(url, options), () => startRefreshJob(url, options))
  }
  refreshJob.running = true
  refreshJob.url = url
  refreshJob.startedAt = Date.now()
  refreshJob.finishedAt = 0
  refreshJob.errorCode = ''
  refreshJob.error = ''
  const promise = refreshOverNetwork(url, options).then(
    (catalog) => {
      refreshJob.running = false
      refreshJob.finishedAt = Date.now()
      return catalog
    },
    (err) => {
      refreshJob.running = false
      refreshJob.finishedAt = Date.now()
      refreshJob.errorCode = typeof err?.code === 'string' && err.code !== '' ? err.code : 'internal'
      refreshJob.error = err instanceof Error ? err.message : String(err)
      throw err
    },
  )
  refreshJob.promise = promise
  promise.catch(() => {}) // fire-and-forget kicks must not surface as unhandled rejections
  return promise
}

/**
 * Cached copy first: when a disk cache exists, serve it immediately (marked
 * stale) and refresh in the background, so a slow catalog never blocks the
 * search box. An explicit ⟳ refresh waits for the network.
 */
async function ensureCatalog(url, options = {}) {
  const cachePath = typeof options.cachePath === 'string' ? options.cachePath : ''
  const logger = options.logger
  let disk = null
  try {
    disk = await readDiskCatalog(cachePath)
  } catch {}
  if (disk !== null) {
    if (catalogCache.catalog === null || catalogCache.url !== url) {
      catalogCache.catalog = { ...disk.catalog, stale: true }
      catalogCache.url = url
      catalogCache.etag = disk.etag
    }
    if (options.refresh !== true) {
      catalogCache.fetchedAt = Date.now()
      startRefreshJob(url, { cachePath, logger, disk })
      return catalogCache.catalog
    }
  }
  return startRefreshJob(url, { cachePath, logger, disk })
}

function fetchCatalog(url, options = {}) {
  const now = Date.now()
  if (catalogCache.catalog !== null && catalogCache.url === url && options.refresh !== true && now - catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return Promise.resolve(catalogCache.catalog)
  }
  if (options.refresh === true) {
    // explicit refresh: join or start the single-flight job and await it
    return startRefreshJob(url, { cachePath: typeof options.cachePath === 'string' ? options.cachePath : '', logger: options.logger })
  }
  if (refreshJob.running && catalogCache.catalog !== null && catalogCache.url === url) {
    // a refresh is already in flight: answer from the cached copy right away
    return Promise.resolve(catalogCache.catalog)
  }
  return ensureCatalog(url, options)
}

function categoryList(catalog, lang) {
  const entries = []
  for (const [id, meta] of Object.entries(catalog.categories)) {
    const en = meta !== null && typeof meta === 'object' && typeof meta.en === 'string' ? meta.en : id
    const zh = meta !== null && typeof meta === 'object' && typeof meta.zh === 'string' ? meta.zh : en
    entries.push({ id, en, zh, label: lang === 'zh' ? zh : en })
  }
  entries.sort((left, right) => left.label.localeCompare(right.label))
  return entries
}

async function runSearch(body, config, lang) {
  const browse = body.browse === true
  let description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description === '' && !browse) throw new ScoutError('invalid-input', messageFor(lang, 'invalid-description'))
  if (description.length > MAX_DESCRIPTION) description = description.slice(0, MAX_DESCRIPTION)

  const requested = Number.isInteger(body.limit) ? body.limit : DEFAULT_LIMIT
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested))
  const category = typeof body.category === 'string' ? body.category : ''
  const sort = body.sort === 'downloads' ? 'downloads' : 'relevance'
  const refresh = body.refresh === true
  const catalog = await fetchCatalog(config.catalogUrl, { refresh, cachePath: config.cachePath, logger: config.logger })
  const result = searchCatalog(catalog.plugins, description, {
    lang,
    limit,
    category,
    filters: body.filters,
    sort,
    categories: catalog.categories,
    browse,
  })
  return {
    ...result,
    updated: catalog.updated,
    catalogCount: catalog.count,
    catalogUrl: catalog.url,
    fetchedAt: catalog.fetchedAt,
    stale: catalog.stale === true,
  }
}

function installSpecOf(entry) {
  const install = typeof entry?.install === 'string' ? entry.install.trim() : ''
  const match = /(?:^|\s)add\s+(\S+)\s*$/u.exec(install)
  if (match !== null) return match[1]
  if (typeof entry?.npm === 'string' && entry.npm !== '') return entry.npm
  const url = typeof entry?.url === 'string' ? entry.url : ''
  const github = /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/u.exec(url)
  if (github !== null) return `github:${github[1]}/${github[2]}`
  return ''
}

async function runInstall(body, config, lang, ctx) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name === '') throw new ScoutError('invalid-input', messageFor(lang, 'invalid-name'))
  const catalog = await fetchCatalog(config.catalogUrl, { cachePath: config.cachePath, logger: config.logger })
  const entry = catalog.plugins.find((plugin) => plugin.name === name)
  if (entry === undefined) throw new ScoutError('not-found', messageFor(lang, 'unknown-plugin'))
  const spec = installSpecOf(entry)
  if (spec === '') throw new ScoutError('invalid-input', messageFor(lang, 'invalid-name'))
  let manager
  try {
    manager = ctx.get('pluginManager')
  } catch {
    manager = undefined
  }
  if (manager === null || manager === undefined || typeof manager.installBundle !== 'function') {
    throw new ScoutError('install-unavailable', messageFor(lang, 'install-unavailable'))
  }
  let result
  try {
    result = await manager.installBundle(spec, { enabled: true })
  } catch (err) {
    const detail = err instanceof Error && typeof err.message === 'string' ? ` ${err.message}` : ''
    throw new ScoutError('io-error', `${messageFor(lang, 'install-failed')}${detail}`)
  }
  const error = result !== null && typeof result === 'object' ? result.error : undefined
  return {
    name,
    spec,
    changed: result !== null && typeof result === 'object' && result.changed === true,
    application: result !== null && typeof result === 'object' && typeof result.application === 'string' ? result.application : 'unknown',
    bundle: result?.bundle ?? null,
    version: result?.version ?? null,
    pendingBuilds: Array.isArray(result?.pendingBuilds) ? result.pendingBuilds : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
    error: error === undefined || error === null
      ? null
      : {
        message: typeof error.message === 'string' ? error.message : '',
        diagnostic: typeof error.diagnostic === 'string' ? error.diagnostic : '',
      },
  }
}

async function runInstalled(body, config, lang, ctx) {
  let manager
  try {
    manager = ctx.get('pluginManager')
  } catch {
    manager = undefined
  }
  if (manager === null || manager === undefined || typeof manager.listBundles !== 'function') {
    throw new ScoutError('install-unavailable', messageFor(lang, 'install-unavailable'))
  }
  let bundles
  try {
    bundles = await manager.listBundles()
  } catch (err) {
    const detail = err instanceof Error && typeof err.message === 'string' ? ` ${err.message}` : ''
    throw new ScoutError('io-error', `${messageFor(lang, 'install-failed')}${detail}`)
  }
  const names = []
  for (const bundle of Array.isArray(bundles) ? bundles : []) {
    if (bundle === null || typeof bundle !== 'object') continue
    if (bundle.installed === true && typeof bundle.name === 'string' && bundle.name !== '') names.push(bundle.name)
  }
  names.sort()
  return { names, fetchedAt: new Date().toISOString() }
}

async function runMeta(body, config, lang) {
  if (body.refresh === true) {
    // explicit ⟳: start (or join) the background job and answer now; the
    // panel follows up with refresh-status and refetches meta when it lands.
    startRefreshJob(config.catalogUrl, { cachePath: config.cachePath, logger: config.logger })
    const current = catalogCache.catalog !== null && catalogCache.url === config.catalogUrl ? catalogCache.catalog : null
    if (current === null) {
      return { updated: null, count: 0, catalogUrl: config.catalogUrl, fetchedAt: 0, stale: true, refreshing: true, categories: [] }
    }
    return {
      updated: current.updated,
      count: current.count,
      catalogUrl: current.url,
      fetchedAt: current.fetchedAt,
      stale: current.stale === true,
      refreshing: refreshJob.running,
      categories: categoryList(current, lang),
    }
  }
  const catalog = await fetchCatalog(config.catalogUrl, { refresh: false, cachePath: config.cachePath, logger: config.logger })
  return {
    updated: catalog.updated,
    count: catalog.count,
    catalogUrl: catalog.url,
    fetchedAt: catalog.fetchedAt,
    stale: catalog.stale === true,
    refreshing: refreshJob.running,
    categories: categoryList(catalog, lang),
  }
}

/** Cheap status probe for the background refresh job (no catalog touch). */
function runRefreshStatus(lang) {
  const failed = !refreshJob.running && refreshJob.errorCode !== ''
  const known = refreshJob.errorCode === 'source-unavailable' || refreshJob.errorCode === 'catalog-invalid'
  return {
    status: refreshJob.running ? 'running' : (failed ? 'error' : 'idle'),
    startedAt: refreshJob.startedAt,
    finishedAt: refreshJob.finishedAt,
    message: failed ? (known ? messageFor(lang, refreshJob.errorCode) : refreshJob.error) : '',
  }
}

export function apply(ctx, config = {}) {
  // config.catalogUrl: optional override for the market catalog endpoint.
  const settings = {
    catalogUrl: typeof config.catalogUrl === 'string' && /^https?:\/\//u.test(config.catalogUrl)
      ? config.catalogUrl
      : DEFAULT_CATALOG_URL,
    cachePath: resolveCachePath(ctx, config),
    logger: typeof ctx.logger === 'object' && ctx.logger !== null ? ctx.logger : undefined,
  }
  // Warm the cache at startup so the first search usually hits memory.
  fetchCatalog(settings.catalogUrl, { cachePath: settings.cachePath, logger: settings.logger }).catch(() => {})

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/market-dog/api',
    handler: async (req, res) => {
      const lang = (() => {
        try {
          return new URL(req.url ?? '/', 'http://dsh.internal').searchParams.get('lang') === 'zh' ? 'zh' : 'en'
        } catch {
          return 'en'
        }
      })()
      try {
        if (refusalOf(ctx, req) !== undefined) {
          sendJson(res, 403, { ok: false, error: { code: 'forbidden', message: messageFor(lang, 'forbidden') } })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: { code: 'method', message: messageFor(lang, 'method') } }, { allow: 'POST' })
          return
        }
        const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
        const action = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length) : ''
        if (action !== 'search' && action !== 'meta' && action !== 'install' && action !== 'installed' && action !== 'refresh-status') {
          sendJson(res, 404, { ok: false, error: { code: 'not-found', message: messageFor(lang, 'unknown-action') } })
          return
        }
        const body = await readJson(req)
        const result = action === 'search'
          ? await runSearch(body, settings, lang)
          : action === 'meta'
            ? await runMeta(body, settings, lang)
            : action === 'refresh-status'
              ? runRefreshStatus(lang)
              : action === 'installed'
              ? await runInstalled(body, settings, lang, ctx)
              : await runInstall(body, settings, lang, ctx)
        sendJson(res, 200, { ok: true, result })
      } catch (err) {
        const code = typeof err?.code === 'string' && err.code !== '' ? err.code : 'internal'
        const localize = code === 'source-unavailable' || code === 'catalog-invalid'
        const message = localize
          ? messageFor(lang, code)
          : (err instanceof ScoutError ? err.message : messageFor(lang, 'internal'))
        const detail = err instanceof Error && typeof err.message === 'string' ? err.message : ''
        sendJson(res, STATUS[code] ?? 500, { ok: false, error: { code, message, detail } })
      }
    },
  }), 'market-dog: http')

  // Static brand assets (the illustrated logo) for the panel masthead.
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/market-dog/assets',
    handler: async (req, res) => {
      if (refusalOf(ctx, req) !== undefined) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('forbidden')
        return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' })
        res.end()
        return
      }
      const pathname = (() => {
        try {
          return new URL(req.url ?? '/', 'http://dsh.internal').pathname
        } catch {
          return ''
        }
      })()
      const name = pathname.startsWith(ASSET_PREFIX) ? pathname.slice(ASSET_PREFIX.length) : ''
      const type = Object.prototype.hasOwnProperty.call(ASSETS, name) ? ASSETS[name] : undefined
      if (type === undefined) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('not found')
        return
      }
      try {
        const body = await readFile(join(PLUGIN_DIR, name))
        res.writeHead(200, {
          'content-type': type,
          'content-length': String(body.byteLength),
          'cache-control': 'public, max-age=86400',
          'x-content-type-options': 'nosniff',
        })
        res.end(req.method === 'HEAD' ? undefined : body)
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('not found')
      }
    },
  }), 'market-dog: assets')
}