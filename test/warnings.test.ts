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
      'You are not using the Sanity CDN. That means your data is always fresh, but the CDN is faster and cheaper. Think about it! For more info, see https://www.sanity.io/help/js-client-cdn-configuration  To hide this warning, please set the `useCdn` option to either `true` or `false` when creating the client.'
    )
  })

  test('warns if in browser on localhost and a token is provided', () => {
    const restoreWindow = global.window
    global.window = {location: {hostname: 'localhost'}} as any
    createClient({projectId: 'abc123', useCdn: false, token: 'foo', apiVersion: '1'})
    expect(warn).toHaveBeenCalledWith(
      'You have configured Sanity client to use a token in the browser. This may cause unintentional security issues. See https://www.sanity.io/help/js-client-browser-token for more information and how to hide this warning.'
    )
    global.window = restoreWindow
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
})
