import type {ReleaseDocument, SanityClient} from '@sanity/client'
import {expect, test} from 'vitest'

import {
  createReleasesClient,
  fetchUntilVisible,
  smokeDocumentType,
  uniqueDocumentId,
  uniqueReleaseId,
} from './helpers'

/**
 * How long to wait for a release to reach a state, and how often to re-check.
 *
 * Unlike query-index lag, some release transitions are genuinely asynchronous:
 * `publish` returns while the release is still in `publishing`, and only settles
 * on `published` once the documents have been moved. That is server-side work
 * proportional to the release's size, so it gets a longer ceiling than
 * `fetchUntilVisible()`, while still sitting inside the suite's 60s timeout.
 */
const RELEASE_STATE_TIMEOUT_MS = 30_000
const RELEASE_STATE_INTERVAL_MS = 500

/** States a release can be deleted from. Everything else is transient or has to be moved through first. */
const DELETABLE_STATES = ['archived', 'published']

/**
 * Polls `releases.get()` until the release satisfies `isSettled`, then returns it.
 *
 * Reads through the `/doc` endpoint (that is what `releases.get()` uses), so this
 * is waiting on the release's own state machine rather than on the query index.
 */
async function waitForRelease(
  client: SanityClient,
  releaseId: string,
  label: string,
  isSettled: (release: ReleaseDocument | undefined) => boolean,
): Promise<ReleaseDocument | undefined> {
  const startedAt = Date.now()

  for (;;) {
    const release = await client.releases.get({releaseId})
    if (isSettled(release)) {
      return release
    }

    const elapsed = Date.now() - startedAt
    if (elapsed + RELEASE_STATE_INTERVAL_MS >= RELEASE_STATE_TIMEOUT_MS) {
      throw new Error(
        `Release ${releaseId} never reached ${label}: still in state "${release?.state}" after ` +
          `${elapsed}ms.`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, RELEASE_STATE_INTERVAL_MS))
  }
}

/**
 * Removes a release whatever state it is in, so the `finally` below can recover
 * from a failure at any point in the lifecycle.
 *
 * The state machine only allows `delete` from `archived` or `published`, and the
 * transitions out of a transient state cannot be forced, only waited for. So this
 * walks the same edges the test does, in the only order they are legal:
 * unschedule a scheduled release, wait out any in-progress transition, archive it
 * if it is active, then delete.
 */
async function removeRelease(client: SanityClient, releaseId: string): Promise<void> {
  const existing = await client.releases.get({releaseId})
  if (!existing) {
    return
  }

  if (existing.state === 'scheduled') {
    await client.releases.unschedule({releaseId})
  }

  // Wait out `publishing`/`archiving`/`unarchiving`: no action is accepted while
  // a transition is in flight.
  const settled = await waitForRelease(
    client,
    releaseId,
    'a state it can be removed from',
    (release) =>
      release === undefined ||
      release.state === 'active' ||
      DELETABLE_STATES.includes(release.state),
  )

  if (settled?.state === 'active') {
    await client.releases.archive({releaseId})
    await waitForRelease(client, releaseId, 'archived', (release) => release?.state === 'archived')
  }

  await client.releases.delete({releaseId})
}

/**
 * Smoke test for the releases client, walking one release through every action
 * it exposes: `create`, `get`, `edit`, `schedule`, `unschedule`, `archive`,
 * `unarchive`, `fetchDocuments`, `publish` and `delete`.
 *
 * One lifecycle rather than ten tests, because releases are a state machine and
 * most of these actions are only legal from a particular state - you cannot
 * unarchive something that was never archived, and `publish` is effectively
 * terminal (a published release accepts nothing but `delete`). Ten isolated
 * tests would each have to build up to their own precondition, creating ten
 * releases against real state that all have to be torn down. The order below is
 * the one the real API accepts, established by probing:
 *
 *   active -> scheduled -> active -> archived -> active -> published -> deleted
 *
 * Two behaviours here were found by probing and are the reason this is worth a
 * real request at all:
 *
 *   1. `fetchDocuments()` runs `*[sanity::partOfRelease($releaseId)]`, which
 *      returns nothing under the default perspective - the version documents in
 *      a release are simply not visible there. It needs an explicit
 *      `perspective`, and being a GROQ query it is also subject to index lag, so
 *      it needs polling on top. Neither is discoverable from a mock.
 *   2. `publish()` resolves while the release is still in `publishing`. Deleting
 *      right after it returns fails with "not permitted to transition from state
 *      publishing to deleted". The state has to be waited out.
 *
 * The archive/unarchive pair runs before any document is added on purpose:
 * archiving deletes the documents that make up the release, so doing it after
 * `createVersion` would put the assertion about the release's contents behind a
 * restore, testing the restore rather than the actions.
 *
 * Publishing has a side effect beyond the release itself - it creates the
 * published document in the dataset - so cleanup covers both that document and
 * the release.
 */
