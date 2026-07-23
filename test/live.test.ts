import type {AddressInfo} from 'node:net'

import {
  type ClientConfig,
  ConnectionFailedError,
  CorsOriginError,
  createClient as createCoreClient,
} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {catchError, firstValueFrom, lastValueFrom, of, take} from 'rxjs'
import {afterEach, describe, expect, test, vitest} from 'vitest'

import {getActiveFetch, getActiveMock, testResolveFetch} from './helpers/mockFetch'
import {createSseServer, type OnRequest} from './helpers/sseServer'

// Mock-backed tests create clients through this shim, which injects the
// per-test `get-it/mock` transport via the public `resolveFetch` config
// option. The real-SSE-server tests (`testSse`/`getClient`) use the core
// `createClient` and therefore the real network stack.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

/**
 * `live.events()` makes two kinds of requests:
 *
 *  - the EventSource connection to `/data/live/events/...`, which is routed
 *    through the injected mock transport and is therefore registered via
 *    {@link getActiveMock}; and
 *  - a `/check/cors` probe (only on connection error) made with the bare
 *    `globalThis.fetch`, expecting a real `Response` it can call `.json()` on.
 *
 * The get-it mock response is intentionally minimal (no `.json()`), so the
 * CORS probe is stubbed separately with a real `Response` via this helper.
 * Returns a counter of how many times `/check/cors` was hit.
 */
function stubCorsCheck(respond: (url: URL) => Response): {hits: number} {
  const state = {hits: 0}
  vitest.stubGlobal('fetch', (input: string | URL): Promise<Response> => {
    const url = typeof input === 'string' ? new URL(input) : input
    if (url.pathname.endsWith('/check/cors')) {
      state.hits++
      return Promise.resolve(respond(url))
    }
    return Promise.reject(new Error(`Unexpected global fetch to ${url.toString()}`))
  })
  return state
}

const corsJson = (result: {allowed?: boolean; withCredentials?: boolean}): Response =>
  Response.json({result})

