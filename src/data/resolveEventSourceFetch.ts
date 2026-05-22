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
 *   2. `get-it/node`'s `createNodeFetch({proxy})` if `config.proxy` is
 *      set. Lazy-loaded on first use so the browser bundle never pulls
 *      in `undici`.
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

  let proxyFetchPromise: Promise<typeof fetch> | null = null
  const getProxyFetch = (): Promise<typeof fetch> => {
    if (proxyFetchPromise) return proxyFetchPromise
    proxyFetchPromise = import('get-it/node').then(
      (m) => m.createNodeFetch({proxy: config.proxy as string}) as unknown as typeof fetch,
    )
    return proxyFetchPromise
  }

  return async function eventSourceFetch(input, init) {
    const baseFetch = pickBaseFetch(config, getProxyFetch)
    const fetchFn = baseFetch instanceof Promise ? await baseFetch : baseFetch

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
    return fetchFn(input, mergedInit)
  }
}

function pickBaseFetch(
  config: InitializedClientConfig,
  getProxyFetch: () => Promise<typeof fetch>,
): typeof fetch | Promise<typeof fetch> {
  const testFetch = (globalThis as {__sanityTestFetch?: typeof fetch}).__sanityTestFetch
  if (testFetch) return testFetch
  if (typeof config.proxy === 'string' && typeof window === 'undefined') {
    return getProxyFetch()
  }
  return globalThis.fetch.bind(globalThis)
}
