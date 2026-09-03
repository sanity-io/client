import {
  type ClientConfig,
  ConnectionFailedError,
  CorsOriginError,
  createClient as createCoreClient,
  type LiveEvent,
  MessageError,
} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {catchError, firstValueFrom, lastValueFrom, of, type Subscription, take, toArray} from 'rxjs'
import {describe, expect, test, vitest} from 'vitest'

import {
  getActiveFetch,
  getActiveMock,
  streamBody,
  streamStall,
  testResolveFetch,
} from './helpers/mockFetch'

// Every client created in this suite talks to the per-test `get-it/mock`
// transport, injected through the public `resolveFetch` config option. Tests
// that need a different transport pass their own `resolveFetch` in the config.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

/**
 * Stubs `location.origin` for a deterministic `CorsOriginError` deep-link and
 * returns the origin the error should end up embedding.
 *
 * Node, happy-dom and the edge-runtime test environment either have no
 * `location` yet or a plain, writable one, so `vitest.stubGlobal` can freely
 * replace it there. Real browsers make `window.location` (and every one of
 * its properties) non-configurable - the HTML spec marks them
 * `[LegacyUnforgeable]`, a deliberate security property so a page can't hide
 * navigation from script - so the stub throws there instead. When that
 * happens there is nothing to fake: the browser already has a real
 * `location`, so fall back to whatever origin is actually serving the test.
 *
 * Legitimate use of `vitest.stubGlobal`, not a module-boundary mock: this
 * reads an environment global the code under test is documented to consult,
 * rather than substituting a collaborator.
 */
function stubLocationOrigin(fallback = 'https://example.com'): string {
  try {
    vitest.stubGlobal('location', {origin: fallback})
    return fallback
  } catch {
    return location.origin
  }
}

/**
 * `live.events()` makes two kinds of requests, both routed through the
 * injected mock transport and therefore registered via {@link getActiveMock}:
 *
 *  - the EventSource connection to `/data/live/events/...`; and
 *  - a `/check/cors` probe, made only on connection error.
 */

