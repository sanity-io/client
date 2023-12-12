import {ContentSourceMap, createClient} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
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
  test('stega: false', async () => {
    expectTypeOf(client.fetch('*', {}, {stega: false})).toMatchTypeOf<Promise<any>>()
  })
})
