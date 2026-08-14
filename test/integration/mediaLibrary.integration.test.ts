import {expect, test} from 'vitest'

import {createMediaLibraryClient, mediaLibraryId} from './helpers'
import {uniqueJpegBytes} from './mediaLibraryFixture'

/**
 * Media Library smoke test, covering the full lifecycle of an asset: upload,
 * read it back, delete it, confirm it is gone.
 *
 * `resource: {type: 'media-library', id}` makes the client build a completely
 * different host and path from the project case, on every request rather than
 * just the upload. A mocked transport cannot catch a regression there, because
 * the mock is told which URL to expect - so this walks three endpoints, not
 * one. Upload additionally responds with a `{asset: ...}` body where Content
 * Lake sends `{document: ...}`.
 *
 * Uploads a real image, since a degenerate one (e.g. a 1x1 PNG) is rejected
 * by the API with a 422. The bytes are unique per run (see
 * `mediaLibraryFixture.ts`): the library dedupes uploads by content hash, and
 * this suite's integration matrix runs several runtimes, potentially
 * concurrently, so re-using fixed bytes would collide across runs.
 *
 * An upload leaves two documents behind: the `sanity.asset` document itself,
 * and the derived `image-...` instance document its `currentVersion` points
 * at. Both are deleted. Leaking either would change what the next run sees,
 * so the delete is both the last step of the smoke path and a `finally`
 * safety net for the case where an earlier assertion throws.
 */
test('assets.upload() uploads to the Media Library, and the asset can be read back and deleted', async () => {
  const client = createMediaLibraryClient()

  // `config()` resolves the configured resource, so this also catches a
  // regression where `resource` is dropped or rewritten between config and
  // request.
  expect(client.config().resource).toEqual({type: 'media-library', id: mediaLibraryId})

  const bytes = uniqueJpegBytes()
  const uploaded = await client.assets.upload('image', new Blob([bytes]), {
    filename: 'client-integration-media-library.jpg',
  })

  /**
   * Deletes everything the upload created. Safe to call twice: deleting an
   * already-deleted document is a no-op rather than an error, which is what
   * lets this serve as both the asserted final step and the `finally` net.
   */
  const deleteUploaded = async () => {
    await client.delete(uploaded._id)
    // The instance document is only reachable via the Media Library shape.
    if ('currentVersion' in uploaded) {
      await client.delete(uploaded.currentVersion._ref)
    }
  }

  // Everything below runs inside the `try` so that a shape regression still
  // cleans up: the upload has already succeeded server-side by this point, so
  // throwing before the `finally` is registered would leak the asset into the
  // library.
  let deleted = false
  try {
    // Resolving to `undefined` here is the exact regression this test exists
    // for: the client used to unwrap `.document`, which the Media Library
    // endpoint never sends.
    expect(uploaded).toBeDefined()
    expect(uploaded).toMatchObject({
      _id: expect.any(String),
      _type: 'sanity.asset',
      assetType: 'sanity.imageAsset',
    })

    // The Media Library upload endpoint responds with `{asset: ...}`, a
    // `sanity.asset` document - never Content Lake's `{document: ...}` shape.
    // Narrowing on `currentVersion` (only present on the Media Library shape)
    // rather than asserting keeps this a real check instead of a cast.
    if (!('currentVersion' in uploaded)) {
      throw new Error(
        `Expected a Media Library asset document with \`currentVersion\`, got: ${JSON.stringify(uploaded)}`,
      )
    }
    expect(uploaded.currentVersion._ref).toEqual(expect.any(String))

    // Read it back through the doc endpoint, which the library builds its own
    // URL for. Asserting the id and type round-trip proves the upload response
    // described a document that actually exists, rather than one the endpoint
    // merely echoed back.
    const fetched = await client.getDocument(uploaded._id)
    expect(fetched).toMatchObject({
      _id: uploaded._id,
      _type: 'sanity.asset',
      assetType: 'sanity.imageAsset',
    })

    // Deleting is part of the smoke path, not just teardown: it is a mutation
    // against the library's own mutate endpoint, and a regression there would
    // otherwise surface only as a slow leak of assets.
    await deleteUploaded()
    deleted = true

    await expect(client.getDocument(uploaded._id)).resolves.toBeUndefined()
  } finally {
    if (!deleted) {
      // An assertion above already failed, so surface that rather than a
      // secondary cleanup error - but still make the attempt.
      await deleteUploaded().catch(() => {})
    }
  }
})
