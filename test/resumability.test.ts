import {ConnectionFailedError, type OAuthTokenSetup} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {firstValueFrom, take, toArray} from 'rxjs'
import {expect, test} from 'vitest'

import {getClient, projectHost} from './client/helpers'
import {getActiveMock} from './helpers/mockFetch'

const sse = (body: string) => ({status: 200, body, headers: {'Content-Type': 'text/event-stream'}})
const oauthClient = (setup: OAuthTokenSetup) => getClient({token: setup})

test('given a listener with a string token, when the server drops the connection, then the eventsource lib reconnects with Last-Event-ID and the same token', async () => {
  getActiveMock()
    .scope(projectHost())
    .on('GET', '/v1/data/listen/foo')
    .respond(sse(`retry: 1\n\n` + encode({event: 'mutation', id: 'evt-1', data: '{}'})))
    .respond(sse(encode({event: 'mutation', id: 'evt-2', data: '{}'})))

  const client = getClient({token: 'static-token'})
  expect(await firstValueFrom(client.listen('*').pipe(take(2), toArray()))).toHaveLength(2)

  const requests = getActiveMock().getRequests()
  expect(requests.map((r) => r.headers.get('last-event-id'))).toEqual([null, 'evt-1'])
  expect(requests.map((r) => r.headers.get('authorization'))).toEqual([
    'Bearer static-token',
    'Bearer static-token',
  ])
})

test('given a listener whose OAuth token rotates mid-stream, when the server drops the connection, then the eventsource lib reconnects with Last-Event-ID and the current token', async () => {
  getActiveMock()
    .scope(projectHost())
    .on('GET', '/v1/data/listen/foo')
    // `retry: 1` so the eventsource lib reconnects in 1ms instead of 3s; body then ends (server drop)
    .respond(sse(`retry: 1\n\n` + encode({event: 'mutation', id: 'evt-1', data: '{}'})))
    .respond(sse(encode({event: 'mutation', id: 'evt-2', data: '{}'})))

  let currentToken = 'token-a'
  const client = oauthClient({
    getToken: async () => currentToken,
    refresh: () => Promise.reject(new Error('not needed')),
  })

  const events = firstValueFrom(client.listen('*').pipe(take(2), toArray()))
  // rotate between the two connections, as a provider's background refresh would
  await new Promise((r) => setTimeout(r, 0))
  currentToken = 'token-b'
  expect(await events).toHaveLength(2)

  const requests = getActiveMock().getRequests()
  expect(requests.map((r) => r.headers.get('last-event-id'))).toEqual([null, 'evt-1'])
  expect(requests.map((r) => r.headers.get('authorization'))).toEqual([
    'Bearer token-a',
    'Bearer token-b',
  ])
})

test('given a listener with a string token, when the reconnect is rejected with a 401, then the error surfaces and nothing reconnects', async () => {
  getActiveMock()
    .scope(projectHost())
    .on('GET', '/v1/data/listen/foo')
    .respond(sse(`retry: 1\n\n` + encode({event: 'mutation', id: 'evt-1', data: '{}'})))
    .respond({status: 401, body: 'Unauthorized'})

  const client = getClient({token: 'static-token'})
  const error = await firstValueFrom(client.listen('*').pipe(take(2), toArray())).catch(
    (e: unknown) => e,
  )

  expect(error).toBeInstanceOf(ConnectionFailedError)
  if (!(error instanceof ConnectionFailedError)) throw error
  expect(error.status).toBe(401)
  expect(getActiveMock().getRequests()).toHaveLength(2)
})

test('given a listener whose token has expired, when the reconnect is rejected with a 401, then the EventSource closes and a refreshed one opens without Last-Event-ID', async () => {
  getActiveMock()
    .scope(projectHost())
    .on('GET', '/v1/data/listen/foo')
    .respond(sse(`retry: 1\n\n` + encode({event: 'mutation', id: 'evt-1', data: '{}'})))
    .respond({status: 401, body: 'Unauthorized'})
    .respond(sse(encode({event: 'mutation', id: 'evt-2', data: '{}'})))

  let currentToken = 'expired'
  const client = oauthClient({
    getToken: async () => currentToken,
    refresh: async () => (currentToken = 'fresh'),
  })

  expect(await firstValueFrom(client.listen('*').pipe(take(2), toArray()))).toHaveLength(2)

  const requests = getActiveMock().getRequests()
  expect(requests.map((r) => r.headers.get('authorization'))).toEqual([
    'Bearer expired',
    'Bearer expired',
    'Bearer fresh',
  ])
  // Last-Event-ID survives the lib's own reconnect (2nd request) but not ours (3rd)
  expect(requests.map((r) => r.headers.get('last-event-id'))).toEqual([null, 'evt-1', null])
})
