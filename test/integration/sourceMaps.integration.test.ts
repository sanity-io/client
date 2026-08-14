import {expect, test} from 'vitest'

import {createIntegrationClient, smokeDocumentType, uniqueDocumentId} from './helpers'

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
    const response = await client.fetch<unknown>(
      '*[_id == $id][0]',
      {id},
      {filterResponse: false, resultSourceMap: 'withKeyArraySelector'},
    )

    expect(response.resultSourceMap?.documents).toEqual(
      expect.arrayContaining([expect.objectContaining({_id: id, _type: smokeDocumentType})]),
    )
  } finally {
    await client.delete(id)
  }
})