describe('.live.events()', () => {
  test('allows apiVersion vX', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: 'vX'})
    expect(() => client.live.events()).not.toThrow()
  })
  test('allows apiVersion X', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: 'X'})
    expect(() => client.live.events()).not.toThrow()
  })
  test('allows apiVersion 2024-06-07', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: '2024-06-07'})
    expect(() => client.live.events()).not.toThrow()
  })
  test('allows apiVersion v2021-03-25', () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      apiVersion: 'v2021-03-25',
    })
    expect(() => client.live.events()).not.toThrow()
  })
  test('disallows apiVersion 1', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: '1'})
    expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
      `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 1. Please update your API version to use this feature.]`,
    )
  })
  test('disallows apiVersion v1', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: 'v1'})
    expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
      `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 1. Please update your API version to use this feature.]`,
    )
  })
  test('disallows apiVersion 2021-03-24', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: '2021-03-24'})
    expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
      `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 2021-03-24. Please update your API version to use this feature.]`,
    )
  })
  test('disallows apiVersion v2020-01-01', () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      apiVersion: 'v2020-01-01',
    })
    expect(() => client.live.events()).toThrowErrorMatchingInlineSnapshot(
      `[Error: The live events API requires API version 2021-03-25 or later. The current API version is 2020-01-01. Please update your API version to use this feature.]`,
    )
  })
  test('requires token when includeDrafts is true', () => {
    const client = createClient({projectId: 'abc123', dataset: 'prod', apiVersion: 'vX'})
    expect(() => client.live.events({includeDrafts: true})).toThrowErrorMatchingInlineSnapshot(
      `[Error: The live events API requires a token or withCredentials when 'includeDrafts: true'. Please update your client configuration. The token should have the lowest possible access role.]`,
    )
  })
  test('allows apiVersion 2021-03-26 when includeDrafts is true', () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      apiVersion: 'v2021-03-25',
      token: 'abc123',
    })
    expect(() => client.live.events({includeDrafts: true})).not.toThrowError()
  })

  test('can listen for tags', async () => {
    expect.assertions(2)

    const eventData = {
      tags: ['tag1', 'tag2'],
    }

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/prod')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'message', data: JSON.stringify(eventData)}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: 'X',
    })

    const message = await firstValueFrom(client.live.events())
    expect(message, 'event data should be correct').toEqual({
      ...eventData,
      id: '123',
      type: 'message',
    })

    const [request] = getActiveMock().getRequests()
    expect(request.url, 'url should be correct').toEqual('/vX/data/live/events/prod')
  })

  test('can listen for tags with includeDrafts', async () => {
    expect.assertions(3)

    const eventData = {
      tags: ['tag1', 'tag2'],
    }

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/prod')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'message', data: JSON.stringify(eventData)}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: 'X',
      token: 'abc123',
    })

    const message = await firstValueFrom(client.live.events({includeDrafts: true}))
    expect(message, 'event data should be correct').toEqual({
      ...eventData,
      id: '123',
      type: 'message',
    })

    const [request] = getActiveMock().getRequests()
    expect(request.query, 'query should include includeDrafts').toMatchObject({
      includeDrafts: 'true',
    })
    // Drafts are only visible to authenticated connections, so this is the one
    // place the token travels on the EventSource request itself.
    expect(request).toHaveHeader('authorization', 'Bearer abc123')
  })

  test('does not send the token unless includeDrafts is set', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/published-only')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'welcome', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'published-only',
      useCdn: false,
      apiVersion: 'X',
      token: 'abc123',
    })

    await firstValueFrom(client.live.events())

    // Published content needs no authentication, so a configured token stays
    // off the request until the caller asks for drafts.
    const [request] = getActiveMock().getRequests()
    expect(request).not.toHaveHeader('authorization')
    expect(request.query).not.toHaveProperty('includeDrafts')
  })

  test('sends cookies instead of a token when includeDrafts relies on withCredentials', async () => {
    expect.assertions(3)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/cookie-auth')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'welcome', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'cookie-auth',
      useCdn: false,
      apiVersion: 'X',
      withCredentials: true,
    })

    // `withCredentials` satisfies the same requirement a token does, so no
    // token is needed to ask for drafts.
    await firstValueFrom(client.live.events({includeDrafts: true}))

    const [request] = getActiveMock().getRequests()
    expect(request.query).toMatchObject({includeDrafts: 'true'})
    expect(request).not.toHaveHeader('authorization')
    expect(request.init?.credentials).toBe('include')
  })

  test('does not send cookies when withCredentials is set but drafts are not requested', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/cookie-auth-published')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'welcome', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'cookie-auth-published',
      useCdn: false,
      apiVersion: 'X',
      withCredentials: true,
    })

    await firstValueFrom(client.live.events())

    const [request] = getActiveMock().getRequests()
    expect(request.init?.credentials).not.toBe('include')
  })

  test('forwards tag and waitFor as query parameters', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/params')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'welcome', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'params',
      useCdn: false,
      apiVersion: 'X',
    })

    await firstValueFrom(client.live.events({tag: 'storefront', waitFor: 'function'}))

    // Without a `requestTagPrefix` the tag is sent as given, and `waitFor`
    // asks the API to hold events until a Sanity Function has processed them.
    const [request] = getActiveMock().getRequests()
    expect(request.query).toEqual({tag: 'storefront', waitFor: 'function'})
  })

  test('connects to the API host even when the client is configured with useCdn: true', async () => {
    expect.assertions(2)

    // The Live Content API is addressed at the project's API host, so the CDN
    // setting that applies to queries must not move the connection.
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/cdn-client')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'welcome', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'cdn-client',
      useCdn: true,
      apiVersion: 'X',
    })

    const event = await firstValueFrom(client.live.events())
    expect(event.type).toBe('welcome')
    expect(getActiveMock()).toHaveReceivedRequest('GET', '/vX/data/live/events/cdn-client')
  })

  test('opens one connection per set of options', async () => {
    expect.assertions(3)

    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    const streamHeaders = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'}
    // One handler per expected connection - handlers are one-shot.
    scope.on('GET', '/vX/data/live/events/per-options').respond({
      status: 200,
      body: encode({id: '1', event: 'welcome', data: '{}'}),
      headers: streamHeaders,
    })
    scope.on('GET', '/vX/data/live/events/per-options').respond({
      status: 200,
      body: encode({id: '2', event: 'welcome', data: '{}'}),
      headers: streamHeaders,
    })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'per-options',
      useCdn: false,
      apiVersion: 'X',
      token: 'abc123',
    })

    // A published-only subscriber and a drafts subscriber must not share a
    // stream: the drafts stream carries events the published one should never
    // see, and it authenticates differently.
    await Promise.all([
      firstValueFrom(client.live.events()),
      firstValueFrom(client.live.events({includeDrafts: true})),
    ])

    expect(getActiveMock()).toHaveReceivedRequestTimes('GET', '/vX/data/live/events/per-options', 2)
    const queries = getActiveMock()
      .getRequests()
      .map((request) => request.query)
    expect(queries).toContainEqual({})
    expect(queries).toContainEqual({includeDrafts: 'true'})
  })

  test('supports restart events', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/prod')
      .respond({
        status: 200,
        body:
          encode({id: 'MXxhYVlRejdGZUpPMA', event: 'welcome', data: '{}'}) +
          encode({id: 'MXxhYVlRejdGZUpPMQ', event: 'restart', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: 'X',
    })

    const msg = await lastValueFrom(client.live.events().pipe(take(2)))
    // A restart tells the consumer to refetch everything and drop the sync
    // tags it holds. It carries the new stream position and nothing else.
    expect(msg, 'emits restart events to tell the client to reset local state').toEqual({
      type: 'restart',
      id: 'MXxhYVlRejdGZUpPMQ',
    })
  })

  test('resumes from the last received event id when the connection drops', async () => {
    expect.assertions(1)

    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    const streamHeaders = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'}
    // `retry: 25` keeps the EventSource's own reconnect timer fast. The stream
    // ends cleanly after the message, which is a disconnect rather than a
    // rejection, so it is retried by the EventSource itself and never reaches
    // `reconnectOnConnectionFailure`.
    scope.on('GET', '/vX/data/live/events/resume').respond({
      status: 200,
      headers: streamHeaders,
      body:
        encode({retry: 25}) +
        encode({id: 'MXxhYVlRejdGZUpPMA', event: 'welcome', data: '{}'}) +
        encode({
          id: 'MXxhYVlRejdGZUpPMQ',
          event: 'message',
          data: JSON.stringify({tags: ['s1:first']}),
        }),
    })
    // Only matches once the client resumes from the position of the last
    // event it received. If it reconnects without it, this handler goes
    // unmatched and `assertAllConsumed()` fails in teardown. The stream then
    // continues with the events that follow that position.
    scope
      .on('GET', '/vX/data/live/events/resume', {headers: {'Last-Event-ID': 'MXxhYVlRejdGZUpPMQ'}})
      .respond({
        status: 200,
        headers: streamHeaders,
        body: streamBody(
          encode({
            id: 'MXxhYVlRejdGZUpPMg',
            event: 'message',
            data: JSON.stringify({tags: ['s1:second']}),
          }),
          streamStall(),
        ),
      })
    // Every `reconnect` also probes the CORS configuration.
    scope
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

    const client = createClient({
      projectId: 'abc123',
      dataset: 'resume',
      useCdn: false,
      apiVersion: 'X',
    })

    const events = await lastValueFrom(client.live.events().pipe(take(4), toArray()))
    expect(events).toEqual([
      {type: 'welcome', id: 'MXxhYVlRejdGZUpPMA'},
      {type: 'message', id: 'MXxhYVlRejdGZUpPMQ', tags: ['s1:first']},
      {type: 'reconnect'},
      {type: 'message', id: 'MXxhYVlRejdGZUpPMg', tags: ['s1:second']},
    ])
  })

  test('emits restart when the last received event id can no longer be resumed from', async () => {
    expect.assertions(1)

    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    const streamHeaders = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'}
    scope.on('GET', '/vX/data/live/events/stale-resume').respond({
      status: 200,
      headers: streamHeaders,
      body:
        encode({retry: 25}) +
        encode({id: 'MXxhYVlRejdGZUpPMA', event: 'welcome', data: '{}'}) +
        encode({
          id: 'MXxhYVlRejdGZUpPMQ',
          event: 'message',
          data: JSON.stringify({tags: ['s1:first']}),
        }),
    })
    // When the position the client resumes from is no longer usable, the
    // first event on the new connection is a `restart` at the current end of
    // the stream. The client forwards it as-is so consumers can refetch.
    scope
      .on('GET', '/vX/data/live/events/stale-resume', {
        headers: {'Last-Event-ID': 'MXxhYVlRejdGZUpPMQ'},
      })
      .respond({
        status: 200,
        headers: streamHeaders,
        body: streamBody(
          encode({id: 'MXxhYVlRejdGZUpPMg', event: 'restart', data: '{}'}),
          streamStall(),
        ),
      })
    scope
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

    const client = createClient({
      projectId: 'abc123',
      dataset: 'stale-resume',
      useCdn: false,
      apiVersion: 'X',
    })

    const events = await lastValueFrom(client.live.events().pipe(take(4), toArray()))
    expect(events).toEqual([
      {type: 'welcome', id: 'MXxhYVlRejdGZUpPMA'},
      {type: 'message', id: 'MXxhYVlRejdGZUpPMQ', tags: ['s1:first']},
      {type: 'reconnect'},
      {type: 'restart', id: 'MXxhYVlRejdGZUpPMg'},
    ])
  })

  test('supports goaway events', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/prod')
      .respond({
        status: 200,
        body:
          encode({event: 'welcome', data: '{}'}) + encode({event: 'goaway', id: '123', data: '{}'}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: 'X',
    })

    const msg = await lastValueFrom(client.live.events().pipe(take(2)))
    expect(msg.type, 'emits goaway events to tell the client to switch to polling').toBe('goaway')
  })

  test('emits errors', async () => {
    expect.assertions(2)

    // An `event: error` message errors the live-events observable, which
    // triggers the `/check/cors` probe just like any other error.
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/prod')
      .respond({
        status: 200,
        body: encode({
          event: 'error',
          data: JSON.stringify({status: 500, message: 'Unfortunate error'}),
        }),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: 'X',
    })

    const error = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))

    expect(error).toBeInstanceOf(MessageError)
    expect(error.message, 'should have passed error message').toBe('Unfortunate error')
  })

  test('the CORS probe goes through the configured transport, not global fetch', async () => {
    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    // The events connection fails, which triggers the probe.
    scope
      .on('GET', '/v2021-03-26/data/live/events/prod')
      .respondPersist({status: 403, body: 'Forbidden'})
    scope.on('GET', '/v2021-03-26/check/cors').respond({
      status: 200,
      body: {result: {allowed: false, withCredentials: false}},
    })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '2021-03-26',
      resolveFetch: testResolveFetch,
    })

    const error = await firstValueFrom(client.live.events().pipe(catchError((err) => of(err))))
    expect(error).toBeInstanceOf(CorsOriginError)
    expect(getActiveMock()).toHaveReceivedRequest('GET', '/v2021-03-26/check/cors')
  })

  test('handles CORS errors', async () => {
    expect.assertions(3)

    // Use distinct projectIds so the cors-check URL differs between the two
    // clients: no-cors reports `allowed: false`. The cors client's
    // connection succeeds outright below, so its probe is never triggered.
    getActiveMock()
      .scope('https://no-cors.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: false, withCredentials: false}}})

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

    // `CorsOriginError.addOriginUrl` (and therefore its `message`) is only
    // built with a deep-link when `location` is available, which happy-dom
    // provides but Node does not. Stub it so the message is deterministic
    // across environments instead of depending on which one happens to
    // supply a `location` global.
    const origin = stubLocationOrigin()
    try {
      const error = await firstValueFrom(
        noCorsClient.live.events().pipe(catchError((err) => of(err))),
      )
      expect(error).toBeInstanceOf(CorsOriginError)
      expect(error.message).toBe(
        `The current origin is not allowed to connect to the Live Content API. Add it here: https://sanity.io/manage/project/no-cors/api?cors=add&origin=${encodeURIComponent(origin)}`,
      )
    } finally {
      vitest.unstubAllGlobals()
    }

    const corsClient = createClient({
      projectId: 'cors',
      dataset: 'prod',
      useCdn: false,
      apiVersion: 'X',
    })
    const event = await firstValueFrom(corsClient.live.events().pipe(catchError((err) => of(err))))
    expect(event.type).toBe('welcome')
  })

  test('handles non-CORS reconnect errors correctly', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

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

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

    // Rate limiting is transient - unlike other 4xx rejections it must keep
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

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

    // Simulate an auth rejection, e.g. an expired or revoked token. Unlike a
    // transient 5xx, the server will keep rejecting - reconnecting forever
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
    // CORS rejection (the probe never reaches `response.text()` in this
    // case). The original underlying error must propagate instead.
    expect.assertions(2)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 500, body: 'boom'})

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

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: 'not json at all'})

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

    getActiveMock()
      .scope('https://api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: false, withCredentials: false}}})

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
    expect(getActiveMock()).toHaveReceivedRequest('GET', '/vX/check/cors')
  })

  test('reports CorsOriginError when EventSource needs credentials but /check/cors reports withCredentials: false', async () => {
    // Regression for the principal-engineer feedback: an origin can be
    // allow-listed without credentials, in which case `allowed: true` alone
    // doesn't guarantee the credentialed EventSource request will succeed.
    // We must treat `withCredentials: false` as a CORS rejection when the
    // caller subscribed with credentials, and surface a deep-link that
    // pre-selects "Allow credentials" in the management form.
    expect.assertions(3)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: false}}})

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
    const origin = stubLocationOrigin()
    try {
      const error = await firstValueFrom(
        client.live.events({includeDrafts: true}).pipe(catchError((err) => of(err))),
      )
      expect(error).toBeInstanceOf(CorsOriginError)
      expect(error.addOriginUrl?.searchParams.get('credentials')).toBe('')
      expect(error.addOriginUrl?.searchParams.get('origin')).toBe(origin)
    } finally {
      vitest.unstubAllGlobals()
    }
  })

  test('does not report CorsOriginError when /check/cors reports allowed: true, withCredentials: true and the EventSource needs credentials', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/check/cors')
      .respond({status: 200, body: {result: {allowed: true, withCredentials: true}}})

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
    expect.assertions(3)

    const onMessage = vitest.fn()
    const onError = vitest.fn()

    // No handler is registered on purpose: unlike a real socket, the mock's
    // fetch records a request synchronously as soon as it's called, before
    // any handler lookup, so "no request recorded" can't stand in for "the
    // connection never happened" the way it did against the real server.
    // Instead, assert the transport-level signal the EventSource's fetch call
    // carries: RxJS teardown (from the synchronous `unsubscribe()` below)
    // calls `es.close()`, which aborts that request's controller before the
    // microtask queue runs, so the recorded request's `init.signal` is
    // already aborted.
    const client = createClient({
      projectId: 'abc123',
      dataset: 'unsubscribe',
      useCdn: false,
      apiVersion: 'X',
    })

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
    expect(getActiveMock().getRequests()[0]?.init?.signal?.aborted).toBe(true)
  })

  test('closes the connection when the last subscriber unsubscribes', async () => {
    expect.assertions(3)

    const body = streamBody(
      encode({id: 'MXxhYVlRejdGZUpPMA', event: 'welcome', data: '{}'}),
      streamStall(),
    )
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/teardown')
      .respond({
        status: 200,
        body,
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'teardown',
      useCdn: false,
      apiVersion: 'X',
    })

    // The stream never ends on its own, so the only way the request can be
    // aborted is the client tearing the connection down on unsubscribe.
    const event = await firstValueFrom(client.live.events())
    expect(event.type).toBe('welcome')

    const [request] = getActiveMock().getRequests()
    expect(request.init?.signal?.aborted).toBe(true)
    expect(body.abortCount).toBe(1)
  })

  test('replays welcome to subscribers that join an open connection', async () => {
    expect.assertions(3)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/vX/data/live/events/late-subscriber')
      .respond({
        status: 200,
        body: streamBody(
          encode({id: 'MXxhYVlRejdGZUpPMA', event: 'welcome', data: '{}'}),
          streamStall(),
        ),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'late-subscriber',
      useCdn: false,
      apiVersion: 'X',
    })

    // The first subscriber holds the connection open past `welcome`.
    let subscription: Subscription | undefined
    try {
      const first = await new Promise<LiveEvent>((resolve, reject) => {
        subscription = client.live.events().subscribe({next: resolve, error: reject})
      })
      expect(first.type).toBe('welcome')

      // A subscriber joining afterwards is told the connection is up without
      // waiting for the server to say so again, and without a second request.
      const late = await firstValueFrom(client.live.events())
      expect(late).toEqual({type: 'welcome', id: 'MXxhYVlRejdGZUpPMA'})
      expect(getActiveMock()).toHaveReceivedRequestTimes(
        'GET',
        '/vX/data/live/events/late-subscriber',
        1,
      )
    } finally {
      subscription?.unsubscribe()
    }
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

    const [request] = getActiveMock().getRequests()
    expect(request).toHaveHeader('x-custom-header', 'custom-value')
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

    // Should create only one EventSource instance
    expect(getActiveMock()).toHaveReceivedRequestTimes(
      'GET',
      '/v2021-03-26/data/live/events/dedupe',
      1,
    )
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
    // Each transport should open its own EventSource
    expect(getActiveMock()).toHaveReceivedRequestTimes(
      'GET',
      '/v2021-03-26/data/live/events/transports',
      2,
    )
  })

  test('works with global API endpoints', async () => {
    expect.assertions(12)

    const eventData = {
      tags: ['tag1', 'tag2'],
    }

    // `resource`-configured clients bypass `useProjectHostname` entirely
    // (see `initConfig` in `src/config.ts`), so these requests land on the
    // plain configured `apiHost` (`https://api.sanity.io` by default)
    // rather than a project subdomain.
    const scope = getActiveMock().scope('https://api.sanity.io')

    const testRequestUrl = async ({
      resource,
      resourceUrl,
    }: {
      resource: ClientConfig['resource']
      resourceUrl: string
    }) => {
      scope.on('GET', resourceUrl).respond({
        status: 200,
        body: encode({id: '123', event: 'message', data: JSON.stringify(eventData)}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

      const client = createClient({
        dataset: 'prod',
        useCdn: false,
        apiVersion: 'X',
        resource,
      })

      // Verify the request works and returns expected data
      const message = await firstValueFrom(client.live.events())
      expect(message, 'event data should be correct').toEqual({
        ...eventData,
        id: '123',
        type: 'message',
      })

      // Verify the URL path is constructed correctly with resource-based url
      const requests = scope.getRequests()
      const request = requests[requests.length - 1]
      expect(
        request.url,
        `url should include correct resource-based path for ${resource?.type}`,
      ).toEqual(resourceUrl)
      // Verify the request method is GET (EventSource uses GET)
      expect(request.method, 'request method should be GET').toBe('GET')
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

    getActiveMock()
      .scope('https://api.sanity.io')
      .on('GET', '/vX/projects/test-project/datasets/prod/live/events')
      .respond({
        status: 200,
        body: encode({id: '123', event: 'message', data: JSON.stringify(eventData)}),
        headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'test-project',
      token: 'test-token',
      requestTagPrefix: 'test',
      resource: {type: 'dataset', id: 'test-project.prod'},
      useCdn: false,
      apiVersion: 'X',
    })

    const message = await firstValueFrom(client.live.events({includeDrafts: true, tag: 'prefix'}))
    expect(message, 'event data should be correct').toEqual({
      ...eventData,
      id: '123',
      type: 'message',
    })

    const [request] = getActiveMock().getRequests()
    // Verify the URL includes resource-based path
    expect(request.url, 'url should include resource-based path').toBe(
      '/vX/projects/test-project/datasets/prod/live/events',
    )
    // Verify includeDrafts parameter is set
    expect(request.query, 'url should include includeDrafts parameter').toMatchObject({
      includeDrafts: 'true',
    })
    // Verify tag parameter is set with requestTagPrefix
    expect(request.query, 'url should include tag parameter').toMatchObject({
      tag: 'test.prefix',
    })
  })
})
