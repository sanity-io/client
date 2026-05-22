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
 *   1. `globalThis.__sanityTestFetch` if set (test mock fetch — keeps
 *      the listener/live tests on the same shim as the rest of the
 *      suite). Read per-call so each request honours the currently
 *      installed mock.
 *   2. `config.resolveProxyFetch(proxy)` if both are set. The Node entry
 *      point supplies `resolveProxyFetch`; the browser entry point does
 *      not. Threading the resolver through the env (instead of importing
 *      `get-it/node` directly) keeps `undici` out of the browser/UMD
 *      bundle, including the inlined-dynamic-import variant.
 *   3. `globalThis.fetch` (no extra dispatcher — Node's default fetch
 *      already honours `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` env
 *      vars via undici's `EnvHttpProxyAgent`).
 *
 * The returned fetch always merges `options.headers` into the outgoing
 * request, regardless of which underlying fetch was picked.
 *
 * @internal
 */
export function resolveEventSourceFetch(
  config: InitializedClientConfig,
  options: EventSourceFetchOptions = {},
): typeof fetch {
  const extraHeaders = options.headers
  const credentials: RequestCredentials | undefined = options.withCredentials
    ? 'include'
    : undefined

  return function eventSourceFetch(input, init) {
    const baseFetch = pickBaseFetch(config)

    const mergedInit: RequestInit = {...init}
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
    return baseFetch(input, mergedInit)
  }
}

function pickBaseFetch(config: InitializedClientConfig): typeof fetch {
  const testFetch = (globalThis as {__sanityTestFetch?: typeof fetch}).__sanityTestFetch
  if (testFetch) return testFetch
  if (typeof config.proxy === 'string' && config.resolveProxyFetch) {
    return config.resolveProxyFetch(config.proxy)
  }
  return globalThis.fetch.bind(globalThis)
}
