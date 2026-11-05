import {type Context, createClient, type MutationEvent, type SanityDocument} from '@sanity/client'
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
