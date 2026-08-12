import {ConnectionFailedError, createClient as createCoreClient} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {catchError, firstValueFrom, lastValueFrom, of, take, toArray} from 'rxjs'
import {describe, expect, test, vitest} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

// Every client created in this suite talks to the per-test `get-it/mock`
// transport, injected through the public `resolveFetch` config option.
const createClient: typeof createCoreClient = (config) =>
  createCoreClient({resolveFetch: testResolveFetch, ...config})

/**
 * Unlike `client.live.events()`, `.listen()` makes a single kind of request -
 * the EventSource connection to `/data/listen/<dataset>` - and never probes
 * `/check/cors`, so these tests only need handlers for that one route.
 */

describe('.listen()', () => {
  test('can listen for mutations', async () => {
    expect.assertions(2)

    const eventData = {
      documentId: 'beer-123',
      eventId: 'blah#beer-123',
      identity: 'uid',
      mutations: [{patch: {id: 'beer-123', set: {abv: 8}}}],
      previousRev: 'MOmofa',
      result: {
        _id: 'beer-123',
        _type: 'beer',
        brewery: 'Trillium',
        title: 'Headroom Double IPA',
        abv: 8,
      },
      resultRev: 'Blatti',
      timestamp: '2017-03-29T12:36:20.506516Z',
      transactionId: 'foo',
      transition: 'update',
    }

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({event: 'mutation', data: JSON.stringify(eventData)}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const query = '*[_type == "beer" && title == $beerName]'
    const params = {beerName: 'Headroom Double IPA'}

    const msg = await firstValueFrom(client.listen(query, params))
    expect(msg, 'event data should be correct').toEqual({...eventData, type: 'mutation'})

    const [request] = getActiveMock().getRequests()
    expect(request.query, 'query should be correct').toMatchObject({
      query: '*[_type == "beer" && title == $beerName]',
      $beerName: '"Headroom Double IPA"',
      includeResult: 'true',
    })
  })

  test('listener sends auth token if given (node)', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({event: 'welcome', data: '{}'}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
      token: 'foobar',
    })

    await firstValueFrom(client.listen('*', {}, {events: ['welcome']}), {defaultValue: null})

    const [request] = getActiveMock().getRequests()
    expect(request, 'should send token').toHaveHeader('authorization', 'Bearer foobar')
  })

  test('listener sends includeAllVersions=true if given', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({event: 'welcome', data: '{}'}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    await firstValueFrom(client.listen('*', {}, {events: ['welcome'], includeAllVersions: true}), {
      defaultValue: null,
    })

    const [request] = getActiveMock().getRequests()
    expect(request.query, 'should include includeAllVersions').toMatchObject({
      includeAllVersions: 'true',
    })
  })

  test('reconnects if disconnected', async () => {
    expect.assertions(1)

    // The connection closes normally (status 200, no error) after sending
    // one message. The `eventsource` package then schedules its own retry
    // and dispatches a plain `error` event with no status - the code that
    // classifies rejections (`reconnectOnConnectionFailure`) never sees it,
    // since `connectEventSource` emits `{type: 'reconnect'}` directly for
    // an errorless disconnect while the connection isn't `CLOSED`.
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({event: 'welcome', data: '{}'}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    await new Promise<void>((resolve, reject) => {
      const subscription = client.listen('*', {}, {events: ['reconnect']}).subscribe({
        next: (msg) => {
          expect(msg.type, 'emits reconnect events if told to').toBe('reconnect')

          subscription.unsubscribe()
          resolve()
        },
        error: (err) => {
          subscription.unsubscribe()
          reject(err)
        },
      })
    })
  })

  test('stops reconnecting and surfaces the error when the connection is rejected with a 4xx', async () => {
    expect.assertions(2)

    // Simulate an auth rejection, e.g. an expired or revoked token. Unlike a
    // transient 5xx, the server will keep rejecting - reconnecting forever
    // would hammer the API once per second.
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respondPersist({status: 401, body: 'Unauthorized'})

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
      token: 'expired-token',
    })

    const event = await firstValueFrom(
      client
        .listen('*', {}, {events: ['reconnect', 'mutation']})
        .pipe(catchError((err) => of(err))),
    )
    expect(event).toBeInstanceOf(ConnectionFailedError)
    expect(event.status).toBe(401)
  })

  test('keeps reconnecting when the connection is rejected with a non-4xx error status', async () => {
    // Implementations may dispatch the error event (with the HTTP status)
    // BEFORE closing for statuses like 501, so the connection is not yet
    // CLOSED when `onError` runs. Relying on readyState alone leaves a
    // permanently dead connection that neither errors nor reconnects - a
    // status present on the event must always take over, letting
    // `reconnectOnConnectionFailure` classify it (non-4xx -> reconnect).
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respondPersist({status: 501, body: 'Not Implemented'})

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
      token: 'some-token',
    })

    const subscription = client
      .listen('*', {}, {events: ['reconnect', 'mutation']})
      .subscribe({error: () => {}})

    try {
      // The reconnect delay is 1s; two attempts within 2.5s proves the
      // connection is retried rather than silently dead after the first
      await new Promise((resolve) => setTimeout(resolve, 2500))
      expect(getActiveMock().getRequests().length).toBeGreaterThanOrEqual(2)
    } finally {
      subscription.unsubscribe()
    }
  })

  test('sends last-event-id header when reconnecting', async () => {
    expect.assertions(1)

    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    // `retry: 25` keeps the ES implementation's own reconnect timer fast,
    // since this disconnect (a plain EOF) isn't classified by
    // `reconnectOnConnectionFailure` - it never becomes an error.
    const body =
      encode({retry: 25}) +
      encode({event: 'welcome', data: '{}'}) +
      encode({event: 'mutation', id: '123', data: JSON.stringify({foo: 'bar'})})

    scope.on('GET', '/v1/data/listen/prod').respond({
      status: 200,
      body,
      headers: {'Content-Type': 'text/event-stream'},
    })
    // One handler per expected connection - handlers are one-shot. This
    // second handler only matches once the client resumes with the last
    // event id from the first connection; if it doesn't, this handler goes
    // unmatched and `assertAllConsumed()` fails in teardown.
    scope.on('GET', '/v1/data/listen/prod', {headers: {'Last-Event-ID': '123'}}).respond({
      status: 200,
      body,
      headers: {'Content-Type': 'text/event-stream'},
    })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const events = await lastValueFrom(
      client.listen('*', {}, {events: ['reconnect', 'mutation']}).pipe(
        take(3),
        catchError((err) => of(err)),
        toArray(),
      ),
    )
    expect(events).toEqual([
      {type: 'mutation', foo: 'bar'},
      {type: 'reconnect'},
      {type: 'mutation', foo: 'bar'},
    ])
  })

  test('forwards welcome and welcomeback events if opted for', async () => {
    expect.assertions(1)

    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    const streamHeaders = {'Content-Type': 'text/event-stream'}

    scope.on('GET', '/v1/data/listen/prod').respond({
      status: 200,
      headers: streamHeaders,
      body:
        encode({retry: 25}) +
        encode({event: 'welcome', data: JSON.stringify({listenerName: 'foo1'})}) +
        encode({event: 'mutation', id: '123', data: JSON.stringify({foo: 'bar'})}),
    })
    // Only matches once the client resumes with the last event id from the
    // first connection.
    scope.on('GET', '/v1/data/listen/prod', {headers: {'Last-Event-ID': '123'}}).respond({
      status: 200,
      headers: streamHeaders,
      body:
        encode({event: 'welcomeback', data: JSON.stringify({listenerName: 'foo2'})}) +
        encode({event: 'mutation', id: '345', data: JSON.stringify({bar: 'baz'})}),
    })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const events = await lastValueFrom(
      client
        .listen(
          '*',
          {},
          {enableResume: true, events: ['reconnect', 'mutation', 'welcome', 'welcomeback']},
        )
        .pipe(
          take(5),
          catchError((err) => of(err)),
          toArray(),
        ),
    )
    expect(events).toEqual([
      {type: 'welcome', listenerName: 'foo1'},
      {type: 'mutation', foo: 'bar'},
      {type: 'reconnect'},
      {type: 'welcomeback', listenerName: 'foo2'},
      {type: 'mutation', bar: 'baz'},
    ])
  })

  test('forwards reset events if opted for', async () => {
    expect.assertions(1)

    const scope = getActiveMock().scope('https://abc123.api.sanity.io')
    const streamHeaders = {'Content-Type': 'text/event-stream'}

    scope.on('GET', '/v1/data/listen/prod').respond({
      status: 200,
      headers: streamHeaders,
      body:
        encode({retry: 25}) +
        encode({event: 'welcome', data: JSON.stringify({listenerName: 'foo1'})}) +
        encode({event: 'mutation', id: '123', data: JSON.stringify({foo: 'bar'})}),
    })
    // Only matches once the client resumes with the last event id from the
    // first connection.
    scope.on('GET', '/v1/data/listen/prod', {headers: {'Last-Event-ID': '123'}}).respond({
      status: 200,
      headers: streamHeaders,
      body:
        encode({event: 'reset', data: '{}'}) +
        encode({event: 'mutation', id: '345', data: JSON.stringify({bar: 'baz'})}),
    })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const events = await lastValueFrom(
      client
        .listen(
          '*',
          {},
          {
            enableResume: true,
            events: ['reconnect', 'mutation', 'welcome', 'welcomeback', 'reset'],
          },
        )
        .pipe(
          take(5),
          catchError((err) => of(err)),
          toArray(),
        ),
    )
    expect(events).toEqual([
      {type: 'welcome', listenerName: 'foo1'},
      {type: 'mutation', foo: 'bar'},
      {type: 'reconnect'},
      {type: 'reset'},
      {type: 'mutation', bar: 'baz'},
    ])
  })

  test('emits channel errors', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({
          event: 'channelError',
          data: JSON.stringify({message: 'Unfortunate error'}),
        }),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const error = await firstValueFrom(client.listen('*').pipe(catchError((err) => of(err))))

    expect(error.message, 'should have passed error message').toBe('Unfortunate error')
  })

  test('emits channel errors with deep error description', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({
          event: 'channelError',
          data: JSON.stringify({error: {description: 'Expected error'}}),
        }),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const error = await firstValueFrom(client.listen('*').pipe(catchError((err) => of(err))))

    expect(error.message, 'should have passed error message').toBe('Expected error')
  })

  test('emits channel errors with groq parse errors (no tag)', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({
          event: 'channelError',
          data: JSON.stringify({
            error: {
              description: 'unexpected token "\\"event]", expected expression',
              end: 18,
              query: '*[_type == "event]',
              start: 11,
              type: 'queryParseError',
            },
          }),
        }),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const error = await firstValueFrom(
      client.listen('*[_type == "event]').pipe(catchError((err) => of(err))),
    )

    expect(error.message, 'should have passed error message').toMatchInlineSnapshot(
      `
        "GROQ query parse error:
        > 1 | *[_type == "event]
            |           ^^^^^^^ unexpected token "\\"event]", expected expression"
      `,
    )
  })

  test('emits channel errors with groq parse errors (with tag)', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({
          event: 'channelError',
          data: JSON.stringify({
            error: {
              description: 'unexpected token "\\"event]", expected expression',
              end: 18,
              query: '*[_type == "event]',
              start: 11,
              type: 'queryParseError',
            },
          }),
        }),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const error = await firstValueFrom(
      client.listen('*[_type == "event]', {}, {tag: 'some-tag'}).pipe(catchError((err) => of(err))),
    )

    expect(error.message, 'should have passed error message').toMatchInlineSnapshot(
      `
        "GROQ query parse error:
        > 1 | *[_type == "event]
            |           ^^^^^^^ unexpected token "\\"event]", expected expression

        Tag: some-tag"
      `,
    )
  })

  test('emits error if request URL is too large', async () => {
    expect.assertions(1)

    // `_listen()` rejects the too-large URL synchronously, before ever
    // calling `initEventSource()` - no request is made, so no handler is
    // registered here.
    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const pad = '_'.repeat(16000)

    const err = await firstValueFrom(
      client.listen(`*{"foo":"${pad}"`).pipe(catchError((error) => of(error))),
    )

    expect(err.message, 'should have passed error message').toBe('Query too large for listener')
  })

  test('can immediately unsubscribe, does not connect to server', async () => {
    expect.assertions(3)

    const onMessage = vitest.fn()
    const onError = vitest.fn()

    // No handler is registered on purpose: the mock's fetch records a
    // request synchronously as soon as it's called, before any handler
    // lookup, so "no request recorded" can't stand in for "the connection
    // never happened". Instead assert the transport-level signal: RxJS
    // teardown (from the synchronous `unsubscribe()` below) calls
    // `es.close()`, which aborts that request's controller before the
    // microtask queue runs, so the recorded request's `init.signal` is
    // already aborted.
    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
    })

    const query = '*[_type == "beer" && title == $beerName]'
    const params = {beerName: 'Headroom Double IPA'}

    client
      .listen(query, params)
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

  test('passes custom headers from client configuration', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', '/v1/data/listen/prod')
      .respond({
        status: 200,
        body: encode({event: 'welcome', data: '{}'}),
        headers: {'Content-Type': 'text/event-stream'},
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      useCdn: false,
      apiVersion: '1',
      headers: {'X-Custom-Header': 'custom-value'},
    })

    await firstValueFrom(client.listen('*', {}, {events: ['welcome']}), {defaultValue: null})

    const [request] = getActiveMock().getRequests()
    expect(request).toHaveHeader('x-custom-header', 'custom-value')
  })
})
