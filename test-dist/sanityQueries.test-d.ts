import {type ClientReturn, createClient, type SanityQueries as ClientQueries} from '@sanity/client'
import {type ClientReturnStega, type StegaBranded, type StegaString} from '@sanity/client/stega'
import {describe, expectTypeOf, test} from 'vitest'

// Resolved through test-dist/tsconfig.json, `@sanity/client` above is `dist/index.d.ts` and
// `@sanity/client/stega` is `dist/stega.d.ts`. Two things about those rollups can only be observed
// here, not in the source-aliased suites:
// - API Extractor drops `declare global` blocks, and `scripts/append-global-types.mjs` puts the
//   global `SanityQueries` declaration back into every rollup that inlines the exported interface.
// - Each rollup inlines its own copy of `SanityQueries` and `ClientReturn`, and renames the inlined
//   interface to `SanityQueries_2` because the global one shares its name, re-exporting it under
//   the public name. Module augmentations have to keep merging through that alias.

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
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the empty body is the point, declaration merging adds a base type to the existing interface
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

  test('the stega entry inlines its own SanityQueries, which module augmentations do not reach', () => {
    // The pre-existing limitation of this branch's rollups, recorded so a change in either direction
    // is noticed. Global registrations are what reach the stega entry, see above.
    expectTypeOf<ClientReturnStega<"*[_type == 'packagingLegacy']">>().toEqualTypeOf<any>()
  })
})
