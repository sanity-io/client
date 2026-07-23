import {
  createRequester,
  type FetchFunction,
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

/**
 * Build both the observable and promise transport forms from a single get-it
 * requester. The promise form is the primitive (`executeRequest` is already
 * promise-based); the observable form wraps it lazily so each subscription
 * starts its own request (cold), and unsubscribing aborts the in-flight
 * fetch — the same contract as the get-it v8 observable adapter.
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
        shouldRetry: shouldRetryRequest,
        maxRetries: config.maxRetries ?? 5,
        ...(config.retryDelay ? {retryDelay: config.retryDelay} : {}),
      }),
      ...envOptions.middleware,
      applyFetchInit,
      printWarnings(config),
    ],
  })

  const promise: PromiseRequester = (options: Any) => {
    // Options arrive fetch-shaped from `requestOptions` — the single
    // translation boundary between public option names and the transport.
    if (typeof options.url !== 'string') {
      throw new TypeError('Request options must include a `url`')
    }
    // The raw `requester` export accepts the v8-style top-level `maxRetries`;
    // normalize it into `meta` where the retry predicate can see it. (The
    // client path already does this in `requestOptions`.)
    const fetchOptions =
      typeof options.maxRetries === 'number' && typeof options.meta?.maxRetries !== 'number'
        ? {...options, meta: {...options.meta, maxRetries: options.maxRetries}}
        : options
    return executeRequest(requester, fetchOptions)
  }

  // Same per-subscription AbortController pattern as `_observe` in
  // dataMethods: a caller-supplied signal is combined in via
  // `AbortSignal.any`, so the request aborts both on the caller's signal and
  // on unsubscribe. `AbortSignal.any` (rather than `addEventListener`)
  // because the caller's signal can be long-lived and reused — a manually
  // added listener would accumulate there once per subscription, since
  // `{once: true}` only cleans up if the signal actually fires.
  const observable: LegacyRequester = (options: Any) =>
    new Observable<ResponseEvent>((subscriber) => {
      const controller = new AbortController()
      const userSignal: AbortSignal | undefined = options.signal
      const signal = userSignal
        ? AbortSignal.any([userSignal, controller.signal])
        : controller.signal
      const subscription = from(promise({...options, signal})).subscribe(subscriber)
      return () => {
        subscription.unsubscribe()
        controller.abort()
      }
    })

  return {promise, observable}
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
  resolveFetch?: (proxyUrl?: string) => FetchFunction
}

async function executeRequest(
  requester: ReturnType<typeof createRequester>,
  fetchOptions: FetchRequestOptions,
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
      const tag = extractRequestTag(fetchOptions.query)
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
 * Extract the GROQ request tag (used for error messages) from the query.
 */
function extractRequestTag(query: FetchRequestOptions['query']): string | undefined {
  if (!query) return undefined
  if (query instanceof URLSearchParams) return query.get('tag') ?? undefined
  const tag = query.tag
  return typeof tag === 'string' ? tag : undefined
}

/**
 * Enforce a rejection-only timeout for requests that must not carry an abort
 * signal (see the `useAbortSignal` handling in `requestOptions`). The
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

/**
 * Parse a response body according to its `content-type`: JSON when the header
 * says so (falling back to the raw text on malformed JSON), text otherwise.
 * Shared with the browser XHR upload path so error bodies parse identically
 * on both transports.
 *
 * @internal
 */
export function parseJsonText(text: string, headers: Headers): unknown {
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

function shouldRetryRequest(err: unknown, attempt: number, options: FetchRequestOptions): boolean {
  // Per-request retry cap/opt-out, v8 parity: both the raw `requester`
  // export and `client.request()` accept a per-request `maxRetries`, carried
  // in `meta` (see `requestOptions` and `defineRequester`). It can cap below,
  // but not extend beyond, the client-level maximum.
  const perRequestMax = options.meta?.maxRetries
  if (typeof perRequestMax === 'number' && attempt >= perRequestMax) return false

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
