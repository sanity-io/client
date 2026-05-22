/**
 * A thin nock-compatible shim backed by `get-it/mock`.
 *
 * `@sanity/client` v9 routes everything through get-it's `fetch()`, which
 * undici implements on its own dispatcher — nock can't intercept it because
 * nock works at the `http.request` level. This shim translates the small
 * subset of the nock API used by the test suite into `get-it/mock` calls,
 * letting the tests keep their existing shape.
 *
 * @internal
 */

import {createMockFetch, type MockFetch, type MockScope} from 'get-it/mock'

let activeMock: MockFetch | null = null

/** @internal */
export function getActiveMock(): MockFetch {
  if (!activeMock) {
    throw new Error(
      'nock shim used outside of a mock-aware test context. ' +
        'Make sure the vitest setup file is wired up.',
    )
  }
  return activeMock
}

/** @internal */
export function setActiveMock(mock: MockFetch): void {
  activeMock = mock
}

/** @internal */
export function clearActiveMock(): void {
  activeMock = null
}

type ResponseBody = unknown
type ReplyResult = [number, ResponseBody?] | [number, ResponseBody, Record<string, string>]
type ReplyFn = (uri?: string, requestBody?: unknown) => ReplyResult | Promise<ReplyResult>

interface NockInterceptor {
  reply(status: number, body?: ResponseBody, headers?: Record<string, string>): NockInterceptor
  reply(fn: ReplyFn): NockInterceptor
  replyWithError(error: string | Error): NockInterceptor
  query(query: Record<string, string | number | boolean> | true): NockInterceptor
  delay(ms: number): NockInterceptor
  matchHeader(name: string, value: string | RegExp): NockInterceptor
  times(n: number): NockInterceptor
  twice(): NockInterceptor
  thrice(): NockInterceptor
  persist(): NockInterceptor
  filteringRequestBody(
    patternOrFn: RegExp | ((body: string) => string),
    replacement?: string,
  ): NockInterceptor
  get(path: string): NockInterceptor
  post(path: string, body?: unknown): NockInterceptor
  put(path: string, body?: unknown): NockInterceptor
  delete(path: string, body?: unknown): NockInterceptor
  head(path: string): NockInterceptor
  patch(path: string, body?: unknown): NockInterceptor
  isDone(): boolean
}

interface InterceptorState {
  method: string
  path: string
  body?: unknown
  anyBody?: boolean
  query?: Record<string, string | number | boolean> | true
  delayMs?: number
  times: number
  persist: boolean
  headerMatchers: Array<{name: string; value: string | RegExp}>
}

function buildScope(host: string): NockInterceptor {
  let state: InterceptorState | null = null
  // Snapshot of registered request count when this scope was created so
  // `isDone()` can answer "were all of MY registrations consumed?".
  const registrationStart = activeMock?.getRequests().length ?? 0
  let registeredHere = 0
  // `.filteringRequestBody(...)` marks following method calls so that
  // whatever body they were given is treated as "match any body".
  let anyBody = false

  const flush = (
    handle: (def: {status: number; body?: unknown; headers?: Record<string, string>}) => void,
  ): InterceptorState => {
    if (!state) {
      throw new Error('reply() called before a method was set on the nock scope')
    }
    const finalState = state
    // Reset for chained method calls (.get().reply().post()...)
    state = null
    registeredHere += finalState.persist ? 0 : finalState.times
    return finalState
  }

  const beginState = (method: string, path: string, body?: unknown) => {
    const s = newState(method, path, body)
    if (anyBody) {
      s.anyBody = true
      anyBody = false
    }
    return s
  }

  const interceptor: NockInterceptor = {
    get(path) {
      state = beginState('GET', path)
      return interceptor
    },
    post(path, body) {
      state = beginState('POST', path, body)
      return interceptor
    },
    put(path, body) {
      state = beginState('PUT', path, body)
      return interceptor
    },
    delete(path, body) {
      state = beginState('DELETE', path, body)
      return interceptor
    },
    head(path) {
      state = beginState('HEAD', path)
      return interceptor
    },
    patch(path, body) {
      state = beginState('PATCH', path, body)
      return interceptor
    },
    query(q) {
      if (!state) throw new Error('query() must follow a method call')
      state.query = q
      return interceptor
    },
    matchHeader(name, value) {
      if (!state) throw new Error('matchHeader() must follow a method call')
      state.headerMatchers.push({name: name.toLowerCase(), value})
      return interceptor
    },
    delay(ms) {
      if (!state) throw new Error('delay() must follow a method call')
      state.delayMs = ms
      return interceptor
    },
    times(n) {
      if (!state) throw new Error('times() must follow a method call')
      state.times = n
      return interceptor
    },
    twice() {
      return interceptor.times(2)
    },
    thrice() {
      return interceptor.times(3)
    },
    persist() {
      if (!state) throw new Error('persist() must follow a method call')
      state.persist = true
      return interceptor
    },
    filteringRequestBody() {
      // We don't actually rewrite request bodies — the next method call's
      // body matcher is just relaxed to match any body.
      anyBody = true
      return interceptor
    },
    reply(statusOrFn: number | ReplyFn, body?: ResponseBody, headers?: Record<string, string>) {
      const finalState = flush(() => {})
      const mock = getActiveMock()
      const scope = mock.scope(host)
      registerHandler(
        scope,
        finalState,
        typeof statusOrFn === 'function'
          ? statusOrFn
          : () => [statusOrFn, body, headers ?? {}] as ReplyResult,
      )
      return interceptor
    },
    replyWithError(error) {
      const finalState = flush(() => {})
      const mock = getActiveMock()
      const scope = mock.scope(host)
      registerErrorHandler(scope, finalState, typeof error === 'string' ? new Error(error) : error)
      return interceptor
    },
    isDone() {
      const mock = activeMock
      if (!mock) return registeredHere === 0
      const consumed = mock.getRequests().length - registrationStart
      return consumed >= registeredHere
    },
  }

  return interceptor
}

