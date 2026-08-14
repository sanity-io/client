import {expect, test} from 'vitest'

import {createMediaLibraryClient, mediaLibraryId} from './helpers'
import {uniqueJpegBytes} from './mediaLibraryFixture'

/**
 * Media Library smoke test: `resource: {type: 'media-library', id}` makes the
 * client build a completely different host and path from the project case,
 * and upload to the Media Library's own endpoint, which responds with a
 * `{asset: ...}` body rather than Content Lake's `{document: ...}`. A mocked
 * transport cannot catch a regression in either, because the mock is told
 * which URL and body shape to expect.
 *
 * Uploads a real image, since a degenerate one (e.g. a 1x1 PNG) is rejected
 * by the API with a 422. The bytes are unique per run (see
 * `mediaLibraryFixture.ts`): the library dedupes uploads by content hash, and
 * this suite's integration matrix runs several runtimes, potentially
 * concurrently, so re-using fixed bytes would collide across runs.
 *
 * Cleans up both documents an upload leaves behind: the `sanity.asset`
 * document itself, and the derived `image-...` instance document its
 * `currentVersion` points at. Leaking either would change what the next run
 * sees, and combined with the content-hash dedup, a leaked asset with
 * non-unique bytes would wedge the suite - so cleanup runs in a `finally`.
 */
test('assets.upload() uploads to the Media Library and the resource id reaches the request', async () => {
  const client = createMediaLibraryClient()

  // `config()` resolves the configured resource, so this also catches a
  // regression where `resource` is dropped or rewritten between config and
  // request.
  expect(client.config().resource).toEqual({type: 'media-library', id: mediaLibraryId})

  const bytes = uniqueJpegBytes()
  const uploaded = await client.assets.upload('image', new Blob([bytes]), {
    filename: 'client-integration-media-library.jpg',
  })

  // Everything below runs inside the `try` so that a shape regression still
  // cleans up: the upload has already succeeded server-side by this point, so
  // throwing before the `finally` is registered would leak the asset into the
  // library.
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
  } finally {
    // `_id` is present on every shape this can resolve to, so it is safe to
    // delete without narrowing first. The derived `image-...` instance
    // document is only reachable via the Media Library shape.
    await client.delete(uploaded._id)
    if ('currentVersion' in uploaded) {
      await client.delete(uploaded.currentVersion._ref)
    }
  }
})
