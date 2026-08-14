// Shared setup for the integration smoke suite. See CONTRIBUTING.md,
// "Integration smoke tests", for what this suite is for and how to run it.
//
// Deliberately does not import anything from `test/helpers/`: those helpers
// (mockFetch, setupMockFetch) exist to fake the transport, which is exactly
// what this suite must not do.
import {createClient} from '@sanity/client'
import type {SanityClient} from '@sanity/client'

/** Private project provisioned for this suite. Holds only system documents, no user content. */
export const projectId = 'ab2gqfft'
export const dataset = 'test'

/**
 * Pinned and dated, not `vX`: keeps results deterministic across runs rather
 * than tracking "whatever the API considers current" the day the suite
 * happens to run. Combined with `useCdn: false` below, that also rules out
 * CDN lag as a source of flake. `2021-03-25` or later is required by
 * `client.live.events()`; none of the six features this suite covers need
 * `vX`.
 */
export const apiVersion = '2024-08-01'

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
