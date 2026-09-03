import {
  createClient,
  type RawQueryResponse,
  type SanityQueries as ClientQueries,
} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

type FooResult = {
  bar: number
}

type GlobalFooResult = {
  baz: string
}

// The module augmentation that `sanity typegen` emitted before the global registry existed. It
// has to keep working on this client unchanged, so this block stays as it is.
declare module '@sanity/client' {
  export interface SanityQueries {
    "*[_type == 'foo']": FooResult
  }
}

// What `sanity typegen` emits now: the registry itself lives on the global interface, and needs no
// import of `@sanity/client` to be valid.
declare global {
  interface SanityQueries {
    "*[_type == 'globalFoo']": GlobalFooResult
  }
}

// The bridge that accompanies the global registry, so that `@sanity/client` releases which only
// read their module-scoped interface pick up the global one. This client already inherits the
// global, so the bridge must be a harmless duplicate `extends` here.
declare module '@sanity/client' {
  interface SanityQueries extends globalThis.SanityQueries {}
}

describe('client.fetch', () => {
  const client = createClient({})

  describe('without params', () => {
    test('known query type', async () => {
      const resp = await client.fetch("*[_type == 'foo']")
      expectTypeOf(resp).toExtend<FooResult>()
    })

    test('ad-hoc query type', async () => {
      const resp = await client.fetch("*[_type == 'bar']")
      expectTypeOf(resp).toExtend<any>()
    })

    test('ad-hoc query with a custom type', async () => {
      type Result = {bar: string}
      const resp = await client.fetch<Result>("*[_type == 'bar']")
      expectTypeOf(resp).toExtend<Result>()
    })

    test('known query type, but overriden with ad-hoc type', async () => {
      type Result = {bar: string}
      const resp = await client.fetch<Result>("*[_type == 'foo']")
      expectTypeOf(resp).toExtend<Result>()
    })
  })

  describe('unfiltered response', () => {
    test('known query type', async () => {
      const resp = await client.fetch("*[_type == 'foo']", {}, {filterResponse: false})
      expectTypeOf(resp).toExtend<RawQueryResponse<FooResult>>()
    })

    test('ad-hoc query type', async () => {
      const resp = await client.fetch("*[_type == 'bar']", {}, {filterResponse: false})
      expectTypeOf(resp).toExtend<RawQueryResponse<any>>()
    })

    test('ad-hoc query with a custom type', async () => {
      type Result = {bar: string}
      const resp = await client.fetch<Result>("*[_type == 'bar']", {}, {filterResponse: false})
      expectTypeOf(resp).toExtend<RawQueryResponse<Result>>()
    })

    test('known query type, but overriden with ad-hoc type', async () => {
      type Result = {bar: string}
      const resp = await client.fetch<Result>("*[_type == 'foo']", {}, {filterResponse: false})
      expectTypeOf(resp).toExtend<RawQueryResponse<Result>>()
    })
  })

  describe('globally registered queries', () => {
    test('known query type', async () => {
      const resp = await client.fetch("*[_type == 'globalFoo']")
      expectTypeOf(resp).toEqualTypeOf<GlobalFooResult>()
    })

    test('unfiltered response', async () => {
      const resp = await client.fetch("*[_type == 'globalFoo']", {}, {filterResponse: false})
      expectTypeOf(resp).toExtend<RawQueryResponse<GlobalFooResult>>()
    })

    test('the typeof query pattern', async () => {
      const query = "*[_type == 'globalFoo']"
      const resp = await client.fetch(query)
      expectTypeOf(resp).toEqualTypeOf<GlobalFooResult>()
    })
  })
})

describe('SanityQueries', () => {
  test('the exported interface has the queries registered through both forms', () => {
    expectTypeOf<ClientQueries["*[_type == 'foo']"]>().toEqualTypeOf<FooResult>()
    expectTypeOf<ClientQueries["*[_type == 'globalFoo']"]>().toEqualTypeOf<GlobalFooResult>()
    expectTypeOf<"*[_type == 'foo']" | "*[_type == 'globalFoo']">().toExtend<keyof ClientQueries>()
  })

  test('the global interface is usable without importing anything', () => {
    expectTypeOf<SanityQueries["*[_type == 'globalFoo']"]>().toEqualTypeOf<GlobalFooResult>()
    expectTypeOf<"*[_type == 'globalFoo']">().toExtend<keyof SanityQueries>()
  })

  test('the module augmentation form registers on the exported interface only', () => {
    expectTypeOf<"*[_type == 'foo']">().not.toExtend<keyof SanityQueries>()
  })
})
