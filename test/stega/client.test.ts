import {
  ClientStegaConfig,
  ContentSourceMap,
  createClient,
  SanityStegaClient,
} from '@sanity/client/stega'
import {vercelStegaDecode, vercelStegaDecodeAll, vercelStegaSplit} from '@vercel/stega'
import {describe, expect, test} from 'vitest'

describe('@sanity/client/stega', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  // const isNode = !isEdge && typeof document === 'undefined'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }
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
  const getClient = (conf?: ClientStegaConfig) => createClient({...clientConfig, ...(conf || {})})

  test('createClient returns a SanityStegaClient instance', () => {
    const client = createClient({projectId: 'foo', dataset: 'bar'})
    expect(client).toBeInstanceOf(SanityStegaClient)
  })

  test.skipIf(isEdge)('it returns stega strings in the response', async () => {
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

    nock(projectHost())
      .get(`/v1/data/query/foo?query=${qs}&resultSourceMap=withKeyArraySelector`)
      .reply(200, {
        ms: 123,
        query: query,
        result,
        resultSourceMap,
      })

    const res = await getClient({stega: {enabled: true, studioUrl: '/studio'}}).fetch(query, params)
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(4)
    expect(res[0].title).not.toBe(result[0].title)
    expect(vercelStegaSplit(res[0].title).cleaned).toBe(result[0].title)
    expect(vercelStegaDecode(res[0].title)).toMatchInlineSnapshot(`
      {
        "href": "/studio/intent/edit/id=njgNkngskjg;type=beer;path=title?baseUrl=%2Fstudio&projectId=foo&dataset=bf1942&id=njgNkngskjg&type=beer&path=title",
        "origin": "sanity.io",
      }
    `)
    expect(vercelStegaDecodeAll(JSON.stringify(res))).toMatchInlineSnapshot(`
      [
        {
          "href": "/studio/intent/edit/id=njgNkngskjg;type=beer;path=title?baseUrl=%2Fstudio&projectId=foo&dataset=bf1942&id=njgNkngskjg&type=beer&path=title",
          "origin": "sanity.io",
        },
        {
          "href": "/studio/intent/edit/id=njgNkngskjg;type=beer;path=country?baseUrl=%2Fstudio&projectId=foo&dataset=bf1942&id=njgNkngskjg&type=beer&path=country",
          "origin": "sanity.io",
        },
      ]
    `)
  })
})
