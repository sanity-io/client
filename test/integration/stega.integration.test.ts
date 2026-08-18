import {stegaClean} from '@sanity/client/stega'
import {expect, test} from 'vitest'

import {
  createIntegrationClient,
  createStegaClient,
  fetchUntilVisible,
  smokeDocumentType,
  uniqueDocumentId,
} from './helpers'

/**
 * Smoke test for stega encoding, and with it for `src/csm/`.
 *
 * Its own file rather than an extra case in `sourceMaps.integration.test.ts`,
 * because it exercises a different published entry point: `@sanity/client/stega`
 * rather than `@sanity/client`. Keeping it separate means a broken `./stega`
 * condition in the `exports` map fails as its own test.
 *
 * A content source map on its own (what the source maps test covers) is just
 * data the API returns. This is the path that consumes it: with
 * `stega: {enabled: true, studioUrl}` the client requests a source map, then
 * walks it through the csm helpers - `resolveMapping` to find which document and
 * field each string came from, `resolveEditInfo` and `createEditUrl` to build a
 * Studio edit URL for it, `walkMap` and `jsonPath` to place it - and hides that
 * URL inside the string as invisible Unicode. That whole chain runs off a source
 * map the client does not author, so a change in the map's shape breaks the
 * encoding while every offline test (which is handed the map it expects) stays
 * green. That is the drift this exists to catch.
 *
 * Asserts the round trip in both directions: the string really was encoded (it
 * still starts with the original but is longer, since the payload is appended as
 * zero-width characters), and `stegaClean()` recovers the original exactly.
 * Comparing lengths rather than matching the payload keeps this from asserting
 * on the encoded URL's internals, which are not this suite's business.
 */
test('a stega-enabled client encodes edit info into strings, and stegaClean() reverses it', async () => {
  // Writes and cleanup go through the plain client: `create()` and `delete()`
  // are unaffected by stega, and using the plain client keeps this test's
  // subject to the read path.
  const client = createIntegrationClient()
  const stegaClient = createStegaClient()
  const id = uniqueDocumentId('stega')
  const label = 'stega smoke test'

  await client.create({_id: id, _type: smokeDocumentType, label})
  try {
    // Same eventual-consistency guard as every other query in this suite: poll
    // on the document appearing, assert on the encoding out here.
    const result = await fetchUntilVisible(
      `document ${id}`,
      () => stegaClient.fetch<{label: string} | null>('*[_id == $id][0]{label}', {id}),
      (value) => value !== null,
    )

    if (result === null) {
      throw new Error(`document ${id} became visible but the query returned null`)
    }

    expect(result.label).not.toBe(label)
    expect(result.label.startsWith(label)).toBe(true)
    expect(result.label.length).toBeGreaterThan(label.length)
    expect(stegaClean(result)).toEqual({label})
  } finally {
    await client.delete(id)
  }
})
