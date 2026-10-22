import {type ClientParams, type ClientReturn, createClient} from '@sanity/client'
import {type ClientReturnStega, type StegaBranded} from '@sanity/client/stega'
import type {Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

// Resolved through test/packaging/tsconfig.json, `@sanity/client` above is `dist/index.d.ts` and
// `@sanity/client/stega` is `dist/stega.d.ts`. The brand on an imported `.groq` file is read
// structurally, so what matters here is that the conditional types survive dts bundling intact,
// in both entries.

// The brand `@sanity-labs/groq-content-mapper` puts on the default export of an imported `.groq`
// file, declared here because the client reads it structurally and never imports that package
type GroqQuery<Query extends string, Result, Params> = Query & {
  readonly __groqParams?: Params
  readonly __groqResult?: Result
}

type PackagingPostsResult = Array<{_id: string; title: string}>
type PackagingPostsParams = {type: string}

declare const packagingPosts: GroqQuery<
  '*[_type == $type]{_id, title}',
  PackagingPostsResult,
  PackagingPostsParams
>

describe('a branded query against the built declaration files', () => {
  const client = createClient({})

  test('is resolved by client.fetch', async () => {
    expectTypeOf(
      await client.fetch(packagingPosts, {type: 'post'}),
    ).toEqualTypeOf<PackagingPostsResult>()
    // @ts-expect-error -- `type` is missing
    await client.fetch(packagingPosts, {other: 'post'})
  })

  test('is resolved by client.observable.fetch', () => {
    expectTypeOf(client.observable.fetch(packagingPosts, {type: 'post'})).toEqualTypeOf<
      Observable<PackagingPostsResult>
    >()
  })

  test('is resolved by ClientReturn and ClientParams', () => {
    expectTypeOf<ClientReturn<typeof packagingPosts>>().toEqualTypeOf<PackagingPostsResult>()
    expectTypeOf<ClientParams<typeof packagingPosts>>().toEqualTypeOf<PackagingPostsParams>()
  })

  test('is resolved by ClientReturnStega from the stega entry', () => {
    expectTypeOf<ClientReturnStega<typeof packagingPosts>>().toEqualTypeOf<
      StegaBranded<PackagingPostsResult>
    >()
  })

  test('unbranded queries still fall back to any', async () => {
    expectTypeOf(await client.fetch('*[_type == $type]', {type: 'post'})).toEqualTypeOf<any>()
  })
})
