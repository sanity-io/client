import {type ContentSourceMap} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {getActiveMock} from '../helpers/mockFetch'
import {createClient, getClient, projectHost} from './helpers'

describe('data', () => {
  const result = [{_id: 'njgNkngskjg', rating: 5}]
  const resultSourceMap = {
    documents: [
      {
        _id: 'njgNkngskjg',
        _type: 'beer',
      },
    ],
    paths: ["$['_id']", "$['rating']"],
    mappings: {
      "$[0]['_id']": {
        source: {
          document: 0,
          path: 0,
          type: 'documentValue',
        },
        type: 'value',
      },
      "$[0]['rating']": {
        source: {
          document: 0,
          path: 1,
          type: 'documentValue',
        },
        type: 'value',
      },
    },
  } satisfies ContentSourceMap
  test('can query for documents', async () => {
    const query = 'beerfiesta.beer[.title == $beerName]'
    const params = {beerName: 'Headroom Double IPA'}
    const qs =
      'beerfiesta.beer%5B.title%20%3D%3D%20%24beerName%5D&%24beerName=%22Headroom%20Double%20IPA%22'

    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo?query=${qs}&returnQuery=false`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const res = await getClient().fetch(query, params)
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('can query for documents and return full response', async () => {
    const query = 'beerfiesta.beer[.title == $beerName]'
    const params = {beerName: 'Headroom Double IPA'}
    const qs =
      'beerfiesta.beer%5B.title%20%3D%3D%20%24beerName%5D&%24beerName=%22Headroom%20Double%20IPA%22'

    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo?query=${qs}`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          query,
          result,
        },
      })

    const res = await getClient().fetch(query, params, {filterResponse: false})
    expect(res.ms, 'should include timing info').toBe(123)
    expect(res.query, 'should include query').toBe(query)
    expect(res.result.length, 'length should match').toBe(1)
    expect(res.result[0].rating, 'data should match').toBe(5)
  })

  test('can explicitly ask to include query in response', async () => {
    const query = 'beerfiesta.beer[.title == $beerName]'
    const params = {beerName: 'Headroom Double IPA'}
    const qs =
      'beerfiesta.beer%5B.title%20%3D%3D%20%24beerName%5D&%24beerName=%22Headroom%20Double%20IPA%22'

    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo?query=${qs}`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          query,
          result,
        },
      })

    const res = await getClient().fetch(query, params, {filterResponse: false, returnQuery: true})
    expect(res.ms, 'should include timing info').toBe(123)
    expect(res.query, 'should include query').toBe(query)
    expect(res.result.length, 'length should match').toBe(1)
    expect(res.result[0].rating, 'data should match').toBe(5)
  })

  test('gets helpful error messages on query errors (no tag)', async () => {
    const query = '*[_type == "event]'
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo?query=${encodeURIComponent(query)}&returnQuery=false`)
      .respond({
        status: 400,
        body: {
          error: {
            description: 'unexpected token "\\"event]", expected expression',
            end: 18,
            query: '*[_type == "event]',
            start: 11,
            type: 'queryParseError',
          },
        },
      })

    await expect(getClient().fetch(query)).rejects.toThrowErrorMatchingInlineSnapshot(`
      [Error: GROQ query parse error:
      > 1 | *[_type == "event]
          |           ^^^^^^^ unexpected token "\\"event]", expected expression]
    `)
  })

  test('gets helpful error messages on query errors (with tag)', async () => {
    const query = '*[_type == "event]'
    getActiveMock()
      .scope(projectHost())
      .on(
        'GET',
        `/v1/data/query/foo?query=${encodeURIComponent(query)}&returnQuery=false&tag=get-events`,
      )
      .respond({
        status: 400,
        body: {
          error: {
            description: 'unexpected token "\\"event]", expected expression',
            end: 18,
            query: '*[_type == "event]',
            start: 11,
            type: 'queryParseError',
          },
        },
      })

    await expect(getClient().fetch(query, {}, {tag: 'get-events'})).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [Error: GROQ query parse error:
      > 1 | *[_type == "event]
          |           ^^^^^^^ unexpected token "\\"event]", expected expression

      Tag: get-events]
    `)
  })

  test('can query for documents with request tag', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo?query=*&tag=mycompany.syncjob&returnQuery=false`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const res = await getClient().fetch('*', {}, {tag: 'mycompany.syncjob'})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('can query for documents with last live event ID', async () => {
    getActiveMock()
      .scope(projectHost())
      .on(
        'GET',
        `/vX/data/query/foo?query=*&returnQuery=false&lastLiveEventId=MTA0MDM1Nnx2a2lQY200bnRHQQ`,
      )
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const res = await getClient({apiVersion: 'X'}).fetch(
      '*',
      {},
      {lastLiveEventId: 'MTA0MDM1Nnx2a2lQY200bnRHQQ'},
    )
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test(
    'allows passing last live event ID from Next.js style searchParams',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on(
          'GET',
          `/vX/data/query/foo?query=*&returnQuery=false&lastLiveEventId=MTA0MDM1Nnx2a2lQY200bnRHQQ`,
        )
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
          },
        })

      const res = await getClient({apiVersion: 'X'}).fetch(
        '*',
        {},
        // searchParams in Next.js will return an arry of strings in some cases,
        // as an convenience we allow it, and behave the same way as URLSearchParams.get() when that happens:
        // we pick the first value in the array
        {lastLiveEventId: ['MTA0MDM1Nnx2a2lQY200bnRHQQ', 'some-other-value']},
      )
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test(
    'allows passing last live event ID from URLSearchParams that might be null',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', `/vX/data/query/foo?query=*&returnQuery=false`)
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
          },
        })
      const searchParams = new URLSearchParams('')

      const res = await getClient({apiVersion: 'X'}).fetch(
        '*',
        {},
        // URLSearchParams.get() will return null if the key is not found, we should handle that
        {lastLiveEventId: searchParams.get('lastLiveEventId')},
      )
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test(
    'allows passing last live event ID from URLSearchParams that might be an empty string',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', `/vX/data/query/foo?query=*&returnQuery=false`)
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
          },
        })
      const searchParams = new URLSearchParams('lastLiveEventId=')

      const res = await getClient({apiVersion: 'X'}).fetch(
        '*',
        {},
        // URLSearchParams.get() will return null if the key is not found, we should handle that
        {lastLiveEventId: searchParams.get('lastLiveEventId')},
      )
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test('can query for documents with resultSourceMap and perspective', async () => {
    getActiveMock()
      .scope(projectHost())
      .on(
        'GET',
        `/vX/data/query/foo?query=*&returnQuery=false&resultSourceMap=true&perspective=previewDrafts`,
      )
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
          resultSourceMap,
        },
      })

    const client = getClient({
      apiVersion: 'X',
      resultSourceMap: true,
      perspective: 'previewDrafts',
    })
    const res = await client.fetch('*', {})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test(
    'can query for documents with resultSourceMap=withKeyArraySelector and perspective',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on(
          'GET',
          `/vX/data/query/foo?query=*&returnQuery=false&resultSourceMap=withKeyArraySelector&perspective=previewDrafts`,
        )
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
            resultSourceMap,
          },
        })

      const client = getClient({
        apiVersion: 'X',
        resultSourceMap: 'withKeyArraySelector',
        perspective: 'previewDrafts',
      })
      const res = await client.fetch('*', {})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test('automatically useCdn false if perspective is previewDrafts', async () => {
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', `/v1/data/query/foo?query=*&returnQuery=false&perspective=previewDrafts`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      useCdn: true,
      perspective: 'previewDrafts',
    })
    const res = await client.fetch('*', {})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test(
    'can query for documents with resultSourceMap and perspective using the third client.fetch parameter',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on(
          'GET',
          `/vX/data/query/foo?query=*&returnQuery=false&resultSourceMap=true&perspective=previewDrafts`,
        )
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
            resultSourceMap,
          },
        })

      const client = getClient({apiVersion: 'X'})
      const res = await client.fetch('*', {}, {resultSourceMap: true, perspective: 'previewDrafts'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test(
    'setting resultSourceMap and perspective on client.fetch overrides the config',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on('GET', `/vX/data/query/foo?query=*&returnQuery=false&perspective=published`)
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
            resultSourceMap,
          },
        })

      const client = getClient({
        apiVersion: 'X',
        resultSourceMap: true,
        perspective: 'previewDrafts',
      })
      const res = await client.fetch('*', {}, {resultSourceMap: false, perspective: 'published'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test(
    'setting a perspective previewDrafts override on client.fetch sets useCdn to false',
    async () => {
      getActiveMock()
        .scope('https://abc123.api.sanity.io')
        .on('GET', `/v1/data/query/foo?query=*&returnQuery=false&perspective=previewDrafts`)
        .respond({
          status: 200,
          body: {
            ms: 123,
            result,
          },
        })

      const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})
      const res = await client.fetch('*', {}, {perspective: 'previewDrafts'})
      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test('can query with a variant id set in the client config', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/vX/data/query/foo?query=*&returnQuery=false&variant=abc`)
      .respond({status: 200, body: {ms: 123, result}})

    const client = getClient({apiVersion: 'X', variant: 'abc'})
    const res = await client.fetch('*', {})

    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('can query with a variant condition set in the client config', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/vX/data/query/foo?query=*&returnQuery=false&variantCondition=market%3Aus`)
      .respond({status: 200, body: {ms: 123, result}})

    const client = getClient({apiVersion: 'X', variant: {market: 'us'}})
    const res = await client.fetch('*', {})

    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('setting a variant id on client.fetch supersedes the config', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/vX/data/query/foo?query=*&returnQuery=false&variant=xyz`)
      .respond({status: 200, body: {ms: 123, result}})

    const client = getClient({
      apiVersion: 'X',
      variant: 'abc',
    })

    const res = await client.fetch('*', {}, {variant: 'xyz'})

    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test(
    'setting a variant condition on client.fetch supersedes the config',
    async () => {
      getActiveMock()
        .scope(projectHost())
        .on(
          'GET',
          `/vX/data/query/foo?query=*&returnQuery=false&variantCondition=audience%3Amusicians&variantCondition=currency%3Agbp&variantCondition=market%3Aeu`,
        )
        .respond({status: 200, body: {ms: 123, result}})

      const client = getClient({
        apiVersion: 'X',
        variant: {
          market: 'us',
        },
      })

      const res = await client.fetch(
        '*',
        {},
        {
          variant: {
            market: 'eu',
            currency: 'gbp',
            audience: 'musicians',
          },
        },
      )

      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test('sends multiple variant conditions ordered lexicographically', async () => {
    getActiveMock()
      .scope(projectHost())
      .on(
        'GET',
        `/vX/data/query/foo?query=*&returnQuery=false&variantCondition=audience%3Amusicians&variantCondition=currency%3Agbp&variantCondition=market%3Aeu`,
      )
      .respond({status: 200, body: {ms: 123, result}})

    const client = getClient({
      apiVersion: 'X',
      variant: {
        market: 'eu',
        audience: 'musicians',
        currency: 'gbp',
      },
    })

    const res = await client.fetch('*', {})

    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
    // The mock matches query params order-insensitively, so assert the
    // lexicographic ordering on the raw URL that was requested.
    const [request] = getActiveMock().getRequests()
    expect(request.fullUrl, 'expected sorted variantCondition params').toContain(
      'variantCondition=audience%3Amusicians&variantCondition=currency%3Agbp&variantCondition=market%3Aeu',
    )
  })

  test(
    'setting a variant id on client.fetch supersedes a variant condition from the config',
    async () => {
      // the fetch-level variant replaces the config value wholesale – no
      // `variantCondition` param should remain
      getActiveMock()
        .scope(projectHost())
        .on('GET', `/vX/data/query/foo?query=*&returnQuery=false&variant=xyz`)
        .respond({status: 200, body: {ms: 123, result}})

      const client = getClient({apiVersion: 'X', variant: {market: 'us'}})
      const res = await client.fetch('*', {}, {variant: 'xyz'})

      expect(res.length, 'length should match').toBe(1)
      expect(res[0].rating, 'data should match').toBe(5)
    },
  )

  test('allow overriding useCdn to false on client.fetch', async () => {
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', `/v1/data/query/foo?query=*&returnQuery=false`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: true})
    const res = await client.fetch('*', {}, {useCdn: false})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('allow overriding useCdn to true on client.fetch', async () => {
    getActiveMock()
      .scope('https://abc123.apicdn.sanity.io')
      .on('GET', `/v1/data/query/foo?query=*&returnQuery=false`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const client = createClient({projectId: 'abc123', dataset: 'foo', useCdn: false})
    const res = await client.fetch('*', {}, {useCdn: true})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('throws on invalid request tag on request', () => {
    expect(() => {
      void getClient().fetch('*', {}, {tag: 'mycompany syncjob ok'})
    }).toThrow(/tag can only contain alphanumeric/i)
  })

  test('can use a tag-prefixed client', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', `/v1/data/query/foo?query=*&returnQuery=false&tag=mycompany.syncjob`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          query: '*',
          result,
        },
      })

    const res = await getClient({requestTagPrefix: 'mycompany'}).fetch('*', {}, {tag: 'syncjob'})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('can query using cacheMode=noStale using APICDN', async () => {
    getActiveMock()
      .scope('https://abc123.apicdn.sanity.io')
      .on('GET', `/v1/data/query/foo?query=*&returnQuery=false&cacheMode=noStale`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const client = createClient({projectId: 'abc123', dataset: 'foo'})
    const res = await client.fetch('*', {}, {cacheMode: 'noStale'})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('cacheMode is ignored when useCdn:false', async () => {
    getActiveMock()
      .scope('https://abc123.api.sanity.io')
      .on('GET', `/v1/data/query/foo?query=*&returnQuery=false`)
      .respond({
        status: 200,
        body: {
          ms: 123,
          result,
        },
      })

    const client = createClient({projectId: 'abc123', dataset: 'foo'})
    const res = await client.fetch('*', {}, {cacheMode: 'noStale', useCdn: false})
    expect(res.length, 'length should match').toBe(1)
    expect(res[0].rating, 'data should match').toBe(5)
  })

  test('handles api errors gracefully', async () => {
    expect.assertions(4)

    const response = {
      statusCode: 403,
      error: 'Forbidden',
      message: 'You are not allowed to access this resource',
    }

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=area51&returnQuery=false')
      .respondPersist({status: 403, body: response})

    try {
      await getClient().fetch('area51')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message, 'should contain error code').toContain(response.error)
      expect(err.message, 'should contain error message').toContain(response.message)
      expect(err.responseBody, 'responseBody should be populated').toContain(response.message)
    }
  })

  test('handles db errors gracefully', async () => {
    expect.assertions(4)

    const response = {
      error: {
        column: 13,
        line: 'foo.bar.baz  12#[{',
        lineNumber: 1,
        description: 'Unable to parse entire expression',
        query: 'foo.bar.baz  12#[{',
        type: 'gqlParseError',
      },
    }

    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=foo.bar.baz%20%2012%23%5B%7B&returnQuery=false')
      .respond({status: 400, body: response})

    try {
      await getClient().fetch('foo.bar.baz  12#[{')
    } catch (err: any) {
      expect(err, 'should be error').toBeInstanceOf(Error)
      expect(err.message, 'should contain error description').toContain(response.error.description)
      expect(err.details.column, 'error should have details object').toBe(response.error.column)
      expect(err.details.line, 'error should have details object').toBe(response.error.line)
    }
  })
})
