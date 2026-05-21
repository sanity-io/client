import {Readable} from 'node:stream'

import createDebugLogger from 'debug'
import {debug} from 'get-it/middleware'
import {createNodeFetch} from 'get-it/node'

import {name, version} from '../../package.json'
import type {EnvironmentOptions, LegacyMiddleware} from './request'

const log = createDebugLogger('sanity:client')

// One undici-backed fetch per (proxy URL) so callers don't pay the cost of
// rebuilding a dispatcher on every request when they use the same proxy.
const proxyFetchCache = new Map<string, ReturnType<typeof createNodeFetch>>()

function getProxyFetch(proxyUrl: string): ReturnType<typeof createNodeFetch> {
  const cached = proxyFetchCache.get(proxyUrl)
  if (cached) return cached
  const fetch = createNodeFetch({proxy: proxyUrl, connections: 30})
  proxyFetchCache.set(proxyUrl, fetch)
  return fetch
}

const middleware: LegacyMiddleware[] = [
  debug({log: (message, ...args) => log(message, ...args), verbose: true}),

  // Lineage is used for recursion control/tracing and can be passed either
  // through client constructor or through environment variable. Not used in
  // browser environments.
  {
    beforeRequest(opts) {
      const lineage =
        (typeof process !== 'undefined' && process.env.X_SANITY_LINEAGE) ||
        (opts as {lineage?: string}).lineage
      if (!lineage) return opts
      const headers = new Headers(opts.headers)
      headers.set('x-sanity-lineage', lineage)
      return {...opts, headers}
    },
  },

  // Asset uploads can pass a Node.js Readable stream (from
  // `fs.createReadStream(...)`) as the body. get-it v9's body type guard only
  // accepts Web streams, so we project Node streams here. undici's fetch
  // accepts Web streams natively.
  {
    beforeRequest(opts) {
      const body = opts.body
      if (!body || typeof (body as {pipe?: unknown}).pipe !== 'function') return opts
      if (typeof Readable.toWeb !== 'function') return opts
      return {...opts, body: Readable.toWeb(body as Readable)}
    },
  },

  // Per-request proxy support. Legacy callers can pass `proxy: 'http://...'`
  // and we swap in a proxy-configured fetch for that single request.
  async (opts, next) => {
    const proxy = opts.meta?.proxy
    if (typeof proxy !== 'string' || opts.fetch) return next(opts)
    return next({...opts, fetch: getProxyFetch(proxy)})
  },

  // Test-only escape hatch: if a global mock fetch has been registered
  // (typically by `test/helpers/setupMockFetch.ts`), route requests through
  // it. Lets the test suite swap out the underlying transport without each
  // test having to thread `fetch: ...` into every `createClient` call.
  async (opts, next) => {
    const globalFetch = (globalThis as {__sanityTestFetch?: typeof opts.fetch})
      .__sanityTestFetch
    if (typeof globalFetch !== 'function' || opts.fetch) return next(opts)
    return next({...opts, fetch: globalFetch})
  },
]

/**
 * Node-specific environment options used to wire up `createRequester`.
 *
 * - `User-Agent` defaults to `@sanity/client <version>`.
 * - Falls back to get-it/node's default undici-backed fetch (which honours
 *   `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` env vars via undici's
 *   `EnvHttpProxyAgent`). Per-request proxy overrides are wired in via the
 *   wrapping middleware above.
 *
 * @internal
 */
const environment: EnvironmentOptions = {
  headers: {'User-Agent': `${name} ${version}`},
  middleware,
}

export default environment
