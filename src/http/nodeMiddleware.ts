import {Readable} from 'node:stream'

import createDebugLogger from 'debug'
import {debug} from 'get-it/middleware'
import {createNodeFetch} from 'get-it/node'

import {name, version} from '../../package.json'
import type {EnvironmentOptions, LegacyMiddleware} from './request'

const log = createDebugLogger('sanity:client')

function isNodeReadableStream(value: unknown): value is Readable {
  if (typeof value !== 'object' || value === null) return false
  if (!('pipe' in value)) return false
  return typeof value.pipe === 'function'
}

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

// The environment's default fetch, shared by all SSE connections that have no
// explicit proxy configured. Built lazily so clients that never use
// `listen()`/`live.events()` don't pay for the dispatcher.
let envDefaultFetch: ReturnType<typeof createNodeFetch> | undefined

/**
 * Exposed via `EnvironmentOptions.resolveFetch` so EventSource connections
 * use the same transport as regular requests instead of falling back to
 * `globalThis.fetch`. Everything get-it's Node fetch provides then applies
 * to SSE too: the undici dispatcher configuration, an explicit `proxy`
 * config (pass the URL), and env-proxy support
 * (`HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`, which Node's own global fetch does
 * not read — that is opt-in via `NODE_USE_ENV_PROXY`, and not on our 22.12
 * floor). Reached via the env rather than a direct import so `get-it/node`
 * (and with it `undici`) stays out of the browser bundle.
 *
 * @internal
 */
function resolveFetch(proxyUrl?: string): typeof fetch {
  if (typeof proxyUrl === 'string') {
    return getProxyFetch(proxyUrl) as unknown as typeof fetch
  }
  envDefaultFetch ??= createNodeFetch()
  return envDefaultFetch as unknown as typeof fetch
}

const middleware: LegacyMiddleware[] = [
  debug({log: (message, ...args) => log(message, ...args), verbose: true}),

  // Lineage is used for recursion control/tracing and can be passed either
  // through the client config (arrives as `meta.lineage`, set by
  // `requestOptions`) or through an environment variable. Not used in
  // browser environments.
  {
    beforeRequest(opts) {
      const configLineage = typeof opts.meta?.lineage === 'string' ? opts.meta.lineage : undefined
      const lineage =
        (typeof process !== 'undefined' && process.env.X_SANITY_LINEAGE) || configLineage
      if (!lineage) return opts
      const headers = new Headers(opts.headers)
      headers.set('x-sanity-lineage', lineage)
      return {...opts, headers}
    },
  },

  // Asset uploads can pass a Node.js Readable stream (from
  // `fs.createReadStream(...)`) as the body. The HTTP transport's body type
  // guard only accepts Web streams, so we project Node streams here —
  // undici's fetch accepts Web streams natively.
  {
    beforeRequest(opts) {
      if (!isNodeReadableStream(opts.body)) return opts
      return {...opts, body: Readable.toWeb(opts.body)}
    },
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
  resolveFetch,
}

export default environment
