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
 * Promise-based sibling of {@link LegacyRequester}. Resolves directly to the
 * single `ResponseEvent` the transport produces, skipping the RxJS wrapper.
 * Used by the promise-based client surface so it never constructs an
 * Observable.
 *
 * @internal
 */
export type PromiseRequester = (options: Any) => Promise<ResponseEvent>

/**
 * Both forms of the transport, sharing a single underlying get-it requester
 * (so retry state and the one-shot warning de-duplication are shared between
 * the observable and promise paths).
 *
 * @internal
 */
export interface DualRequester {
  observable: LegacyRequester
  promise: PromiseRequester
}

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

// Test-only escape hatch: if a global mock fetch has been registered
// (typically by `test/helpers/setupMockFetch.ts`), route requests through
// it. Lets the test suite swap out the underlying transport without each
// test having to thread `fetch: ...` into every `createClient` call.
const testFetchOverride: WrappingMiddleware = async (opts, next) => {
  const globalFetch = (globalThis as {__sanityTestFetch?: typeof opts.fetch}).__sanityTestFetch
  if (typeof globalFetch !== 'function' || opts.fetch) return next(opts)
  return next({...opts, fetch: globalFetch})
}

/**
 * Build both the observable and promise transport forms from a single get-it
 * requester. The promise form is the primitive (`executeRequest` is already
 * promise-based); the observable form simply wraps it with `from()`.
 *
 * @internal
 */
export function defineRequester(
  envOptions: EnvironmentOptions,
  config: HttpRequestConfig = {},
): DualRequester {
  // Framework-patched fetch implementations read extra `RequestInit` fields
  // for caching semantics — Next.js App Router's `cache` and `next` options in
  // particular. Legacy callers pass those via an object-valued `fetch` request
  // option (see `adaptToFetchOptions`, which stashes it in `meta.fetchInit`
  // since get-it v9's own `fetch` option only accepts a function). Merge them
  // into the init of whichever fetch implementation is effective for the
  // request: per-request/test-override fetch, the environment default, or the
  // global fetch.
  const applyFetchInit: WrappingMiddleware = (opts, next) => {
    const fetchInit = opts.meta?.fetchInit
    if (typeof fetchInit !== 'object' || fetchInit === null) return next(opts)
    const baseFetch: NonNullable<FetchRequestOptions['fetch']> =
      opts.fetch ?? envOptions.fetch ?? globalThis.fetch
    const fetchWithInit: typeof baseFetch = (input, init) =>
      baseFetch(input, {...fetchInit, ...init})
    return next({...opts, fetch: fetchWithInit})
  }

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
      testFetchOverride,
      applyFetchInit,
      printWarnings(config),
    ],
  })

  const promise: PromiseRequester = (options: Any) => {
    const fetchOptions = adaptToFetchOptions(options)
    return executeRequest(requester, fetchOptions, options)
  }

  return {
    promise,
    observable: (options: Any) => from(promise(options)),
  }
}

/** @internal */
export function defineHttpRequest(
  envOptions: EnvironmentOptions,
  config: HttpRequestConfig = {},
): LegacyRequester {
  return defineRequester(envOptions, config).observable
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
  /**
   * Resolves the environment's fetch implementation — the same transport
   * regular requests use (custom fetch variants, undici configuration,
   * env-proxy support and all), optionally configured for an explicit proxy
   * URL. Lets consumers of the resolved config (the EventSource fetch
   * resolver) avoid falling back to whatever `globalThis.fetch` happens to
   * be. The Node environment supplies get-it's undici-backed fetch; the
   * browser environment leaves it unset (the global fetch IS the
   * environment's fetch there).
   *
   * Looked up via the env rather than imported directly so that the Node-only
   * `get-it/node` (which transitively pulls in `undici`) never ends up in the
   * browser/UMD bundle, even via rollup's inlined dynamic imports.
   */
  resolveFetch?: (proxyUrl?: string) => typeof fetch
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
    response = await withSoftTimeout(requester(fetchOptions), fetchOptions, url)
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

/**
 * Enforce a rejection-only timeout for requests that must not carry an abort
 * signal (see the `useAbortSignal` handling in `adaptToFetchOptions`). The
 * underlying request is left running when the timeout wins — the same
 * trade-off the get-it v8 fetch transport made — so a memoizing fetch
 * implementation (React/Next.js) can still settle the shared promise for
 * other consumers.
 */
function withSoftTimeout<T>(
  pending: Promise<T>,
  fetchOptions: FetchRequestOptions,
  url: string,
): Promise<T> {
  const softTimeout = fetchOptions.meta?.softTimeout
  if (typeof softTimeout !== 'number' || softTimeout <= 0) return pending

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new DOMException(
          `The operation timed out after ${softTimeout}ms while attempting to reach ${url}`,
          'TimeoutError',
        ),
      )
    }, softTimeout)
  })
  // If the timeout wins, the still-running request must not surface as an
  // unhandled rejection when it eventually settles.
  pending.catch(() => {})
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer))
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

  // `useAbortSignal: false` is set by the query path when the caller provided
  // no signal of their own, and means no AbortSignal may reach the fetch init:
  // Next.js' patched fetch opts a request out of React Request Memoization
  // whenever `init.signal` is present (next/dist/server/lib/dedupe-fetch.js),
  // and get-it v9 implements timeouts via `AbortSignal.timeout()` — including
  // a 120s default when no timeout is given. Disable the transport timeout
  // and let `executeRequest` enforce it as a rejection-only "soft" timeout
  // instead, mirroring the get-it v8 fetch transport (which likewise never
  // aborted the underlying request when `useAbortSignal` was false).
  if (options.useAbortSignal === false && !fetchOptions.signal) {
    const softTimeout = fetchOptions.timeout
    fetchOptions.timeout = false
    if (typeof softTimeout === 'number' && softTimeout > 0) {
      fetchOptions.meta = {...fetchOptions.meta, softTimeout}
    }
  }

  if (options.withCredentials) fetchOptions.credentials = 'include'

  // Legacy callers pass `maxRedirects: 0` to opt out of redirects.
  if (options.maxRedirects === 0) fetchOptions.redirect = 'manual'

  // The legacy `fetch` option is either a custom fetch implementation
  // (function) or a bag of extra `RequestInit` fields (object) — Next.js App
  // Router's `cache`/`next` caching options arrive as the latter, via
  // `client.fetch(query, params, {cache, next})`. get-it v9's `fetch` option
  // only accepts a function, so the init extras travel in `meta` and are
  // merged into the effective fetch by the `applyFetchInit` middleware.
  // (A boolean `fetch` was v8's "force the fetch transport" switch — a no-op
  // now that fetch is the only transport.)
  if (typeof options.fetch === 'function') {
    fetchOptions.fetch = options.fetch
  } else if (typeof options.fetch === 'object' && options.fetch !== null) {
    fetchOptions.meta = {...fetchOptions.meta, fetchInit: options.fetch}
  }

  // An explicit `proxy` from the client config arrives pre-resolved as the
  // internal `proxyFetch` (see `requestOptions`). Resolved from the live
  // config on every request, so replacing the proxy via `client.config()` or
  // `withConfig()` applies to subsequent requests. A caller-supplied `fetch`
  // function wins over it.
  if (!fetchOptions.fetch && typeof options.proxyFetch === 'function') {
    fetchOptions.fetch = options.proxyFetch
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

function legacyShouldRetry(err: unknown, attempt: number, options: FetchRequestOptions): boolean {
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
