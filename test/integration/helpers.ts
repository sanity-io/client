// Shared setup for the integration smoke suite. See CONTRIBUTING.md,
// "Integration smoke tests", for what this suite is for and how to run it.
//
// Deliberately does not import anything from `test/helpers/`: those helpers
// (mockFetch, setupMockFetch) exist to fake the transport, which is exactly
// what this suite must not do.
import {createClient} from '@sanity/client'
import type {SanityClient} from '@sanity/client'
import {createClient as createStegaEnabledClient} from '@sanity/client/stega'
import type {SanityStegaClient} from '@sanity/client/stega'

/**
 * Reads a piece of suite configuration from the environment, falling back to
 * the provisioned default.
 *
 * The defaults are what CI uses, so nothing has to be configured for the
 * normal path. The override exists so the suite can be pointed at a different
 * project, dataset or Media Library without patching this file: to reproduce a
 * failure against your own project, or to run two branches concurrently
 * without them competing for the same documents. Treats an empty variable as
 * unset, since a CI secret that failed to resolve expands to an empty string
 * rather than disappearing, and silently targeting `projectId: ''` would fail
 * far from its cause.
 */
function fromEnv(name: string, fallback: string): string {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

/**
 * Project provisioned solely for this suite, in its own organization (Sanity
 * Client CI) so a CI-writable token cannot reach anything else. The `test`
 * dataset is private and holds only system documents; every test creates and
 * deletes its own fixtures.
 *
 * Override with `SANITY_INTEGRATION_PROJECT_ID` / `SANITY_INTEGRATION_DATASET`.
 * A token for the overriding project has to be supplied alongside, since the
 * default token is scoped to the default project.
 */
export const projectId = fromEnv('SANITY_INTEGRATION_PROJECT_ID', 'ufeo1jge')
export const dataset = fromEnv('SANITY_INTEGRATION_DATASET', 'test')

/**
 * Pinned and dated, not `vX`: keeps results deterministic across runs rather
 * than tracking "whatever the API considers current" the day the suite
 * happens to run. Combined with `useCdn: false` below, that also rules out
 * CDN lag as a source of flake. `2021-03-25` or later is required by
 * `client.live.events()`; none of the six features this suite covers need
 * `vX`.
 */
export const apiVersion = '2024-08-01'

/**
 * Media Library provisioned for the organization that owns this project.
 *
 * Media Library is an organization-level resource, reached by configuring the
 * client with `resource: {type: 'media-library', id}` rather than a project and
 * dataset. Uploading to it needs an organization-wide token: a project token,
 * however broad its project role, fails with "Insufficient permissions". So
 * {@link createMediaLibraryClient} uses `SANITY_INTEGRATION_ORG_TOKEN`, not the
 * project token the rest of this suite uses.
 *
 * Override with `SANITY_INTEGRATION_MEDIA_LIBRARY_ID`. Note that this is not
 * tied to {@link projectId}: the library belongs to the organization, so
 * overriding the project does not imply overriding the library, or the reverse.
 */
export const mediaLibraryId = fromEnv('SANITY_INTEGRATION_MEDIA_LIBRARY_ID', 'mlh3itedy1LA')

/** `_type` given to every document this suite creates, so stray leftovers are easy to spot and sweep. */
export const smokeDocumentType = 'client.integration.smoke'

/** Builds a document id unique to this run, so concurrent runs of the suite cannot collide. */
export function uniqueDocumentId(feature: string): string {
  return `client-integration-${feature}-${crypto.randomUUID()}`
}

/**
 * Builds a release id unique to this run.
 *
 * Deliberately terser than {@link uniqueDocumentId}, because a release id is not
 * used on its own: a document in a release is stored as
 * `versions.<releaseId>.<documentId>`, and the client rejects any document id
 * over 128 characters. Two descriptive ids joined that way overrun that limit, so
 * the release side is kept compact (the dashes are stripped from the UUID for the
 * same reason) while keeping the collision resistance that matters when several
 * runtimes run this suite concurrently.
 */
export function uniqueReleaseId(): string {
  return `rel${crypto.randomUUID().replace(/-/g, '')}`
}

/**
 * How long to wait for a just-written document to become queryable, and how
 * often to re-check. The 15s ceiling sits well inside this suite's 30s
 * `testTimeout` so that exhausting it reports as "never became visible" rather
 * than as an opaque test timeout, while leaving room for the surrounding
 * create and delete.
 */
const QUERY_VISIBILITY_TIMEOUT_MS = 15_000
const QUERY_VISIBILITY_INTERVAL_MS = 250

/**
 * Re-runs a query until its result shows up, then returns it.
 *
 * Writes to Content Lake are acknowledged before the query index has caught
 * up: `create()` can resolve, and the document be readable through the `/doc`
 * endpoint, while a GROQ query for it still returns nothing. That delay is
 * normally imperceptible, which is exactly what makes it dangerous in a test -
 * it passes locally and fails occasionally in CI. Any test that queries for a
 * document it just wrote has to poll rather than assume.
 *
 * Only absence is retried. Errors from `fetch` propagate immediately: a 401 or
 * a malformed query is never going to resolve by waiting, and retrying would
 * turn a clear failure into a slow one. For the same reason the caller's
 * assertions stay outside this helper, so a wrong value fails at once instead
 * of being re-polled until the deadline.
 *
 * `isVisible` is required rather than defaulted: what counts as "not there
 * yet" differs per query (`null`, an empty array, a missing source map), and
 * guessing wrong would silently return too early and reintroduce the flake.
 */
export async function fetchUntilVisible<T>(
  label: string,
  fetch: () => Promise<T>,
  isVisible: (result: T) => boolean,
): Promise<T> {
  const startedAt = Date.now()
  let attempts = 0

  for (;;) {
    const result = await fetch()
    attempts++
    if (isVisible(result)) {
      return result
    }

    const elapsed = Date.now() - startedAt
    if (elapsed + QUERY_VISIBILITY_INTERVAL_MS >= QUERY_VISIBILITY_TIMEOUT_MS) {
      throw new Error(
        `${label} never became queryable: still not visible after ${attempts} attempts over ` +
          `${elapsed}ms. The document was written successfully, so either the query index is ` +
          `lagging far beyond ${QUERY_VISIBILITY_TIMEOUT_MS}ms or the query does not match it.`,
      )
    }

    await new Promise((resolve) => setTimeout(resolve, QUERY_VISIBILITY_INTERVAL_MS))
  }
}

/**
 * Creates a client for the integration smoke suite, reading the token from
 * `SANITY_INTEGRATION_TOKEN`.
 *
 * Throws immediately if the variable is missing, rather than skipping the
 * test: the workflow that runs this suite always provides the secret, so a
 * missing token locally means the suite was invoked without the setup
 * CONTRIBUTING.md describes. That should fail loudly, not quietly report as
 * passing (or, worse, silently skipped).
 */
export function createIntegrationClient(): SanityClient {
  return createClient({projectId, dataset, apiVersion, useCdn: false, token: requireProjectToken()})
}

/**
 * Reads the project token, throwing rather than skipping when it is missing.
 *
 * Shared by every project-scoped factory below, so that all of them fail with
 * the same actionable message instead of a 401 from the API.
 */
function requireProjectToken(): string {
  const token = process.env.SANITY_INTEGRATION_TOKEN
  if (!token) {
    throw new Error(
      'SANITY_INTEGRATION_TOKEN is not set. The integration smoke suite needs an API token for ' +
        'the test project to talk to the real Sanity API. See "Integration smoke tests" in ' +
        'CONTRIBUTING.md for how to create your own token and run this suite locally.',
    )
  }

  return token
}

/**
 * API version Content Releases requires.
 *
 * Probed against the real API rather than guessed: every release action is
 * rejected with `action index 0: not supported for this API version` (HTTP 400)
 * on this suite's pinned `2024-08-01`, and equally on `2024-09-01`,
 * `2024-11-01`, `2025-01-01` and `2025-02-01`. `2025-02-19` is the first dated
 * version that accepts them. Pinned to that exact date rather than moved to
 * `vX`, so releases keep the same determinism the rest of the suite gets from a
 * dated version.
 */
export const releasesApiVersion = '2025-02-19'

/**
 * Creates a client for the releases smoke test, on {@link releasesApiVersion}.
 *
 * Its own factory rather than a parameter on {@link createIntegrationClient},
 * so the version bump and the reason for it stay next to each other, matching
 * how {@link createAgentActionsClient} carries its `vX` requirement.
 */
export function createReleasesClient(): SanityClient {
  return createClient({
    projectId,
    dataset,
    apiVersion: releasesApiVersion,
    useCdn: false,
    token: requireProjectToken(),
  })
}

/**
 * Studio URL the stega smoke test encodes edit links against.
 *
 * Never resolved or fetched: stega encoding only needs a base to build an edit
 * URL from, so an unreachable placeholder keeps the test independent of any
 * deployed Studio.
 */
export const stegaStudioUrl = 'https://example.com/studio'

/**
 * Creates a stega-enabled client, imported from the `@sanity/client/stega`
 * entry point rather than the root one.
 *
 * This covers a second published entry point in the `exports` map, and it is
 * the shortest real path through `src/csm/`: `stega: {enabled: true}` makes
 * `fetch()` request a content source map and then run it through the csm
 * helpers (`resolveEditInfo`, `createEditUrl`, `walkMap`, `jsonPath`) to encode
 * an edit URL into every string in the result. A mocked transport cannot catch
 * a drift in the source map the API produces, which is the input those helpers
 * work from.
 */
export function createStegaClient(): SanityStegaClient {
  return createStegaEnabledClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: requireProjectToken(),
    stega: {enabled: true, studioUrl: stegaStudioUrl},
  })
}

