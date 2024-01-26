/// <reference types="next/types/global" />

/* eslint-disable @typescript-eslint/no-namespace */
import {createClient} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
  test('prevent accidentally passing App Router options to params', () => {
    // `client.fetch` has type checking to prevent the common mistake of passing `cache` and `next` options as params (2nd parameter) in Next.js projects, where they should be passed as options (the 3rd parameter)
    // the below checks ensures that the type guard doesn't prevent valid calls in non-Next.js projects
    expectTypeOf(client.fetch('count(*[cache == $cache])', {cache: 'no-store'})).toMatchTypeOf<
      Promise<any>
    >()
    expectTypeOf(
      client.fetch<any, {cache: 'no-store'}>('count(*[cache == $cache])', {cache: 'no-store'}),
    ).toMatchTypeOf<Promise<any>>()
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

  test('options for Next.js App Router are allowed', () => {
    expectTypeOf(
      client.fetch('*[_type == $type]', {type: 'post'}, {cache: 'no-store'}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(client.fetch('*[_type == $type]', {type: 'post'}, {next: {}})).toMatchTypeOf<
      Promise<any>
    >()
    expectTypeOf(
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: false}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {tags: ['post']}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60, tags: ['post']}}),
    ).toMatchTypeOf<Promise<any>>()
    expectTypeOf(
      client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        {next: {revalidate: false, tags: ['post']}},
      ),
    ).toMatchTypeOf<Promise<any>>()
  })
})
