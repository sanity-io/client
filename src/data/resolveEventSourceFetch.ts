import type {EventSourceFetchInit, FetchLikeResponse} from 'eventsource'
import type {FetchFunction, FetchInit} from 'get-it'

import {type CanonicalHttpResponse, httpResponseFromFetch} from '../http/errors'
import type {InitializedClientConfig} from '../types'

/**
 * A connection attempt the server answered with a non-2xx response, as seen
 * by the fetch handed to the `eventsource` package. The package itself never
 * reads the body of a rejected response (it only reports the status), so
 * this is the only place the client gets to see the API's error payload.
 *
 * @internal
 */
export interface RejectedEventSourceResponse {
  /** The rejected response, in the same shape `ClientError`/`ServerError` expose. */
  response: CanonicalHttpResponse
  /** Raw body text. `undefined` if the body could not be read. */
  responseBody?: string
}

/** @internal */
export interface EventSourceFetchOptions {
  /**
   * Headers that must be merged into every EventSource request. Used for
   * the `Authorization` token, custom `headers` from the client config,
   * etc. — things the native EventSource API has no equivalent for.
   */
  headers?: Record<string, string>
  /**
   * If the client was configured with `withCredentials: true`, the
   * resolved fetch forwards `credentials: 'include'` so the browser
   * attaches cookies to the SSE request.
   */
  withCredentials?: boolean
  /**
   * Called with every non-2xx response, after its body has been read, and
   * before the response is handed back to the `eventsource` package. Lets
   * the connection layer attach the API's error payload to the
   * `ConnectionFailedError` it raises for the rejection.
   */
  onRejectedResponse?: (rejected: RejectedEventSourceResponse) => void
}

/**
 * Build a `fetch` implementation suitable for the `eventsource` package's
 * `fetch` option. Routes the EventSource connection through the same
 * transport layer the rest of the client uses, so things like the
 * test-fetch override, the per-request `proxy` config, and `HTTPS_PROXY`
 * env-var support apply to SSE too.
 *
 * Resolution order on each request:
 *
 *   1. `config.resolveFetch(config.proxy)` if set — the client's fetch
 *      resolver, so SSE uses the same transport as regular requests:
 *      custom fetch variants (incl. the test suite's injected mock),
 *      undici configuration, an explicit `proxy` config, and env-proxy
 *      support all apply to SSE too. The Node entry supplies get-it's
 *      undici-backed fetch (threading the resolver through the env
 *      instead of importing `get-it/node` directly keeps `undici` out of
 *      the browser bundle); the browser entry leaves it unset.
 *   2. `globalThis.fetch`. Note that Node's global fetch does NOT read
 *      proxy env vars (that is opt-in via `NODE_USE_ENV_PROXY`), which
 *      is one of the reasons step 1 exists.
 *
 * The returned fetch always merges `options.headers` into the outgoing
 * request, regardless of which underlying fetch was picked.
 *
 * @internal
 */
export function resolveEventSourceFetch(
  config: InitializedClientConfig,
  options: EventSourceFetchOptions = {},
): EventSourceFetch {
  const extraHeaders = options.headers
  const credentials: FetchInit['credentials'] = options.withCredentials ? 'include' : undefined
  const onRejectedResponse = options.onRejectedResponse

  return async function eventSourceFetch(url, init) {
    const baseFetch = pickBaseFetch(config)
    const href = typeof url === 'string' ? url : url.href

    // Extra `EventSourceFetchInit` fields get-it's `FetchInit` doesn't
    // declare (`mode`, `cache`) survive the spread and reach whichever
    // fetch implementation is effective.
    const mergedInit: FetchInit = {...init}
    if (extraHeaders) {
      const headers = new Headers(init?.headers)
      for (const [key, value] of Object.entries(extraHeaders)) {
        headers.set(key, value)
      }
      mergedInit.headers = headers
    }
    if (credentials !== undefined) {
      mergedInit.credentials = credentials
    }
    // get-it's `FetchResponse` is a structural superset of the package's
    // `FetchLikeResponse`, so it can be handed over as-is.
    const response = await baseFetch(href, mergedInit)
    if (onRejectedResponse && !response.ok) {
      onRejectedResponse(await readRejectedResponse(response, href))
    }
    return response
  }
}

/**
 * Reads the body of a rejected (non-2xx) connection attempt. A 2xx body is
 * the event stream itself and must never be touched here; a rejected body is
 * a one-off error payload the `eventsource` package would otherwise discard.
 *
 * Never throws: a body that cannot be read (stream error, aborted request)
 * leaves both `responseBody` and `response.body` undefined, so the caller
 * still learns the status, URL and headers of the rejection.
 */
async function readRejectedResponse(
  response: Awaited<ReturnType<FetchFunction>>,
  requestUrl: string,
): Promise<RejectedEventSourceResponse> {
  let responseBody: string | undefined
  try {
    responseBody = await response.text()
  } catch {
    responseBody = undefined
  }
  // Picked field by field: on a real `Response` these are prototype getters,
  // which an object spread would not copy.
  const {status, statusText, headers, url} = response
  return {
    response: httpResponseFromFetch(
      {
        status,
        statusText,
        headers,
        url,
        body: responseBody === undefined ? undefined : parseBody(responseBody),
      },
      requestUrl,
      'GET',
    ),
    responseBody,
  }
}

/**
 * The API answers rejections with a JSON `{error, message, errorCode}` body,
 * but a proxy or load balancer in front of it may answer with HTML or plain
 * text. Expose JSON parsed (so consumers can read `body.errorCode`) and
 * anything else as the raw string, mirroring what get-it does for regular
 * requests.
 */
function parseBody(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * The fetch shape handed to the `eventsource` package: accepts what its
 * `FetchLike` passes in, requires only what get-it's `FetchFunction`
 * guarantees back — the full `typeof fetch` contract is not needed anywhere
 * in this chain.
 *
 * @internal
 */
export type EventSourceFetch = (
  url: string | URL,
  init?: EventSourceFetchInit,
) => Promise<FetchLikeResponse>

/**
 * The fetch the client's own transport resolves for this config: the
 * configured `resolveFetch` (honouring an explicit `proxy`) if present,
 * otherwise the global fetch. Shared by the EventSource connection and the
 * `/check/cors` probe so both resolve identically.
 *
 * @internal
 */
export function pickBaseFetch(config: InitializedClientConfig): FetchFunction {
  if (config.resolveFetch) {
    return config.resolveFetch(typeof config.proxy === 'string' ? config.proxy : undefined)
  }
  return globalThis.fetch.bind(globalThis)
}
