import {ChannelError} from '@sanity/client'
import {firstValueFrom, throwError, timeout} from 'rxjs'
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

/**
 * The error path of `client.listen()`: an invalid query.
 *
 * This surfaces completely differently from `client.fetch()`'s error path, which
 * is the reason it is worth a real request. The listen endpoint accepts the
 * connection and returns HTTP 200, then reports the parse failure as a
 * server-sent `error` event on the open stream. So there is no `ClientError` and
 * no status code: `connectEventSource()` has to recognise that frame and turn it
 * into an observable error, a `ChannelError` carrying the raw event in `data`.
 * Nothing about that mapping is visible to a mocked transport, which is handed
 * the frame it expects.
 *
 * The `timeout` matters as much as the assertion. If a regression made the
 * client swallow the `error` frame, the observable would simply never emit, and
 * without this the test would sit on the open connection until the suite's 60s
 * `testTimeout` and report as an opaque hang rather than as "no error arrived".
 */
test('listen() surfaces an invalid query as a ChannelError on the observable', async () => {
  const client = createIntegrationClient()

  let error: unknown
  try {
    await firstValueFrom(
      client.listen('*[_type == ').pipe(
        timeout({
          first: 15_000,
          with: () =>
            throwError(
              () =>
                new Error(
                  'listen() with an invalid query neither emitted nor errored within 15s. The ' +
                    'server reports a query parse error as an SSE `error` frame, so the ' +
                    'observable should have errored with a ChannelError.',
                ),
            ),
        }),
      ),
    )
  } catch (err) {
    error = err
  }

  if (!(error instanceof ChannelError)) {
    throw error ?? new Error('Expected listen() with an invalid query to error, but it emitted')
  }

  expect(error.message).toMatch(/GROQ query parse error/)
})
