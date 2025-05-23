/* eslint-disable no-shadow */
import type {AddressInfo} from 'node:net'

import {type ClientConfig, CorsOriginError, createClient} from '@sanity/client'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {catchError, firstValueFrom, lastValueFrom, of, take} from 'rxjs'
import {afterAll, afterEach, beforeAll, describe, expect, test, vitest} from 'vitest'

import {createSseServer, type OnRequest} from './helpers/sseServer'

const getClient = (options: ClientConfig & {port: number}) =>
  createClient({
    dataset: 'prod',
    apiHost: `http://127.0.0.1:${options.port}`,
    useProjectHostname: false,
    useCdn: false,
    apiVersion: 'X',
    ...options,
  })

const testSse = async (onRequest: OnRequest, options: ClientConfig = {}) => {
  const server = await createSseServer(onRequest)
  const client = getClient({port: (server!.address() as AddressInfo).port, ...options})
  return {server, client}
}

describe.skipIf(typeof EdgeRuntime === 'string' || typeof document !== 'undefined')(
  '.live.events()',
  () => {
    const server = setupServer(
      http.options(
        '/vX/data/live/events/prod',
        () =>
          new HttpResponse(null, {
            status: 204,
            headers: {'Access-Control-Allow-Origin': '*', 'Content-Length': '0'},
          }),
      ),
    )

    beforeAll(() => {
      server.listen({onUnhandledRequest: 'bypass'})
    })

    afterEach(() => {
      server.resetHandlers()
    })

    afterAll(() => {
      server.close()
    })

    test('allows apiVersion vX', () => {
      const client = getClient({apiVersion: 'vX', port: 1234})
      expect(() => client.live.events()).not.toThrow()
    })
    test('allows apiVersion X', () => {
      const client = getClient({apiVersion: 'X', port: 1234})
      expect(() => client.live.events()).not.toThrow()
    })
    test('allows apiVersion 2024-06-07', () => {
      const client = getClient({apiVersion: '2024-06-07', port: 1234})
      expect(() => client.live.events()).not.toThrow()
    })
    test('allows apiVersion v2021-03-25', () => {
      const client = getClient({apiVersion: 'v2021-03-25', port: 1234})
      expect(() => client.live.events()).not.toThrow()
    })
    test('disallows apiVersion 1', () => {
      const client = getClient({apiVersion: '1', port: 1234})
      expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
        `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 1. Please update your API version to use this feature.]`,
      )
    })
    test('disallows apiVersion v1', () => {
      const client = getClient({apiVersion: 'v1', port: 1234})
      expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
        `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 1. Please update your API version to use this feature.]`,
      )
    })
    test('disallows apiVersion 2021-03-24', () => {
      const client = getClient({apiVersion: '2021-03-24', port: 1234})
      expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
        `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 2021-03-24. Please update your API version to use this feature.]`,
      )
    })
    test('disallows apiVersion v2020-01-01', () => {
      const client = getClient({apiVersion: 'v2020-01-01', port: 1234})
      expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
        `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 2020-01-01. Please update your API version to use this feature.]`,
      )
    })
    test('requires token when includeDrafts is true', () => {
      const client = getClient({apiVersion: 'vX', port: 1234})
      expect(() => client.live.events({includeDrafts: true})).toThrowErrorMatchingInlineSnapshot(
        `[Error: The live events API requires a token or withCredentials when 'includeDrafts: true'. Please update your client configuration. The token should have the lowest possible access role.]`,
      )
    })
    test('allows apiVersion 2021-03-26 when includeDrafts is true', () => {
      const client = getClient({apiVersion: 'v2021-03-25', token: 'abc123', port: 1234})
      expect(() => client.live.events({includeDrafts: true})).not.toThrowError()
    })

    test('can listen for tags', async () => {
      expect.assertions(3)

      const eventData = {
        tags: ['tag1', 'tag2'],
      }

      const {server, client} = await testSse(({request, channel}) => {
        expect(request.url, 'url should be correct').toEqual(`/vX/data/live/events/prod`)

        channel!.send({id: '123', data: eventData})
        process.nextTick(() => channel!.close())
      })

      const message = await firstValueFrom(client.live.events())
      expect(message, 'event data should be correct').toEqual({
        ...eventData,
        id: '123',
        type: 'message',
      })

      server.close()
    })

    test('can listen for tags with includeDrafts', async () => {
      expect.assertions(3)

      const eventData = {
        tags: ['tag1', 'tag2'],
      }

      const {server, client} = await testSse(
        ({request, channel}) => {
          expect(request.url, 'url should be correct').toEqual(
            `/vX/data/live/events/prod?includeDrafts=true`,
          )

          channel!.send({id: '123', data: eventData})
          process.nextTick(() => channel!.close())
        },
        {token: 'abc123'},
      )

      const message = await firstValueFrom(client.live.events({includeDrafts: true}))
      expect(message, 'event data should be correct').toEqual({
        ...eventData,
        id: '123',
        type: 'message',
      })

      server.close()
    })

    test('supports restart events', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'welcome'})
        channel!.send({event: 'restart'})
        process.nextTick(() => channel!.close())
      })

      const msg = await lastValueFrom(client.live.events().pipe(take(2)))
      expect(msg.type, 'emits restart events to tell the client to reset local state').toBe(
        'restart',
      )
      server.close()
    })

    test('supports goaway events', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'welcome'})
        channel!.send({event: 'goaway', id: '123', reason: 'connection limit reached'})
        process.nextTick(() => channel!.close())
      })

      const msg = await lastValueFrom(client.live.events().pipe(take(2)))
      expect(msg.type, 'emits goaway events to tell the client to switch to polling').toBe('goaway')
      server.close()
    })

    test('emits errors', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'error', data: {status: 500, message: 'Unfortunate error'}})
        channel!.close()
        process.nextTick(() => channel!.close())
      })

      const error = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))

      expect(error.message, 'should have passed error message').toBe('Unfortunate error')

      server.close()
    })

    test('handles CORS errors', async () => {
      expect.assertions(3)
      const restoreFetch = global.fetch

      global.fetch = async (info, init) => {
        const response = await restoreFetch(info, init)
        if (!response.headers.has('access-control-allow-origin')) {
          throw new Error('CORS preflight request failed')
        }
        return response
      }

      const {default: nock} = await import('nock')

      // The OPTIONS request is done with `global.fetch`, and so nock can't intercept it.
      server.use(
        http.options(
          'https://abc123.api.sanity.io/vX/data/live/events/no-cors',
          () => new HttpResponse(null, {status: 204, headers: {'Content-Length': '0'}}),
        ),
        http.options(
          'https://abc123.api.sanity.io/vX/data/live/events/cors',
          () =>
            new HttpResponse(null, {
              status: 204,
              headers: {'Access-Control-Allow-Origin': '*', 'Content-Length': '0'},
            }),
        ),
      )

      // The EventSource can't be intercepted by msw, so we use nock
      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/cors')
        .reply(200, ['event: welcome', 'data: {}', '', '.', ''].join('\n'), {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/event-stream',
        })

      const client = createClient({
        projectId: 'abc123',
        dataset: 'no-cors',
        useCdn: false,
        apiVersion: 'X',
      })

      const error = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
      expect(error).toBeInstanceOf(CorsOriginError)
      expect(error.message).toMatchInlineSnapshot(
        `"The current origin is not allowed to connect to the Live Content API. Change your configuration here: https://sanity.io/manage/project/abc123/api"`,
      )

      const client2 = client.withConfig({dataset: 'cors'})
      const event = await firstValueFrom(client2.live.events().pipe(catchError((err) => of(err))))
      expect(event.type).toBe('welcome')
      global.fetch = restoreFetch
    })

    test('can immediately unsubscribe, does not connect to server', async () => {
      const onMessage = vitest.fn()
      const onError = vitest.fn()
      const onRequest = vitest.fn(({channel}) => {
        channel!.send({id: '123', data: {tags: ['tag1', 'tag2']}})
        process.nextTick(() => channel!.close())
      })

      const {server, client} = await testSse(onRequest)

      client.live
        .events()
        .subscribe({
          next: onMessage,
          error: onError,
        })
        .unsubscribe()

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(onMessage).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
      expect(onRequest).not.toHaveBeenCalled()
      server.close()
    })

    test('passes custom headers from client configuration', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(
        ({request, channel}) => {
          if (request.method === 'OPTIONS') {
            expect(request.headers['x-custom-header']).toBe('custom-value')
          }

          if (channel) {
            channel.send({id: '123', data: {tags: ['tag1']}})
            process.nextTick(() => channel.close())
          }
        },
        {headers: {'X-Custom-Header': 'custom-value'}},
      )

      await firstValueFrom(client.live.events(), {defaultValue: null})
      server.close()
    })

    test('deduplicates EventSource instances for same URL and options', async () => {
      expect.assertions(5)
      let instanceCount = 0

      const restoreFetch = global.fetch

      global.fetch = async (info, init) => {
        const response = await restoreFetch(info, init)
        if (!response.headers.has('access-control-allow-origin')) {
          throw new Error('CORS preflight request failed')
        }
        return response
      }

      const {default: nock} = await import('nock')

      // The OPTIONS request is done with `global.fetch`, and so nock can't intercept it.
      server.use(
        http.options(
          'https://abc123.api.sanity.io/v2021-03-26/data/live/events/dedupe',
          () =>
            new HttpResponse(null, {
              status: 204,
              headers: {'Access-Control-Allow-Origin': '*', 'Content-Length': '0'},
            }),
        ),
      )

      // The EventSource can't be intercepted by msw, so we use nock
      nock('https://abc123.api.sanity.io')
        .get('/v2021-03-26/data/live/events/dedupe')
        .reply(() => {
          instanceCount++
          return [
            200,
            [
              'id: NjA5MDk3MTQ0fFduQzE3KzVTTTBv',
              'event: welcome',
              'data: {}',
              '',
              '.',
              'id: NjI0MTk4MzExfHFkS2twak9CcjRF',
              'event: message',
              'data: {"tags": []}',
              '',
              '.',
            ].join('\n'),
            {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'text/event-stream',
            },
          ]
        })

      const client = createClient({
        projectId: 'abc123',
        dataset: 'dedupe',
        useCdn: false,
        apiVersion: '2021-03-26',
      })

      // Create two subscriptions with same parameters
      const first1 = firstValueFrom(client.live.events())
      const first2 = firstValueFrom(client.live.events())
      const last1 = lastValueFrom(client.live.events().pipe(take(2)))
      const last2 = lastValueFrom(client.live.events().pipe(take(2)))

      const [msg1a, msg1b, msg2a, msg2b] = await Promise.all([first1, first2, last1, last2])

      expect(instanceCount, 'should create only one EventSource instance').toBe(1)
      expect(msg1a).toEqual(msg1b)
      expect(msg2a).toEqual(msg2b)
      expect(msg1a).toEqual({id: 'NjA5MDk3MTQ0fFduQzE3KzVTTTBv', type: 'welcome'})
      expect(msg2a).toEqual({id: 'NjI0MTk4MzExfHFkS2twak9CcjRF', type: 'message', tags: []})

      global.fetch = restoreFetch
    })
  },
)
