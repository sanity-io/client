import {expect, test} from 'vitest'

import {createIntegrationClient, projectId} from './helpers'

/**
 * Smoke test for `client.projects.list()` and `client.projects.getById()`.
 *
 * Both are management API endpoints, built against `api.sanity.io` with no
 * project in the host and no dataset in the path - a URL shape nothing else in
 * this suite produces. `getById()` is also the one place a project token's own
 * scope is visible in the response, so a real request is what proves the token
 * reaches the project the rest of the suite assumes it does.
 *
 * One test rather than two: they are the same round trip at two granularities,
 * and reading the project the list just reported is the assertion that ties them
 * together.
 *
 * Asserts membership and identity only. The token used here can see exactly one
 * project today, but asserting a count would break the moment it is granted
 * another, and `displayName` and `members` belong to whoever administers the
 * project, not to this test.
 */
test('projects.list() includes this project, and getById() returns it', async () => {
  const client = createIntegrationClient()

  const projects = await client.projects.list()
  expect(projects.map((project) => project.id)).toContain(projectId)

  const project = await client.projects.getById(projectId)
  expect(project.id).toBe(projectId)
  expect(project.displayName).toEqual(expect.any(String))
})
