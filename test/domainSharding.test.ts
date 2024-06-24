import {type ClientConfig, createClient} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getDomainSharder} from '../src/http/domainSharding'

const apiHost = 'api.sanity.url'
const defaultProjectId = 'bf1942'
const clientConfig = {
  apiHost: `https://${apiHost}`,
  projectId: defaultProjectId,
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
}

describe('domain sharding', async () => {
  const isBrowser = typeof window !== 'undefined' && window.location && window.location.hostname
  const isEdge = typeof EdgeRuntime === 'string'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  const testClient = describe.each([
    [
      'static config',
      (conf?: ClientConfig) =>
        createClient({...clientConfig, useDomainSharding: true, ...(conf || {})}),
    ],
    [
      'reconfigured config',
      (conf?: ClientConfig) =>
        createClient({...clientConfig, ...(conf || {}), useDomainSharding: false}).withConfig({
          useDomainSharding:
            typeof conf?.useDomainSharding === 'undefined' ? true : conf.useDomainSharding,
        }),
    ],
  ])

  testClient('%s: some test', (name, getClient) => {
    test.skipIf(isEdge || isBrowser)(
      'can create a client that spreads request over a number of hostnames',
      async () => {
        const client = getClient()

        for (let i = 0; i <= 15; i++) {
          const shard = i % 10
          const mockHost = `https://${defaultProjectId}.api.s${shard}.sanity.url`
          const mockPath = `/v1/ping?req=${i}`
          nock(mockHost).get(mockPath).delay(25).reply(200, {req: i})
        }

        const requests = []
        for (let i = 0; i <= 15; i++) {
          requests.push(client.request({uri: `/ping?req=${i}`}))
        }

        const responses = await Promise.all(requests)

        for (let i = 0; i <= 15; i++) {
          const res = responses[i]
          expect(res).toMatchObject({req: i})
        }
      },
    )

    test('listen() uses sharding', async () => {
      const client = getClient()
      const listenerName = 'QYdPOBgC3V0Os5QsphvTKu'

      nock('https://bf1942.api.s0.sanity.url', {encodedQueryParams: true})
        .get('/v1/data/listen/foo')
        .query({query: 'true', includeResult: 'true'})
        .reply(200, `\n:\nevent: welcome\ndata: {"listenerName": "${listenerName}"}\n\n\n`, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        })

      return new Promise<void>((resolve, reject) => {
        const subscription = client.listen('true', {}, {events: ['welcome']}).subscribe({
          next: (msg) => {
            expect(msg).toMatchObject({listenerName})
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

    test('middleware does not shard if `useDomainSharding` is undefined', () => {
      const {middleware} = getDomainSharder()
      const out = middleware.processOptions({url: 'https://bf1942.api.sanity.url/v1/ping'})
      expect(out.url).toBe('https://bf1942.api.sanity.url/v1/ping')
    })

    test('middleware does not shard if `useDomainSharding` is false', () => {
      const {middleware} = getDomainSharder()
      const out = middleware.processOptions({
        url: 'https://bf1942.api.sanity.url/v1/ping',
        useDomainSharding: false,
      })
      expect(out.url).toBe('https://bf1942.api.sanity.url/v1/ping')
    })

    test('middleware rewrites hostname to be shared if `useDomainSharding` is true', () => {
      const {middleware} = getDomainSharder()
      const out = middleware.processOptions({
        url: 'https://bf1942.api.sanity.url/v1/ping',
        useDomainSharding: true,
      })
      expect(out.url).toBe('https://bf1942.api.s0.sanity.url/v1/ping')
    })

    test('middleware uses first bucket with fewest pending requests', () => {
      const {middleware} = getDomainSharder([9, 6, 3, 8, 1, 2, 5, 4, 1, 7])
      const out = middleware.processOptions({
        url: 'https://bf1942.api.sanity.url/v1/ping',
        useDomainSharding: true,
      })
      expect(out.url).toBe('https://bf1942.api.s4.sanity.url/v1/ping')
    })

    test('middleware increases bucket request number on request', () => {
      const buckets = [1, 1]
      const {middleware} = getDomainSharder(buckets)
      middleware.onRequest({
        options: {
          url: 'https://bf1942.api.s1.sanity.url/v1/ping',
          useDomainSharding: true,
        },
      })
      expect(buckets).toEqual([1, 2])
    })

    test('middleware decreases bucket request number on response', () => {
      const buckets = [2, 1]
      const {middleware} = getDomainSharder(buckets)
      const context = {
        options: {
          url: 'https://bf1942.api.s0.sanity.url/v1/ping',
          useDomainSharding: true,
        },
      }
      middleware.onResponse({} as any, context as any)
      expect(buckets).toEqual([1, 1])
    })

    test('reconfiguring with `withConfig()` maintains sharding setting', () => {
      const client = getClient()
      expect(client.config().useDomainSharding).toBe(true)

      const client2 = client.withConfig({apiVersion: '2024-07-01'})
      expect(client2.config().useDomainSharding).toBe(true)
    })
  })
})
