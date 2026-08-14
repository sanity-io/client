import {expect, test} from 'vitest'

import {createIntegrationClient} from './helpers'

/**
 * Smoke test for `client.users.getById('me')`.
 *
 * `'me'` is not just a convenient id: it is resolved server-side from the token
 * on the request, and the client's overload types it as `CurrentSanityUser`
 * rather than `SanityUser` for exactly that reason. So this is the cheapest real
 * check that the token is being sent, accepted, and attributed to an identity -
 * a mocked transport can only confirm the URL was built, never that the
 * credential works.
 *
 * Asserts the identity fields exist and are strings, not their values: the
 * token's owner differs between CI and any developer running this locally, and
 * asserting an email or a name would make the test fail for the wrong person
 * rather than for a client regression.
 */
test("users.getById('me') resolves the token's own user", async () => {
  const client = createIntegrationClient()

  const user = await client.users.getById('me')

  expect(user.id).toEqual(expect.any(String))
  expect(user.id).not.toBe('')
  expect(user.name).toEqual(expect.any(String))
})
