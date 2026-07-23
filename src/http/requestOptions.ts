import type {Any} from '../types'

const projectHeader = 'X-Sanity-Project-ID'

/**
 * Build the per-request options object passed down to the HTTP layer.
 *
 * Deliberately returns the legacy "get-it v8 + sanity client" shape (incl.
 * `withCredentials` and `json`) even though the transport is fetch-based now:
 * every calling layer (dataMethods, assets, agents, ...) was written against
 * that shape, so keeping it stable confined the get-it v9 migration to a
 * single translation boundary (`adaptToFetchOptions` in `http/request.ts`)
 * instead of rippling through every call site. Collapsing the legacy and
 * fetch shapes into one is a candidate for the planned follow-up refactor.
 *
 * @internal
 */
export function requestOptions(config: Any, overrides: Any = {}): Any {
  const headers: Any = {}

  if (config.headers) {
    Object.assign(headers, config.headers)
  }

  const token = overrides.token || config.token
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (!overrides.useGlobalApi && !config.useProjectHostname && config.projectId) {
    headers[projectHeader] = config.projectId
  }

  const withCredentials = Boolean(
    typeof overrides.withCredentials === 'undefined'
      ? config.withCredentials
      : overrides.withCredentials,
  )

  const timeout = typeof overrides.timeout === 'undefined' ? config.timeout : overrides.timeout
  return Object.assign({}, overrides, {
    headers: Object.assign({}, headers, overrides.headers || {}),
    timeout: typeof timeout === 'undefined' ? 5 * 60 * 1000 : timeout,
    // An explicit `proxy` config is resolved against the environment's fetch
    // here, from the live config — so replacing it via `client.config()` or
    // `withConfig()` affects subsequent requests. Kept separate from the
    // `fetch` option, which is reserved for caller-supplied fetch functions
    // and RequestInit extras. There is deliberately no per-request proxy.
    ...(typeof config.proxy === 'string' && config.resolveFetch
      ? {proxyFetch: config.resolveFetch(config.proxy)}
      : {}),
    json: true,
    withCredentials,
    fetch:
      typeof overrides.fetch === 'object' && typeof config.fetch === 'object'
        ? {...config.fetch, ...overrides.fetch}
        : overrides.fetch || config.fetch,
  })
}
