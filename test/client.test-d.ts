import {
  type ContentSourceMap,
  createClient,
  type QueryOptions,
  type QueryParams,
  type QueryWithoutParams,
  type RawQueryResponse,
  type ClientConfig,
  type InitializedClientConfig,
  type SanityDocument,
  type SingleMutationResult,
  type MultipleMutationResult,
  type MutationSelection,
  type Mutation,
  type Action,
  type Patch,
  type Transaction,
  type ObservablePatch,
  type ObservableTransaction,
  type BaseActionOptions,
} from '@sanity/client'
import {lastValueFrom} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.fetch', () => {
  const client = createClient({})
  test('params', async () => {
    // Detect if there are any QueryOptions that are not handled by QueryParams
    type QueryParamsKeys = {
      [K in keyof QueryOptions as QueryParams[K] extends never
        ? Exclude<K, 'cache' | 'next'>
        : never]-?: QueryParams[K] extends never ? true : never
    }
    expectTypeOf<QueryParamsKeys>().toMatchTypeOf<Record<string, never>>()
    // Any params not conflicting with QueryOptions should be allowed
    expectTypeOf({type: 'post'}).toMatchTypeOf<QueryParams>()
    // While those conflicting should error
    expectTypeOf({filterResponse: true}).not.toMatchTypeOf<QueryParams>()
  })
  test('simple query', async () => {
    expectTypeOf(await client.fetch('*')).toMatchTypeOf<any>()
    expectTypeOf(await lastValueFrom(client.observable.fetch('*'))).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*', undefined)).toMatchTypeOf<any>()
    expectTypeOf(await lastValueFrom(client.observable.fetch('*', undefined))).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*', {})).toMatchTypeOf<any>()
    expectTypeOf(await lastValueFrom(client.observable.fetch('*', {}))).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*[_type == $type]', {type: 'post'})).toMatchTypeOf<any>()
    expectTypeOf(
      await lastValueFrom(client.observable.fetch('*[_type == $type]', {type: 'post'})),
    ).toMatchTypeOf<any>()
    expectTypeOf(await client.fetch('*', undefined, {filterResponse: false})).toMatchTypeOf<
      RawQueryResponse<any>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.fetch('*', undefined, {filterResponse: false})),
    ).toMatchTypeOf<RawQueryResponse<any>>()
    expectTypeOf(
      await client.fetch<any, {filterResponse?: undefined}>('*', {} satisfies QueryParams, {
        filterResponse: false,
      }),
    ).toMatchTypeOf<RawQueryResponse<any>>()
    expectTypeOf(
      await lastValueFrom(
        client.observable.fetch<any, {filterResponse?: undefined}>('*', {} satisfies QueryParams, {
          filterResponse: false,
        }),
      ),
    ).toMatchTypeOf<RawQueryResponse<any>>()
    expectTypeOf(
      await client.fetch('*[_type == $type]', {type: 'post'}, {filterResponse: false}),
    ).toMatchTypeOf<RawQueryResponse<any>>()
    expectTypeOf(
      await lastValueFrom(
        client.observable.fetch('*[_type == $type]', {type: 'post'}, {filterResponse: false}),
      ),
    ).toMatchTypeOf<RawQueryResponse<any>>()
  })
  test('generics', async () => {
    expectTypeOf(await client.fetch<number>('count(*)')).toMatchTypeOf<number>()
    expectTypeOf(
      await lastValueFrom(client.observable.fetch<number>('count(*)')),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await lastValueFrom(
        client.observable.fetch<number, {type: string}>('count(*[_type == $type])', {type: 'post'}),
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>('count(*[_type == $type])', {
        // @ts-expect-error -- should fail
        _type: 'post',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, never>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, undefined>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', undefined),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', {}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', undefined),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, never>('count(*[_type == $type])', {}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch<number, never>('count(*[_type == $type])', {type: 'post'}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>('count(*[_type == $type])'),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>('count(*[_type == $type])', undefined),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>('count(*[_type == $type])', {}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, Record<string, never>>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*[_type == $type])', {
        // @ts-expect-error -- should fail
        filterResponse: false,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {filterResponse: boolean}
      >('count(*[_type == $type])', {
        filterResponse: false,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*[_type == $type])', {
        type: 'post',
        // @ts-expect-error -- should fail
        filterResponse: true,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<
        number,
        // @ts-expect-error -- should fail
        {filterResponse: boolean; type: string}
      >('count(*[_type == $type])', {
        filterResponse: true,
        type: 'post',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>('count(*[_type == $type])', undefined, {
        filterResponse: true,
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        {},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>('count(*[_type == $type])', undefined, {
        filterResponse: false,
      }),
    ).toMatchTypeOf<RawQueryResponse<number>>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        {},
        {filterResponse: false},
      ),
    ).toMatchTypeOf<RawQueryResponse<number>>()
    expectTypeOf(
      await client.fetch<number, QueryWithoutParams>(
        'count(*[_type == $type])',
        // @ts-expect-error -- should fail
        {type: 'post'},
        {filterResponse: false},
      ),
    ).not.toMatchTypeOf<RawQueryResponse<number>>()
  })
  test('filterResponse: false', async () => {
    expectTypeOf(
      await client.fetch<number>('count(*)', {}, {filterResponse: true}),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await lastValueFrom(client.observable.fetch<number>('count(*)', {}, {filterResponse: true})),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>('count(*)', {}, {filterResponse: false}),
    ).toMatchTypeOf<{
      result: number
      ms: number
      query: string
      resultSourceMap?: ContentSourceMap
    }>()
    expectTypeOf(
      await lastValueFrom(client.observable.fetch<number>('count(*)', {}, {filterResponse: false})),
    ).toMatchTypeOf<{
      result: number
      ms: number
      query: string
      resultSourceMap?: ContentSourceMap
    }>()
    expectTypeOf(
      await client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: true},
      ),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number, {type: string}>(
        'count(*[_type == $type])',
        {type: 'post'},
        {filterResponse: false},
      ),
    ).toMatchTypeOf<{
      result: number
      ms: number
      query: string
      resultSourceMap?: ContentSourceMap
    }>()
  })
  test('stega: false', async () => {
    expectTypeOf(await client.fetch('*', {}, {stega: false})).toMatchTypeOf<any>()
    expectTypeOf(
      await lastValueFrom(client.observable.fetch('*', {}, {stega: false})),
    ).toMatchTypeOf<any>()
  })
  test('params can use properties that conflict with Next.js-defined properties', async () => {
    // `client.fetch` has type checking to prevent the common mistake of passing `cache` and `next` options as params (2nd parameter) in Next.js projects, where they should be passed as options (the 3rd parameter)
    // the below checks ensures that the type guard doesn't prevent valid calls in non-Next.js projects
    expectTypeOf(await client.fetch('count(*[cache == $cache])', {})).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number>('count(*[cache == $cache])', {
        cache: 'no-store',
      }),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch<number, {cache: RequestInit['cache']}>('count(*[cache == $cache])', {
        cache: 'no-store',
      }),
    ).toMatchTypeOf<number>()
    expectTypeOf(
      await client.fetch<number>(
        'count(*)',
        {},
        {
          // @ts-expect-error -- should fail as it's not a Next.js project
          cache: 'no-store',
        },
      ),
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
      await client.fetch<number>(
        'count(*)',
        {},
        {
          // @ts-expect-error -- should fail as it's not a Next.js project
          next: {revalidate: 60},
        },
      ),
    ).toMatchTypeOf<number>()

    expectTypeOf(
      await client.fetch('count(*[next.tags == $next.tags])', {next: {tags: ['post']}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch<number>('count(*[next.tags == $next.tags])', {
        next: {tags: ['post']},
      }),
    ).toMatchTypeOf<number>()
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

  test('options for Next.js App Router are not allowed outside Next.js', async () => {
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {cache: 'no-store'}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: 60}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {revalidate: false}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      // @ts-expect-error -- should fail
      await client.fetch('*[_type == $type]', {type: 'post'}, {next: {tags: ['post']}}),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        // @ts-expect-error -- should fail
        {next: {revalidate: 60, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
    expectTypeOf(
      await client.fetch(
        '*[_type == $type]',
        {type: 'post'},
        // @ts-expect-error -- should fail
        {next: {revalidate: false, tags: ['post']}},
      ),
    ).toMatchTypeOf<any>()
  })
})

// Tests for client configuration methods
describe('client.config and client.withConfig', () => {
  test('client.config', () => {
    const client = createClient({})

    // Test config getter
    expectTypeOf(client.config()).toMatchTypeOf<InitializedClientConfig>()
    expectTypeOf(client.observable.config()).toMatchTypeOf<InitializedClientConfig>()

    // Test config setter
    const newConfig: Partial<ClientConfig> = {apiVersion: '2023-05-03'}
    expectTypeOf(client.config(newConfig)).toEqualTypeOf(client)
    expectTypeOf(client.observable.config(newConfig)).toEqualTypeOf(client.observable)

    // Test withConfig
    expectTypeOf(client.withConfig(newConfig)).toMatchTypeOf(client)
    expectTypeOf(client.observable.withConfig(newConfig)).toMatchTypeOf(client.observable)
  })
})

// Tests for URL helper methods
describe('client URL methods', () => {
  test('client.getUrl', () => {
    const client = createClient({})

    // Test getUrl with default canUseCdn
    expectTypeOf(client.getUrl('/path/to/resource')).toMatchTypeOf<string>()
    expectTypeOf(client.observable.getUrl('/path/to/resource')).toMatchTypeOf<string>()

    // Test getUrl with explicit canUseCdn
    expectTypeOf(client.getUrl('/path/to/resource', true)).toMatchTypeOf<string>()
    expectTypeOf(client.observable.getUrl('/path/to/resource', true)).toMatchTypeOf<string>()

    expectTypeOf(client.getUrl('/path/to/resource', false)).toMatchTypeOf<string>()
    expectTypeOf(client.observable.getUrl('/path/to/resource', false)).toMatchTypeOf<string>()
  })

  test('client.getDataUrl', () => {
    const client = createClient({})

    // Test getDataUrl with only operation
    expectTypeOf(client.getDataUrl('query')).toMatchTypeOf<string>()
    expectTypeOf(client.observable.getDataUrl('query')).toMatchTypeOf<string>()

    // Test getDataUrl with operation and path
    expectTypeOf(client.getDataUrl('query', 'production')).toMatchTypeOf<string>()
    expectTypeOf(client.observable.getDataUrl('query', 'production')).toMatchTypeOf<string>()
  })
})

// Tests for document methods
describe('client document methods', () => {
  const client = createClient({})

  test('client.getDocument', async () => {
    // Basic usage
    expectTypeOf(await client.getDocument('doc123')).toMatchTypeOf<
      SanityDocument<any> | undefined
    >()
    expectTypeOf(await lastValueFrom(client.observable.getDocument('doc123'))).toMatchTypeOf<
      SanityDocument<any> | undefined
    >()

    // With generic type
    expectTypeOf(await client.getDocument<{title: string}>('doc123')).toMatchTypeOf<
      SanityDocument<{title: string}> | undefined
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.getDocument<{title: string}>('doc123')),
    ).toMatchTypeOf<SanityDocument<{title: string}> | undefined>()

    // With options
    expectTypeOf(await client.getDocument('doc123', {tag: 'tag1'})).toMatchTypeOf<
      SanityDocument<any> | undefined
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.getDocument('doc123', {tag: 'tag1'})),
    ).toMatchTypeOf<SanityDocument<any> | undefined>()
  })

  test('client.getDocuments', async () => {
    // Basic usage
    expectTypeOf(await client.getDocuments(['doc123', 'doc456'])).toMatchTypeOf<
      (SanityDocument<any> | null)[]
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.getDocuments(['doc123', 'doc456'])),
    ).toMatchTypeOf<(SanityDocument<any> | null)[]>()

    // With generic type
    expectTypeOf(await client.getDocuments<{title: string}>(['doc123', 'doc456'])).toMatchTypeOf<
      (SanityDocument<{title: string}> | null)[]
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.getDocuments<{title: string}>(['doc123', 'doc456'])),
    ).toMatchTypeOf<(SanityDocument<{title: string}> | null)[]>()

    // With options
    expectTypeOf(await client.getDocuments(['doc123', 'doc456'], {tag: 'tag1'})).toMatchTypeOf<
      (SanityDocument<any> | null)[]
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.getDocuments(['doc123', 'doc456'], {tag: 'tag1'})),
    ).toMatchTypeOf<(SanityDocument<any> | null)[]>()
  })

  test('client.create', async () => {
    const doc = {_type: 'post', title: 'Hello World'}

    // Basic usage
    expectTypeOf(await client.create(doc)).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(await lastValueFrom(client.observable.create(doc))).toMatchTypeOf<
      SanityDocument<any>
    >()

    // With generic type
    expectTypeOf(await client.create<{title: string}>(doc)).toMatchTypeOf<
      SanityDocument<{title: string}>
    >()
    expectTypeOf(await lastValueFrom(client.observable.create<{title: string}>(doc))).toMatchTypeOf<
      SanityDocument<{title: string}>
    >()

    // Return first document with options
    expectTypeOf(await client.create(doc, {returnFirst: true})).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(
      await lastValueFrom(client.observable.create(doc, {returnFirst: true})),
    ).toMatchTypeOf<SanityDocument<any>>()

    // Return documents array with options
    const docsResult = await client.create(doc, {returnFirst: false, returnDocuments: true})
    expectTypeOf(docsResult).toBeArray()

    const obsDocsResult = await lastValueFrom(
      client.observable.create(doc, {returnFirst: false, returnDocuments: true}),
    )
    expectTypeOf(obsDocsResult).toBeArray()

    // Return mutation result
    expectTypeOf(
      await client.create(doc, {returnDocuments: false}),
    ).toMatchTypeOf<SingleMutationResult>()
    expectTypeOf(
      await lastValueFrom(client.observable.create(doc, {returnDocuments: false})),
    ).toMatchTypeOf<SingleMutationResult>()
  })

  test('client.createIfNotExists', async () => {
    const docWithId = {_id: 'unique123', _type: 'post', title: 'Hello World'}

    // Basic usage
    expectTypeOf(await client.createIfNotExists(docWithId)).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(await lastValueFrom(client.observable.createIfNotExists(docWithId))).toMatchTypeOf<
      SanityDocument<any>
    >()

    // With generic type
    expectTypeOf(await client.createIfNotExists<{title: string}>(docWithId)).toMatchTypeOf<
      SanityDocument<{title: string}>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.createIfNotExists<{title: string}>(docWithId)),
    ).toMatchTypeOf<SanityDocument<{title: string}>>()

    // Return first document with options
    expectTypeOf(await client.createIfNotExists(docWithId, {returnFirst: true})).toMatchTypeOf<
      SanityDocument<any>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.createIfNotExists(docWithId, {returnFirst: true})),
    ).toMatchTypeOf<SanityDocument<any>>()

    // Return documents array with options
    const docsResult = await client.createIfNotExists(docWithId, {
      returnFirst: false,
      returnDocuments: true,
    })
    expectTypeOf(docsResult).toBeArray()

    const obsDocsResult = await lastValueFrom(
      client.observable.createIfNotExists(docWithId, {returnFirst: false, returnDocuments: true}),
    )
    expectTypeOf(obsDocsResult).toBeArray()

    // Return mutation result
    expectTypeOf(
      await client.createIfNotExists(docWithId, {returnDocuments: false}),
    ).toMatchTypeOf<SingleMutationResult>()
    expectTypeOf(
      await lastValueFrom(client.observable.createIfNotExists(docWithId, {returnDocuments: false})),
    ).toMatchTypeOf<SingleMutationResult>()
  })

  test('client.createOrReplace', async () => {
    const docWithId = {_id: 'unique123', _type: 'post', title: 'Hello World'}

    // Basic usage
    expectTypeOf(await client.createOrReplace(docWithId)).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(await lastValueFrom(client.observable.createOrReplace(docWithId))).toMatchTypeOf<
      SanityDocument<any>
    >()

    // With generic type
    expectTypeOf(await client.createOrReplace<{title: string}>(docWithId)).toMatchTypeOf<
      SanityDocument<{title: string}>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.createOrReplace<{title: string}>(docWithId)),
    ).toMatchTypeOf<SanityDocument<{title: string}>>()

    // Return first document with options
    expectTypeOf(await client.createOrReplace(docWithId, {returnFirst: true})).toMatchTypeOf<
      SanityDocument<any>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.createOrReplace(docWithId, {returnFirst: true})),
    ).toMatchTypeOf<SanityDocument<any>>()

    // Return documents array with options
    const docsResult = await client.createOrReplace(docWithId, {
      returnFirst: false,
      returnDocuments: true,
    })
    expectTypeOf(docsResult).toBeArray()

    const obsDocsResult = await lastValueFrom(
      client.observable.createOrReplace(docWithId, {returnFirst: false, returnDocuments: true}),
    )
    expectTypeOf(obsDocsResult).toBeArray()

    // Return mutation result
    expectTypeOf(
      await client.createOrReplace(docWithId, {returnDocuments: false}),
    ).toMatchTypeOf<SingleMutationResult>()
    expectTypeOf(
      await lastValueFrom(client.observable.createOrReplace(docWithId, {returnDocuments: false})),
    ).toMatchTypeOf<SingleMutationResult>()
  })

  test('client.delete', async () => {
    // With document ID
    expectTypeOf(await client.delete('doc123')).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(await lastValueFrom(client.observable.delete('doc123'))).toMatchTypeOf<
      SanityDocument<any>
    >()

    // With generic type
    expectTypeOf(await client.delete<{title: string}>('doc123')).toMatchTypeOf<
      SanityDocument<{title: string}>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.delete<{title: string}>('doc123')),
    ).toMatchTypeOf<SanityDocument<{title: string}>>()

    // With selection object
    const selection: MutationSelection = {query: '*[_type == "post"]'}
    expectTypeOf(await client.delete(selection)).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(await lastValueFrom(client.observable.delete(selection))).toMatchTypeOf<
      SanityDocument<any>
    >()

    // Return first document with options
    expectTypeOf(await client.delete('doc123', {returnFirst: true})).toMatchTypeOf<
      SanityDocument<any>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.delete('doc123', {returnFirst: true})),
    ).toMatchTypeOf<SanityDocument<any>>()

    // Return documents array with options
    const docsResult = await client.delete('doc123', {returnFirst: false, returnDocuments: true})
    expectTypeOf(docsResult).toBeArray()

    const obsDocsResult = await lastValueFrom(
      client.observable.delete('doc123', {returnFirst: false, returnDocuments: true}),
    )
    expectTypeOf(obsDocsResult).toBeArray()

    // Return mutation result
    expectTypeOf(
      await client.delete('doc123', {returnDocuments: false}),
    ).toMatchTypeOf<SingleMutationResult>()
    expectTypeOf(
      await lastValueFrom(client.observable.delete('doc123', {returnDocuments: false})),
    ).toMatchTypeOf<SingleMutationResult>()
  })

  test('client.mutate', async () => {
    const mutations: Mutation<any>[] = [{create: {_type: 'post', title: 'Hello World'}}]

    // Basic usage
    expectTypeOf(await client.mutate(mutations)).toMatchTypeOf<SanityDocument<any>>()
    expectTypeOf(await lastValueFrom(client.observable.mutate(mutations))).toMatchTypeOf<
      SanityDocument<any>
    >()

    // Return first document with options
    expectTypeOf(await client.mutate(mutations, {returnFirst: true})).toMatchTypeOf<
      SanityDocument<any>
    >()
    expectTypeOf(
      await lastValueFrom(client.observable.mutate(mutations, {returnFirst: true})),
    ).toMatchTypeOf<SanityDocument<any>>()

    // Return documents array with options
    const docsResult = await client.mutate(mutations, {returnFirst: false, returnDocuments: true})
    expectTypeOf(docsResult).toBeArray()

    const obsDocsResult = await lastValueFrom(
      client.observable.mutate(mutations, {returnFirst: false, returnDocuments: true}),
    )
    expectTypeOf(obsDocsResult).toBeArray()

    // Return mutation result
    expectTypeOf(
      await client.mutate(mutations, {returnDocuments: false}),
    ).toMatchTypeOf<SingleMutationResult>()
    expectTypeOf(
      await lastValueFrom(client.observable.mutate(mutations, {returnDocuments: false})),
    ).toMatchTypeOf<SingleMutationResult>()

    // With transaction
    const transaction = client.transaction().create({_type: 'post', title: 'Hello World'})
    expectTypeOf(await client.mutate(transaction)).toMatchTypeOf<SanityDocument<any>>()

    // With observable transaction
    const obsTransaction = client.observable
      .transaction()
      .create({_type: 'post', title: 'Hello World'})
    expectTypeOf(await lastValueFrom(client.observable.mutate(obsTransaction))).toMatchTypeOf<
      SanityDocument<any>
    >()
  })

  test('client.patch', async () => {
    // Create patch with ID
    const patch = client.patch('doc123')
    expectTypeOf(patch).toMatchTypeOf<Patch>()

    // Create observable patch with ID
    const obsPatch = client.observable.patch('doc123')
    expectTypeOf(obsPatch).toMatchTypeOf<ObservablePatch>()

    // Create patch with array of IDs
    const patchWithIds = client.patch(['doc123', 'doc456'])
    expectTypeOf(patchWithIds).toMatchTypeOf<Patch>()

    // Create patch with query selection
    const patchWithQuery = client.patch({query: '*[_type == "post"]'})
    expectTypeOf(patchWithQuery).toMatchTypeOf<Patch>()

    // Create patch with operations
    const patchWithOps = client.patch('doc123', {set: {title: 'Updated Title'}})
    expectTypeOf(patchWithOps).toMatchTypeOf<Patch>()

    // Patch operations
    const patchWithChain = client
      .patch('doc123')
      .set({title: 'Updated Title'})
      .inc({count: 1})
      .dec({visits: 1})
      .unset(['oldField'])

    expectTypeOf(patchWithChain).toMatchTypeOf<Patch>()

    // Commit operations
    const commitResult = await patchWithChain.commit()
    expectTypeOf(commitResult).toMatchTypeOf<SanityDocument<any>>()

    const obsCommitResult = await lastValueFrom(obsPatch.set({title: 'Updated Title'}).commit())
    expectTypeOf(obsCommitResult).toMatchTypeOf<SanityDocument<any>>()

    // Commit with options
    const commitOptions = await patchWithChain.commit({returnDocuments: false})
    expectTypeOf(commitOptions).toMatchTypeOf<SingleMutationResult>()

    const obsCommitOptions = await lastValueFrom(obsPatch.commit({returnDocuments: false}))
    expectTypeOf(obsCommitOptions).toMatchTypeOf<SingleMutationResult>()
  })

  test('client.transaction', async () => {
    // Create empty transaction
    const transaction = client.transaction()
    expectTypeOf(transaction).toMatchTypeOf<Transaction>()

    // Create observable transaction
    const obsTransaction = client.observable.transaction()
    expectTypeOf(obsTransaction).toMatchTypeOf<ObservableTransaction>()

    // Create transaction with operations
    const transactionWithOps = client.transaction([{create: {_type: 'post', title: 'Hello World'}}])
    expectTypeOf(transactionWithOps).toMatchTypeOf<Transaction>()

    // Transaction operations
    const transactionChain = client
      .transaction()
      .create({_type: 'post', title: 'Hello World'})
      .createIfNotExists({_id: 'unique123', _type: 'post', title: 'Hello Again'})
      .delete('doc123')

    expectTypeOf(transactionChain).toMatchTypeOf<Transaction>()

    // Commit operations
    const commitResult = await transactionChain.commit()
    expectTypeOf(commitResult).toMatchTypeOf<MultipleMutationResult>()

    const obsCommitResult = await lastValueFrom(
      obsTransaction.create({_type: 'post', title: 'Hello'}).commit(),
    )
    expectTypeOf(obsCommitResult).toMatchTypeOf<MultipleMutationResult>()

    // Commit with options
    const commitOptions = await transactionChain.commit({returnFirst: true})
    expectTypeOf(commitOptions).toMatchTypeOf<SingleMutationResult>()

    const obsCommitOptions = await lastValueFrom(
      obsTransaction.commit({returnFirst: true, returnDocuments: false}),
    )
    expectTypeOf(obsCommitOptions).toMatchTypeOf<SingleMutationResult>()
  })

  test('client.action', async () => {
    // Single action
    const action = {
      actionType: 'sanity.action.document.publish',
      draftId: 'draft.bike-123',
      publishedId: 'bike-123',
    } satisfies Action

    const actionResult = await client.action(action)
    expectTypeOf(actionResult).toBeObject()

    const obsActionResult = await lastValueFrom(client.observable.action(action))
    expectTypeOf(obsActionResult).toBeObject()

    // Action array
    const actions = [
      {
        actionType: 'sanity.action.document.publish',
        draftId: 'draft.bike-123',
        publishedId: 'bike-123',
      },
      {
        actionType: 'sanity.action.document.unpublish',
        publishedId: 'bike-456',
        draftId: 'draft.bike-456',
      },
    ] satisfies Action[]

    const actionsResult = await client.action(actions)
    expectTypeOf(actionsResult).toBeObject()

    const obsActionsResult = await lastValueFrom(client.observable.action(actions))
    expectTypeOf(obsActionsResult).toBeObject()

    // With options
    const actionOptions = {
      dryRun: true,
      transactionId: 'my-transaction-id',
    } satisfies BaseActionOptions

    const actionWithOptions = await client.action(action, actionOptions)
    expectTypeOf(actionWithOptions).toBeObject()

    const obsActionWithOptions = await lastValueFrom(
      client.observable.action(action, actionOptions),
    )
    expectTypeOf(obsActionWithOptions).toBeObject()
  })

  test('client.request', async () => {
    // Basic request
    const requestResult = await client.request({
      method: 'GET',
      uri: '/path/to/endpoint',
    })
    expectTypeOf(requestResult).toBeAny()

    const obsRequestResult = await lastValueFrom(
      client.observable.request({
        method: 'GET',
        uri: '/path/to/endpoint',
      }),
    )
    expectTypeOf(obsRequestResult).toBeAny()

    // With generic type
    interface CustomResponse {
      result: string
      timestamp: number
    }

    const typedRequest = await client.request<CustomResponse>({
      method: 'GET',
      uri: '/path/to/endpoint',
    })
    expectTypeOf(typedRequest).toMatchTypeOf<CustomResponse>()

    const obsTypedRequest = await lastValueFrom(
      client.observable.request<CustomResponse>({
        method: 'GET',
        uri: '/path/to/endpoint',
      }),
    )
    expectTypeOf(obsTypedRequest).toMatchTypeOf<CustomResponse>()
  })
})