/**
 * Creates a client targeting the organization's Media Library instead of a
 * project dataset, using an organization-scoped token.
 *
 * The point of exercising this for real is that `resource` changes how the
 * client builds every URL (a library host and path rather than a project one).
 * A mocked transport cannot catch a regression there, because the mock is told
 * which URL to expect. Uploading to the library also needs the organization
 * token: the project token every other test uses gets "Insufficient
 * permissions" against the upload endpoint.
 */
export function createMediaLibraryClient(): SanityClient {
  const token = process.env.SANITY_INTEGRATION_ORG_TOKEN
  if (!token) {
    throw new Error(
      'SANITY_INTEGRATION_ORG_TOKEN is not set. The Media Library smoke test needs an ' +
        'organization-scoped token to upload, separate from the project token the rest of the ' +
        'suite uses. See "Integration smoke tests" in CONTRIBUTING.md.',
    )
  }

  return createClient({
    apiVersion,
    useCdn: false,
    token,
    resource: {type: 'media-library', id: mediaLibraryId},
  })
}

/**
 * Creates a client for Agent Actions, which needs two things the rest of this
 * suite does not.
 *
 * First, an organization-scoped token. Agent Actions requires the
 * `sanity.organization/read` grant, which a project token cannot carry however
 * broad its project role, so this reads `SANITY_INTEGRATION_ORG_TOKEN` rather
 * than the project token every other test uses. Kept separate deliberately: the
 * other tests have no business holding organization-wide credentials.
 *
 * Second, `apiVersion: 'vX'`. Agent Actions rejects dated API versions outright
 * ("Agent Actions are only available on apiVersion vX"), so this is the one
 * place the suite departs from its pinned-version rule.
 */
export function createAgentActionsClient(): SanityClient {
  const token = process.env.SANITY_INTEGRATION_ORG_TOKEN
  if (!token) {
    throw new Error(
      'SANITY_INTEGRATION_ORG_TOKEN is not set. The Agent Actions smoke test needs an ' +
        'organization-scoped token, separate from the project token the rest of the suite uses. ' +
        'See "Integration smoke tests" in CONTRIBUTING.md.',
    )
  }

  return createClient({projectId, dataset, apiVersion: 'vX', useCdn: false, token})
}