test('releases walks a full lifecycle: create, edit, schedule, archive, publish, delete', async () => {
  const client = createReleasesClient()

  // Unique per run, like every id this suite writes: several runtimes run this
  // matrix concurrently, and a fixed id would have them fighting over one
  // release. `uniqueReleaseId()` rather than `uniqueDocumentId()` because the
  // release id becomes part of `versions.<releaseId>.<documentId>`, and two
  // descriptive ids joined that way exceed the client's 128-character document
  // id limit.
  const releaseId = uniqueReleaseId()
  const publishedId = uniqueDocumentId('releasedoc')
  const versionId = `versions.${releaseId}.${publishedId}`

  try {
    const created = await client.releases.create({
      releaseId,
      metadata: {releaseType: 'asap', title: 'releases smoke test'},
    })
    expect(created.releaseId).toBe(releaseId)
    expect(created.transactionId).toEqual(expect.any(String))

    // `get()` reads the backing system document, which is what proves the create
    // action landed as a real release rather than just being accepted.
    const release = await client.releases.get({releaseId})
    expect(release).toMatchObject({
      _id: `_.releases.${releaseId}`,
      _type: 'system.release',
      state: 'active',
      metadata: {releaseType: 'asap', title: 'releases smoke test'},
    })

    // `edit` patches the release metadata, so it exercises the patch payload
    // against a system document rather than a normal one.
    await client.releases.edit({releaseId, patch: {set: {'metadata.title': 'edited by the suite'}}})
    const edited = await client.releases.get({releaseId})
    expect(edited?.metadata.title).toBe('edited by the suite')

    // Scheduled an hour out: far enough that the release cannot publish itself
    // mid-test (a `publishAt` in the past publishes immediately), which is what
    // keeps `unschedule` below reachable.
    await client.releases.schedule({
      releaseId,
      publishAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    expect((await client.releases.get({releaseId}))?.state).toBe('scheduled')

    await client.releases.unschedule({releaseId})
    expect((await client.releases.get({releaseId}))?.state).toBe('active')

    await client.releases.archive({releaseId})
    await waitForRelease(client, releaseId, 'archived', (r) => r?.state === 'archived')

    await client.releases.unarchive({releaseId})
    await waitForRelease(client, releaseId, 'active', (r) => r?.state === 'active')

    // A release needs a document before `publish` does anything observable.
    // Passing `document` rather than the recommended `baseId` (which warns on
    // stderr) is deliberate: `baseId` versions an existing published document, so
    // the published id would already exist before `publish` ran and the assertion
    // below would prove nothing. Creating the version from scratch means the
    // published document can only appear because the release published it.
    await client.createVersion({
      releaseId,
      publishedId,
      document: {_id: versionId, _type: smokeDocumentType, label: 'published by a release'},
    })

    // `perspective: 'raw'` is required, not incidental: under the default
    // perspective this query returns an empty result even though the version
    // document exists (verified against the real API). It has to come from the
    // client config, because `fetchDocuments()`'s options are
    // `BaseMutationOptions`, which carries no `perspective` - the API honours a
    // per-call one, but the client does not type it. Polling on top, because
    // this is a GROQ query and the write is acknowledged before the index sees
    // it.
    const documents = await fetchUntilVisible(
      `documents in release ${releaseId}`,
      () => client.withConfig({perspective: 'raw'}).releases.fetchDocuments({releaseId}),
      (response) => response.result.length > 0,
    )
    expect(documents.result.map((document) => document._id)).toEqual([versionId])

    await client.releases.publish({releaseId})
    // Publishing is asynchronous: the action resolves in `publishing` and only
    // then settles on `published`.
    await waitForRelease(client, releaseId, 'published', (r) => r?.state === 'published')

    // The point of publishing: the version document becomes a real document at
    // its published id. Read through `getDocument()`, so this is the document
    // store rather than the query index - but still polled, since the move
    // happens after the state flips.
    const published = await fetchUntilVisible(
      `published document ${publishedId}`,
      () => client.getDocument(publishedId),
      (document) => document !== undefined,
    )
    expect(published).toMatchObject({_id: publishedId, label: 'published by a release'})

    // `delete` is the last legal action on a published release, and removes the
    // backing system document.
    await client.releases.delete({releaseId})
    expect(await client.releases.get({releaseId})).toBeUndefined()
  } finally {
    // Recover whatever state the release is in. Errors are swallowed so that a
    // failed assertion above surfaces as itself rather than as a cleanup error,
    // matching how the Media Library test handles the same tradeoff.
    await removeRelease(client, releaseId).catch(() => {})
    // Both documents, unconditionally: which of them exists depends on how far
    // the lifecycle got, and deleting a missing document is a no-op.
    await client.delete(publishedId).catch(() => {})
    await client.delete(versionId).catch(() => {})
  }
})
