import type {EventSourceFetchInit, FetchLikeResponse} from 'eventsource'
import type {FetchFunction, FetchInit} from 'get-it'

import type {InitializedClientConfig} from '../types'

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
 *      the browser/UMD bundle); the browser entry leaves it unset.
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

  return function eventSourceFetch(url, init) {
    const baseFetch = pickBaseFetch(config)

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
    return baseFetch(typeof url === 'string' ? url : url.href, mergedInit)
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

function pickBaseFetch(config: InitializedClientConfig): FetchFunction {
  if (config.resolveFetch) {
    return config.resolveFetch(typeof config.proxy === 'string' ? config.proxy : undefined)
  }
  return globalThis.fetch.bind(globalThis)
}
