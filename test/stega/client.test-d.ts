import {createClient, SanityClient} from '@sanity/client'
import {
  type ContentSourceMap,
  createClient as createStegaClient,
  SanityStegaClient,
} from '@sanity/client/stega'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client: SanityClient | SanityStegaClient = createStegaClient({})
  test('simple query', async () => {
    expectTypeOf(await client.fetch('*')).toExtend<any>()
    expectTypeOf(await client.fetch('*[_type == $type]', {type: 'post'})).toExtend<any>()
  })
  test('generics', async () => {
    expectTypeOf(await client.fetch<number>('count(*)')).toExtend<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
    ).toExtend<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, {type: string}>('count(*[_type == $type])'),
    ).toExtend<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {_type: 'post'}),
    ).toExtend<number>()
  })
  test('filterResponse: false', async () => {
    expectTypeOf(
      await client.fetch<number>('count(*)', {}, {filterResponse: true}),
    ).toExtend<number>()
    expectTypeOf(await client.fetch<number>('count(*)', {}, {filterResponse: false})).toExtend<{
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
    ).toExtend<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: false},
      ),
    ).toExtend<{
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

  expectTypeOf(isStegaClient(createStegaClient({}))).toExtend<boolean>()
  expectTypeOf(isStegaClient(createClient({}))).toExtend<boolean>()
  expectTypeOf(isSanityClient(createStegaClient({}))).toExtend<boolean>()
  expectTypeOf(isSanityClient(createClient({}))).toExtend<boolean>()
})

test('SanityClient type is assignable to itself on both export paths', async () => {
  expectTypeOf<SanityClient>().toExtend<import('@sanity/client/stega').SanityClient>()
})
