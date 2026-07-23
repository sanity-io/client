/**
 * Test transport backed by `get-it/mock`.
 *
 * `@sanity/client` v9 routes everything through get-it's `fetch()`, which
 * undici implements on its own dispatcher. Rather than intercept at the
 * `http.request` level, tests inject the mock through the client's
 * `resolveFetch` config option — the supported way to replace the client's
 * transport (see {@link testResolveFetch}) — and register handlers directly
 * via the `get-it/mock` API:
 *
 * ```ts
 * const client = createClient({...config, resolveFetch: testResolveFetch})
 * getActiveMock()
 *   .scope('https://abc123.api.sanity.io')
 *   .on('GET', '/v1/users/me')
 *   .respond({status: 200, body: {}})
 * ```
 *
 * Network errors (`.respondWithError()`), delayed responses (the `delay`
 * response option), query-param coercion, request-header matching (the
 * `headers` match option), binary/streamed request bodies (recorded as
 * `Uint8Array`, matched with `bodyBytes()`) and streaming response bodies
 * (`streamBody()` with `streamDelay`/`streamStall`/`streamError` directives —
 * used to model long-lived SSE connections) are all handled natively by
 * `get-it/mock` (9.3.0 and later), so this module only layers on the
 * transport wiring the suite needs.
 *
 * @internal
 */

import type {FetchFunction} from 'get-it'
import {createMockFetch, type MockFetch} from 'get-it/mock'

export type {AsymmetricMatcher, MockFetch, MockResponseDef, MockScope} from 'get-it/mock'
// Re-export the asymmetric matchers so tests can reach them through the same
// (edge-guarded, dynamically imported) helper module instead of importing
// `get-it/mock` directly.
export {
  anyValue,
  arrayContaining,
  bodyBytes,
  objectContaining,
  queryContaining,
  streamBody,
  streamDelay,
  streamError,
  streamStall,
  stringMatching,
} from 'get-it/mock'

let activeMock: MockFetch | null = null
let activeFetch: FetchFunction | null = null

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

/**
 * The active mock's fetch (happy-dom-normalized). Useful for delegation when
 * a test wraps the transport with a spy.
 */
export function getActiveFetch(): FetchFunction {
  if (!activeFetch) {
    throw new Error(
      'getActiveFetch() used outside of a mock-aware test context. ' +
        'Make sure the vitest setup file (setupMockFetch.ts) is wired up.',
    )
  }
  return activeFetch
}

/**
 * Drop-in `resolveFetch` for client configs: routes the client's requests
 * (including EventSource connections) through the currently active mock.
 * Reads the active mock per call, so a client created in one test keeps
 * working when the next test's mock is installed.
 *
 * ```ts
 * const client = createClient({...config, resolveFetch: testResolveFetch})
 * ```
 */
export const testResolveFetch: (proxyUrl?: string) => FetchFunction = () => getActiveFetch()

/** Create a fresh mock for one test and install it as active. */
export function installMock(): MockFetch {
  const mock = createMockFetch()
  activeMock = mock
  activeFetch = 'happyDOM' in globalThis ? lowercaseHeaders(mock.fetch) : mock.fetch
  return mock
}

/**
 * happy-dom's `Headers` iterates names with their original casing, violating
 * the fetch spec (header names must iterate lowercased). `get-it/mock` builds
 * its header-match record from that iteration, so mixed-case names like
 * `Authorization` would never match in the browser test environment.
 * Normalizes to a lowercased plain record before handing off to the mock.
 * See https://github.com/capricorn86/happy-dom/issues/2249
 */
function lowercaseHeaders(fetch: MockFetch['fetch']): MockFetch['fetch'] {
  return (url, init) => {
    if (!init?.headers) return fetch(url, init)
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
    return fetch(url, {...init, headers})
  }
}

/**
 * Tear down the mock installed by installMock(), first asserting that every
 * registered one-shot response was consumed - a mock a test registers but
 * never hits is a bug in the test. Responses that may legitimately go
 * unserved (e.g. "responds this way no matter how often it's asked") should
 * be registered with `respondPersist()`, which never counts as unconsumed.
 */
export function uninstallMock(): void {
  if (activeMock) {
    activeMock.assertAllConsumed()
    activeMock.clear()
  }
  activeMock = null
  activeFetch = null
}
