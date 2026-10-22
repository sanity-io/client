import {
  type ClientParams,
  type ClientReturn,
  createClient,
  type ListenEvent,
  type ListenOptions,
  type MutationEvent,
  type QueryParams,
  type RawQuerylessQueryResponse,
  type RawQueryResponse,
  type WelcomeEvent,
} from '@sanity/client'
import type {Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

// The brand `@sanity-labs/groq-content-mapper` puts on the default export of an imported `.groq`
// file. It is declared here rather than imported: the client reads the brand structurally and
// must never depend on `@sanity-labs/groq-content-mapper`, so this file must not either.
type GroqQuery<Query extends string, Result, Params> = Query & {
  readonly __groqParams?: Params
  readonly __groqResult?: Result
}

// `defineQuery` from `groq`, which returns the string it is given with its literal type intact.
function defineQuery<const Q extends string>(query: Q): Q {
  return query
}

type Post = {_id: string; _type: 'post'; title: string}
type PostsBySearchResult = Array<Pick<Post, '_id' | 'title'>>
type PostsBySearchParams = {searchQuery: string; start: number; end: number}

declare const postsBySearch: GroqQuery<
  '*[_type == "post" && title match $searchQuery][$start...$end]{_id, title}',
  PostsBySearchResult,
  PostsBySearchParams
>
declare const allPosts: GroqQuery<'*[_type == "post"]', Post[], Record<string, never>>
declare const firstPost: GroqQuery<'*[_type == "post"][0]', Post | null, Record<string, never>>

type RegisteredResult = {registered: true}
type BrandedOverRegisteredResult = {branded: true}
declare global {
  interface SanityQueries {
    "*[_type == 'registered']": RegisteredResult
  }
}
// Same query text as the registered one, but carrying a brand that says something else
declare const brandedRegistered: GroqQuery<
  "*[_type == 'registered']",
  BrandedOverRegisteredResult,
  Record<string, never>
>

describe('ClientReturn', () => {
  test('reads the __groqResult brand', () => {
    expectTypeOf<ClientReturn<typeof postsBySearch>>().toEqualTypeOf<PostsBySearchResult>()
    expectTypeOf<ClientReturn<typeof firstPost>>().toEqualTypeOf<Post | null>()
  })

  test('the brand wins over the fallback', () => {
    expectTypeOf<
      ClientReturn<typeof postsBySearch, {other: true}>
    >().toEqualTypeOf<PostsBySearchResult>()
  })

  test('the brand is read before the SanityQueries registry', () => {
    expectTypeOf<ClientReturn<"*[_type == 'registered']">>().toEqualTypeOf<RegisteredResult>()
    expectTypeOf<
      ClientReturn<typeof brandedRegistered>
    >().toEqualTypeOf<BrandedOverRegisteredResult>()
  })

  test('unbranded queries resolve as before', () => {
    expectTypeOf<ClientReturn<string>>().toEqualTypeOf<any>()
    expectTypeOf<ClientReturn<'*[_type == "unknown"]'>>().toEqualTypeOf<any>()
    expectTypeOf<ClientReturn<'*[_type == "unknown"]', {fallback: true}>>().toEqualTypeOf<{
      fallback: true
    }>()
    expectTypeOf<
      ClientReturn<"*[_type == 'registered']", {fallback: true}>
    >().toEqualTypeOf<RegisteredResult>()
  })
})

describe('ClientParams', () => {
  test('reads the __groqParams brand', () => {
    expectTypeOf<ClientParams<typeof postsBySearch>>().toEqualTypeOf<PostsBySearchParams>()
    expectTypeOf<ClientParams<typeof allPosts>>().toEqualTypeOf<Record<string, never>>()
  })

  test('the brand wins over the fallback', () => {
    expectTypeOf<
      ClientParams<typeof postsBySearch, {other: true}>
    >().toEqualTypeOf<PostsBySearchParams>()
  })

  test('unbranded queries fall back to QueryParams, or to the given fallback', () => {
    expectTypeOf<ClientParams<string>>().toEqualTypeOf<QueryParams>()
    expectTypeOf<ClientParams<'*[_type == "post"]'>>().toEqualTypeOf<QueryParams>()
    expectTypeOf<ClientParams<"*[_type == 'registered']">>().toEqualTypeOf<QueryParams>()
    expectTypeOf<ClientParams<'*[_type == "post"]', {type: string}>>().toEqualTypeOf<{
      type: string
    }>()
  })
})

describe('client.fetch', () => {
  const client = createClient({})

  describe('a branded query', () => {
    test('types the result and checks the params, with no generic argument', async () => {
      const posts = await client.fetch(postsBySearch, {searchQuery: 'foo', start: 0, end: 10})
      expectTypeOf(posts).toEqualTypeOf<PostsBySearchResult>()

      // @ts-expect-error -- `start` and `end` are missing
      await client.fetch(postsBySearch, {searchQuery: 'foo'})
      // @ts-expect-error -- `start` is a number
      await client.fetch(postsBySearch, {searchQuery: 'foo', start: '0', end: 10})
      // @ts-expect-error -- `limit` is not a param of this query
      await client.fetch(postsBySearch, {searchQuery: 'foo', start: 0, end: 10, limit: 10})
    })

    test('params can still be left out or empty, as they can for any query', async () => {
      // Only params that are actually given are checked against the brand. Leaving them out, or
      // passing `undefined` or `{}`, has always been accepted for every query and still is.
      expectTypeOf(await client.fetch(postsBySearch)).toEqualTypeOf<PostsBySearchResult>()
      expectTypeOf(
        await client.fetch(postsBySearch, undefined),
      ).toEqualTypeOf<PostsBySearchResult>()
      expectTypeOf(await client.fetch(postsBySearch, {})).toEqualTypeOf<PostsBySearchResult>()
      expectTypeOf(await client.fetch(postsBySearch, {}, {filterResponse: false})).toEqualTypeOf<
        RawQueryResponse<PostsBySearchResult>
      >()
    })

    test('a query without params takes none', async () => {
      expectTypeOf(await client.fetch(allPosts)).toEqualTypeOf<Post[]>()
      expectTypeOf(await client.fetch(allPosts, {})).toEqualTypeOf<Post[]>()
      expectTypeOf(await client.fetch(allPosts, undefined)).toEqualTypeOf<Post[]>()
      // @ts-expect-error -- this query declares no params
      await client.fetch(allPosts, {type: 'post'})
    })

    test('nullable results keep their null', async () => {
      expectTypeOf(await client.fetch(firstPost)).toEqualTypeOf<Post | null>()
    })

    test('the brand is read before the SanityQueries registry', async () => {
      expectTypeOf(await client.fetch("*[_type == 'registered']")).toEqualTypeOf<RegisteredResult>()
      expectTypeOf(
        await client.fetch(brandedRegistered),
      ).toEqualTypeOf<BrandedOverRegisteredResult>()
    })

    test('an explicit generic overrides the brand', async () => {
      type Custom = {custom: true}
      const params = {searchQuery: 'foo', start: 0, end: 10}
      expectTypeOf(await client.fetch<Custom>(postsBySearch, params)).toEqualTypeOf<Custom>()
      // With the result overridden, params are the plain `QueryParams` again
      expectTypeOf(await client.fetch<Custom>(postsBySearch, {anything: 1})).toEqualTypeOf<Custom>()
      // An explicit params generic is checked instead of the brand
      expectTypeOf(
        await client.fetch<Custom, {searchQuery: string}>(postsBySearch, {searchQuery: 'foo'}),
      ).toEqualTypeOf<Custom>()
      await client.fetch<Custom, {searchQuery: string}>(postsBySearch, {
        // @ts-expect-error -- not in the explicit params generic
        start: 0,
      })
      expectTypeOf(
        await client.fetch<Custom>(postsBySearch, params, {filterResponse: false}),
      ).toEqualTypeOf<RawQueryResponse<Custom>>()
    })

    test('filterResponse: false wraps the branded result', async () => {
      const params = {searchQuery: 'foo', start: 0, end: 10}
      expectTypeOf(
        await client.fetch(postsBySearch, params, {filterResponse: false}),
      ).toEqualTypeOf<RawQueryResponse<PostsBySearchResult>>()
      expectTypeOf(
        await client.fetch(postsBySearch, params, {filterResponse: false, returnQuery: false}),
      ).toEqualTypeOf<RawQuerylessQueryResponse<PostsBySearchResult>>()
      expectTypeOf(
        await client.fetch(postsBySearch, params, {filterResponse: true}),
      ).toEqualTypeOf<PostsBySearchResult>()
      expectTypeOf(await client.fetch(allPosts, {}, {filterResponse: false})).toEqualTypeOf<
        RawQueryResponse<Post[]>
      >()

      // @ts-expect-error -- `start` and `end` are missing
      await client.fetch(postsBySearch, {searchQuery: 'foo'}, {filterResponse: false})
      await client.fetch(
        postsBySearch,
        // @ts-expect-error -- `start` and `end` are missing
        {searchQuery: 'foo'},
        {filterResponse: false, returnQuery: false},
      )
    })

    test('the options are still checked', async () => {
      const params = {searchQuery: 'foo', start: 0, end: 10}
      // @ts-expect-error -- not a query option
      await client.fetch(postsBySearch, params, {nope: true})
    })
  })

  describe('the observable API', () => {
    const params = {searchQuery: 'foo', start: 0, end: 10}

    test('types the result and checks the params', () => {
      expectTypeOf(client.observable.fetch(postsBySearch, params)).toEqualTypeOf<
        Observable<PostsBySearchResult>
      >()
      expectTypeOf(client.observable.fetch(postsBySearch)).toEqualTypeOf<
        Observable<PostsBySearchResult>
      >()
      expectTypeOf(client.observable.fetch(firstPost)).toEqualTypeOf<Observable<Post | null>>()
      // @ts-expect-error -- `start` and `end` are missing
      client.observable.fetch(postsBySearch, {searchQuery: 'foo'})
      // @ts-expect-error -- `limit` is not a param of this query
      client.observable.fetch(postsBySearch, {...params, limit: 10})
      // @ts-expect-error -- this query declares no params
      client.observable.fetch(allPosts, {type: 'post'})
    })

    test('filterResponse: false wraps the branded result', () => {
      expectTypeOf(
        client.observable.fetch(postsBySearch, params, {filterResponse: false}),
      ).toEqualTypeOf<Observable<RawQueryResponse<PostsBySearchResult>>>()
      expectTypeOf(
        client.observable.fetch(postsBySearch, params, {filterResponse: false, returnQuery: false}),
      ).toEqualTypeOf<Observable<RawQuerylessQueryResponse<PostsBySearchResult>>>()
      // @ts-expect-error -- `start` and `end` are missing
      client.observable.fetch(postsBySearch, {searchQuery: 'foo'}, {filterResponse: false})
    })

    test('an explicit generic overrides the brand', () => {
      type Custom = {custom: true}
      expectTypeOf(client.observable.fetch<Custom>(postsBySearch, params)).toEqualTypeOf<
        Observable<Custom>
      >()
      expectTypeOf(
        client.observable.fetch<Custom>(postsBySearch, params, {filterResponse: false}),
      ).toEqualTypeOf<Observable<RawQueryResponse<Custom>>>()
    })

    test('a registered query resolves with filterResponse: false, like the promise API', () => {
      expectTypeOf(
        client.observable.fetch("*[_type == 'registered']", {}, {filterResponse: false}),
      ).toEqualTypeOf<Observable<RawQueryResponse<RegisteredResult>>>()
    })
  })

  describe('unbranded queries are unchanged', () => {
    test('plain strings', async () => {
      expectTypeOf(await client.fetch('*[_type == "post"]')).toEqualTypeOf<any>()
      expectTypeOf(await client.fetch('*[_type == $type]', {type: 'post'})).toEqualTypeOf<any>()
      expectTypeOf(
        await client.fetch('*[_type == $type]', {type: 'post'}, {filterResponse: false}),
      ).toEqualTypeOf<RawQueryResponse<any>>()
      // @ts-expect-error -- a fetch option passed as a GROQ param
      await client.fetch('*[_type == $type]', {type: 'post', filterResponse: false})
    })

    test('defineQuery', async () => {
      const unregistered = defineQuery('*[_type == "post"]')
      expectTypeOf(await client.fetch(unregistered)).toEqualTypeOf<any>()
      expectTypeOf(await client.fetch(unregistered, {type: 'post'})).toEqualTypeOf<any>()
      const registered = defineQuery("*[_type == 'registered']")
      expectTypeOf(await client.fetch(registered)).toEqualTypeOf<RegisteredResult>()
      expectTypeOf(await client.fetch(registered, {}, {filterResponse: false})).toEqualTypeOf<
        RawQueryResponse<RegisteredResult>
      >()
    })

    test('explicit generics', async () => {
      expectTypeOf(await client.fetch<number>('count(*)')).toEqualTypeOf<number>()
      expectTypeOf(
        await client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
      ).toEqualTypeOf<number>()
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {
        // @ts-expect-error -- not in the explicit params generic
        _type: 'post',
      })
      expectTypeOf(await client.fetch<number>("*[_type == 'registered']")).toEqualTypeOf<number>()
    })

    test('code that is generic over the query string keeps compiling', () => {
      // These wrappers are never called, they only have to typecheck. The params type is resolved
      // while `G` is still a type parameter, and TypeScript has to be able to relate the params
      // to it in that deferred state.
      function loose<const G extends string>(query: G, params: QueryParams = {}) {
        return client.fetch(query, params)
      }
      function optional<const G extends string>(query: G, params?: QueryParams) {
        return client.observable.fetch(query, params)
      }
      function concrete<const G extends string>(query: G, params: {type: string}) {
        return client.fetch(query, params, {filterResponse: false})
      }
      function explicit<const G extends string>(query: G, params: QueryParams = {}) {
        return client.fetch<ClientReturn<G>>(query, params, {filterResponse: false})
      }
      function listening<const G extends string>(query: G, params?: {type: string}) {
        return {query, events: client.listen(query, params)}
      }
      expectTypeOf(loose).returns.resolves.toBeAny()
      expectTypeOf(optional).returns.toEqualTypeOf<Observable<any>>()
      expectTypeOf(concrete).returns.resolves.toEqualTypeOf<RawQueryResponse<any>>()
      expectTypeOf(explicit).returns.resolves.toEqualTypeOf<RawQueryResponse<any>>()
      expectTypeOf(listening).returns.toEqualTypeOf<{
        query: string
        events: Observable<MutationEvent>
      }>()
    })
  })
})

