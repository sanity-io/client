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

/**
 * Smoke test for the transaction and patch builders:
 * `client.transaction().patch(id, (p) => ...).commit()`.
 *
 * `create()` above sends a document; this sends a *program*. The callback form
 * of `patch()` runs the patch builder, and the builder's whole job is to
 * serialise chained operations into the wire format the mutate endpoint expects:
 * two different operations here (`set` and `inc`) so the result depends on both
 * being present and correctly named, and both wrapped in a transaction envelope.
 * Every hermetic test of this asserts against the payload we believe is correct.
 * Only a real request proves the API agrees, and `inc` makes that provable
 * without ambiguity: the stored value is 3 only if the server actually applied
 * an increment to the existing 1, rather than overwriting it.
 *
 * Reads back with `getDocument()`, not a query, so no polling is needed: the
 * `/doc` endpoint reads the document store directly, while the query index lags
 * behind the write.
 */
test('transaction().patch() applies set and inc, and the result reads back', async () => {
  const client = createIntegrationClient()
  const id = uniqueDocumentId('transaction')

  await client.create({
    _id: id,
    _type: smokeDocumentType,
    label: 'before patch',
    count: 1,
  })
  try {
    const result = await client
      .transaction()
      .patch(id, (patch) => patch.set({label: 'after patch'}).inc({count: 2}))
      .commit()

    // A transaction id is what proves the mutations were committed as one
    // transaction rather than as separate requests.
    expect(result.transactionId).toEqual(expect.any(String))
    expect(result.documentIds).toEqual([id])

    const patched = await client.getDocument(id)
    expect(patched).toMatchObject({_id: id, label: 'after patch', count: 3})
  } finally {
    await client.delete(id)
  }
})
