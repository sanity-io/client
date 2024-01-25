import {createClient, SanityClient} from '@sanity/client'
import {
  ContentSourceMap,
  createClient as createStegaClient,
  SanityStegaClient,
} from '@sanity/client/stega'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client: SanityClient | SanityStegaClient = createStegaClient({})
  test('simple query', async () => {
    expectTypeOf(client.fetch('*')).toMatchTypeOf<Promise<any>>()
    expectTypeOf(client.fetch('*[_type == $type]', {type: 'post'})).toMatchTypeOf<Promise<any>>()
  })
  test('generics', async () => {
    expectTypeOf(client.fetch<number>('count(*)')).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<Promise<number>>()
    // @ts-expect-error -- should fail
    expectTypeOf(client.fetch<number, {type: string}>('count(*[_type == $type])')).toMatchTypeOf<
      Promise<number>
    >()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch<number, {type: string}>('count(*[_type == $type])', {_type: 'post'}),
    ).toMatchTypeOf<Promise<number>>()
  })
  test('filterResponse: false', async () => {
    expectTypeOf(client.fetch<number>('count(*)', {}, {filterResponse: true})).toMatchTypeOf<
      Promise<number>
    >()
    expectTypeOf(client.fetch<number>('count(*)', {}, {filterResponse: false})).toMatchTypeOf<
      Promise<{
        result: number
        ms: number
        query: string
        resultSourceMap?: ContentSourceMap
      }>
    >()
    expectTypeOf(
      client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: false},
      ),
    ).toMatchTypeOf<
      Promise<{
        result: number
        ms: number
        query: string
        resultSourceMap?: ContentSourceMap
      }>
    >()
  })
})

test('SanityClient type can be assigned to SanityStegaClient', () => {
  function isStegaClient(client: SanityClient | SanityStegaClient): client is SanityStegaClient {
    return client instanceof SanityStegaClient
  }
  function isSanityClient(client: unknown): client is SanityClient {
    return client instanceof SanityClient
  }

  expectTypeOf(isStegaClient(createStegaClient({}))).toMatchTypeOf<boolean>()
  expectTypeOf(isStegaClient(createClient({}))).toMatchTypeOf<boolean>()
  expectTypeOf(isSanityClient(createStegaClient({}))).toMatchTypeOf<boolean>()
  expectTypeOf(isSanityClient(createClient({}))).toMatchTypeOf<boolean>()
})

// test('SanityClient type is assignable to itself on both export paths', () => {
//   expectTypeOf<SanityClient>().toMatchTypeOf<import('@sanity/client/stega').SanityClient>()
// })
