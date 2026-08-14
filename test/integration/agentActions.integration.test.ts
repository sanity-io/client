import {expect, test} from 'vitest'

import {createAgentActionsClient} from './helpers'

/**
 * Agent Actions smoke test.
 *
 * One call, deliberately. Every run costs real inference, so this checks that
 * the round trip works and stops there: an organization-scoped token is
 * accepted, the `vX` requirement is satisfied, the request reaches the Agent
 * Actions endpoint, and a response comes back parsed as the declared type.
 *
 * The assertion is on shape, not content. Asking an LLM to reply with an exact
 * word and then asserting that word would make this test flake on model
 * nondeterminism, which is the opposite of what a smoke test is for.
 */
test('a prompt action returns a string response', async () => {
  const client = createAgentActionsClient()

  const response = await client.agent.action.prompt({
    instruction: 'Reply with a single short word.',
    format: 'string',
  })

  expect(typeof response).toBe('string')
  expect(response.length).toBeGreaterThan(0)
}, 60_000)
