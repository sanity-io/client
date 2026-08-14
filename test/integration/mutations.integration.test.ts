import {expect, test} from 'vitest'

import {createIntegrationClient, smokeDocumentType, uniqueDocumentId} from './helpers'

/** Smoke test for mutations against the real API: `client.create()` then `client.delete()`. */
test('create() and delete() round-trip a document', async () => {
  const client = createIntegrationClient()
  const id = uniqueDocumentId('mutations')

  try {
    const created = await client.create({
      _id: id,
      _type: smokeDocumentType,
      label: 'mutations smoke test',
    })
    expect(created).toMatchObject({
      _id: id,
      _type: smokeDocumentType,
      label: 'mutations smoke test',
    })

    // Assert the round trip (the document is actually gone), not the shape of
    // delete()'s return value: with no options, its resolved shape varies by
    // mutation content in ways unrelated to whether the delete itself worked.
    await client.delete(id)
    const after = await client.getDocument(id)
    expect(after).toBeUndefined()
  } finally {
    // Safety net: a no-op if the delete above already succeeded.
    await client.delete(id)
  }
})
