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
    const server = setupServer()

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
      expect.assertions(2)

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
      expect.assertions(2)

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

      const {default: nock} = await import('nock')

      // Mock /check/cors via msw (it's hit through `fetch`, which msw intercepts).
      // Use distinct projectIds so the cors-check URL differs between the two clients.
      server.use(
        http.get('https://no-cors.api.sanity.io/vX/check/cors', () =>
          HttpResponse.json({result: {allowed: false, withCredentials: false}}),
        ),
        http.get('https://cors.api.sanity.io/vX/check/cors', () =>
          HttpResponse.json({result: {allowed: true, withCredentials: false}}),
        ),
      )

      // The EventSource can't be intercepted by msw, so we use nock.
      // For the no-cors project, simulate a 403 (the typical CORS-rejection response)
      // which causes the listener to reconnect and trigger the CORS check.
      nock('https://no-cors.api.sanity.io').get('/vX/data/live/events/prod').reply(403, '')

      nock('https://cors.api.sanity.io')
        .get('/vX/data/live/events/prod')
        .reply(200, ['event: welcome', 'data: {}', '', '.', ''].join('\n'), {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/event-stream',
        })

      const noCorsClient = createClient({
        projectId: 'no-cors',
        dataset: 'prod',
        useCdn: false,
        apiVersion: 'X',
      })

      const error = await firstValueFrom(
        noCorsClient.live.events().pipe(catchError((err) => of(err))),
      )
      expect(error).toBeInstanceOf(CorsOriginError)
      expect(error.message).toMatchInlineSnapshot(
        `"The current origin is not allowed to connect to the Live Content API. Change your configuration here: https://sanity.io/manage/project/no-cors/api"`,
      )

      const corsClient = createClient({
        projectId: 'cors',
        dataset: 'prod',
        useCdn: false,
        apiVersion: 'X',
      })
      const event = await firstValueFrom(
        corsClient.live.events().pipe(catchError((err) => of(err))),
      )
      expect(event.type).toBe('welcome')
    })

    test('handles non-CORS reconnect errors correctly', async () => {
      expect.assertions(1)

      const {default: nock} = await import('nock')

      server.use(
        http.get('https://abc123.api.sanity.io/vX/check/cors', () =>
          HttpResponse.json({result: {allowed: true, withCredentials: false}}),
        ),
      )

      // Simulate 500 server error (not CORS)
      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/error-dataset')
        .reply(500, 'Internal Server Error')

      const client = createClient({
        projectId: 'abc123',
        dataset: 'error-dataset',
        useCdn: false,
        apiVersion: 'X',
      })

      // Since CORS check reports allowed: true, should get a reconnect event (not CorsOriginError)
      const event = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
      expect(event.type).toBe('reconnect')
    })

    test('does not report CorsOriginError when /check/cors returns a non-2xx response', async () => {
      // Regression: a non-2xx response from /check/cors is not a confirmed
      // CORS rejection (the probe never reaches `response.json()` in this
      // case). The original underlying error must propagate instead.
      expect.assertions(2)

      const {default: nock} = await import('nock')

      server.use(
        http.get('https://abc123.api.sanity.io/vX/check/cors', () =>
          HttpResponse.text('boom', {status: 500}),
        ),
      )

      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/check-cors-non-2xx')
        .reply(500, 'Internal Server Error')

      const client = createClient({
        projectId: 'abc123',
        dataset: 'check-cors-non-2xx',
        useCdn: false,
        apiVersion: 'X',
      })

      const event = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
      expect(event).not.toBeInstanceOf(CorsOriginError)
      expect(event.type).toBe('reconnect')
    })

    test('does not report CorsOriginError when /check/cors returns invalid JSON', async () => {
      // Regression: a 2xx response with a body that fails JSON parsing must
      // also not be treated as a confirmed CORS rejection. This exercises the
      // `.catch` branch in `checkCorsObservable()` (the JSON-parse / network-
      // error path), not the `!response.ok` short-circuit.
      expect.assertions(2)

      const {default: nock} = await import('nock')

      server.use(
        http.get('https://abc123.api.sanity.io/vX/check/cors', () =>
          HttpResponse.text('not json at all', {status: 200}),
        ),
      )

      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/check-cors-bad-json')
        .reply(500, 'Internal Server Error')

      const client = createClient({
        projectId: 'abc123',
        dataset: 'check-cors-bad-json',
        useCdn: false,
        apiVersion: 'X',
      })

      const event = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
      expect(event).not.toBeInstanceOf(CorsOriginError)
      expect(event.type).toBe('reconnect')
    })

    test('uses non-project hostname and sends projectId for /check/cors when useProjectHostname is false', async () => {
      // Regression for SDK-1783: resource/global-host clients reach
      // `api.sanity.io/.../check/cors`, where the path carries no project
      // context. The probe must send `?projectId=` so the endpoint can evaluate
      // the correct project's allow-list instead of rejecting every origin.
      expect.assertions(3)

      const {default: nock} = await import('nock')

      let checkCorsHits = 0
      let checkCorsProjectId: string | null = null
      server.use(
        http.get('https://api.sanity.io/vX/check/cors', ({request}) => {
          checkCorsHits++
          checkCorsProjectId = new URL(request.url).searchParams.get('projectId')
          return HttpResponse.json({result: {allowed: false, withCredentials: false}})
        }),
      )

      nock('https://api.sanity.io').get('/vX/data/live/events/global').reply(403, '')

      const client = createClient({
        projectId: 'abc123',
        dataset: 'global',
        useProjectHostname: false,
        useCdn: false,
        apiVersion: 'X',
      })

      const error = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
      expect(error).toBeInstanceOf(CorsOriginError)
      expect(checkCorsHits).toBeGreaterThan(0)
      expect(checkCorsProjectId).toBe('abc123')
    })

    test('reports CorsOriginError when EventSource needs credentials but /check/cors reports withCredentials: false', async () => {
      // Regression for the principal-engineer feedback: an origin can be
      // allow-listed without credentials, in which case `allowed: true` alone
      // doesn't guarantee the credentialed EventSource request will succeed.
      // We must treat `withCredentials: false` as a CORS rejection when the
      // caller subscribed with credentials, and surface a deep-link that
      // pre-selects "Allow credentials" in the management form.
      expect.assertions(3)

      const {default: nock} = await import('nock')

      server.use(
        http.get('https://abc123.api.sanity.io/vX/check/cors', () =>
          HttpResponse.json({result: {allowed: true, withCredentials: false}}),
        ),
      )

      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/creds-not-allowed?includeDrafts=true')
        .reply(403, '')

      const client = createClient({
        projectId: 'abc123',
        dataset: 'creds-not-allowed',
        useCdn: false,
        apiVersion: 'X',
        withCredentials: true,
        // `withCredentials` alone doesn't activate `esOptions.withCredentials` -
        // the implementation only sets it when `includeDrafts: true` is also
        // passed at call time.
      })

      // `CorsOriginError.addOriginUrl` is only constructed when `location` is
      // available (i.e. in browser-ish environments). Stub it here so we can
      // assert the `credentials=` query param ends up on the deep-link.
      vitest.stubGlobal('location', {origin: 'https://example.com'})
      try {
        const error = (await firstValueFrom(
          client.live.events({includeDrafts: true}).pipe(catchError((err) => of(err))),
        )) as CorsOriginError
        expect(error).toBeInstanceOf(CorsOriginError)
        expect(error.addOriginUrl?.searchParams.get('credentials')).toBe('')
        expect(error.addOriginUrl?.searchParams.get('origin')).toBe('https://example.com')
      } finally {
        vitest.unstubAllGlobals()
      }
    })

    test('does not report CorsOriginError when /check/cors reports allowed: true, withCredentials: true and the EventSource needs credentials', async () => {
      expect.assertions(2)

      const {default: nock} = await import('nock')

      server.use(
        http.get('https://abc123.api.sanity.io/vX/check/cors', () =>
          HttpResponse.json({result: {allowed: true, withCredentials: true}}),
        ),
      )

      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/creds-ok?includeDrafts=true')
        .reply(500, 'Internal Server Error')

      const client = createClient({
        projectId: 'abc123',
        dataset: 'creds-ok',
        useCdn: false,
        apiVersion: 'X',
        withCredentials: true,
      })

      const event = await firstValueFrom(
        client.live.events({includeDrafts: true}).pipe(catchError((err) => of(err))),
      )
      expect(event).not.toBeInstanceOf(CorsOriginError)
      expect(event.type).toBe('reconnect')
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

      const {default: nock} = await import('nock')

      // Intercept the EventSource GET and assert the custom header explicitly
      nock('https://abc123.api.sanity.io')
        .get('/vX/data/live/events/headers')
        .reply(function () {
          expect(this.req.headers['x-custom-header']).toBe('custom-value')
          return [
            200,
            ['event: welcome', 'data: {}', '', '.', ''].join('\n'),
            {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'text/event-stream',
            },
          ]
        })

      const client = createClient({
        projectId: 'abc123',
        dataset: 'headers',
        useCdn: false,
        apiVersion: 'X',
        headers: {'X-Custom-Header': 'custom-value'},
      })

      await firstValueFrom(client.live.events(), {defaultValue: null})
    })

    test('deduplicates EventSource instances for same URL and options', async () => {
      expect.assertions(5)
      let instanceCount = 0

      const {default: nock} = await import('nock')

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
    })

    test('works with global API endpoints', async () => {
      expect.assertions(12)

      const eventData = {
        tags: ['tag1', 'tag2'],
      }

      const testRequestUrl = async ({
        resource,
        resourceUrl,
      }: {
        resource: ClientConfig['resource']
        resourceUrl: string
      }) => {
        const {server, client} = await testSse(
          ({request, channel}) => {
            // Verify the URL path is constructed correctly with resource-based url
            expect(
              request.url,
              `url should include correct resource-based path for ${resource?.type}`,
            ).toEqual(resourceUrl)
            // Verify the request method is GET (EventSource uses GET)
            expect(request.method, 'request method should be GET').toBe('GET')

            channel!.send({id: '123', data: eventData})
            process.nextTick(() => channel!.close())
          },
          {resource},
        )

        // Verify the request works and returns expected data
        const message = await firstValueFrom(client.live.events())
        expect(message, 'event data should be correct').toEqual({
          ...eventData,
          id: '123',
          type: 'message',
        })

        server.close()
      }

      await testRequestUrl({
        resource: {type: 'dataset', id: 'test-project.prod'},
        resourceUrl: '/vX/projects/test-project/datasets/prod/live/events',
      })

      await testRequestUrl({
        resource: {type: 'media-library', id: 'test-media-library'},
        resourceUrl: '/vX/media-libraries/test-media-library/live/events',
      })

      await testRequestUrl({
        resource: {type: 'canvas', id: 'test-canvas'},
        resourceUrl: '/vX/canvases/test-canvas/live/events',
      })

      await testRequestUrl({
        resource: {type: 'dashboard', id: 'test-dashboard'},
        resourceUrl: '/vX/dashboards/test-dashboard/live/events',
      })
    })

    test('creates request with correct query parameters when using resources', async () => {
      expect.assertions(4)

      const eventData = {
        tags: ['tag1'],
      }

      const {server, client} = await testSse(
        ({request, channel}) => {
          // Verify the URL includes resource-based path
          expect(request.url, 'url should include resource-based path').toContain(
            '/vX/projects/test-project/datasets/prod/live/events',
          )
          // Verify includeDrafts parameter is set
          expect(request.url, 'url should include includeDrafts parameter').toContain(
            'includeDrafts=true',
          )
          // Verify tag parameter is set with requestTagPrefix
          expect(request.url, 'url should include tag parameter').toContain('tag=test.prefix')

          channel!.send({id: '123', data: eventData})
          process.nextTick(() => channel!.close())
        },
        {
          projectId: 'test-project',
          token: 'test-token',
          requestTagPrefix: 'test',
          resource: {type: 'dataset', id: 'test-project.prod'},
        },
      )

      const message = await firstValueFrom(client.live.events({includeDrafts: true, tag: 'prefix'}))
      expect(message, 'event data should be correct').toEqual({
        ...eventData,
        id: '123',
        type: 'message',
      })

      server.close()
    })
  },
)
