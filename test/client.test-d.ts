import {
  type ContentSourceMap,
  createClient,
  type QueryOptions,
  type QueryParams,
  type QueryWithoutParams,
  type RawQueryResponse,
} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
  test('params', async () => {
    // Detect if there are any QueryOptions that are not handled by QueryParams
    type QueryParamsKeys = {
      [K in keyof QueryOptions as QueryParams[K] extends never
        ? Exclude<K, 'cache' | 'next'>
        : never]-?: QueryParams[K] extends never ? true : never
    }
    expectTypeOf<QueryParamsKeys>().toMatchTypeOf<Record<string, never>>()
    // Any params not conflicting with QueryOptions should be allowed
    expectTypeOf({type: 'post'}).toMatchTypeOf<QueryParams>()
    // While those conflicting should error
    expectTypeOf({filterResponse: true}).not.toMatchTypeOf<QueryParams>()
  })
  test('simple query', async () => {
    expectTypeOf(await client.fetch('*')).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*', undefined)).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*', {})).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*[_type == $type]', {type: 'post'})).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*', undefined, {filterResponse: false})).toMatchTypeOf<
      RawQueryResponse<any>
    >()
    expectTypeOf(
      await client.fetch<any, {filterResponse?: undefined}>('*', {} satisfies QueryParams, {
        filterResponse: false,
      }),
    ).toMatchTypeOf<RawQueryResponse<any>>()
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {filterResponse: false}),
    ).toMatchTypeOf<RawQueryResponse<any>>()
  })
  test('generics', async () => {
    expectTypeOf(await client.fetch<number>('count(*)')).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {
        // @ts-expect-error -- should fail
        _type: 'post',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, never>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, undefined>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', undefined),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', {}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', undefined),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', {}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, never>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>('count(*[_type == $type])', undefined),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>('count(*[_type == $type])', {}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*[_type == $type])', {
        // @ts-expect-error -- should fail
        filterResponse: false,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {filterResponse: boolean}
      >('count(*[_type == $type])', {
        filterResponse: false,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*[_type == $type])', {
        type: 'post',
        // @ts-expect-error -- should fail
        filterResponse: true,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {filterResponse: boolean; type: string}
      >('count(*[_type == $type])', {
        filterResponse: true,
        type: 'post',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>('count(*[_type == $type])', undefined, {
        filterResponse: true,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        {},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>('count(*[_type == $type])', undefined, {
        filterResponse: false,
      }),
    ).toMatchTypeOf<RawQueryResponse<number>>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        {},
        {filterResponse: false},
      ),
    ).toMatchTypeOf<RawQueryResponse<number>>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
        {filterResponse: false},
      ),
    ).not.toMatchTypeOf<RawQueryResponse<number>>()
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
  test('stega: false', async () => {
    expectTypeOf(await client.fetch('*', {}, {stega: false})).toMatchTypeOf<any>()
  })
  test('params can use properties that conflict with Next.js-defined properties', async () => {
    // `client.fetch` has type checking to prevent the common mistake of passing `cache` and `next` options as params (2nd parameter) in Next.js projects, where they should be passed as options (the 3rd parameter)
    // the below checks ensures that the type guard doesn't prevent valid calls in non-Next.js projects
    expectTypeOf(await client.fetch('count(*[cache == $cache])', {})).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number>('count(*[cache == $cache])', {
        cache: 'no-store',
      }),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        cache: 'no-store',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>(
        'count(*)',
        {},
        {
          // @ts-expect-error -- should fail as it's not a Next.js project
          cache: 'no-store',
        },
      ),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch('count(*[next.revalidate == $next.revalidate])', {next: {revalidate: 60}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number, {next: any}>('count(*[next.revalidate == $next.revalidate])', {
        next: {revalidate: 60},
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: {revalidate: number}}>(
        'count(*[next.revalidate == $next.revalidate])',
        {next: {revalidate: 60}},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: {revalidate: number}}>(
        'count(*[next.revalidate == $next.revalidate])',
        {
          // @ts-expect-error -- should fail
          next: {revalidate: false},
        },
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: {revalidate: number}}>(
        'count(*[next.revalidate == $next.revalidate])',
        {
          // @ts-expect-error -- should fail
          'invalid-key': 'no-store',
        },
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>(
        'count(*)',
        {},
        {
          // @ts-expect-error -- should fail as it's not a Next.js project
          next: {revalidate: 60},
        },
      ),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch('count(*[next.tags == $next.tags])', {next: {tags: ['post']}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number>('count(*[next.tags == $next.tags])', {
        next: {tags: ['post']},
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: {tags: string[]}}>('count(*[next.tags == $next.tags])', {
        next: {tags: ['post']},
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: {tags: string[]}}>('count(*[next.tags == $next.tags])', {
        // @ts-expect-error -- should fail
        next: {tags: 'post'},
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: {tags: string[]}}>('count(*[next.tags == $next.tags])', {
        // @ts-expect-error -- should fail
        'invalid-key': 'no-store',
      }),
    ).toMatchTypeOf<number>()
  })

  test('options for Next.js App Router are not allowed outside Next.js', async () => {
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {cache: 'no-store'}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: false}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {tags: ['post']}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        // @ts-expect-error -- should fail
        {next: {revalidate: 60, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        // @ts-expect-error -- should fail
        {next: {revalidate: false, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
  })
})
