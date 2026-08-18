import {expect, test} from 'vitest'

import {
  createIntegrationClient,
  fetchUntilVisible,
  smokeDocumentType,
  uniqueDocumentId,
} from './helpers'

/**
 * Smoke test for content source maps / stega: `client.fetch()` with
 * `resultSourceMap` against the real API. `withKeyArraySelector` is the
 * variant Visual Editing relies on, so the fixture document includes a
 * keyed array to exercise it.
 */
test('fetch() returns a resultSourceMap for content source maps', async () => {
  const client = createIntegrationClient()
  const id = uniqueDocumentId('sourcemap')

  await client.create({
    _id: id,
    _type: smokeDocumentType,
    items: [{_key: 'a', label: 'first'}],
  })
  try {
    // Same eventual-consistency guard as the query smoke test: poll on the
    // result appearing, then assert the source map. Waiting on `result` rather
    // than on `resultSourceMap` keeps the two concerns apart - the source map
    // is produced by the same query execution, so if it is missing once the
    // document is visible, that is a real regression and should fail at once
    // rather than be retried until the deadline.
    const response = await fetchUntilVisible(
      `document ${id}`,
      () =>
        client.fetch<unknown>(
          '*[_id == $id][0]',
          {id},
          {filterResponse: false, resultSourceMap: 'withKeyArraySelector'},
        ),
      ({result}) => result !== null,
    )

    expect(response.resultSourceMap?.documents).toEqual(
      expect.arrayContaining([expect.objectContaining({_id: id, _type: smokeDocumentType})]),
    )
  } finally {
    await client.delete(id)
  }
})
