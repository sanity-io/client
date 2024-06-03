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
    expectTypeOf(await client.fetch('*')).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*[_type == $type]', {type: 'post'})).toMatchTypeOf<any>()
  })
  test('generics', async () => {
    expectTypeOf(await client.fetch<number>('count(*)')).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, {type: string}>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {_type: 'post'}),
    ).toMatchTypeOf<number>()
  })
  test('filterResponse: false', async () => {
    expectTypeOf(
      await client.fetch<number>('count(*)', {}, {filterResponse: true}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*)', {}, {filterResponse: false}),
    ).toMatchTypeOf<{
      result: number
      ms: number
      query: string
      resultSourceMap?: ContentSourceMap
    }>()
    expectTypeOf(
      await client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: false},
      ),
    ).toMatchTypeOf<{
      result: number
      ms: number
      query: string
      resultSourceMap?: ContentSourceMap
    }>()
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

test('SanityClient type is assignable to itself on both export paths', async () => {
  expectTypeOf<SanityClient>().toMatchTypeOf<import('@sanity/client/stega').SanityClient>()
})
