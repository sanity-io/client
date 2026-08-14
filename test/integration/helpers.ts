// Shared setup for the integration smoke suite. See CONTRIBUTING.md,
// "Integration smoke tests", for what this suite is for and how to run it.
//
// Deliberately does not import anything from `test/helpers/`: those helpers
// (mockFetch, setupMockFetch) exist to fake the transport, which is exactly
// what this suite must not do.
import {createClient} from '@sanity/client'
import type {SanityClient} from '@sanity/client'

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
  const token = process.env.SANITY_INTEGRATION_TOKEN
  if (!token) {
    throw new Error(
      'SANITY_INTEGRATION_TOKEN is not set. The integration smoke suite needs an API token for ' +
        'the test project to talk to the real Sanity API. See "Integration smoke tests" in ' +
        'CONTRIBUTING.md for how to create your own token and run this suite locally.',
    )
  }

  return createClient({projectId, dataset, apiVersion, useCdn: false, token})
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
