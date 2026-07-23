import type {RequestOptions as GetItRequestOptions} from 'get-it'

import type {Any} from '../types'

const projectHeader = 'X-Sanity-Project-ID'

/**
 * The request shape the transport (`defineRequester`) consumes: get-it v9's
 * own options, with `headers` pinned to the plain-record form this builder
 * always produces.
 *
 * @internal
 */
export type FetchRequest = Omit<GetItRequestOptions, 'headers'> & {
  headers: Record<string, string>
}

/**
 * Project the public request options (`uri`, `timeout: 0` to disable,
 * `withCredentials`, `maxRedirects`, the function/object-form `fetch`, ...)
 * plus the client config into a get-it v9 fetch-shaped request. This is the
 * single translation boundary between the client's public option names and
 * the transport — everything below it speaks get-it v9.
 *
 * Reads the live client config, so reconfiguration via `client.config()` /
 * `withConfig()` (token, headers, proxy, ...) applies to subsequent requests.
 *
 * @internal
 */
export function requestOptions(config: Any, overrides: Any = {}): FetchRequest {
  const headers: Record<string, string> = {}

  if (config.headers) {
    Object.assign(headers, config.headers)
  }

  const token = overrides.token || config.token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (!overrides.useGlobalApi && !config.useProjectHostname && config.projectId) {
    headers[projectHeader] = config.projectId
  }

  const request: FetchRequest = {
    url: overrides.url ?? overrides.uri,
    headers: Object.assign(headers, overrides.headers || {}),
  }

  if (overrides.method) request.method = overrides.method
  if (overrides.body !== undefined) request.body = overrides.body
  if (overrides.query) request.query = expandQueryArrays(overrides.query)
  if (overrides.signal) request.signal = overrides.signal

  const withCredentials = Boolean(
    typeof overrides.withCredentials === 'undefined'
      ? config.withCredentials
      : overrides.withCredentials,
  )
  if (withCredentials) request.credentials = 'include'

  // The public option is the legacy `maxRedirects` count, but only "follow"
  // vs "don't" ever worked — fetch has no redirect budget.
  if (typeof overrides.maxRedirects === 'number') {
    request.redirect = overrides.maxRedirects === 0 ? 'manual' : 'follow'
  }

  // Public semantics: `0` disables the timeout (get-it uses `false`), default
  // is five minutes.
  const timeout = typeof overrides.timeout === 'undefined' ? config.timeout : overrides.timeout
  request.timeout = typeof timeout === 'undefined' ? 5 * 60 * 1000 : timeout === 0 ? false : timeout

  // `useAbortSignal: false` is set by the query path when the caller provided
  // no signal of their own, and means no AbortSignal may reach the fetch
  // init: Next.js' patched fetch opts a request out of React Request
  // Memoization whenever `init.signal` is present, and get-it v9 implements
  // timeouts via `AbortSignal.timeout()`. Disable the transport timeout and
  // let the transport enforce it as a rejection-only "soft" timeout instead
  // (see `withSoftTimeout` in `http/request.ts`).
  if (overrides.useAbortSignal === false && !request.signal) {
    if (typeof request.timeout === 'number' && request.timeout > 0) {
      request.meta = {...request.meta, softTimeout: request.timeout}
    }
    request.timeout = false
  }

  // The public `fetch` option is either a custom fetch implementation
  // (function) or a bag of extra `RequestInit` fields (object) — Next.js App
  // Router's `cache`/`next` caching options arrive as the latter. get-it's
  // `fetch` option only accepts a function, so the init extras travel in
  // `meta` and are merged into the effective fetch by the `applyFetchInit`
  // middleware. (A boolean `fetch` was v8's "force the fetch transport"
  // switch — a no-op now that fetch is the only transport.)
  const fetchOption =
    typeof overrides.fetch === 'object' && typeof config.fetch === 'object'
      ? {...config.fetch, ...overrides.fetch}
      : overrides.fetch || config.fetch
  if (typeof fetchOption === 'function') {
    request.fetch = fetchOption
  } else if (typeof fetchOption === 'object' && fetchOption !== null) {
    request.meta = {...request.meta, fetchInit: fetchOption}
  }

  // The config's fetch resolver supplies the transport for every request —
  // the environment's own fetch by default, a proxy-configured one when an
  // explicit `proxy` is set, or a caller-supplied resolver (the test suite
  // injects its mock this way). A per-request `fetch` function wins over it.
  // There is deliberately no per-request proxy.
  if (!request.fetch && config.resolveFetch) {
    request.fetch = config.resolveFetch(typeof config.proxy === 'string' ? config.proxy : undefined)
  }

  // A per-request retry cap/opt-out (`maxRetries: 0`) travels in `meta`,
  // where the retry middleware's predicate reads it.
  if (typeof overrides.maxRetries === 'number') {
    request.meta = {...request.meta, maxRetries: overrides.maxRetries}
  }

  // Lineage travels in `meta`; the Node middleware projects it onto the
  // `x-sanity-lineage` header (merged with the `X_SANITY_LINEAGE` env var).
  if (typeof config.lineage === 'string' && config.lineage) {
    request.meta = {...request.meta, lineage: config.lineage}
  }

  return request
}

/**
 * Expand array-valued query params into repeated keys.
 *
 * get-it v9 stringifies a plain object's values directly, so passing
 * `{meta: ['palette', 'location']}` would produce `?meta=palette,location`
 * — which Content Lake doesn't recognise. Repeated keys
 * (`?meta=palette&meta=location`) are produced via `URLSearchParams`.
 */
function expandQueryArrays(query: Any): FetchRequest['query'] {
  if (query instanceof URLSearchParams) return query
  if (!query || typeof query !== 'object') return query
  if (!Object.values(query).some(Array.isArray)) return query

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) params.append(key, `${item}`)
      }
    } else {
      params.append(key, `${value}`)
    }
  }
  return params
}
