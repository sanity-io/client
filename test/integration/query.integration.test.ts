import {expect, test} from 'vitest'

import {
  createIntegrationClient,
  fetchUntilVisible,
  smokeDocumentType,
  uniqueDocumentId,
} from './helpers'

/**
 * Smoke test for `client.fetch()` against the real API.
 *
 * This also folds in the intent of the old `test/integration/live.test.ts`:
 * this file, like every file in this suite, imports `@sanity/client` with no
 * source alias (see `vitest.integration.config.ts`), so it resolves the
 * published package through the real `exports` map. A passing query here
 * proves both that resolution works and that the client still speaks the
 * API's protocol.
 */
test('fetch() resolves the published package and queries the real API', async () => {
  const client = createIntegrationClient()
  const id = uniqueDocumentId('query')

  await client.create({_id: id, _type: smokeDocumentType, label: 'query smoke test'})
  try {
    // Polls rather than querying once: the write is acknowledged before the
    // query index has necessarily caught up, so a single fetch would flake.
    // The assertion stays out here, so a document that is visible but wrong
    // fails immediately instead of being polled until the deadline.
    const result = await fetchUntilVisible(
      `document ${id}`,
      () => client.fetch<{_id: string; label: string} | null>('*[_id == $id][0]{_id, label}', {id}),
      (value) => value !== null,
    )
    expect(result).toEqual({_id: id, label: 'query smoke test'})
  } finally {
    await client.delete(id)
  }
})