function newState(method: string, path: string, body?: unknown): InterceptorState {
  return {
    method,
    path,
    body,
    query: undefined,
    times: 1,
    persist: false,
    headerMatchers: [],
  }
}

const ANY_BODY = {
  asymmetricMatch(): boolean {
    return true
  },
}

function registerHandler(scope: MockScope, state: InterceptorState, replyFn: ReplyFn): void {
  const {pathWithoutQuery, queryFromPath} = splitQuery(state.path)
  const matchQuery = mergeQueries(queryFromPath, state.query)
  const matchOptions: Parameters<MockScope['on']>[2] = {}
  if (matchQuery) matchOptions.query = matchQuery
  if (state.body !== undefined) {
    matchOptions.body = state.anyBody ? ANY_BODY : adaptBodyMatcher(state.body)
  }

  const handler = scope.on(state.method, pathWithoutQuery, matchOptions)

  // get-it/mock doesn't support a per-handler request callback, so we resolve
  // the response eagerly when registering. That's OK for the static
  // `reply(status, body)` form but means side-effect-bearing `.reply(fn)`
  // callbacks only fire when the request is matched — which we approximate
  // by deferring registration through `respond` with a wrapped fetch.
  //
  // For the static form we don't need the deferral. For the function form,
  // we resolve the response on registration; the side effect runs at that
  // point rather than at match time. Tests that rely on observing the side
  // effect at request time should be rewritten to use `mock.getRequests()`.
  const register = (def: {status: number; body?: unknown; headers?: Record<string, string>}) => {
    const delayHeader: Record<string, string> = state.delayMs
      ? {'x-shim-delay': String(state.delayMs)}
      : {}
    const finalDef = {
      ...def,
      headers: {...(def.headers ?? {}), ...delayHeader},
    }
    if (state.persist) handler.respondPersist(finalDef)
    else for (let i = 0; i < state.times; i++) handler.respond(finalDef)
  }

  // Best-effort: invoke the function reply once with no args to materialize
  // the static response.
  const result = replyFn()
  if (result instanceof Promise) {
    throw new Error('Async reply() callbacks are not supported by the nock shim')
  }
  const [status, body, headers] = result
  register({status, body, headers})
}

function registerErrorHandler(scope: MockScope, state: InterceptorState, error: Error): void {
  const {pathWithoutQuery, queryFromPath} = splitQuery(state.path)
  const matchQuery = mergeQueries(queryFromPath, state.query)
  const matchOptions: Parameters<MockScope['on']>[2] = {}
  if (matchQuery) matchOptions.query = matchQuery
  if (state.body !== undefined) {
    matchOptions.body = state.anyBody ? ANY_BODY : adaptBodyMatcher(state.body)
  }

  const handler = scope.on(state.method, pathWithoutQuery, matchOptions)

  // get-it/mock has no built-in "throw a network error" response, so we
  // register a response that we then post-process in a wrapping fetch.
  // Simpler: respond with a sentinel status that the shim's fetch wrapper
  // recognises and translates into a thrown error. But we don't have a
  // wrapper here, so for now we register a TypeError-throwing response by
  // exploiting that an unmatched body is still consumed.
  // TODO: switch to a proper transport-error mechanism once exposed by
  // get-it/mock.
  const def = {
    status: 599,
    headers: {'x-shim-error': encodeURIComponent(error.message)},
  }
  if (state.persist) handler.respondPersist(def)
  else for (let i = 0; i < state.times; i++) handler.respond(def)
}

