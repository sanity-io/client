import {
  createRequester,
  HttpError as GetItHttpError,
  type RequestOptions as FetchRequestOptions,
  type TransformMiddleware,
  type WrappingMiddleware,
} from 'get-it'
import {isRetryableRequest, retry} from 'get-it/middleware'
import {from, Observable} from 'rxjs'

import type {Any} from '../types'
import {ClientError, httpResponseFromFetch, ServerError} from './errors'

/**
 * Middleware accepted by the internal HTTP layer. Two flavors per get-it v9:
 * a flat-pipeline transform (`beforeRequest`/`afterResponse`) or a wrapping
 * middleware that surrounds the fetch chain.
 *
 * @internal
 */
export type LegacyMiddleware = TransformMiddleware | WrappingMiddleware

/**
 * The shape this client's internal pipeline produces. Mirrors the historical
 * `ResponseEvent` from the get-it v8 multi-event observable, so all the existing
 * downstream code (`_requestObservable`, `_uploadObservable`,
 * `defineCreateClient`) keeps working without churn.
 *
 * @internal
 */
export interface ResponseEvent {
  type: 'response'
  body: unknown
  statusCode: number
  statusMessage: string | null
  headers: Record<string, string>
  url: string
  method: string
}

/**
 * Legacy "requester" type — the result of `defineHttpRequest`. Returns a
 * single-event Observable for compatibility with the rest of the codebase.
 *
 * @internal
 */
export type LegacyRequester = (options: Any) => Observable<ResponseEvent>

/**
 * Options for tuning the HTTP request pipeline per-client.
 *
 * @internal
 */
export interface HttpRequestConfig {
  ignoreWarnings?: string | RegExp | Array<string | RegExp>
  maxRetries?: number
  retryDelay?: (attemptNumber: number) => number
}

/** @internal */
export function defineHttpRequest(
  envOptions: EnvironmentOptions,
  config: HttpRequestConfig = {},
): LegacyRequester {
  const requester = createRequester({
    ...(envOptions.fetch ? {fetch: envOptions.fetch} : {}),
    headers: envOptions.headers,
    // Keep get-it's built-in 4xx/5xx → HttpError so the retry middleware can
    // see them; we translate to ClientError/ServerError after the retry loop
    // has exhausted in `executeRequest`.
    httpErrors: true,
    middleware: [
      retry({
        shouldRetry: legacyShouldRetry,
        maxRetries: config.maxRetries ?? 5,
        ...(config.retryDelay ? {retryDelay: config.retryDelay} : {}),
      }),
      ...envOptions.middleware,
      printWarnings(config),
    ],
  })

  return (options: Any) => {
    const fetchOptions = adaptToFetchOptions(options)
    return from(executeRequest(requester, fetchOptions, options))
  }
}

/**
 * Options describing the environment-specific defaults (Node vs. browser).
 *
 * @internal
 */
export interface EnvironmentOptions {
  fetch?: FetchRequestOptions['fetch']
  headers?: Record<string, string>
  middleware: LegacyMiddleware[]
}

async function executeRequest(
  requester: ReturnType<typeof createRequester>,
  fetchOptions: FetchRequestOptions,
  legacyOptions: Any,
): Promise<ResponseEvent> {
  const url = fetchOptions.url
  const method = (fetchOptions.method ?? 'GET').toUpperCase()

  let response
  try {
    response = await requester(fetchOptions)
  } catch (err) {
    if (err instanceof GetItHttpError) {
      // `err.body` is the response body as a string (get-it v9 stores the
      // already-decoded text), regardless of which response variant
      // `err.response` is.
      const errBodyText = typeof err.body === 'string' ? err.body : ''
      const errBody = parseJsonText(errBodyText, err.headers)
      const canonical = httpResponseFromFetch(
        {
          status: err.status,
          statusText: err.statusText,
          headers: err.headers,
          body: errBody,
        },
        url,
        method,
      )
      const tag = typeof legacyOptions.query?.tag === 'string' ? legacyOptions.query.tag : undefined
      if (canonical.statusCode >= 500) {
        throw new ServerError(canonical)
      }
      throw new ClientError(canonical, tag)
    }
    throw err
  }

  const body = parseJsonBody(response)
  return {
    type: 'response',
    body,
    statusCode: response.status,
    statusMessage: response.statusText || null,
    headers: headersToRecord(response.headers),
    url,
    method,
  }
}