const getClient = (options: ClientConfig & {port: number}) =>
  createCoreClient({
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
    afterEach(() => {
      vitest.unstubAllGlobals()
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

      // The /check/cors probe is hit through the bare global `fetch`. Use
      // distinct projectIds so the cors-check URL differs between the two
      // clients: no-cors reports `allowed: false`, cors reports `allowed: true`.
      stubCorsCheck((url) =>
        url.hostname.startsWith('no-cors')
          ? corsJson({allowed: false, withCredentials: false})
          : corsJson({allowed: true, withCredentials: false}),
      )

      // The EventSource connection goes through the get-it mock. For the
      // no-cors project, simulate a 403 (the typical CORS-rejection response)
      // which causes the listener to reconnect and trigger the CORS check.
      getActiveMock()
        .scope('https://no-cors.api.sanity.io')
        .on('GET', '/vX/data/live/events/prod')
        .respond({status: 403, body: ''})

      getActiveMock()
        .scope('https://cors.api.sanity.io')
        .on('GET', '/vX/data/live/events/prod')
        .respond({
          status: 200,
          body: encode({event: 'welcome', data: '{}'}),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/event-stream',
          },
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

      stubCorsCheck(() => corsJson({allowed: true, withCredentials: false}))

      // Simulate 500 server error (not CORS)
      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/error-dataset')
        .respond({status: 500, body: 'Internal Server Error'})

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

    test('keeps reconnecting when the connection is rejected with a 429 (rate limited)', async () => {
      expect.assertions(1)

      stubCorsCheck(() => corsJson({allowed: true, withCredentials: false}))

      // Rate limiting is transient — unlike other 4xx rejections it must keep
      // the reconnect behavior so listeners recover when the throttle lifts
      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/rate-limited-dataset')
        .respondPersist({status: 429, body: 'Too Many Requests'})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'rate-limited-dataset',
        useCdn: false,
        apiVersion: 'X',
        token: 'valid-but-throttled-token',
      })

      const event = await firstValueFrom(
        client.live.events({includeDrafts: true}).pipe(catchError((err) => of(err))),
      )
      expect(event).toEqual({type: 'reconnect'})
    })

    test('stops reconnecting and surfaces the error when the connection is rejected with a 4xx', async () => {
      expect.assertions(2)

      stubCorsCheck(() => corsJson({allowed: true, withCredentials: false}))

      // Simulate an auth rejection, e.g. an expired or revoked token. Unlike a
      // transient 5xx, the server will keep rejecting — reconnecting forever
      // would hammer the API once per second.
      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/unauthorized-dataset')
        .respondPersist({status: 401, body: 'Unauthorized'})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'unauthorized-dataset',
        useCdn: false,
        apiVersion: 'X',
        token: 'expired-token',
      })

      const event = await firstValueFrom(
        client.live.events({includeDrafts: true}).pipe(catchError((err) => of(err))),
      )
      expect(event).toBeInstanceOf(ConnectionFailedError)
      expect(event.status).toBe(401)
    })

    test('does not report CorsOriginError when /check/cors returns a non-2xx response', async () => {
      // Regression: a non-2xx response from /check/cors is not a confirmed
      // CORS rejection (the probe never reaches `response.json()` in this
      // case). The original underlying error must propagate instead.
      expect.assertions(2)

      stubCorsCheck(() => new Response('boom', {status: 500}))

      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/check-cors-non-2xx')
        .respond({status: 500, body: 'Internal Server Error'})

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

      stubCorsCheck(() => new Response('not json at all', {status: 200}))

      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/check-cors-bad-json')
        .respond({status: 500, body: 'Internal Server Error'})

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

    test('uses non-project hostname for /check/cors when useProjectHostname is false', async () => {
      expect.assertions(2)

      const cors = stubCorsCheck(() => corsJson({allowed: false, withCredentials: false}))

      getActiveMock()
        .scope('https://api.sanity.io')
        .on('GET', '/vX/data/live/events/global')
        .respond({status: 403, body: ''})

      const client = createClient({
        projectId: 'abc123',
        dataset: 'global',
        useProjectHostname: false,
        useCdn: false,
        apiVersion: 'X',
      })

      const error = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
      expect(error).toBeInstanceOf(CorsOriginError)
      expect(cors.hits).toBeGreaterThan(0)
    })

    test('reports CorsOriginError when EventSource needs credentials but /check/cors reports withCredentials: false', async () => {
      // Regression for the principal-engineer feedback: an origin can be
      // allow-listed without credentials, in which case `allowed: true` alone
      // doesn't guarantee the credentialed EventSource request will succeed.
      // We must treat `withCredentials: false` as a CORS rejection when the
      // caller subscribed with credentials, and surface a deep-link that
      // pre-selects "Allow credentials" in the management form.
      expect.assertions(3)

      stubCorsCheck(() => corsJson({allowed: true, withCredentials: false}))

      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/creds-not-allowed')
        .respond({status: 403, body: ''})

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

      stubCorsCheck(() => corsJson({allowed: true, withCredentials: true}))

      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/creds-ok')
        .respond({status: 500, body: 'Internal Server Error'})

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

      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/vX/data/live/events/headers')
        .respond({
          status: 200,
          body: encode({event: 'welcome', data: '{}'}),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/event-stream',
          },
        })

      const client = createClient({
        projectId: 'abc123',
        dataset: 'headers',
        useCdn: false,
        apiVersion: 'X',
        headers: {'X-Custom-Header': 'custom-value'},
      })

      await firstValueFrom(client.live.events(), {defaultValue: null})

      const requests = getActiveMock().getRequests()
      expect(requests[0].headers.get('x-custom-header')).toBe('custom-value')
    })

    test('deduplicates EventSource instances for same URL and options', async () => {
      expect.assertions(5)

      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', '/v2021-03-26/data/live/events/dedupe')
        .respond({
          status: 200,
          body:
            encode({id: 'NjA5MDk3MTQ0fFduQzE3KzVTTTBv', event: 'welcome', data: '{}'}) +
            encode({
              id: 'NjI0MTk4MzExfHFkS2twak9CcjRF',
              event: 'message',
              data: '{"tags": []}',
            }),
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/event-stream',
          },
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

      expect(
        getActiveMock().getRequests().length,
        'should create only one EventSource instance',
      ).toBe(1)
      expect(msg1a).toEqual(msg1b)
      expect(msg2a).toEqual(msg2b)
      expect(msg1a).toEqual({id: 'NjA5MDk3MTQ0fFduQzE3KzVTTTBv', type: 'welcome'})
      expect(msg2a).toEqual({id: 'NjI0MTk4MzExfHFkS2twak9CcjRF', type: 'message', tags: []})
    })

    test('does not share EventSource instances across different transports', async () => {
      expect.assertions(4)

      const body = encode({id: 'NjA5MDk3MTQ0fFduQzE3KzVTTTBv', event: 'welcome', data: '{}'})
      const scope = getActiveMock().scope('https://abc123.api.sanity.io')
      // One handler per expected connection - handlers are one-shot.
      scope.on('GET', '/v2021-03-26/data/live/events/transports').respond({
        status: 200,
        body,
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })
      scope.on('GET', '/v2021-03-26/data/live/events/transports').respond({
        status: 200,
        body,
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

      const config = {
        projectId: 'abc123',
        dataset: 'transports',
        useCdn: false,
        apiVersion: '2021-03-26',
      }
      const client1 = createClient(config)
      // Same URL, headers and credentials, but a different transport: a spy
      // fetch that delegates to the active mock. Before transport identity
      // was part of the events-cache key, this client would silently reuse
      // client1's cached observable and the spy would never be hit.
      let spiedRequests = 0
      const client2 = createCoreClient({
        ...config,
        resolveFetch: () => (url, init) => {
          spiedRequests++
          return getActiveFetch()(url, init)
        },
      })

      const [welcome1, welcome2] = await Promise.all([
        firstValueFrom(client1.live.events()),
        firstValueFrom(client2.live.events()),
      ])

      expect(welcome1).toEqual({id: 'NjA5MDk3MTQ0fFduQzE3KzVTTTBv', type: 'welcome'})
      expect(welcome2).toEqual({id: 'NjA5MDk3MTQ0fFduQzE3KzVTTTBv', type: 'welcome'})
      expect(spiedRequests, 'second client should connect through its own transport').toBe(1)
      expect(
        getActiveMock().getRequests().length,
        'each transport should open its own EventSource',
      ).toBe(2)
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
