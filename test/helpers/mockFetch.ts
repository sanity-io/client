/**
 * Test transport backed by `get-it/mock`.
 *
 * `@sanity/client` v9 routes everything through get-it's `fetch()`, which
 * undici implements on its own dispatcher. Rather than intercept at the
 * `http.request` level, the test suite installs a `get-it/mock` fetch into
 * `globalThis.__sanityTestFetch` (read by `src/http/request.ts` and
 * `src/data/resolveEventSourceFetch.ts`) and registers handlers directly via
 * the `get-it/mock` API:
 *
 * ```ts
 * getActiveMock()
 *   .scope('https://abc123.api.sanity.io')
 *   .on('GET', '/v1/users/me')
 *   .respond({status: 200, body: {}})
 * ```
 *
 * Network errors (`.respondWithError()`), delayed responses (the `delay`
 * response option) and query-param coercion are all handled natively by
 * `get-it/mock` (9.1.0 and later), so this module only layers on the transport
 * wiring and binary-body normalisation the suite needs.
 *
 * @internal
 */

import {createMockFetch, type MockFetch} from 'get-it/mock'

export type {AsymmetricMatcher, MockFetch, MockResponseDef, MockScope} from 'get-it/mock'
// Re-export the asymmetric matchers so tests can reach them through the same
// (edge-guarded, dynamically imported) helper module instead of importing
// `get-it/mock` directly.
export {anyValue, arrayContaining, objectContaining, stringMatching} from 'get-it/mock'

let activeMock: MockFetch | null = null

/** Returns the mock installed for the current test, throwing if there is none. */
export function getActiveMock(): MockFetch {
  if (!activeMock) {
    throw new Error(
      'getActiveMock() used outside of a mock-aware test context. ' +
        'Make sure the vitest setup file (setupMockFetch.ts) is wired up.',
    )
  }
  return activeMock
}

/** Create a fresh mock for one test and install it as active. */
export function installMock(): MockFetch {
  const mock = createMockFetch()
  activeMock = mock
  // Wrap the mock fetch so that ReadableStream / binary bodies are
  // materialised into a hex string before matching. get-it/mock only inspects
  // string bodies on the request, and the suite's binary-body matchers (asset
  // uploads) expect the body as a hex string.
  const wrapped: typeof mock.fetch = async (url, init) => {
    let body = init?.body
    if (body instanceof ReadableStream) {
      const chunks: Uint8Array[] = []
      const reader = body.getReader()
      while (true) {
        const {value, done} = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      const flat = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        flat.set(chunk, offset)
        offset += chunk.byteLength
      }
      body = bytesToHex(flat)
    } else if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
      const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : body
      body = bytesToHex(bytes)
    }
    return mock.fetch(url, init ? {...init, body} : init)
  }
  ;(globalThis as {__sanityTestFetch?: typeof mock.fetch}).__sanityTestFetch = wrapped
  return mock
}

/** Tear down the mock installed by installMock(). */
export function uninstallMock(): void {
  if (activeMock) activeMock.clear()
  activeMock = null
  delete (globalThis as {__sanityTestFetch?: unknown}).__sanityTestFetch
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}