function parseJsonBody(response: {headers: Headers; text(): string}): unknown {
  return parseJsonText(response.text(), response.headers)
}

function parseJsonText(text: string, headers: Headers): unknown {
  const contentType = (headers.get('content-type') ?? '').toLowerCase()
  if (!text) return undefined
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function adaptToFetchOptions(options: Any): FetchRequestOptions {
  const url: string = options.url ?? options.uri
  if (typeof url !== 'string') {
    throw new TypeError('Request options must include a `url` or `uri`')
  }

  const fetchOptions: FetchRequestOptions = {url}

  if (options.method) fetchOptions.method = options.method
  if (options.body !== undefined) fetchOptions.body = options.body
  if (options.headers) fetchOptions.headers = options.headers
  if (options.query) fetchOptions.query = adaptQuery(options.query)
  if (options.signal) fetchOptions.signal = options.signal

  // Timeout: legacy used `0` to disable; v9 uses `false`. Anything else is ms.
  if (options.timeout !== undefined) {
    fetchOptions.timeout = options.timeout === 0 ? false : options.timeout
  }

  if (options.withCredentials) fetchOptions.credentials = 'include'

  // Legacy callers pass `maxRedirects: 0` to opt out of redirects.
  if (options.maxRedirects === 0) fetchOptions.redirect = 'manual'

  if (typeof options.fetch === 'function') fetchOptions.fetch = options.fetch

  // Per-request proxy is a Node-only legacy feature. Stash it in `meta` so
  // the Node middleware can swap in a proxy-configured fetch for this call.
  if (typeof options.proxy === 'string') {
    fetchOptions.meta = {...fetchOptions.meta, proxy: options.proxy}
  }

  return fetchOptions
}

/**
 * Expand array-valued query params into repeated keys.
 *
 * get-it v9 stringifies a plain object's values directly, so passing
 * `{meta: ['palette', 'location']}` would produce `?meta=palette,location`
 * — which Content Lake doesn't recognise. v8 expanded arrays into
 * `?meta=palette&meta=location`; we restore that shape via `URLSearchParams`.
 *
 * @internal
 */
function adaptQuery(query: Any): FetchRequestOptions['query'] {
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

function legacyShouldRetry(
  err: unknown,
  attempt: number,
  options: FetchRequestOptions,
): boolean {
  // Allow opting out of retries via meta
  if (options.meta && (options.meta as Any).maxRetries === 0) return false

  // HTTP errors aren't usually retryable, but Content Lake gives us a few
  // status codes where retrying *is* the right move.
  if (err instanceof GetItHttpError) {
    const isSafe = (options.method ?? 'GET') === 'GET' || options.method === 'HEAD'
    const isQuery = (options.url ?? '').includes('/data/query')
    const status = err.status
    const retryableStatus = status === 429 || status === 502 || status === 503
    if ((isSafe || isQuery) && retryableStatus) return true
    return false
  }

  return isRetryableRequest(err, attempt, options)
}

function printWarnings(config: HttpRequestConfig): TransformMiddleware {
  const seen: Record<string, boolean> = {}

  const shouldIgnore = (message: string): boolean => {
    if (config.ignoreWarnings === undefined) return false
    const patterns = Array.isArray(config.ignoreWarnings)
      ? config.ignoreWarnings
      : [config.ignoreWarnings]
    return patterns.some((pattern) =>
      typeof pattern === 'string' ? message.includes(pattern) : pattern.test(message),
    )
  }

  return {
    afterResponse(response) {
      const header = response.headers.get('x-sanity-warning')
      if (!header) return response
      // Multiple warnings can be comma-separated per HTTP header semantics.
      for (const msg of header.split(',').map((m) => m.trim())) {
        if (!msg || seen[msg] || shouldIgnore(msg)) continue
        seen[msg] = true
        // eslint-disable-next-line no-console
        console.warn(msg)
      }
      return response
    },
  }
}
