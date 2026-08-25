import {type Context, createClient} from '@sanity/client'
import {describe, expectTypeOf, test} from 'vitest'

describe('client.context format-dependent return types', () => {
  const client = createClient({})
  const kb = client.context.knowledgeBase('kb123')

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

  test('knowledgeBases.create requires the organizationId alongside the wire fields', async () => {
    expectTypeOf(
      await client.context.knowledgeBases.create({
        organizationId: 'org',
        name: 'n',
        description: 'd',
      }),
    ).toEqualTypeOf<Context.KnowledgeBase>()
    // @ts-expect-error -- should fail: organizationId is required
    void client.context.knowledgeBases.create({
      name: 'n',
      description: 'd',
    })
  })
})
