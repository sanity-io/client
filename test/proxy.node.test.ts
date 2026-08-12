import {readFileSync} from 'node:fs'
import {createServer, type IncomingMessage, type Server} from 'node:http'
import {type AddressInfo, type Socket} from 'node:net'
import {join as joinPath} from 'node:path'
import {TLSSocket} from 'node:tls'

// Load pre-generated test certificates - a server cert signed by the test CA
// in `certs/ca.pem`, so the client can verify it for real instead of
// disabling TLS verification. See `certs/README.md`.
const testCert = {
  key: readFileSync(joinPath(__dirname, 'certs', 'server', 'key.pem')),
  cert: readFileSync(joinPath(__dirname, 'certs', 'server', 'cert.pem')),
}
const testCaPath = joinPath(__dirname, 'certs', 'ca.pem')

import {createClient as createCoreClient} from '@sanity/client'
import type {FetchFunction} from 'get-it'
import {ProxyAgent} from 'undici'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'

import {requestOptions} from '../src/http/requestOptions'
import {getActiveFetch, getActiveMock} from './helpers/mockFetch'

const testCaCert = readFileSync(testCaPath)

// Body the mock proxy sends back for a plain-HTTP tunneled target (see the
// "production proxy fetch" test below), distinguishable from the JSON
// Sanity-API-shaped response used for the HTTPS targets.
const PLAIN_HTTP_RESPONSE_BODY = 'plain http response body'

/**
 * Builds a fetch that tunnels through `proxyUrl` and verifies the far end's
 * certificate against the test CA, instead of disabling TLS verification for
 * the whole process (which this replaces).
 *
 * This constructs its own undici `ProxyAgent` rather than going through
 * get-it's `createNodeFetch({proxy, tls: {ca}})` (what the production
 * `resolveFetch` in `src/http/nodeMiddleware.ts` uses): get-it's public
 * `TlsOptions` only forwards `cert`/`key`/`ca`, and this also needs
 * `servername`, which that type doesn't expose.
 *
 * `servername` is needed because verification for a CONNECT-tunneled request
 * is against the *origin* hostname the client believes it's calling (e.g.
 * `abc123.api.sanity.io`), not the tunnel's own address - confirmed
 * empirically: with only `ca` set, the request failed with
 * `ERR_TLS_CERT_ALTNAME_INVALID: Host: abc123.api.sanity.io. is not in the
 * cert's altnames: IP Address:127.0.0.1, DNS:localhost`. The test server's
 * certificate is issued for what it actually is - `127.0.0.1`/`localhost` -
 * so `servername` pins verification to that real identity, the same idea as
 * curl's `--resolve` combined with `--cacert` for a service reached through a
 * tunnel. `localhost`, not `127.0.0.1`: RFC 6066 SNI values must be DNS
 * names, not IP literals - Node accepts an IP but logs a deprecation warning
 * for it (`DEP0123`), which `localhost` avoids while matching the cert's
 * other SAN entry just as well.
 */
// Mirrors the `proxyFetchCache` in `src/http/nodeMiddleware.ts`: `resolveFetch`
// runs on every request (`src/http/requestOptions.ts`), so without this a
// `ProxyAgent` - and its own connection pool - would be built and then never
// closed on every single proxied request in this file, a latent leak
// (harmless today only because the mock server below sends
// `Connection: close`). Memoizing per URL, like production does, means the
// tests in this file that make one request reuse nothing new, but a test
// making several through the same client/proxy shares one agent instead of
// piling them up.
const caTrustingProxyFetches = new Map<string, FetchFunction>()

function createCaTrustingProxyFetch(proxyUrl: string): FetchFunction {
  const cached = caTrustingProxyFetches.get(proxyUrl)
  if (cached) return cached

  const dispatcher = new ProxyAgent({
    uri: proxyUrl,
    allowH2: false,
    requestTls: {ca: testCaCert, servername: 'localhost'},
  })
  const proxyFetch: FetchFunction = async (input, init) => {
    const {body, ...rest} = init ?? {}
    // `dispatcher` is a Node-only, non-standard `fetch()` extension (not part
    // of the DOM `RequestInit` type `FetchInit` is deliberately kept
    // compatible with) - hence the intersection type here rather than an
    // inline object literal, which `RequestInit`'s excess-property check
    // would reject.
    const requestInit: RequestInit & {dispatcher: ProxyAgent} = {
      ...rest,
      dispatcher,
      ...(body === undefined ? {} : {body}),
      ...(body instanceof ReadableStream ? {duplex: 'half'} : {}),
    }
    return fetch(input, requestInit)
  }
  caTrustingProxyFetches.set(proxyUrl, proxyFetch)
  return proxyFetch
}

