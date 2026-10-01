import {type AuthState, createClient as createCoreClient} from '@sanity/client'
import {BehaviorSubject} from 'rxjs'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

// The deprecation warning is printed once per process, so these tests live in
// their own file: nothing else here may read `config().token` on a client
// with a reactive `auth` source before the first test does.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

const baseConfig = {
  projectId: 'abc123',
  dataset: 'prod',
  useCdn: false,
  apiVersion: '1',
}

const apiHost = 'https://abc123.api.sanity.io'
const queryPath = '/v1/data/query/prod?query=*&returnQuery=false'

describe('auth: deprecated config().token under a reactive source', () => {
  // Legitimate use of `vi.spyOn`, not a module-boundary mock: this observes
  // a designed-in output channel (the warning).
  const warn = vi.spyOn(console, 'warn')
  afterEach(() => {
    warn.mockRestore()
  })

  test('returns the last resolved credential under a reactive source, warning once', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', queryPath, {headers: {Authorization: 'Bearer resolved'}})
      .respond({status: 200, body: {result: []}})

    const auth = new BehaviorSubject<Promise<AuthState>>(
      Promise.resolve<AuthState>({token: 'resolved'}),
    )
    const client = createClient({...baseConfig, auth})
    warn.mockClear()

    expect(client.config().token, 'nothing resolved before the first request').toBeUndefined()
    expect(client.config().withCredentials).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(
      /`client.config\(\)\.token` and `client.config\(\)\.withCredentials` are deprecated/,
    )

    await client.fetch('*')

    expect(client.config().token).toBe('resolved')
    expect(client.config().withCredentials).toBe(false)
    // Derived clients share the record through the shared observable.
    expect(client.withConfig({dataset: 'other'}).config().token).toBe('resolved')
    expect(warn, 'warns once per process').toHaveBeenCalledTimes(1)
  })

  test('static configs return their configured value without warning', () => {
    warn.mockClear()
    const client = createClient({...baseConfig, token: 'static'})
    expect(client.config().token).toBe('static')
    expect(warn).not.toHaveBeenCalled()
  })
})
