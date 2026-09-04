import {ClientError, ConnectionFailedError, type OAuthTokenSetup} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test, vi} from 'vitest'

import {getClient, projectHost} from './client/helpers'
import {getActiveMock} from './helpers/mockFetch'

const usersPath = '/v1/users/me'

// The DX under test: an OAuth setup handed straight to `token` on the real client.
const oauthClient = (setup: OAuthTokenSetup) => getClient({token: setup})

function authHeaders(): Array<string | null> {
  return getActiveMock()
    .getRequests()
    .map((request) => request.headers.get('authorization'))
}

describe('OAuth auto-refresh (token as OAuthTokenSetup)', () => {
  test('proactive: applies the token from getToken() to every request', async () => {
    getActiveMock().scope(projectHost()).on('GET', usersPath).respond({status: 200, body: {id: 'me'}})

    const setup: OAuthTokenSetup = {
      getToken: async () => 'proactive-token',
      refresh: () => Promise.reject(new Error('should not refresh')),
    }
    const client = oauthClient(setup)

    await expect(client.users.getById('me')).resolves.toEqual({id: 'me'})
    expect(authHeaders()).toEqual(['Bearer proactive-token'])
  })

  test('reactive: a 401 refreshes then retries once with the new token', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', usersPath)
      .respond({status: 401, body: {error: {description: 'Token expired'}}})
      .respond({status: 200, body: {id: 'me'}})

    const refresh = vi.fn(() => Promise.resolve('fresh-token'))
    const setup: OAuthTokenSetup = {getToken: async () => 'expired-token', refresh}
    const client = oauthClient(setup)

    await expect(client.users.getById('me')).resolves.toEqual({id: 'me'})
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(authHeaders()).toEqual(['Bearer expired-token', 'Bearer fresh-token'])
  })

  test('single-flight: concurrent 401s share one refresh, then each retries', async () => {
    const concurrency = 3
    const route = getActiveMock().scope(projectHost()).on('GET', usersPath)
    for (let i = 0; i < concurrency; i++) {
      route.respond({status: 401, body: {error: {description: 'Token expired'}}})
    }
    for (let i = 0; i < concurrency; i++) {
      route.respond({status: 200, body: {id: 'me'}})
    }

    // Gate refresh open until all requests reach it; a straggler starting a
    // second refresh would fail the dedupe.
    const gate = Promise.withResolvers<string>()
    const refresh = vi.fn(() => gate.promise)
    const setup: OAuthTokenSetup = {getToken: async () => 'expired-token', refresh}
    const client = oauthClient(setup)

    const inflight = Promise.all(
      Array.from({length: concurrency}, () => client.users.getById('me')),
    )

    // Let the first attempts 401 and land on the shared refresh.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refresh).toHaveBeenCalledTimes(1)

    gate.resolve('fresh-token')
    await expect(inflight).resolves.toEqual([{id: 'me'}, {id: 'me'}, {id: 'me'}])

    const headers = authHeaders()
    expect(headers.filter((h) => h === 'Bearer expired-token')).toHaveLength(concurrency)
    expect(headers.filter((h) => h === 'Bearer fresh-token')).toHaveLength(concurrency)
  })

  test('unrecoverable refresh: calls onAuthError and surfaces the original 401', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', usersPath)
      .respond({status: 401, body: {error: {description: 'Token expired'}}})

    const refreshError = new Error('refresh token expired')
    const onAuthError = vi.fn()
    const setup: OAuthTokenSetup = {
      getToken: async () => 'expired-token',
      refresh: () => Promise.reject(refreshError),
      onAuthError,
    }
    const client = oauthClient(setup)

    const error = await client.users.getById('me').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ClientError)
    if (!(error instanceof ClientError)) throw error
    expect(error.statusCode).toBe(401)
    expect(onAuthError).toHaveBeenCalledTimes(1)
    expect(onAuthError).toHaveBeenCalledWith(refreshError)
  })

  test('already refreshed: retries with the current token without refreshing', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', usersPath)
      .respond({status: 401, body: {error: {description: 'Token expired'}}})
      .respond({status: 200, body: {id: 'me'}})

    // First read is the token we send; by the 401 the provider already holds a
    // newer one (another request or tab refreshed it).
    const getToken = vi.fn(async () => 'current-token')
    getToken.mockResolvedValueOnce('stale-token')
    const refresh = vi.fn(() => Promise.resolve('unused-token'))
    const client = oauthClient({getToken, refresh})

    await expect(client.users.getById('me')).resolves.toEqual({id: 'me'})
    expect(refresh).not.toHaveBeenCalled()
    expect(authHeaders()).toEqual(['Bearer stale-token', 'Bearer current-token'])
  })

  test('listen: a 401-rejected connection refreshes then reconnects with the new token', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo')
      .respond({status: 401, body: 'Unauthorized'})
      .respond({
        status: 200,
        body: encode({event: 'welcome', data: '{}'}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    let currentToken = 'expired-token'
    const refresh = vi.fn(() => {
      currentToken = 'fresh-token'
      return Promise.resolve(currentToken)
    })
    const client = oauthClient({getToken: async () => currentToken, refresh})

    const event = await firstValueFrom(client.listen('*', {}, {events: ['welcome']}))
    expect(event).toEqual({type: 'welcome'})
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(authHeaders()).toEqual(['Bearer expired-token', 'Bearer fresh-token'])
  })

  test('listen: a second consecutive 401 surfaces without another refresh', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/listen/foo')
      .respondPersist({status: 401, body: 'Unauthorized'})

    const refresh = vi.fn(() => Promise.resolve('fresh-but-rejected-token'))
    const client = oauthClient({getToken: async () => 'expired-token', refresh})

    const error = await firstValueFrom(client.listen('*', {}, {events: ['welcome']})).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ConnectionFailedError)
    if (!(error instanceof ConnectionFailedError)) throw error
    expect(error.status).toBe(401)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  test('unrecoverable refresh: fires onAuthError once across concurrent 401s', async () => {
    const concurrency = 3
    const route = getActiveMock().scope(projectHost()).on('GET', usersPath)
    for (let i = 0; i < concurrency; i++) {
      route.respond({status: 401, body: {error: {description: 'Token expired'}}})
    }

    // Gate the shared refresh open until all three 401s have joined it, so the
    // rejection is observed by all three but onAuthError fires once.
    const gate = Promise.withResolvers<string>()
    const refresh = vi.fn(() => gate.promise)
    const onAuthError = vi.fn()
    const client = oauthClient({getToken: async () => 'expired-token', refresh, onAuthError})

    const inflight = Promise.allSettled(
      Array.from({length: concurrency}, () => client.users.getById('me')),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(refresh).toHaveBeenCalledTimes(1)

    const refreshError = new Error('refresh token expired')
    gate.reject(refreshError)
    const results = await inflight

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(onAuthError).toHaveBeenCalledTimes(1)
    expect(onAuthError).toHaveBeenCalledWith(refreshError)
  })
})
