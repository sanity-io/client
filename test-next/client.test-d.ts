/// <reference types="next/types/global" />

import {
  createClient,
  type QueryOptions,
  type QueryParams,
  type RawQuerylessQueryResponse,
  type RawQueryResponse,
} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
  test('params', async () => {
    // Detect if there are any QueryOptions that are not handled by QueryParams
    type QueryParamsKeys = {
      [K in keyof QueryOptions as QueryParams[K] extends never
        ? K
        : never]-?: QueryParams[K] extends never ? true : never
    }
    expectTypeOf<QueryParamsKeys>().toMatchTypeOf<Record<string, never>>()
    // Any params not conflicting with QueryOptions should be allowed
    expectTypeOf({type: 'post'}).toMatchTypeOf<QueryParams>()
    // While those conflicting should error
    expectTypeOf({cache: 'no-store'}).not.toMatchTypeOf<QueryParams>()
  })
  test('simple query', async () => {
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        {cache: 'force-cache', next: {revalidate: 60, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        {filterResponse: false, cache: 'force-cache', next: {revalidate: 60, tags: ['post']}},
      ),
    ).toMatchTypeOf<RawQueryResponse<any>>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        {filterResponse: false, returnQuery: false},
      ),
    ).toMatchTypeOf<RawQuerylessQueryResponse<any>>()
  })
  test('generics', async () => {
    expectTypeOf(
      await client.fetch<number>('count(*[cache == $cache])', {
        // @ts-expect-error -- should fail
        cache: 'invalid-cache',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {cache: QueryOptions['cache']}
      >('count(*[cache == $cache])', {
        cache: 'force-cache',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {cache: QueryOptions['cache']}
      >('count(*[cache == $cache])', {cache: 'invalid-cache'}),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch<number>('count(*[next.revalidate == $next.revalidate])', {
        // @ts-expect-error -- should fail
        next: {revalidate: false},
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {next: QueryOptions['next']}
      >('count(*[next.revalidate == $next.revalidate])', {
        next: {revalidate: false},
      }),
    ).toMatchTypeOf<number>()
  })
  test('options for Next.js App Router are available', async () => {
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {cache: 'no-store'}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: false}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {tags: ['post']}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        {next: {revalidate: 60, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        {next: {revalidate: false, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
  })
})
