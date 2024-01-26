/// <reference types="next/types/global" />

import {createClient, QueryOptions, RawQueryResponse} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
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
  })
  test('generics', async () => {
    expectTypeOf(
      await client.fetch<number>('count(*[cache == $cache])', {cache: 'invalid-cache'}),
    ).not.toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {cache: QueryOptions['cache']}>('count(*[cache == $cache])', {
        cache: 'force-cache',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {cache: QueryOptions['cache']}>(
        'count(*[cache == $cache])',
        // @ts-expect-error -- should fail
        {cache: 'invalid-cache'},
      ),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch<number>('count(*[next.revalidate == $next.revalidate])', {
        next: {revalidate: false},
      }),
    ).not.toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: QueryOptions['next']}>(
        'count(*[next.revalidate == $next.revalidate])',
        {
          next: {revalidate: false},
        },
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {next: QueryOptions['next']}>(
        'count(*[next.revalidate == $next.revalidate])',
        {
          next: {
            revalidate: 60,
            // @ts-expect-error -- should fail
            cache: 'invalid-cache',
          },
        },
      ),
    ).toMatchTypeOf<number>()
  })
  test('params can use properties that conflict with Next.js-defined properties', async () => {
    // `client.fetch` has type checking to prevent the common mistake of passing `cache` and `next` options as params (2nd parameter) in Next.js projects, where they should be passed as options (the 3rd parameter)
    // the below checks ensures that the type guard doesn't prevent valid calls in non-Next.js projects
    expectTypeOf(await client.fetch('count(*[cache == $cache])', {})).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number>('count(*[cache == $cache])', {cache: 'no-store'}),
    ).not.toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        cache: 'no-store',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        // @ts-expect-error -- should fail
        cache: 'invalid-value',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        // @ts-expect-error -- should fail
        'invalid-key': 'no-store',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*)', {}, {cache: 'no-store'}),
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
      await client.fetch<number>('count(*)', {}, {next: {revalidate: 60}}),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch('count(*[next.tags == $next.tags])', {next: {tags: ['post']}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number>('count(*[next.tags == $next.tags])', {
        next: {tags: ['post']},
      }),
    ).not.toMatchTypeOf<number>()
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