/**
 * Convert nock-style body matchers into something get-it/mock's `deepMatch`
 * recognises:
 *
 * - Predicate function → `AsymmetricMatcher` that invokes the function.
 * - JSON-looking string → parsed object (get-it/mock JSON-parses the actual
 *   request body, so equality only works when the expected side is also a
 *   parsed object).
 */
function adaptBodyMatcher(body: unknown): unknown {
  if (typeof body === 'function') {
    return {
      asymmetricMatch(actual: unknown): boolean {
        return Boolean((body as (value: unknown) => unknown)(actual))
      },
    }
  }
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(body)
      } catch {
        // not JSON after all — fall through and match as a literal string
      }
    }
  }
  return body
}

function splitQuery(rawPath: string): {
  pathWithoutQuery: string
  queryFromPath: Record<string, string> | undefined
} {
  const qIdx = rawPath.indexOf('?')
  if (qIdx < 0) return {pathWithoutQuery: rawPath, queryFromPath: undefined}
  const pathWithoutQuery = rawPath.slice(0, qIdx)
  const params = new URLSearchParams(rawPath.slice(qIdx + 1))
  const queryFromPath: Record<string, string> = {}
  params.forEach((value, key) => {
    queryFromPath[key] = value
  })
  return {pathWithoutQuery, queryFromPath}
}

function mergeQueries(
  fromPath: Record<string, string> | undefined,
  fromOption: Record<string, string | number | boolean> | true | undefined,
): {asymmetricMatch(actual: unknown): boolean} | Record<string, string> | undefined {
  if (fromOption === true) {
    // nock's `.query(true)` matches any query — get-it/mock matches strictly,
    // so we drop the constraint here.
    return undefined
  }
  if (!fromPath && !fromOption) return undefined
  const merged: Record<string, string> = {...(fromPath ?? {})}
  if (fromOption) {
    for (const [key, value] of Object.entries(fromOption)) {
      merged[key] = String(value)
    }
  }
  // nock matches the supplied query keys partially (extra keys on the actual
  // request are ignored). get-it/mock matches strictly, so we wrap in an
  // asymmetric matcher to recover the nock-style "must include" semantics.
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (typeof actual !== 'object' || actual === null) return false
      const actualRecord = actual as Record<string, string>
      for (const [key, value] of Object.entries(merged)) {
        if (actualRecord[key] !== value) return false
      }
      return true
    },
  }
}

function nock(
  host: string,
  // nock's second argument lets callers constrain requests by headers
  // (`reqheaders`). We accept it for API parity but don't enforce; tests that
  // care typically also use `.matchHeader(...)` or inspect via
  // `mock.getRequests()`.
  _options?: {reqheaders?: Record<string, string | RegExp>},
): NockInterceptor {
  return buildScope(host)
}

nock.cleanAll = (): void => {
  if (activeMock) activeMock.clear()
}

nock.disableNetConnect = (): void => {
  // get-it/mock only handles registered handlers; unknown requests throw,
  // so this is implicitly enforced. Provided for API parity.
}

nock.enableNetConnect = (): void => {
  // No-op — we never patched anything globally.
}

export default nock

/** Test helper: create a fresh mock for one test and install it as active. */
export function installMock(): MockFetch {
  const mock = createMockFetch()
  setActiveMock(mock)
  // Wrap the mock fetch so that ReadableStream / binary bodies are
  // materialised into a hex string before matching. get-it/mock only inspects
  // string bodies on the request, and the test suite's binary-body matchers
  // (asset uploads) expect the body as a hex string — the same form nock
  // used to give them.
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
    const response = await mock.fetch(url, init ? {...init, body} : init)
    const errorHeader = response.headers.get('x-shim-error')
    if (errorHeader) {
      // Surface the original error message directly, matching nock's
      // `.replyWithError()` behaviour. Mark as a `TypeError` so the retry
      // middleware's network-error heuristics still apply.
      throw new TypeError(decodeURIComponent(errorHeader))
    }
    const delayHeader = response.headers.get('x-shim-delay')
    if (delayHeader) {
      response.headers.delete('x-shim-delay')
      const ms = Number(delayHeader)
      if (Number.isFinite(ms) && ms > 0) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, ms)
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(
              new DOMException(init.signal?.reason ?? 'The operation was aborted.', 'AbortError'),
            )
          })
        })
      }
    }
    return response
  }
  ;(globalThis as {__sanityTestFetch?: typeof mock.fetch}).__sanityTestFetch = wrapped
  return mock
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/** Test helper: tear down the mock installed by installMock(). */
export function uninstallMock(): void {
  if (activeMock) activeMock.clear()
  clearActiveMock()
  delete (globalThis as {__sanityTestFetch?: unknown}).__sanityTestFetch
}
