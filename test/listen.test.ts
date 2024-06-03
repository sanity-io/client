import type {AddressInfo} from 'node:net'

import {type ClientConfig, createClient} from '@sanity/client'
import {describe, expect, test, vitest} from 'vitest'

import {createSseServer, type OnRequest} from './helpers/sseServer'

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

      try {
        await new Promise<void>((resolve, reject) => {
          const query = '*[_type == "beer" && title == $beerName]'
          const params = {beerName: 'Headroom Double IPA'}

          const subscription = client.listen(query, params).subscribe({
            next: (msg) => {
              expect(msg, 'event data should be correct').toEqual({...eventData, type: 'mutation'})

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

    test('listener sends auth token if given (node)', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(
        ({request, channel}) => {
          expect(request.headers.authorization, 'should send token').toBe('Bearer foobar')

          channel!.send({event: 'disconnect'})
          process.nextTick(() => {
            channel!.close()
          })
        },
        {token: 'foobar'},
      )

      try {
        await new Promise<void>((resolve, reject) => {
          const subscription = client.listen('*').subscribe({
            error: (err) => {
              subscription.unsubscribe()
              reject(err)
            },
            complete: resolve,
          })
        })
      } finally {
        server.close()
      }
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

    test('emits channel errors', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'channelError', data: {message: 'Unfortunate error'}})
        channel!.close()
        process.nextTick(() => channel!.close())
      })
      try {
        await new Promise<void>((resolve) => {
          const subscription = client.listen('*').subscribe({
            error: (err) => {
              expect(err.message, 'should have passed error message').toBe('Unfortunate error')

              subscription.unsubscribe()
              resolve()
            },
          })
        })
      } finally {
        server.close()
      }
    })

    test('emits channel errors with deep error description', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.send({event: 'channelError', data: {error: {description: 'Expected error'}}})
        channel!.close()
        process.nextTick(() => channel!.close())
      })
      try {
        await new Promise<void>((resolve) => {
          const subscription = client.listen('*').subscribe({
            error: (err) => {
              expect(err.message, 'should have passed error message').toBe('Expected error')
              subscription.unsubscribe()
              resolve()
            },
          })
        })
      } finally {
        server.close()
      }
    })

    test('emits error if request URL is too large', async () => {
      expect.assertions(1)

      const {server, client} = await testSse(({channel}) => {
        channel!.close()
        process.nextTick(() => channel!.close())
      })

      try {
        await new Promise<void>((resolve) => {
          const pad = '_'.repeat(16000)
          client.listen(`*{"foo":"${pad}"`).subscribe({
            error: (err) => {
              expect(err.message, 'should have passed error message').toBe(
                'Query too large for listener',
              )

              resolve()
            },
          })
        })
      } finally {
        server.close()
      }
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
  },
)
