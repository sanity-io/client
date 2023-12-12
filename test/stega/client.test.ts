import {createClient as createCoreClient} from '@sanity/client'
import {
  ClientStegaConfig,
  ContentSourceMap,
  createClient,
  SanityStegaClient,
} from '@sanity/client/stega'
import {vercelStegaDecode, vercelStegaDecodeAll, vercelStegaSplit} from '@vercel/stega'
import {describe, expect, test} from 'vitest'

const apiHost = 'api.sanity.url'
const defaultProjectId = 'bf1942'
const projectHost = (projectId?: string) => `https://${projectId || defaultProjectId}.${apiHost}`
const clientConfig = {
  apiHost: `https://${apiHost}`,
  projectId: 'bf1942',
  apiVersion: '1',
  dataset: 'foo',
  useCdn: false,
}

describe('@sanity/client/stega', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  const getClient = (conf?: ClientStegaConfig) => createClient({...clientConfig, ...(conf || {})})

  const result = [{_id: 'njgNkngskjg', title: 'IPA', rating: 4, country: 'Norway'}]
  const resultSourceMap = {
    documents: [
      {
        _id: 'njgNkngskjg',
        _type: 'beer',
      },
    ],
    paths: ["$['_id']", "$['title']", "$['rating']", "$['country']"],
    mappings: {
      "$[0]['_id']": {
        source: {
          document: 0,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$[0]['title']": {
        source: {
          document: 0,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$[0]['rating']": {
        source: {
          document: 0,
          path: 2,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$[0]['country']": {
        source: {
          document: 0,
          path: 3,
          type: 'documentValue',
        },
        type: 'value',
      },
    },
  } satisfies ContentSourceMap
  const query = '*[_id == $id]{_id, title, rating}'
  const params = {id: 'njgNkngskjg'}
  const qs = '*%5B_id+%3D%3D+%24id%5D%7B_id%2C+title%2C+rating%7D&%24id=%22njgNkngskjg%22'
  const studioUrl = '/studio'

  describe('createClient', async () => {
    test('createClient returns a SanityStegaClient instance', () => {
      const client = createClient({projectId: 'foo', dataset: 'bar'})
      expect(client).toBeInstanceOf(SanityStegaClient)
    })

    test('config() returns a stega config property', () => {
      const client = createClient({projectId: 'foo', dataset: 'bar'})
      expect(client.config().stega).toMatchInlineSnapshot(`
        {
          "enabled": false,
          "filter": [Function],
        }
      `)
    })

    test('withConfig merges stega', () => {
      const client = createClient({projectId: 'foo', dataset: 'bar', stega: {studioUrl: '/studio'}})
      expect(client.withConfig({stega: {enabled: true}}).config().stega.studioUrl).toBe('/studio')
    })

    test('the stega option accepts booleans as a shortcut to toggle `enabled`', () => {
      const client1 = createClient({
        projectId: 'foo',
        dataset: 'bar',
        stega: {enabled: true, studioUrl: '/studio'},
      })
      expect(client1.withConfig({stega: false}).config().stega.enabled).toBe(false)
      const client2 = createClient({
        projectId: 'foo',
        dataset: 'bar',
        stega: {enabled: false, studioUrl: '/studio'},
      })
      expect(client2.withConfig({stega: true}).config().stega.enabled).toBe(true)
    })

    test('config merges stega', () => {
      const client = createClient({projectId: 'foo', dataset: 'bar', stega: {studioUrl: '/studio'}})
      expect(client.config({stega: {enabled: true}}).config().stega.studioUrl).toBe('/studio')
    })

    test('the stega option accepts booleans as a shortcut to toggle `enabled`', () => {
      const client = createClient({
        projectId: 'foo',
        dataset: 'bar',
        stega: {enabled: true, studioUrl: '/studio'},
      })
      expect(client.config({stega: false}).config().stega.enabled).toBe(false)
      expect(client.config({stega: true}).config().stega.enabled).toBe(true)
    })

    test.skipIf(isEdge)('it returns stega strings in the response', async () => {
      nock(projectHost())
        .get(`/v1/data/query/foo?query=${qs}&resultSourceMap=withKeyArraySelector`)
        .reply(200, {ms: 123, query, result, resultSourceMap})

      const res = await getClient({stega: {enabled: true, studioUrl: '/studio'}}).fetch(
        query,
        params,
      )
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(4)
      expect(res[0].title).not.toBe(result[0].title)
      expect(vercelStegaSplit(res[0].title).cleaned).toBe(result[0].title)
      expect(vercelStegaDecode(res[0].title)).toMatchInlineSnapshot(`
        {
          "href": "/studio/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=title?baseUrl=%2Fstudio&id=njgNkngskjg&type=beer&path=title",
          "origin": "sanity.io",
        }
      `)
      expect(vercelStegaDecodeAll(JSON.stringify(res))).toMatchInlineSnapshot(`
        [
          {
            "href": "/studio/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=title?baseUrl=%2Fstudio&id=njgNkngskjg&type=beer&path=title",
            "origin": "sanity.io",
          },
          {
            "href": "/studio/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=country?baseUrl=%2Fstudio&id=njgNkngskjg&type=beer&path=country",
            "origin": "sanity.io",
          },
        ]
      `)
    })
  })

  describe.skipIf(isEdge)('client.fetch', async () => {
    test('the stega option accepts booleans as a shortcut to toggle `enabled`', async () => {
      nock(projectHost())
        .get(`/v1/data/query/foo?query=${qs}&resultSourceMap=withKeyArraySelector`)
        .reply(200, {ms: 123, query, result, resultSourceMap})

      const res = await getClient({stega: {studioUrl}}).fetch(query, params, {
        stega: true,
      })
      expect(vercelStegaDecodeAll(JSON.stringify(res))).toMatchInlineSnapshot(`
        [
          {
            "href": "/studio/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=title?baseUrl=%2Fstudio&id=njgNkngskjg&type=beer&path=title",
            "origin": "sanity.io",
          },
          {
            "href": "/studio/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=country?baseUrl=%2Fstudio&id=njgNkngskjg&type=beer&path=country",
            "origin": "sanity.io",
          },
        ]
      `)
    })

    test('the stega option accepts booleans as a shortcut to toggle `enabled`', async () => {
      nock(projectHost())
        .get(`/v1/data/query/foo?query=${qs}`)
        .reply(200, {ms: 123, query, result, resultSourceMap})

      const res = await getClient({stega: {studioUrl, enabled: true}}).fetch(query, params, {
        stega: false,
      })
      expect(vercelStegaDecodeAll(JSON.stringify(res))).toMatchInlineSnapshot('undefined')
    })

    test('the stega option merges in defaults', async () => {
      nock(projectHost())
        .get(`/v1/data/query/foo?query=${qs}&resultSourceMap=withKeyArraySelector`)
        .reply(200, {ms: 123, query, result, resultSourceMap})

      const res = await getClient({stega: {studioUrl, enabled: true}}).fetch(query, params, {
        stega: {
          studioUrl: '/admin',
        },
      })
      expect(vercelStegaDecodeAll(JSON.stringify(res))).toMatchInlineSnapshot(`
        [
          {
            "href": "/admin/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=title?baseUrl=%2Fadmin&id=njgNkngskjg&type=beer&path=title",
            "origin": "sanity.io",
          },
          {
            "href": "/admin/intent/edit/mode=presentation;id=njgNkngskjg;type=beer;path=country?baseUrl=%2Fadmin&id=njgNkngskjg&type=beer&path=country",
            "origin": "sanity.io",
          },
        ]
      `)
    })
  })
})

describe('@sanity/client', () => {
  describe('createClient', () => {
    test('throws an error if trying to use stega options that should use the stega client', () => {
      expect(() =>
        createCoreClient({
          projectId: 'abc123',
          // @ts-expect-error - we want to test that it throws an error
          stega: {
            enabled: true,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: It looks like you're using options meant for '@sanity/client/stega'. Make sure you're using the right import. Or set 'stega' in 'createClient' to 'false'.]`,
      )
      expect(() =>
        // @ts-expect-error - we want to test that it throws an error
        createCoreClient({projectId: 'abc123', stega: null}),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: It looks like you're using options meant for '@sanity/client/stega'. Make sure you're using the right import. Or set 'stega' in 'createClient' to 'false'.]`,
      )
    })
    test('allows passing stega: undefined', () => {
      expect(() =>
        createCoreClient({
          projectId: 'abc123',
          // @ts-expect-error - we want to test that it throws an error
          stega: undefined,
        }),
      ).not.toThrow()
    })
    test('allows passing stega: false', () => {
      expect(() =>
        createCoreClient({
          projectId: 'abc123',
          // @ts-expect-error - we want to test that it throws an error
          stega: false,
        }),
      ).not.toThrow()
    })
    test('disallows passing stega: true', () => {
      expect(() =>
        createCoreClient({
          projectId: 'abc123',
          // @ts-expect-error - we want to test that it throws an error
          stega: true,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: It looks like you're using options meant for '@sanity/client/stega'. Make sure you're using the right import. Or set 'stega' in 'createClient' to 'false'.]`,
      )
    })
  })
  describe('client.fetch', async () => {
    const client = createCoreClient(clientConfig)
    const isEdge = typeof EdgeRuntime === 'string'
    let nock: typeof import('nock') = (() => {
      throw new Error('Not supported in EdgeRuntime')
    }) as any
    if (!isEdge) {
      const _nock = await import('nock')
      nock = _nock.default

      nock(projectHost())
        .get(`/v1/data/query/foo?query=*`)
        .reply(200, {ms: 123, query: '*', result: []})
    }

    test('throws an error if trying to use stega options that should use the stega client', async () => {
      await expect(() =>
        client.fetch(
          '*',
          {},
          {
            stega: {
              enabled: true,
            },
          },
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: It looks like you're using options meant for '@sanity/client/stega'. Make sure you're using the right import. Or set 'stega' in 'fetch' to 'false'.]`,
      )
      expect(() =>
        // @ts-expect-error - we want to test that it throws an error
        createCoreClient({projectId: 'abc123', stega: null}),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: It looks like you're using options meant for '@sanity/client/stega'. Make sure you're using the right import. Or set 'stega' in 'createClient' to 'false'.]`,
      )
    })
    test('allows passing stega: undefined', () => {
      expect(() =>
        client.fetch(
          '*',
          {},
          {
            stega: undefined,
          },
        ),
      ).not.toThrow()
    })
    test('allows passing stega: false', () => {
      expect(() =>
        client.fetch(
          '*',
          {},
          {
            stega: false,
          },
        ),
      ).not.toThrow()
    })
    test('disallows passing stega: true', () => {
      expect(() =>
        client.fetch(
          '*',
          {},
          {
            stega: true,
          },
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: It looks like you're using options meant for '@sanity/client/stega'. Make sure you're using the right import. Or set 'stega' in 'fetch' to 'false'.]`,
      )
    })
  })
})
