import {afterAll, beforeEach, describe, expect, test, vi} from 'vitest'

describe('Client config warnings', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  const {createClient} = await import(isEdge ? '../dist/index.browser.js' : '../src')

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
    const restoreWindow = global.window
    global.window = {location: {hostname: 'localhost'}} as any
    createClient({projectId: 'abc123', useCdn: false, token: 'foo', apiVersion: '1'})
    expect(warn).toHaveBeenCalledWith(
      'You have configured Sanity client to use a token in the browser. This may cause unintentional security issues. See https://www.sanity.io/help/js-client-browser-token for more information and how to hide this warning.',
    )
    global.window = restoreWindow
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

  test.skipIf(isEdge)('warns if server sends warning back', async () => {
    expect.assertions(1)

    const {default: nock} = await import('nock')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .reply(200, {}, {'X-Sanity-Warning': 'Friction endures'})

    await createClient({projectId: 'abc123', useCdn: true, apiVersion: '1'}).users.getById('me')
    expect(warn).toHaveBeenCalledWith('Friction endures')
  })

  test.skipIf(isEdge)('only warns once', async () => {
    expect.assertions(2)

    const {default: nock} = await import('nock')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .times(2)
      .reply(200, {}, {'X-Sanity-Warning': 'Friction endures'})

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

  test.skipIf(isEdge)('ignores warnings using string pattern', async () => {
    expect.assertions(1)

    const {default: nock} = await import('nock')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .reply(200, {}, {'X-Sanity-Warning': 'This is an experimental API version warning'})

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: 'experimental API version',
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })

  test.skipIf(isEdge)('ignores warnings using regex pattern', async () => {
    expect.assertions(1)

    const {default: nock} = await import('nock')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .reply(200, {}, {'X-Sanity-Warning': 'This is an experimental API version warning'})

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: /experimental.*version/i,
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })

  test.skipIf(isEdge)('ignores warnings using array of patterns', async () => {
    expect.assertions(1)

    const {default: nock} = await import('nock')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .reply(200, {}, {'X-Sanity-Warning': 'Rate limit warning'})

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: [/experimental/i, /rate limit/i, /deprecated/],
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })

  test.skipIf(isEdge)('shows warnings when ignoreWarnings does not match', async () => {
    expect.assertions(1)

    const {default: nock} = await import('nock')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .reply(200, {}, {'X-Sanity-Warning': 'This is an important warning'})

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: 'experimental',
    }).users.getById('me')

    expect(warn).toHaveBeenCalledWith('This is an important warning')
  })

  test.skipIf(isEdge)('ignores warnings using exported constant', async () => {
    expect.assertions(1)

    const {default: nock} = await import('nock')
    const {EXPERIMENTAL_API_WARNING} = await import('../src/types')

    nock('https://abc123.api.sanity.io')
      .get('/v1/users/me')
      .reply(200, {}, {'X-Sanity-Warning': 'This is an experimental API version warning'})

    await createClient({
      projectId: 'abc123',
      useCdn: true,
      apiVersion: '1',
      ignoreWarnings: EXPERIMENTAL_API_WARNING,
    }).users.getById('me')

    expect(warn).not.toHaveBeenCalled()
  })
})
