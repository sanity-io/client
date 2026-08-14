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
 *
 * Kept alongside the options test below rather than replaced by it: this is the
 * default, no-argument path, and it is the only one that connects with no
 * `Authorization` header at all, since the client only sends one when
 * `includeDrafts` is set.
 */
test('live.events() connects without erroring', async () => {
  const client = createIntegrationClient()

  const event = await firstValueFrom(client.live.events())

  expect(event.type).toBe('welcome')
})

/**
 * `live.events()` with every option it accepts, on an authenticated client.
 *
 * A different request from the one above, in ways only the real API can judge.
 * `includeDrafts`, `tag` and `waitFor` each add a query parameter, and
 * `includeDrafts` additionally makes the client attach `Authorization: Bearer`
 * to the EventSource connection - the one place in the client where a token
 * travels on an SSE request rather than an HTTP one. Sending an unsupported
 * parameter or a header the endpoint rejects would fail the connection here,
 * while a mocked EventSource would happily accept anything.
 *
 * Probed before writing: `includeDrafts` needs no perspective configuration and
 * no API version beyond the `2021-03-25` floor `live.events()` already enforces,
 * so this runs on the suite's pinned version. The client throws locally if
 * `includeDrafts` is set without a token or `withCredentials`, so the
 * authenticated client is a requirement, not a preference.
 *
 * Still asserts only `welcome`: message events depend on other writes in the
 * dataset, and `waitFor: 'function'` gates those behind a Sanity Function
 * callback this project has none of. The `welcome` frame arrives before any of
 * that, which is what keeps this deterministic.
 */
test('live.events() connects with includeDrafts, tag and waitFor on an authenticated client', async () => {
  const client = createIntegrationClient()

  const event = await firstValueFrom(
    client.live.events({includeDrafts: true, tag: 'integration.live', waitFor: 'function'}),
  )

  expect(event.type).toBe('welcome')
})
