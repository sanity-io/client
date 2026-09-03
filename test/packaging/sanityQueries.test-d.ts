import {type ClientReturn, createClient, type SanityQueries as ClientQueries} from '@sanity/client'
import {type ClientReturnStega, type StegaBranded, type StegaString} from '@sanity/client/stega'
import {describe, expectTypeOf, test} from 'vitest'

// Resolved through test/packaging/tsconfig.json, `@sanity/client` above is `dist/index.d.ts` and
// `@sanity/client/stega` is `dist/stega.d.ts`. The stega entry is bundled separately from the main
// entry, so whether a registration made in user land reaches `ClientReturnStega` depends on the
// shape of the built files, which the source-aliased suites cannot observe.

type PackagingPost = {
  _id: string
  _type: 'post'
  title: string
}

type PackagingLegacy = {
  _id: string
  _type: 'legacy'
}

// The global registry, as `sanity typegen` emits it
declare global {
  interface SanityQueries {
    "*[_type == 'packagingPost']": PackagingPost
  }
}

// The bridge for older clients that accompanies it, a duplicate `extends` on this client
declare module '@sanity/client' {
  interface SanityQueries extends globalThis.SanityQueries {}
}

// The module augmentation form that older `sanity typegen` output uses
declare module '@sanity/client' {
  interface SanityQueries {
    "*[_type == 'packagingLegacy']": PackagingLegacy
  }
}

describe('SanityQueries in the built declaration files', () => {
  const client = createClient({})

  test('a globally registered query is resolved by client.fetch', async () => {
    const resp = await client.fetch("*[_type == 'packagingPost']")
    expectTypeOf(resp).toEqualTypeOf<PackagingPost>()
  })

  test('a globally registered query is resolved by ClientReturn', () => {
    expectTypeOf<ClientReturn<"*[_type == 'packagingPost']">>().toEqualTypeOf<PackagingPost>()
  })

  test('a globally registered query is resolved by ClientReturnStega from the stega entry', async () => {
    const query = "*[_type == 'packagingPost']"
    const resp = await client.fetch<ClientReturnStega<typeof query>>(query)
    expectTypeOf(resp).toEqualTypeOf<StegaBranded<PackagingPost>>()
    expectTypeOf(resp.title).toEqualTypeOf<StegaString<string>>()
  })

  test('the module augmentation form still resolves', async () => {
    const resp = await client.fetch("*[_type == 'packagingLegacy']")
    expectTypeOf(resp).toEqualTypeOf<PackagingLegacy>()
  })

  test('the exported interface carries both registrations', () => {
    expectTypeOf<ClientQueries["*[_type == 'packagingPost']"]>().toEqualTypeOf<PackagingPost>()
    expectTypeOf<ClientQueries["*[_type == 'packagingLegacy']"]>().toEqualTypeOf<PackagingLegacy>()
  })

  test('unregistered queries still fall back to any', async () => {
    const resp = await client.fetch("*[_type == 'packagingUnknown']")
    expectTypeOf(resp).toEqualTypeOf<any>()
  })
})
