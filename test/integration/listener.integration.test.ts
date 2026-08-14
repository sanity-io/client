import {firstValueFrom} from 'rxjs'
import {expect, test} from 'vitest'

import {createIntegrationClient, smokeDocumentType} from './helpers'

/**
 * Smoke test for `client.listen()` against the real API.
 *
 * Asserts only that the SSE connection opens: the server sends a `welcome`
 * event immediately on connect, before evaluating the query against any
 * data, so this needs no document and does not depend on other activity in
 * the dataset. `firstValueFrom` unsubscribes as soon as that event arrives.
 * If the connection failed instead, the observable would error and this
 * test would fail via the rejected promise.
 */
test('listen() connects over SSE without erroring', async () => {
  const client = createIntegrationClient()

  const event = await firstValueFrom(
    client.listen(`*[_type == "${smokeDocumentType}"]`, {}, {events: ['welcome']}),
  )

  expect(event.type).toBe('welcome')
})
