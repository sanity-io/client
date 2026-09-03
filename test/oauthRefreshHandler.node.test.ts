import {ClientError, type OAuthTokenSetup} from '@sanity/client'
import {describe, expect, test, vi} from 'vitest'

import {getClient, projectHost} from './client/helpers'
import {getActiveMock} from './helpers/mockFetch'

// Where `XMLHttpRequest` is a global (browsers, happy-dom) `assets.upload()`
// takes the XHR path (`src/http/browserUpload.ts`), which bypasses the client's
// `resolveFetch` seam and therefore the get-it fetch mock — so these mock-based
// assertions can only run where XHR is absent and uploads use the fetch path.
// The XHR path has its own coverage in `browserUpload.browser.test.ts`.

const oauthClient = (setup: OAuthTokenSetup) => getClient({token: setup})

function authHeaders(): Array<string | null> {
  return getActiveMock()
    .getRequests()
    .map((request) => request.headers.get('authorization'))
}

describe('OAuth auto-refresh (token as OAuthTokenSetup), fetch upload path', () => {
  test('upload: a 401 refreshes but surfaces the error; the retry uses the fresh token', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('POST', '/v1/assets/images/foo')
      .respond({status: 401, body: {error: {description: 'Token expired'}}})
      .respond({status: 201, body: {document: {url: 'https://some.asset.url'}}})

    let currentToken = 'expired-token'
    const refresh = vi.fn(() => {
      currentToken = 'fresh-token'
      return Promise.resolve(currentToken)
    })
    const client = oauthClient({getToken: async () => currentToken, refresh})

    // No auto-retry: the 401 surfaces (the body may be a consumed stream)...
    const error = await client.assets.upload('image', Buffer.from('img')).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClientError)
    if (!(error instanceof ClientError)) throw error
    expect(error.statusCode).toBe(401)
    // ...but the refresh already happened, so the caller's retry succeeds.
    expect(refresh).toHaveBeenCalledTimes(1)
    await expect(client.assets.upload('image', Buffer.from('img'))).resolves.toMatchObject({
      url: 'https://some.asset.url',
    })
    expect(authHeaders()).toEqual(['Bearer expired-token', 'Bearer fresh-token'])
  })
})