// Proxied requests must reach the real local CONNECT proxy, everything else
// goes through the per-test mock.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({
    resolveFetch: (proxyUrl) =>
      typeof proxyUrl === 'string' ? createCaTrustingProxyFetch(proxyUrl) : getActiveFetch(),
    ...config,
  })

describe('proxy configuration', () => {
  describe('requestOptions', () => {
    test('config proxy resolves to the environment fetch, not a per-request option', () => {
      // The per-request proxy option was removed; a config-level proxy is
      // resolved against the environment's fetch on each request (from the
      // live config, so `config()`/`withConfig()` replacements apply) and
      // becomes the request's `fetch` implementation directly.
      const proxyFetch = async () => new Response('')
      const resolveFetch = vi.fn(() => proxyFetch)
      const config = {
        projectId: 'abc123',
        dataset: 'production',
        proxy: 'http://proxy.example.com:8080',
        resolveFetch,
      }
      const options = requestOptions(config)
      expect('proxy' in options).toBe(false)
      expect(options.fetch).toBe(proxyFetch)
      expect(resolveFetch).toHaveBeenCalledWith('http://proxy.example.com:8080')
    })
  })

  describe('client configuration', () => {
    test('can set proxy in client config', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        proxy: 'http://proxy.example.com:8080',
      })
      expect(client.config().proxy).toBe('http://proxy.example.com:8080')
    })

    test('can update proxy via config()', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
      })
      client.config({proxy: 'http://new-proxy.example.com:8080'})
      expect(client.config().proxy).toBe('http://new-proxy.example.com:8080')
    })

    test('withConfig preserves proxy setting', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        proxy: 'http://proxy.example.com:8080',
      })
      const newClient = client.withConfig({dataset: 'staging'})
      expect(newClient.config().proxy).toBe('http://proxy.example.com:8080')
    })

    test('withConfig can override proxy setting', () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        proxy: 'http://proxy.example.com:8080',
      })
      const newClient = client.withConfig({proxy: 'http://new-proxy.example.com:9090'})
      expect(newClient.config().proxy).toBe('http://new-proxy.example.com:9090')
    })
  })

  describe('proxy server integration', () => {
    let proxyServer: Server
    let proxyPort: number
    let connectRequests: {method: string; url: string; headers: IncomingMessage['headers']}[]
    let tunneledRequests: {method: string; url: string; headers: Record<string, string>}[]

    beforeEach(async () => {
      // TLS verification here is provided by createCaTrustingProxyFetch()
      // above, scoped to this test's own client - not by disabling it for
      // the whole process, as this test used to.
      //
      // `vi.stubEnv('NODE_EXTRA_CA_CERTS', testCaPath)` was tried first, as
      // the more standard mechanism, but empirically has no effect: Node
      // reads that variable once at process start, so stubbing it here
      // (long after boot) still leaves the request failing with
      // `UNABLE_TO_VERIFY_LEAF_SIGNATURE`.
      connectRequests = []
      tunneledRequests = []

      // Create a mock HTTP proxy server that handles CONNECT for tunneling
      proxyServer = createServer()

      // Handle CONNECT method for tunneling. undici's `ProxyAgent` tunnels
      // regardless of the target's scheme (`proxyTunnel` defaults to
      // `true`), so a plain-HTTP target still arrives here as a CONNECT -
      // it just skips the TLS handshake once the tunnel is up. That's used
      // below by the "production proxy fetch" test, which targets a
      // `:80` (plain HTTP) origin so it needs neither the test CA nor a
      // TLS handshake to exercise the real production dispatcher.
      proxyServer.on('connect', (req: IncomingMessage, clientSocket: Socket) => {
        connectRequests.push({
          method: req.method || 'CONNECT',
          url: req.url || '',
          headers: req.headers,
        })

        // Tell the client the tunnel is established
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

        const isPlainHttpTarget = (req.url || '').endsWith(':80')
        const protocol = isPlainHttpTarget ? 'http' : 'https'
        // For an HTTPS target the client TLS-handshakes over the raw tunnel
        // next, so the far end needs to speak TLS back. A plain-HTTP
        // target's tunneled bytes are already plaintext HTTP - nothing to
        // wrap. `TLSSocket` extends `Socket`, so both branches fit the one
        // `Socket`-typed variable below without a cast.
        const tunnelSocket: Socket = isPlainHttpTarget
          ? clientSocket
          : new TLSSocket(clientSocket, {isServer: true, key: testCert.key, cert: testCert.cert})

        // Buffer to accumulate request data
        let requestData = ''

        tunnelSocket.on('data', (data: Buffer) => {
          requestData += data.toString()

          // Check if we have a complete HTTP request (ends with double CRLF)
          if (requestData.includes('\r\n\r\n')) {
            // Parse the HTTP request
            const lines = requestData.split('\r\n')
            const [method, path] = lines[0].split(' ')
            const headers: Record<string, string> = {}

            for (let i = 1; i < lines.length; i++) {
              const line = lines[i]
              if (line === '') break
              const colonIndex = line.indexOf(':')
              if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).toLowerCase()
                const value = line.substring(colonIndex + 1).trim()
                headers[key] = value
              }
            }

            tunneledRequests.push({
              method,
              url: `${protocol}://${req.url}${path}`,
              headers,
            })

            // Send a mock response - the real Sanity API shape for the
            // HTTPS targets every other test in this file uses, a plain
            // distinguishable body for the plain-HTTP target.
            const responseBody = isPlainHttpTarget
              ? PLAIN_HTTP_RESPONSE_BODY
              : JSON.stringify({result: []})
            const response = [
              'HTTP/1.1 200 OK',
              `Content-Type: ${isPlainHttpTarget ? 'text/plain' : 'application/json'}`,
              `Content-Length: ${responseBody.length}`,
              'Connection: close',
              '',
              responseBody,
            ].join('\r\n')

            tunnelSocket.write(response)
            tunnelSocket.end()
          }
        })

        tunnelSocket.on('error', () => {
          // Ignore TLS/socket errors in tests
        })
      })

      await new Promise<void>((resolve) => {
        proxyServer.listen(0, '127.0.0.1', () => {
          proxyPort = (proxyServer.address() as AddressInfo).port
          resolve()
        })
      })
    })

    afterEach(async () => {
      await new Promise<void>((resolve) => proxyServer.close(() => resolve()))
    })

    test('fetch() routes through proxy to project hostname', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
        proxy: `http://127.0.0.1:${proxyPort}`,
      })

      await client.fetch('*[_type == "post"]')

      expect(connectRequests.length).toBe(1)
      expect(connectRequests[0].url).toBe('abc123.api.sanity.io:443')
      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].url).toContain('/v2021-06-07/data/query/production')
    })

    test('fetch() routes through proxy to CDN hostname when useCdn is true', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: true,
        proxy: `http://127.0.0.1:${proxyPort}`,
      })

      await client.fetch('*[_type == "post"]')

      expect(connectRequests.length).toBe(1)
      expect(connectRequests[0].url).toBe('abc123.apicdn.sanity.io:443')
      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].url).toContain('/v2021-06-07/data/query/production')
    })

    test('users.getById() routes through proxy to project hostname', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
        proxy: `http://127.0.0.1:${proxyPort}`,
      })

      await client.users.getById('me')

      expect(connectRequests.length).toBe(1)
      expect(connectRequests[0].url).toBe('abc123.api.sanity.io:443')
      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].url).toContain('/v2021-06-07/users/me')
    })

    test('routes through proxy to global API when useProjectHostname is false', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
        useProjectHostname: false,
        proxy: `http://127.0.0.1:${proxyPort}`,
      })

      await client.users.getById('me')

      expect(connectRequests.length).toBe(1)
      expect(connectRequests[0].url).toBe('api.sanity.io:443')
      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].url).toContain('/v2021-06-07/users/me')
    })

    test('proxy receives authorization header when token is set', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
        proxy: `http://127.0.0.1:${proxyPort}`,
        token: 'test-token',
      })

      await client.fetch('*[_type == "post"]')

      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].headers.authorization).toBe('Bearer test-token')
    })

    test('config({proxy}) applies to subsequent requests', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
      })
      client.config({proxy: `http://127.0.0.1:${proxyPort}`})

      await client.fetch('*[_type == "post"]')

      expect(connectRequests.length).toBe(1)
      expect(connectRequests[0].url).toBe('abc123.api.sanity.io:443')
    })

    test('withConfig({proxy}) applies to the derived client only', async () => {
      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/v2021-06-07/data/query/production?query=*&returnQuery=false')
        .respond({status: 200, body: {result: []}})

      const base = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
      })
      const proxied = base.withConfig({proxy: `http://127.0.0.1:${proxyPort}`})

      await proxied.fetch('*[_type == "post"]')
      expect(connectRequests.length).toBe(1)

      // The base client is unaffected - it goes through the regular
      // (mocked) transport, not the proxy.
      await base.fetch('*')
      expect(connectRequests.length).toBe(1)
    })

    test('a per-request proxy option is no longer honored', async () => {
      // BREAKING (v9): proxying is configured at client instantiation only.
      // A `proxy` passed with request options must be ignored - the request
      // goes through the regular (here: mocked) transport, never the proxy.
      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/v2021-06-07/users/me')
        .respond({status: 200, body: {id: 'me'}})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
      })

      await client.request({
        url: '/users/me',
        // @ts-expect-error -- the per-request `proxy` option was removed
        proxy: `http://127.0.0.1:${proxyPort}`,
      })

      expect(connectRequests.length).toBe(0)
    })

    test('proxy receives project ID header when useProjectHostname is false', async () => {
      const client = createClient({
        projectId: 'abc123',
        dataset: 'production',
        apiVersion: '2021-06-07',
        useCdn: false,
        useProjectHostname: false,
        proxy: `http://127.0.0.1:${proxyPort}`,
      })

      await client.users.getById('me')

      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].headers['x-sanity-project-id']).toBe('abc123')
    })

    test('the production resolveFetch tunnels a real request through the proxy', async () => {
      // Every other test above goes through `createCaTrustingProxyFetch()`,
      // built for this file's TLS-trust needs. This one instead calls the
      // real production `resolveFetch` from `src/http/nodeMiddleware.ts`
      // (`createCoreClient(...).config().resolveFetch` - the same accessor
      // every proxied test in this file used before the CA work, and still
      // what `client.config().resolveFetch` returns in production) to
      // prove the actual `getProxyFetch` / `createNodeFetch({proxy,
      // connections: 30})` dispatcher tunnels a request end to end, not
      // just that constructing it doesn't throw.
      //
      // Targets a plain-HTTP origin, deliberately, so this needs neither
      // the test CA nor a TLS handshake - undici's `ProxyAgent` tunnels
      // regardless of scheme (see the `beforeEach` above), so a CONNECT
      // still happens; the mock proxy just skips wrapping the tunnel in
      // TLS for a `:80` target, since the origin genuinely has none.
      const {resolveFetch} = createCoreClient({
        projectId: 'abc123',
        dataset: 'production',
      }).config()
      if (!resolveFetch) {
        throw new Error('expected the Node entry to supply resolveFetch on the config')
      }
      const proxiedFetch = resolveFetch(`http://127.0.0.1:${proxyPort}`)

      const response = await proxiedFetch('http://plain-http-origin.test/probe')
      const body = await response.text()

      expect(connectRequests.length).toBe(1)
      expect(connectRequests[0].url).toBe('plain-http-origin.test:80')
      expect(tunneledRequests.length).toBe(1)
      expect(tunneledRequests[0].url).toContain('/probe')
      expect(body).toBe(PLAIN_HTTP_RESPONSE_BODY)
    })

    // Skipped under get-it v9 / undici: `EnvHttpProxyAgent` snapshots the
    // HTTPS_PROXY value at construction time, and the default Node fetch is
    // built at module load — so setting the env var inside the test no
    // longer takes effect. Real-world usage (env var set before process
    // start) continues to work, but we can't exercise that swap mid-test.
    test.skip('uses HTTPS_PROXY environment variable automatically', async () => {
      const originalHttpsProxy = process.env.HTTPS_PROXY
      process.env.HTTPS_PROXY = `http://127.0.0.1:${proxyPort}`

      try {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          // No explicit proxy option - should use env var
        })

        await client.fetch('*[_type == "post"]')

        expect(connectRequests.length).toBe(1)
        expect(connectRequests[0].url).toBe('abc123.api.sanity.io:443')
      } finally {
        if (originalHttpsProxy === undefined) {
          delete process.env.HTTPS_PROXY
        } else {
          process.env.HTTPS_PROXY = originalHttpsProxy
        }
      }
    })

    test('NO_PROXY environment variable bypasses proxy for matching hosts', async () => {
      const originalHttpsProxy = process.env.HTTPS_PROXY
      const originalNoProxy = process.env.NO_PROXY
      process.env.HTTPS_PROXY = `http://127.0.0.1:${proxyPort}`
      process.env.NO_PROXY = 'api.sanity.io'

      try {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          useProjectHostname: false, // Use api.sanity.io which is in NO_PROXY
        })

        // This should NOT go through proxy due to NO_PROXY, so it will fail
        // to connect (no real server). We catch the error and verify no proxy was used.
        try {
          await client.users.getById('me')
        } catch {
          // Expected - no real server at api.sanity.io
        }

        // Verify no requests went through the proxy
        expect(connectRequests.length).toBe(0)
      } finally {
        if (originalHttpsProxy === undefined) {
          delete process.env.HTTPS_PROXY
        } else {
          process.env.HTTPS_PROXY = originalHttpsProxy
        }
        if (originalNoProxy === undefined) {
          delete process.env.NO_PROXY
        } else {
          process.env.NO_PROXY = originalNoProxy
        }
      }
    })
  })
})
