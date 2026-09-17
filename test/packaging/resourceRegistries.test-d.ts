import {
  type SanityProjectionsByResource as ClientProjections,
  type SanityQueriesByResource as ClientQueries,
  type SanitySchemasByResource as ClientSchemas,
} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

// Resolved through test/packaging/tsconfig.json, so `@sanity/client` above is `dist/index.d.ts`.
// The source-aliased suite cannot observe whether the `extends globalThis.X` inheritance survives
// bundling into the declaration files, which is the only way a consumer ever sees it.

type PackagingAuthor = {_id: string; _type: 'author'; name: string | null}
type PackagingMovie = {_id: string; _type: 'movie'; title: number | null}

type TestAuthorsResult = PackagingAuthor[]
type ProductionAuthorsResult = {_id: string}[]
type AuthorNameResult = {name: string | null}

// The global registries, as a multi-resource `sanity typegen` run emits them.
declare global {
  interface SanitySchemasByResource {
    'packaging1.test': PackagingAuthor | PackagingMovie
    'packaging2.production': PackagingAuthor
  }
  interface SanityQueriesByResource {
    'packaging1.test': {'*[_type == "author"]': TestAuthorsResult}
    'packaging2.production': {'*[_type == "author"]': ProductionAuthorsResult}
  }
  interface SanityProjectionsByResource {
    'packaging1.test': {author: {'{name}': AuthorNameResult}}
  }
}

// The bridge that accompanies them, a duplicate `extends` on this client.
declare module '@sanity/client' {
  interface SanitySchemasByResource extends globalThis.SanitySchemasByResource {}
  interface SanityQueriesByResource extends globalThis.SanityQueriesByResource {}
  interface SanityProjectionsByResource extends globalThis.SanityProjectionsByResource {}
}

describe('resource registries in the built declaration files', () => {
  test('a globally registered schema reaches the exported interface', () => {
    expectTypeOf<ClientSchemas['packaging2.production']>().toEqualTypeOf<PackagingAuthor>()
    expectTypeOf<ClientSchemas['packaging1.test']>().toEqualTypeOf<
      PackagingAuthor | PackagingMovie
    >()
  })

  test('the same query text resolves to a different type per resource', () => {
    expectTypeOf<
      ClientQueries['packaging1.test']['*[_type == "author"]']
    >().toEqualTypeOf<TestAuthorsResult>()
    expectTypeOf<
      ClientQueries['packaging2.production']['*[_type == "author"]']
    >().toEqualTypeOf<ProductionAuthorsResult>()
  })

  test('a projection resolves by resource and document type', () => {
    expectTypeOf<
      ClientProjections['packaging1.test']['author']['{name}']
    >().toEqualTypeOf<AuthorNameResult>()
  })

  test('an unregistered resource is not a key', () => {
    expectTypeOf<'packaging3.nope'>().not.toExtend<keyof ClientSchemas>()
  })
})
