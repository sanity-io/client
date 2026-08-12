import http from 'node:http'

/**
 * A minimal asset-upload endpoint for the real-browser upload tests.
 *
 * `src/http/browserUpload.ts` uses `XMLHttpRequest` (fetch has no
 * upload-progress hook in the browser), so `get-it/mock` cannot intercept it.
 * This is the one path in the suite that needs a real server to talk to.
 *
 * Routes are chosen by the last segment of the request path, which also
 * covers requests built by `client.assets.upload()` - those always land on
 * `/v1/assets/images/<dataset>`, so picking the dataset name picks the route:
 *
 * - default (including `/success`) - 201 with a Sanity-shaped asset document.
 * - `/error400` - 401 with a structured error body, plus `traceparent` and
 *   `x-served-by` headers, mirroring a real API error response.
 * - `/error500` - 503 with a plain-text body.
 * - `/hang` - never responds at all. Used by the abort tests.
 *
 * Any request carrying an `?id=` or `?tag=` query parameter is recorded
 * (path, query, bytes received, whether the connection closed before a
 * response was sent) and can be inspected afterwards via
 * `GET /diagnostics?id=<the same value>`. That's the only way for a test
 * running in a real browser to prove what the server actually received,
 * now that there is no fake XHR instance left to inspect.
 */

interface RequestRecord {
  received: boolean
  aborted: boolean
  bytesReceived: number
  path: string
  query: Record<string, string>
}

export interface UploadServer {
  url: string
  close: () => Promise<void>
}

export async function createUploadServer(): Promise<UploadServer> {
  const records = new Map<string, RequestRecord>()

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || '*',
      )
      // The error tests read `traceparent`/`x-served-by` off a cross-origin
      // response - browsers hide response headers from JS by default unless
      // the server explicitly exposes them.
      res.setHeader('Access-Control-Expose-Headers', '*')
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', 'http://upload-server.invalid')
    const route = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
    const id = url.searchParams.get('id') ?? url.searchParams.get('tag')

    // A diagnostics lookup is itself a request, but it must never become a
    // record of itself - it only ever reads what an earlier request left
    // behind, keyed by the same `?id=`/`?tag=` value.
    if (route === 'diagnostics') {
      const found = id ? records.get(id) : undefined
      res.writeHead(200, {'content-type': 'application/json'})
      res.end(
        JSON.stringify(
          found ?? {
            received: false,
            aborted: false,
            bytesReceived: 0,
            path: url.pathname,
            query: {},
          },
        ),
      )
      return
    }

    let record: RequestRecord | undefined
    if (id) {
      record = {
        received: true,
        aborted: false,
        bytesReceived: 0,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
      }
      records.set(id, record)
      req.on('close', () => {
        // No response was ever finished writing, so the connection only
        // closes early if the client tore it down - i.e. a real abort.
        if (record && !res.writableEnded) record.aborted = true
      })
    }

    req.on('data', (chunk: Buffer) => {
      if (record) record.bytesReceived += chunk.length
    })

    if (route === 'hang') {
      // Never respond - the connection just sits there until the client
      // aborts it, or the server tears every connection down at teardown.
      return
    }

    if (route === 'error400') {
      req.on('end', () => {
        res.writeHead(401, 'Unauthorized', {
          'content-type': 'application/json',
          traceparent: '00-abcdef1234567890-0000-01',
          'x-served-by': 'gradient',
        })
        res.end(
          JSON.stringify({error: {description: 'Session does not have the correct permissions'}}),
        )
      })
      return
    }

    if (route === 'error500') {
      req.on('end', () => {
        res.writeHead(503, 'Service Unavailable', {'content-type': 'text/plain'})
        res.end('upstream capacity exceeded')
      })
      return
    }

    // Default: success. Covers both the explicit `/success` route used by the
    // low-level `uploadWithProgress()` tests and `/v1/assets/images/<dataset>`
    // built by `assets.upload()`.
    req.on('end', () => {
      res.writeHead(201, 'Created', {'content-type': 'application/json'})
      res.end(JSON.stringify({document: {_id: 'image-abc', _type: 'sanity.imageAsset'}}))
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  // `server.address()` returns `string | AddressInfo | null` - narrowed
  // explicitly rather than cast, since a listening TCP server always yields
  // an `AddressInfo` object.
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('upload server did not bind a TCP port')
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => {
      server.closeAllConnections()
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}
