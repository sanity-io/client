import {expect, test} from 'vitest'

import {createIntegrationClient, smokeDocumentType, uniqueDocumentId} from './helpers'

/** Smoke test for `client.getDocument()`, the `/doc` endpoint, against the real API. */
test('getDocument() fetches a document by id from the /doc endpoint', async () => {
  const client = createIntegrationClient()
  const id = uniqueDocumentId('doc')

  await client.create({_id: id, _type: smokeDocumentType, label: 'doc smoke test'})
  try {
    const doc = await client.getDocument<{label: string}>(id)
    expect(doc).toMatchObject({_id: id, _type: smokeDocumentType, label: 'doc smoke test'})
  } finally {
    await client.delete(id)
  }
})
