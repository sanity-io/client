import {type Context, createClient, type MutationEvent, type SanityDocument} from '@sanity/client'
import {type Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.context format-dependent return types', () => {
  const client = createClient({resource: {type: 'knowledge-base', id: 'kb123'}})
  const kb = client.context

  test('outline resolves to the typed shape by default and to a string for text formats', async () => {
    expectTypeOf(await kb.outline()).toEqualTypeOf<Context.Outline>()
    expectTypeOf(await kb.outline({format: 'json'})).toEqualTypeOf<Context.Outline>()
    expectTypeOf(await kb.outline({format: 'markdown'})).toEqualTypeOf<string>()
    expectTypeOf(await kb.outline({format: 'plain'})).toEqualTypeOf<string>()
  })

  test('entries.get resolves to the typed shape by default and to a string for text formats', async () => {
    expectTypeOf(await kb.entries.get({path: 'a/b'})).toEqualTypeOf<Context.EntryDetail>()
    expectTypeOf(await kb.entries.get({path: 'a/b', format: 'markdown'})).toEqualTypeOf<string>()
  })

  test('sources.delete resolves to void', async () => {
    expectTypeOf(await kb.sources.delete({sourceId: 'source1'})).toEqualTypeOf<void>()
  })

  test('the file import variant is only valid with file fields', async () => {
    // @ts-expect-error -- should fail: file imports require a filename
    void kb.imports.create({type: 'file', file: new Blob(['x'])})
    // @ts-expect-error -- should fail: text imports carry content, not a file
    void kb.imports.create({type: 'text', title: 't', file: new Blob(['x'])})
  })

  test('insights.listen emits mutation events by default', () => {
    expectTypeOf(client.context.insights.listen('*')).toEqualTypeOf<
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
