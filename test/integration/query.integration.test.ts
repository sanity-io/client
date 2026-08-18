import {ClientError, isQueryParseError} from '@sanity/client'
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

/**
 * The error path of `client.fetch()`: a malformed GROQ query must reject with
 * the server's own diagnosis, not with a generic failure.
 *
 * Worth doing for real because the interesting part is the mapping, and the
 * mapping is driven entirely by a response body this client does not author.
 * `extractErrorProps()` recognises a query parse error by the shape of
 * `body.error` (`type: 'queryParseError'` plus `query`, `start`, `end`) and only
 * then renders the code frame that points at the offending character. A mocked
 * transport asserts against a body we wrote ourselves, so it cannot notice the
 * API changing that shape - at which point the client would silently fall back
 * to a generic message and users would lose the code frame.
 *
 * So this asserts three things beyond "it threw": that it is a `ClientError`
 * (4xx, not a transport failure), that `details` still satisfies the public
 * `isQueryParseError()` guard, and that the code frame was rendered.
 */
test('fetch() rejects a malformed query with the API error', async () => {
  const client = createIntegrationClient()

  let error: unknown
  try {
    await client.fetch('*[_type == ')
  } catch (err) {
    error = err
  }

  // Narrow by rethrowing rather than asserting, so that an unexpected error
  // surfaces as itself instead of as a failed instanceof check.
  if (!(error instanceof ClientError)) {
    throw error ?? new Error('Expected fetch() with a malformed query to reject, but it resolved')
  }

  expect(error.statusCode).toBe(400)
  expect(isQueryParseError(error.details)).toBe(true)
  expect(error.message).toMatch(/GROQ query parse error/)
  // The code frame, i.e. proof the client rendered the server's position
  // information rather than just echoing a message.
  expect(error.message).toMatch(/unexpected end-of-file, expected expression/)
})
