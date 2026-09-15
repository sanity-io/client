import {
  type SanityProjectionsByResource as ClientProjections,
  type SanityQueriesByResource as ClientQueries,
  type SanitySchemasByResource as ClientSchemas,
} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

type Author = {_type: 'author'; _id: string; name: string | null}
type Movie = {_type: 'movie'; _id: string; title: number | null}
type Slug = {_type: 'slug'; current: string}

type TestAuthorsResult = Author[]
type ProductionAuthorsResult = {_id: string}[]
type AuthorNameProjectionResult = {name: string | null}

// What a multi-resource `sanity typegen` run emits. Two resources whose schemas disagree about
// `title`, and which give the same query text different result types.
declare global {
  interface SanitySchemasByResource {
    'ppsg7ml5.test': Author | Movie | Slug
    'vo1ysemo.production': Author
  }
  interface SanityQueriesByResource {
    'ppsg7ml5.test': {'*[_type == "author"]': TestAuthorsResult}
    'vo1ysemo.production': {'*[_type == "author"]': ProductionAuthorsResult}
  }
  interface SanityProjectionsByResource {
    'ppsg7ml5.test': {author: {'{name}': AuthorNameProjectionResult}}
  }
}

// The bridge for `@sanity/client` releases that only read their module-scoped interfaces. This
// client already inherits the globals, so each bridge is a harmless duplicate `extends` here.
declare module '@sanity/client' {
  interface SanitySchemasByResource extends globalThis.SanitySchemasByResource {}
  interface SanityQueriesByResource extends globalThis.SanityQueriesByResource {}
  interface SanityProjectionsByResource extends globalThis.SanityProjectionsByResource {}
}

describe('SanitySchemasByResource', () => {
  test('a resource key selects that resource union', () => {
    expectTypeOf<ClientSchemas['vo1ysemo.production']>().toEqualTypeOf<Author>()
  })

  test('two resources keep separate unions', () => {
    expectTypeOf<ClientSchemas['ppsg7ml5.test']>().toEqualTypeOf<Author | Movie | Slug>()
    expectTypeOf<Movie>().not.toExtend<ClientSchemas['vo1ysemo.production']>()
  })

  test('a caller can select one document type out of the union', () => {
    type Selected = Extract<ClientSchemas['ppsg7ml5.test'], {_type: 'movie'}>
    expectTypeOf<Selected>().toEqualTypeOf<Movie>()
  })

  test('the global interface is usable without importing anything', () => {
    expectTypeOf<SanitySchemasByResource['vo1ysemo.production']>().toEqualTypeOf<Author>()
  })
})

describe('SanityQueriesByResource', () => {
  test('the same query text resolves to a different type per resource', () => {
    // The whole point of the registry. These two entries share their key and must not share
    // their result type.
    expectTypeOf<
      ClientQueries['ppsg7ml5.test']['*[_type == "author"]']
    >().toEqualTypeOf<TestAuthorsResult>()
    expectTypeOf<
      ClientQueries['vo1ysemo.production']['*[_type == "author"]']
    >().toEqualTypeOf<ProductionAuthorsResult>()
    expectTypeOf<ClientQueries['ppsg7ml5.test']['*[_type == "author"]']>().not.toEqualTypeOf<
      ClientQueries['vo1ysemo.production']['*[_type == "author"]']
    >()
  })

  test('both resources are registered', () => {
    expectTypeOf<'ppsg7ml5.test' | 'vo1ysemo.production'>().toExtend<keyof ClientQueries>()
  })
})

describe('SanityProjectionsByResource', () => {
  test('a projection resolves by resource and document type', () => {
    expectTypeOf<
      ClientProjections['ppsg7ml5.test']['author']['{name}']
    >().toEqualTypeOf<AuthorNameProjectionResult>()
  })

  test('a resource with no registered projections is absent rather than empty', () => {
    expectTypeOf<'vo1ysemo.production'>().not.toExtend<keyof ClientProjections>()
  })
})

describe('resource keys', () => {
  test('registered resources are keys and an unknown resource is not', () => {
    // Asserted as membership rather than as the exhaustive `keyof`. These are global
    // interfaces, so any other file in the program can add keys, and an exhaustive
    // assertion here breaks whenever one does.
    expectTypeOf<'ppsg7ml5.test' | 'vo1ysemo.production'>().toExtend<keyof ClientSchemas>()
    expectTypeOf<'nope.nope'>().not.toExtend<keyof ClientSchemas>()
  })
})
