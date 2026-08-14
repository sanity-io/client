import {expect, test} from 'vitest'

import {createIntegrationClient, dataset} from './helpers'

/**
 * Smoke test for `client.datasets.list()`.
 *
 * This is a management API endpoint, not a Content Lake one: the client builds
 * it against `api.sanity.io` rather than the project's data host, and it is one
 * of the few responses the client hands back as a bare array rather than
 * unwrapping an envelope. A mocked transport is told both of those things, so
 * only a real request can show that the URL still resolves and the body still
 * parses.
 *
 * Asserts membership rather than the list's contents or length: this project's
 * datasets are not this test's to control, and anyone adding one should not
 * break the suite. Creating or deleting a dataset is deliberately out of scope -
 * it is a slow, project-wide side effect with no cheap way to guarantee cleanup.
 */
test('datasets.list() includes the dataset this suite runs against', async () => {
  const client = createIntegrationClient()

  const datasets = await client.datasets.list()

  expect(datasets.map((entry) => entry.name)).toContain(dataset)
})

/**
 * Smoke test for `client.datasets.getEmbeddingsSettings()`.
 *
 * Probed before writing, because the honest expectation was that this would 404
 * for a project with no embeddings configured. It does not: the endpoint
 * responds 200 with a settings object describing the disabled state
 * (`{enabled: false, status: 'disabled'}`), which is what the integration
 * project returns and will keep returning as long as nobody enables embeddings
 * on it.
 *
 * So the assertion is deliberately weaker than that observed body. `enabled`
 * being a boolean is the part that is true either way, and it is enough to prove
 * the request reached the right endpoint and the response parsed. Asserting
 * `enabled: false` would turn "someone enabled embeddings on the CI project"
 * into a client test failure, which tells the reader nothing about the client.
 */
test('datasets.getEmbeddingsSettings() returns the settings for the dataset', async () => {
  const client = createIntegrationClient()

  const settings = await client.datasets.getEmbeddingsSettings(dataset)

  expect(typeof settings.enabled).toBe('boolean')
})