describe('client.listen', () => {
  const client = createClient({})
  const params = {searchQuery: 'foo', start: 0, end: 10}

  test('checks the params of a branded query', () => {
    expectTypeOf(client.listen(postsBySearch, params)).toEqualTypeOf<Observable<MutationEvent>>()
    expectTypeOf(client.listen(postsBySearch)).toEqualTypeOf<Observable<MutationEvent>>()
    expectTypeOf(client.listen(allPosts, {})).toEqualTypeOf<Observable<MutationEvent>>()
    expectTypeOf(client.listen(postsBySearch, params, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()
    // Empty params are accepted like they are by `fetch`, so the common `listen(query, {}, options)`
    // shape keeps working for a branded query
    expectTypeOf(client.listen(postsBySearch, {}, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()
    expectTypeOf(client.listen(postsBySearch, undefined, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()
    // @ts-expect-error -- `start` and `end` are missing
    client.listen(postsBySearch, {searchQuery: 'foo'})
    // @ts-expect-error -- `start` and `end` are missing
    client.listen(postsBySearch, {searchQuery: 'foo'}, {events: ['welcome']})
    // Accepting empty params does not loosen the check on given ones: every property of the
    // literal is still checked against the brand, so an unknown param is an error here as well
    // @ts-expect-error -- `limit` is not a param of this query
    client.listen(postsBySearch, {...params, limit: 10})
    // @ts-expect-error -- `limit` is not a param of this query
    client.listen(postsBySearch, {...params, limit: 10}, {events: ['welcome']})
    // @ts-expect-error -- this query declares no params
    client.listen(allPosts, {type: 'post'})
  })

  test('the result brand does not apply: listeners emit documents, not query results', () => {
    expectTypeOf(client.listen<Post>(postsBySearch, params)).toEqualTypeOf<
      Observable<MutationEvent<Post>>
    >()
  })

  test('unbranded queries are unchanged', () => {
    expectTypeOf(client.listen('*')).toEqualTypeOf<Observable<MutationEvent>>()
    expectTypeOf(client.listen('*[_type == $type]', {type: 'post'})).toEqualTypeOf<
      Observable<MutationEvent>
    >()
    expectTypeOf(client.listen('*', {}, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()
    // Two explicit type arguments only ever matched the overload that takes options. The query
    // type parameter is appended after the existing ones on both overloads so that this still does.
    expectTypeOf(
      client.listen<Post, {events: ['welcome']}>('*', {}, {events: ['welcome']}),
    ).toEqualTypeOf<Observable<WelcomeEvent>>()
    expectTypeOf(client.listen<Post, ListenOptions>('*', {}, {events: ['welcome']})).toEqualTypeOf<
      Observable<ListenEvent<Post>>
    >()
  })
})
