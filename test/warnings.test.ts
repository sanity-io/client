import {afterAll, beforeEach, describe, expect, test, vi} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

describe('Client config warnings', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  // The conditional specifier means TS can only resolve this import's type
  // when `dist/` has been built (it types as `any` otherwise, e.g. in the CI
  // test job), so the shim below anchors its type to the source entry
  // point — a type-only reference that always resolves and is erased at
  // runtime.
  const {createClient: createCoreClient} = await import(isEdge ? '../dist/index.js' : '../src')
  // Clients in this suite go through the per-test mock, injected via the
  // public `resolveFetch` config option.
  const createClient: typeof import('../src').createClient = (config) =>
    createCoreClient({resolveFetch: testResolveFetch, ...config})

  // Legitimate use of `vi.spyOn`, not a module-boundary mock: this observes
  // a designed-in output channel (the warnings this suite exists to test)
  // rather than substituting a collaborator of the code under test.
  const warn = vi.spyOn(console, 'warn')
  beforeEach(() => {
    warn.mockReset()
  })
  afterAll(() => {
    warn.mockRestore()
  })

  test('warns if useCdn is not given', () => {
    createClient({projectId: 'abc123', apiVersion: '1'})
    expect(warn).toHaveBeenCalledWith(
      "Since you haven't set a value for `useCdn`, we will deliver content using our global, edge-cached API-CDN. If you wish to have content delivered faster, set `useCdn: false` to use the Live API. Note: You may incur higher costs using the live API.",
    )
  })

  test('warns if in browser on localhost and a token is provided', () => {
    // Node has no ambient `window`; the edge-runtime test environment has
    // one but no `window.location`. Both accept `vi.stubGlobal` freely, so
    // fake a minimal window there to exercise the `isBrowser` branch in
    // `config.ts`. Real browsers make `window` unforgeable (a deliberate
    // web-platform security property - see the HTML spec's
    // `[LegacyUnforgeable]` Location/Window attributes) and already serve
    // tests from `localhost`, so the stub throws there and there is nothing
    // to do: the real `window.location` already satisfies the assertion.
    // Legitimate use of `vi.stubGlobal`, not a module-boundary mock: this
    // reads an environment global the code under test is documented to
    // consult, rather than substituting a collaborator.
    try {
      vi.stubGlobal('window', {location: {hostname: 'localhost'}})
    } catch {
      // Real browser: nothing to stub, see above.
    }
    try {
      createClient({projectId: 'abc123', useCdn: false, token: 'foo', apiVersion: '1'})
      expect(warn).toHaveBeenCalledWith(
        'You have configured Sanity client to use a token in the browser. This may cause unintentional security issues. See https://www.sanity.io/help/js-client-browser-token for more information and how to hide this warning.',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('warns if both token and `withCredentials` is set', () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'bar',
      useCdn: false,
      token: 'abc123',
      withCredentials: true,
      apiVersion: '1',
    })
    expect(warn).toHaveBeenCalledWith(
      'You have configured Sanity client to use a token, but also provided `withCredentials: true`. This is no longer supported - only token will be used - remove `withCredentials: true`.',
    )

    expect(client.config()).toMatchObject({
      token: 'abc123',
      withCredentials: false,
    })
  })

  // Deprecation printers are `once`-wrapped at module scope, so this has to be
  // the only test in the file that touches the `uri` option.
  test('warns once when the deprecated `uri` request option is used', async () => {
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {}})
      .respond({status: 200, body: {}})
      .respond({status: 200, body: {}})

    const client = createClient({projectId: 'abc123', useCdn: false, apiVersion: '1'})

    await client.request({url: '/ping'})
    expect(warn).not.toHaveBeenCalled()

    await client.request({uri: '/ping'})
    await client.request({uri: '/ping'})

    expect(warn).toHaveBeenCalledWith(
      'The `uri` request option has been renamed to `url`. Please update your code to use `url` instead. Support for `uri` will be removed in a future version.',
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('warns about `baseId` only when `createVersion()` is given a document', async () => {
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('POST', '/v1/data/actions/foo')
      .respond({status: 200, body: {transactionId: 'abc123'}})
      .respond({status: 200, body: {transactionId: 'def456'}})

    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: false,
      apiVersion: '1',
    })

    // The `baseId` form goes first, deliberately. The warning is wrapped in
    // `once()`, so if this call warned, the assertion after the second call
    // could not tell a real warning from a leftover one.
    await client.createVersion({baseId: 'base123', publishedId: 'pub123', releaseId: 'release456'})
    expect(warn).not.toHaveBeenCalled()

    // The `document` form is legitimate: it is the only way to create a version
    // of a document that does not exist yet, since `baseId` needs something to
    // branch from. So the warning is a conditional nudge, not a correction, and
    // this asserts that wording rather than just that something was printed.
    await client.createVersion({
      publishedId: 'pub123',
      releaseId: 'release456',
      document: {_id: 'versions.release456.pub123', _type: 'post'},
    })
    expect(warn).toHaveBeenCalledWith(
      'You have called `createVersion()` with a defined `document`. If you are creating a version of a document that already exists, prefer providing `baseId` and `releaseId` instead.',
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('warns if server sends warning back', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({status: 200, body: {}, headers: {'X-Sanity-Warning': 'Friction endures'}})

    await createClient({projectId: 'abc123', useCdn: true, apiVersion: '1'}).users.getById('me')
    expect(warn).toHaveBeenCalledWith('Friction endures')
  })

  test('only warns once', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({status: 200, body: {}, headers: {'X-Sanity-Warning': 'Friction endures'}})
      .respond({status: 200, body: {}, headers: {'X-Sanity-Warning': 'Friction endures'}})

    const client = createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
    })

    await client.users.getById('me')
    await client.users.getById('me')

    expect(warn).toHaveBeenCalledWith('Friction endures')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('ignores warnings using string pattern', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({
        status: 200,
        body: {},
        headers: {'X-Sanity-Warning': 'This is an experimental API version warning'},
      })

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: 'experimental API version',
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })

  test('ignores warnings using regex pattern', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({
        status: 200,
        body: {},
        headers: {'X-Sanity-Warning': 'This is an experimental API version warning'},
      })

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: /experimental.*version/i,
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })

  test('ignores warnings using array of patterns', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({status: 200, body: {}, headers: {'X-Sanity-Warning': 'Rate limit warning'}})

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: [/experimental/i, /rate limit/i, /deprecated/],
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })

  test('shows warnings when ignoreWarnings does not match', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({
        status: 200,
        body: {},
        headers: {'X-Sanity-Warning': 'This is an important warning'},
      })

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: 'experimental',
    }).users.getById('me')

    expect(warn).toHaveBeenCalledWith('This is an important warning')
  })

  test('ignores warnings using exported constant', async () => {
    expect.assertions(1)

    const {EXPERIMENTAL_API_WARNING} = await import('../src/types')

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/users/me')
      .respond({
        status: 200,
        body: {},
        headers: {'X-Sanity-Warning': 'This is an experimental API version warning'},
      })

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: EXPERIMENTAL_API_WARNING,
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })
})
