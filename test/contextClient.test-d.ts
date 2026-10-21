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

  test('imports.delete resolves to void', async () => {
    expectTypeOf(await kb.imports.delete({importId: 'imp1'})).toEqualTypeOf<void>()
  })

  test('the file import variant is only valid with file fields', async () => {
    // @ts-expect-error -- should fail: file imports require a filename
    void kb.imports.create({type: 'file', file: new Blob(['x'])})
    // @ts-expect-error -- should fail: text imports carry content, not a file
    void kb.imports.create({type: 'text', title: 't', file: new Blob(['x'])})
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
