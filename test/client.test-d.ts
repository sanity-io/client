import {ContentSourceMap, createClient, RawQueryResponse} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
  test('simple query', async () => {
    expectTypeOf(client.fetch('*')).toMatchTypeOf<Promise<any>>()
    expectTypeOf(client.fetch('*', undefined)).toMatchTypeOf<Promise<any>>()
    expectTypeOf(client.fetch('*', {})).toMatchTypeOf<Promise<any>>()
    expectTypeOf(client.fetch('*[_type == $type]', {type: 'post'})).toMatchTypeOf<Promise<any>>()
    expectTypeOf(client.fetch('*', undefined, {filterResponse: false})).toMatchTypeOf<
      Promise<RawQueryResponse<any>>
    >()
    expectTypeOf(client.fetch('*', {}, {filterResponse: false})).toMatchTypeOf<
      Promise<RawQueryResponse<any>>
    >()
    expectTypeOf(
      client.fetch('*[_type == $type]', {type: 'post'}, {filterResponse: false}),
    ).toMatchTypeOf<Promise<RawQueryResponse<any>>>()
  })
  test('generics', async () => {
    expectTypeOf(client.fetch<number>('count(*)')).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<Promise<number>>()
    // @ts-expect-error -- should fail
    expectTypeOf(
      client.fetch<number, {type: string}>('count(*[_type == $type])', {cache: 'no-store'}),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch<number, {type: string}>('count(*[_type == $type])', {_type: 'post'}),
    ).toMatchTypeOf<Promise<number>>()
  })
  test('filterResponse: false', async () => {
    expectTypeOf(client.fetch<number>('count(*)', {}, {filterResponse: true})).toMatchTypeOf<
      Promise<number>
    >()
    const ok = await client.fetch<number>('count(*)', {}, {filterResponse: false} as const)
    const okk = await client.fetch<number>('count(*)', {}, {filterResponse: true} as const)
    const okkk = await client.fetch<number>('count(*)', {})
    const okkkk = await client.fetch<number>('count(*)', {filterResponse: false})
    expectTypeOf(
      client.fetch<number>('count(*)', {}, {filterResponse: false as const}),
    ).toMatchTypeOf<
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
  test('params can use properties that conflict with Next.js-defined properties', () => {
    // `client.fetch` has type checking to prevent the common mistake of passing `cache` and `next` options as params (2nd parameter) in Next.js projects, where they should be passed as options (the 3rd parameter)
    // the below checks ensures that the type guard doesn't prevent valid calls in non-Next.js projects
    expectTypeOf(client.fetch('count(*[cache == $cache])', {cache: 'no-store'})).toMatchTypeOf<
      Promise<any>
    >()
    expectTypeOf(
      client.fetch<number>('count(*[cache == $cache])', {cache: 'no-store'}),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        cache: 'no-store',
      }),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        // @ts-expect-error -- should fail
        cache: 'invalid-value',
      }),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        // @ts-expect-error -- should fail
        'invalid-key': 'no-store',
      }),
    ).toMatchTypeOf<Promise<number>>()

    expectTypeOf(
      client.fetch('count(*[next.revalidate == $next.revalidate])', {next: {revalidate: 60}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch<number>('count(*[next.revalidate == $next.revalidate])', {
        next: {revalidate: 60},
      }),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {next: {revalidate: number}}>(
        'count(*[next.revalidate == $next.revalidate])',
        {next: {revalidate: 60}},
      ),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {next: {revalidate: number}}>(
        'count(*[next.revalidate == $next.revalidate])',
        {
          // @ts-expect-error -- should fail
          next: {revalidate: false},
        },
      ),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {next: {revalidate: number}}>(
        'count(*[next.revalidate == $next.revalidate])',
        {
          // @ts-expect-error -- should fail
          'invalid-key': 'no-store',
        },
      ),
    ).toMatchTypeOf<Promise<number>>()

    expectTypeOf(
      client.fetch('count(*[next.tags == $next.tags])', {next: {tags: ['post']}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch<number>('count(*[next.tags == $next.tags])', {
        next: {tags: ['post']},
      }),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {next: {tags: string[]}}>('count(*[next.tags == $next.tags])', {
        next: {tags: ['post']},
      }),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {next: {tags: string[]}}>('count(*[next.tags == $next.tags])', {
        // @ts-expect-error -- should fail
        next: {tags: 'post'},
      }),
    ).toMatchTypeOf<Promise<number>>()
    expectTypeOf(
      client.fetch<number, {next: {tags: string[]}}>('count(*[next.tags == $next.tags])', {
        // @ts-expect-error -- should fail
        'invalid-key': 'no-store',
      }),
    ).toMatchTypeOf<Promise<number>>()
  })

  test('options for Next.js App Router are not allowed outside Next.js', () => {
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch('*[_type == $type]', {type: 'post'}, {cache: 'no-store'}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: false}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {tags: ['post']}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60, tags: ['post']}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        // @ts-expect-error -- should fail
        {next: {revalidate: false, tags: ['post']}},
      ),
    ).toMatchTypeOf<Promise<any>>()
  })
})
