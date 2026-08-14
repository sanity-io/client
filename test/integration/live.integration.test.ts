import {firstValueFrom} from 'rxjs'
import {expect, test} from 'vitest'

import {createIntegrationClient} from './helpers'

/**
 * Smoke test for `client.live.events()` against the real API.
 *
 * Asserts only that the SSE connection opens: the server sends a `welcome`
 * event immediately on connect, so this needs no document and does not
 * depend on other activity in the dataset. `firstValueFrom` unsubscribes as
 * soon as that event arrives. If the connection failed instead, the
 * observable would error and this test would fail via the rejected promise.
 */
test('live.events() connects without erroring', async () => {
  const client = createIntegrationClient()

  const event = await firstValueFrom(client.live.events())

  expect(event.type).toBe('welcome')
})
