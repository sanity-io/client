import {
  type Context,
  createClient,
  isContextApiError,
  type MutationEvent,
  type SanityDocument,
} from '@sanity/client'
import {type Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.context.request types', () => {
  const client = createClient({resource: {type: 'knowledge-base', id: 'kb123'}})
  const context = client.context

  test('routes are the spec operations', () => {
    expectTypeOf<'POST /knowledge-bases/{knowledgeBaseId}/sources'>().toExtend<Context.Route>()
    expectTypeOf<'GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}'>().toExtend<Context.Route>()
    expectTypeOf<'PUT /knowledge-bases/{knowledgeBaseId}/sources'>().not.toExtend<Context.Route>()
    expectTypeOf<'GET /knowledge-bases/{knowledgeBaseId}/imports'>().not.toExtend<Context.Route>()
  })

  test('resolves with the success response body', async () => {
    const source = await context.request(
      'GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}',
      {
        params: {sourceId: 's1'},
      },
    )
    expectTypeOf(source).toEqualTypeOf<Context.Source>()
    expectTypeOf(source.type).toEqualTypeOf<'web' | 'sanity-dataset' | 'files'>()

    const job = await context.request('GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}', {
      params: {jobId: 'job1'},
    })
    expectTypeOf(job.kind).toEqualTypeOf<'build' | 'update' | 'sync'>()

    expectTypeOf(
      await context.request('DELETE /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
        params: {sourceId: 's1'},
      }),
    ).toEqualTypeOf<undefined>()
  })

  test("types a document's content by its format", async () => {
    const route = 'GET /knowledge-bases/{knowledgeBaseId}/documents/{documentId}/content'
    const params = {documentId: 'd1'}
    const view = await context.request(route, {params})
    expectTypeOf(view.totalLines).toEqualTypeOf<number>()
    expectTypeOf(await context.request(route, {params, query: {format: 'json'}})).toEqualTypeOf(
      view,
    )
    expectTypeOf(
      await context.request(route, {params, query: {format: 'markdown', lines: '1-10'}}),
    ).toEqualTypeOf<string>()
    expectTypeOf(
      await context.request(route, {params, query: {format: 'plain'}}),
    ).toEqualTypeOf<string>()
    // @ts-expect-error -- raw content is bytes, which requestBytes resolves with
    void context.request(route, {params, query: {format: 'raw'}})
    expectTypeOf(
      await context.requestBytes(route, {params, query: {format: 'raw'}}),
    ).toEqualTypeOf<Uint8Array>()
  })

  test('types path parameters, query and body from the spec', () => {
    void context.request('PATCH /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
      params: {sourceId: 's1'},
      body: {title: 'Docs'},
    })
    void context.request('GET /knowledge-bases/{knowledgeBaseId}/documents', {
      query: {state: 'missing', limit: 10},
    })
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/sources', {
      body: {type: 'web', url: 'https://example.com'},
    })

    void context.request('GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
      // @ts-expect-error -- sourceId is a required path parameter
      params: {},
    })
    // @ts-expect-error -- the init argument is required when a path parameter is
    void context.request('GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}')
    void context.request('GET /knowledge-bases/{knowledgeBaseId}/documents', {
      // @ts-expect-error -- state is an enum
      query: {state: 'gone'},
    })
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/sources', {
      // @ts-expect-error -- a source has a type
      body: {title: 'Docs'},
    })
    // @ts-expect-error -- the body is required
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/instructions', {})
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/build', {
      // @ts-expect-error -- build takes no body
      body: {},
    })
    // @ts-expect-error -- not a Context API route
    void context.request('GET /projects')
  })

  test('a knowledge base reports its source chunks, not a document count', () => {
    type KnowledgeBase = Context.Response<'GET /knowledge-bases/{knowledgeBaseId}'>
    expectTypeOf<KnowledgeBase>().not.toHaveProperty('sourceUsage')
  })

  test('an instruction can be checked and drafted before it is created', () => {
    expectTypeOf(
      context.request('POST /knowledge-bases/{knowledgeBaseId}/instructions/check', {
        body: {statement: 'Refunds take 5 days', scopeDocumentIds: ['d1'], candidatesOnly: true},
      }),
    ).resolves.toExtend<{
      checked: number
      contradictions: {id: string; path: string; title: string; issue: string}[]
      candidates?: {id: string; path: string; title: string}[]
    }>()
    expectTypeOf(
      context.request('POST /knowledge-bases/{knowledgeBaseId}/instructions/draft', {
        body: {feedback: 'Refunds take 5 days, not 10', entryId: 'entry.1'},
      }),
    ).resolves.toExtend<{statement: string; scopeDocumentIds: string[]}>()
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/instructions/check', {
      // @ts-expect-error -- a check needs the documents the instruction is tied to
      body: {statement: 'Refunds take 5 days'},
    })
  })

  test('the knowledge base and organization are optional, filled from the configuration', () => {
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/build')
    void context.request('POST /knowledge-bases/{knowledgeBaseId}/build', {
      params: {knowledgeBaseId: 'kbOther'},
    })
    void context.request('DELETE /organizations/{organizationId}/mcp/{mcpEndpoint}', {
      params: {mcpEndpoint: 'support'},
    })
  })

  test('the observable client resolves to the same types', () => {
    expectTypeOf(
      client.observable.context.request('POST /knowledge-bases/{knowledgeBaseId}/build'),
    ).toEqualTypeOf<Observable<Context.Response<'POST /knowledge-bases/{knowledgeBaseId}/build'>>>()
  })
})

describe('Context API errors', () => {
  test('isContextApiError narrows to a body with a known or newer code', () => {
    const error: unknown = new Error('failed')
    if (isContextApiError(error)) {
      expectTypeOf(error.response.body.code).toExtend<string>()
      expectTypeOf<'buildInFlight'>().toExtend<typeof error.response.body.code>()
      expectTypeOf<'aCodeAddedLater'>().toExtend<typeof error.response.body.code>()
      expectTypeOf(error.response.body.message).toEqualTypeOf<string>()
    }
    expectTypeOf<'buildInFlight'>().toExtend<Context.ErrorCode>()
    expectTypeOf<'aCodeAddedLater'>().not.toExtend<Context.ErrorCode>()
  })
})

describe('client.context store reads', () => {
  const client = createClient({context: {organizationId: 'org1'}})

  test('fetch is typed by its caller, listen emits mutation events', () => {
    expectTypeOf(client.context.fetch<Context.McpDoc[]>('*')).toEqualTypeOf<
      Promise<Context.McpDoc[]>
    >()
    expectTypeOf(client.context.listen('*')).toEqualTypeOf<
      Observable<MutationEvent<SanityDocument>>
    >()
  })
})
