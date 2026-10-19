import {type Auth, createClient as createCoreClient} from '@sanity/client'
import {BehaviorSubject} from 'rxjs'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {testResolveFetch} from './helpers/mockFetch'

// The warning is printed once per process, so these tests live in their own
// file: nothing else here may read `config().token` on a client with a
// reactive `auth` before these tests do.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

const baseConfig = {
  projectId: 'abc123',
  dataset: 'prod',
  useCdn: false,
  apiVersion: '1',
}

describe('auth: config().token under a reactive auth', () => {
  // Legitimate use of `vi.spyOn`, not a module-boundary mock: this observes
  // a designed-in output channel (the warning).
  const warn = vi.spyOn(console, 'warn')
  afterEach(() => {
    warn.mockClear()
  })

  test('describes the configured inputs: `token` and `withCredentials` are undefined, with a warning once', async () => {
    const auth = new BehaviorSubject(Promise.resolve<Auth>({token: 'reactive'}))
    const client = createClient({...baseConfig, auth})

    expect(client.config().token).toBeUndefined()
    expect(client.config().withCredentials).toBeUndefined()
    expect(client.config().auth).toBe(auth)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(
      /configured with a reactive `auth`, so `client.config\(\)\.token` and `client.config\(\)\.withCredentials` are `undefined`/,
    )

    // The credential is read through `getAuth()` instead.
    await expect(client.getAuth()).resolves.toEqual({token: 'reactive'})
    expect(client.config().token).toBeUndefined()
    expect(warn, 'warns once per process').toHaveBeenCalledTimes(1)
  })

  test('static configs return their configured value without warning', () => {
    const client = createClient({...baseConfig, token: 'static'})
    expect(client.config().token).toBe('static')
    expect(warn).not.toHaveBeenCalled()
  })
})
