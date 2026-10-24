import {type Context, createClient, type MutationEvent, type SanityDocument} from '@sanity/client'
import {type Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.context return types', () => {
  const client = createClient({
    resource: {type: 'knowledge-base', id: 'kb123'},
  })
  const kb = client.context

  test('the GROQ read helpers resolve to the published document shapes', async () => {
    expectTypeOf(await kb.entries.get({path: 'a/b'})).toEqualTypeOf<Context.EntryDoc | null>()
    expectTypeOf(await kb.entries.list()).toEqualTypeOf<Context.Entry[]>()
    expectTypeOf(await kb.issues.list()).toEqualTypeOf<Context.IssueDoc[]>()
    expectTypeOf(await kb.issues.get({issueId: 'i'})).toEqualTypeOf<Context.IssueDoc | null>()
    expectTypeOf(await kb.instructions.list()).toEqualTypeOf<Context.InstructionDoc[]>()
    expectTypeOf(await kb.mcpEndpoints.list()).toEqualTypeOf<Context.McpDoc[]>()
    expectTypeOf(await kb.mcpEndpoints.get({name: 'n'})).toEqualTypeOf<Context.McpDoc | null>()
    expectTypeOf(
      await kb.conversations.get({threadId: 't'}),
    ).toEqualTypeOf<Context.ConversationDoc | null>()
  })

  test('jobs.get narrows its result on kind', async () => {
    const job = await kb.jobs.get({jobId: 'job1'})
    expectTypeOf(job.kind).toEqualTypeOf<'build' | 'update' | 'sync'>()
    if (job.kind === 'build') {
      expectTypeOf(job.result?.entryCount).toEqualTypeOf<number | undefined>()
    }
    if (job.kind === 'update') {
      expectTypeOf(job.result?.revisionId).toEqualTypeOf<string | null | undefined>()
    }
    if (job.kind === 'sync') {
      expectTypeOf(job.result).toEqualTypeOf<unknown>()
    }
    expectTypeOf(job.result).toEqualTypeOf<unknown>()
  })

  test('mcpEndpoints management resolves to the endpoint, delete to void', async () => {
    expectTypeOf(
      await kb.mcpEndpoints.create({
        title: 't',
        name: 'n',
        sources: [{type: 'dataset', id: 'proj.production'}],
      }),
    ).toEqualTypeOf<Context.McpEndpoint>()
    expectTypeOf(
      await kb.mcpEndpoints.edit({name: 'n', groqFilter: null}),
    ).toEqualTypeOf<Context.McpEndpoint>()
    expectTypeOf(await kb.mcpEndpoints.delete({name: 'n'})).toEqualTypeOf<void>()
  })

  test('mcpEndpoints.status resolves to the status verdicts, initialContext to text', async () => {
    const status = await kb.mcpEndpoints.status({name: 'n', mode: 'groq'})
    expectTypeOf(status).toEqualTypeOf<Context.McpEndpointStatus>()
    expectTypeOf(status.requiredOk).toEqualTypeOf<boolean>()
    expectTypeOf(await kb.mcpEndpoints.initialContext({name: 'n'})).toEqualTypeOf<string>()
  })

  test('conversations.delete resolves to void', async () => {
    expectTypeOf(await kb.conversations.delete({threadId: 't'})).toEqualTypeOf<void>()
  })

  test('sources.delete resolves to void', async () => {
    expectTypeOf(await kb.sources.delete({sourceId: 'source1'})).toEqualTypeOf<void>()
  })

  test('instructions.delete resolves to the rebuild job', async () => {
    expectTypeOf(
      await kb.instructions.delete({instructionId: 'ins1', rebuild: true}),
    ).toEqualTypeOf<Context.DeleteInstructionResponse>()
  })

  test('sources.create resolves with the source, preview with the crawl preview', async () => {
    expectTypeOf(
      await kb.sources.create({type: 'web', url: 'https://example.com'}),
    ).toEqualTypeOf<Context.Source>()
    expectTypeOf(
      await kb.sources.create({type: 'files', title: 't', file: new Blob(['x']), filename: 'x'}),
    ).toEqualTypeOf<Context.Source>()
    expectTypeOf(
      await kb.sources.preview({url: 'https://example.com'}),
    ).toEqualTypeOf<Context.CrawlPreview>()
    // @ts-expect-error -- should fail: a dry run goes through sources.preview
    void kb.sources.create({type: 'web', url: 'https://example.com', dryRun: true})
  })

  test('the file variant of sources.create is only valid with file fields', async () => {
    const blob = new Blob(['x'])
    // @ts-expect-error -- should fail: a file needs a filename
    void kb.sources.create({type: 'files', title: 't', file: blob})
    // @ts-expect-error -- should fail: a files source holds inline content or a file, not both
    void kb.sources.create({type: 'files', title: 't', content: 'x', file: blob, filename: 'x'})
    // @ts-expect-error -- should fail: only files sources take a file
    void kb.sources.create({type: 'web', url: 'https://x.dev', file: blob, filename: 'x'})
  })

  test('documents.content resolves per format', async () => {
    expectTypeOf(
      await kb.documents.content({documentId: 'd'}),
    ).toEqualTypeOf<Context.DocumentContentResponse>()
    expectTypeOf(
      await kb.documents.content({documentId: 'd', format: 'json'}),
    ).toEqualTypeOf<Context.DocumentContentResponse>()
    expectTypeOf(
      await kb.documents.content({documentId: 'd', format: 'plain'}),
    ).toEqualTypeOf<string>()
    expectTypeOf(
      await kb.documents.content({documentId: 'd', format: 'raw'}),
    ).toEqualTypeOf<Uint8Array>()
  })

  test('documents.delete resolves to void', async () => {
    expectTypeOf(await kb.documents.delete({documentId: 'd'})).toEqualTypeOf<void>()
  })

  test('context.listen emits mutation events by default', () => {
    expectTypeOf(client.context.listen('*')).toEqualTypeOf<
      Observable<MutationEvent<SanityDocument>>
    >()
  })

  test('knowledgeBases.create requires the organizationId alongside the wire fields', async () => {
    expectTypeOf(
      await client.context.knowledgeBases.create({
        organizationId: 'org',
        title: 't',
        description: 'd',
      }),
    ).toEqualTypeOf<Context.KnowledgeBase>()
    // @ts-expect-error -- should fail: organizationId is required
    void client.context.knowledgeBases.create({
      title: 't',
      description: 'd',
    })
  })

  test('knowledge-base is a valid resource config type', () => {
    expectTypeOf(createClient({resource: {type: 'knowledge-base', id: 'kb123'}})).not.toBeNever()
    // @ts-expect-error -- should fail: unknown resource types are rejected
    void createClient({resource: {type: 'knowledge-bases', id: 'kb123'}})
  })
})
