import {type AuthState, createClient as createCoreClient} from '@sanity/client'
import {BehaviorSubject} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

// Node-only for the same reason `test/client/assets.node.test.ts` is: outside
// Node the upload path runs through `XMLHttpRequest`, which the fetch mock
// cannot intercept. The XHR path builds its request through the same
// `_prepareAuthenticatedRequest`, and is exercised against a real server in
// `test/browserUpload.browser.test.ts`.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

describe('auth: uploads', () => {
  test('the upload path sends the credential the source currently holds', async () => {
    const auth = new BehaviorSubject<Promise<AuthState>>(
      Promise.resolve<AuthState>({token: 'first'}),
    )
    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    scope
      .on('POST', '/v1/assets/files/prod', {headers: {Authorization: 'Bearer first'}})
      .respond({status: 201, body: {document: {_id: 'file-1'}}})
    scope
      .on('POST', '/v1/assets/files/prod', {headers: {Authorization: 'Bearer second'}})
      .respond({status: 201, body: {document: {_id: 'file-2'}}})

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
      auth,
    })

    await expect(client.assets.upload('file', new Blob(['one']))).resolves.toMatchObject({
      _id: 'file-1',
    })
    auth.next(Promise.resolve<AuthState>({token: 'second'}))
    await expect(client.assets.upload('file', new Blob(['two']))).resolves.toMatchObject({
      _id: 'file-2',
    })
  })
})
