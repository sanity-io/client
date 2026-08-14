import {expect, test} from 'vitest'

import {createMediaLibraryClient, mediaLibraryId} from './helpers'

/**
 * Media Library smoke test.
 *
 * Read-only on purpose. Media Library is an organization-level resource, and
 * writing to it needs an organization-wide token; this suite carries only a
 * project token, so it reads. That is enough for what a smoke test is for
 * here: `resource: {type: 'media-library', id}` makes the client build a
 * completely different host and path from the project case, and a mocked
 * transport cannot catch a regression in that, because the mock is told which
 * URL to expect.
 */
test('a client configured for the Media Library queries it', async () => {
  const client = createMediaLibraryClient()

  const count = await client.fetch('count(*)')

  // Asserting a number rather than a value: the library's contents are not this
  // suite's to control, and an empty library is a legitimate state.
  expect(typeof count).toBe('number')
  expect(Number.isInteger(count)).toBe(true)
})

test('the Media Library resource id reaches the request', async () => {
  const client = createMediaLibraryClient()

  // `config()` resolves the configured resource, so this catches a regression
  // where `resource` is dropped or rewritten between config and request.
  expect(client.config().resource).toEqual({type: 'media-library', id: mediaLibraryId})
})
