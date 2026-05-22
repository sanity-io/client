import type {AddressInfo} from 'node:net'

import {type ClientConfig, ConnectionFailedError, createClient} from '@sanity/client'
import {catchError, firstValueFrom, lastValueFrom, of, take, toArray} from 'rxjs'
import {beforeEach, describe, expect, test, vitest} from 'vitest'

import {createSseServer, type OnRequest} from './helpers/sseServer'

// These tests talk to a real local SSE server, so they need the real
// `fetch` rather than the global mock fetch the setup file installs.
beforeEach(() => {
  delete (globalThis as {__sanityTestFetch?: unknown}).__sanityTestFetch
})

const getClient = (options: ClientConfig & {port: number}) =>
  createClient({
    dataset: 'prod',
    apiHost: `http://127.0.0.1:${options.port}`,
    useProjectHostname: false,
    useCdn: false,
    apiVersion: '1',
    ...options,
  })

const testSse = async (onRequest: OnRequest, options: ClientConfig = {}) => {
  const server = await createSseServer(onRequest)
  const client = getClient({port: (server!.address() as AddressInfo).port, ...options})
  return {server, client}
}

describe.skipIf(typeof EdgeRuntime === 'string' || typeof document !== 'undefined')(
  '.listen()',
  () => {
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

      const {server, client} = await testSse(({request, channel}) => {
        const searchParams = new URLSearchParams({
          query: '*[_type == "beer" && title == $beerName]',
          $beerName: '"Headroom Double IPA"',
          includeResult: 'true',
        })
        expect(request.url, 'url should be correct').toEqual(`/v1/data/listen/prod?${searchParams}`)

        channel!.send({event: 'mutation', data: eventData})
        process.nextTick(() => channel!.close())
      })

      const query = '*[_type == "beer" && title == $beerName]'
      const params = {beerName: 'Headroom Double IPA'}

      const msg = await firstValueFrom(client.listen(query, params))
      expect(msg, 'event data should be correct').toEqual({...eventData, type: 'mutation'})
      server.close()
    })

    test('listener sends auth token if given (node)', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(
        ({request, channel}) => {
          expect(request.headers.authorization, 'should send token').toBe('Bearer foobar')

          channel!.send({event: 'welcome'})
        },
        {token: 'foobar'},
      )

      await firstValueFrom(client.listen('*', {}, {events: ['welcome']}), {defaultValue: null})
      server.close()
    })

    test('listener sends includeAllVersions=true if given', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({request, channel}) => {
        expect(request.url).toContain('includeAllVersions=true')

        channel!.send({event: 'welcome'})
      })

      await firstValueFrom(
        client.listen('*', {}, {events: ['welcome'], includeAllVersions: true}),
        {defaultValue: null},
      )
      server.close()
    })

    test('reconnects if disconnected', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'welcome'})
        channel!.close()
        process.nextTick(() => channel!.close())
      })

      try {
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
      } finally {
        server.close()
      }
    })

    test('stops reconnecting and surfaces the error when the connection is rejected with a 4xx', async () => {
      expect.assertions(2)

      const {default: nock} = await import('nock')

      // Simulate an auth rejection, e.g. an expired or revoked token. Unlike a
      // transient 5xx, the server will keep rejecting — reconnecting forever
      // would hammer the API once per second.
      nock('https://abc123.api.sanity.io')
        .persist()
        .get('/v1/data/listen/prod')
        .query(true)
        .reply(401, 'Unauthorized')

      // The token sets an auth header, forcing the polyfill — the only
      // EventSource implementation that exposes the HTTP status of a rejected
      // connection
      const client = createClient({
        projectId: 'abc123',
        dataset: 'prod',
        useCdn: false,
        apiVersion: '1',
        token: 'expired-token',
      })

      try {
        const event = await firstValueFrom(
          client
            .listen('*', {}, {events: ['reconnect', 'mutation']})
            .pipe(catchError((err) => of(err))),
        )
        expect(event).toBeInstanceOf(ConnectionFailedError)
        expect(event.status).toBe(401)
      } finally {
        nock.cleanAll()
      }
    })

    test('keeps reconnecting when the connection is rejected with a non-4xx error status', async () => {
      // The Node polyfill dispatches the error event (with `status`) BEFORE
      // closing for statuses like 501, so the connection is not yet CLOSED when
      // `onError` runs. Relying on readyState alone leaves a permanently dead
      // connection that neither errors nor reconnects — a status present on the
      // event must always take over, letting `reconnectOnConnectionFailure`
      // classify it (non-4xx → reconnect).
      expect.assertions(1)

      const {default: nock} = await import('nock')

      let attempts = 0
      nock('https://abc123.api.sanity.io')
        .persist()
        .get('/v1/data/listen/prod')
        .query(true)
        .reply(501, () => {
          attempts++
          return 'Not Implemented'
        })

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
        expect(attempts).toBeGreaterThanOrEqual(2)
      } finally {
        subscription.unsubscribe()
        nock.cleanAll()
      }
    })

    test('sends last-event-id header when reconnecting', async () => {
      expect.assertions(2)

      let attempt = 0
      const {server, client} = await testSse(({channel, request}) => {
        attempt++
        channel!.send({event: 'welcome'})
        channel!.send({event: 'mutation', id: '123', data: {foo: 'bar'}})
        if (attempt === 2) {
          expect(request.headers['last-event-id'], 'should send last-event-id').toBe('123')
        }
        channel!.close()
        process.nextTick(() => channel!.close())
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

      server.close()
    })

    test('forwards welcome and welcomeback events if opted for', async () => {
      expect.assertions(2)

      let attempt = 0
      const {server, client} = await testSse(({channel, request}) => {
        attempt++
        if (attempt === 1) {
          channel!.send({event: 'welcome', data: {listenerName: 'foo1'}})
          channel!.send({event: 'mutation', id: '123', data: {foo: 'bar'}})
          channel!.close()
        }
        if (attempt === 2) {
          expect(request.headers['last-event-id'], 'should send last-event-id').toBe('123')
          channel!.send({event: 'welcomeback', data: {listenerName: 'foo2'}})
          channel!.send({event: 'mutation', id: '345', data: {bar: 'baz'}})
          process.nextTick(() => channel!.close())
        }
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

      server.close()
    })

    test('forwards reset events if opted for', async () => {
      expect.assertions(2)

      let attempt = 0
      const {server, client} = await testSse(({channel, request}) => {
        attempt++
        if (attempt === 1) {
          channel!.send({event: 'welcome', data: {listenerName: 'foo1'}})
          channel!.send({event: 'mutation', id: '123', data: {foo: 'bar'}})
          channel!.close()
        }
        if (attempt === 2) {
          expect(request.headers['last-event-id'], 'should send last-event-id').toBe('123')
          channel!.send({event: 'reset'})
          channel!.send({event: 'mutation', id: '345', data: {bar: 'baz'}})
          process.nextTick(() => channel!.close())
        }
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

      server.close()
    })

    test('emits channel errors', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'channelError', data: {message: 'Unfortunate error'}})
        channel!.close()
        process.nextTick(() => channel!.close())
      })

      const error = await firstValueFrom(client.listen('*').pipe(catchError((err) => of(err))))

      expect(error.message, 'should have passed error message').toBe('Unfortunate error')

      server.close()
    })

    test('emits channel errors with deep error description', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'channelError', data: {error: {description: 'Expected error'}}})
      })

      const error = await firstValueFrom(client.listen('*').pipe(catchError((err) => of(err))))

      expect(error.message, 'should have passed error message').toBe('Expected error')

      server.close()
    })

    test('emits channel errors with groq parse errors (no tag)', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({
          event: 'channelError',
          data: {
            error: {
              description: 'unexpected token "\\"event]", expected expression',
              end: 18,
              query: '*[_type == "event]',
              start: 11,
              type: 'queryParseError',
            },
          },
        })
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

      server.close()
    })

    test('emits channel errors with groq parse errors (with tag)', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({
          event: 'channelError',
          data: {
            error: {
              description: 'unexpected token "\\"event]", expected expression',
              end: 18,
              query: '*[_type == "event]',
              start: 11,
              type: 'queryParseError',
            },
          },
        })
      })

      const error = await firstValueFrom(
        client
          .listen('*[_type == "event]', {}, {tag: 'some-tag'})
          .pipe(catchError((err) => of(err))),
      )

      expect(error.message, 'should have passed error message').toMatchInlineSnapshot(
        `
        "GROQ query parse error:
        > 1 | *[_type == "event]
            |           ^^^^^^^ unexpected token "\\"event]", expected expression

        Tag: some-tag"
      `,
      )

      server.close()
    })

    test('emits error if request URL is too large', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.close()
        process.nextTick(() => channel!.close())
      })

      const pad = '_'.repeat(16000)

      const err = await firstValueFrom(
        client.listen(`*{"foo":"${pad}"`).pipe(catchError((error) => of(error))),
      )

      expect(err.message, 'should have passed error message').toBe('Query too large for listener')
      server.close()
    })

    test('can immediately unsubscribe, does not connect to server', async () => {
      const onMessage = vitest.fn()
      const onError = vitest.fn()
      const onRequest = vitest.fn(({channel}) => {
        channel!.send({event: 'mutation', data: {foo: 'bar'}})
        process.nextTick(() => channel!.close())
      })

      const {server, client} = await testSse(onRequest)

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
      expect(onRequest).not.toHaveBeenCalled()
      server.close()
    })

    test('passes custom headers from client configuration', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(
        ({request, channel}) => {
          expect(request.headers['x-custom-header']).toBe('custom-value')
          channel!.send({event: 'welcome'})
        },
        {headers: {'X-Custom-Header': 'custom-value'}},
      )

      await firstValueFrom(client.listen('*', {}, {events: ['welcome']}), {defaultValue: null})
      server.close()
    })
  },
)
