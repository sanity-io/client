import {expect, test} from 'vitest'

import {createIntegrationClient} from './helpers'

/** Narrows an unknown thrown value to something carrying a `name`. */
function hasName(value: unknown): value is {name: string} {
  return typeof value === 'object' && value !== null && 'name' in value
}

/**
 * Smoke test for cancelling a request with an `AbortController`.
 *
 * The reason to do this for real is that abort is not the client's own
 * behaviour: `signal` is threaded through the client into the runtime's `fetch`,
 * and it is the runtime that decides what a cancelled request rejects with. This
 * suite runs on five of them (Node, Bun, Deno, workerd, Vercel Edge), so this is
 * the only place the client's abort plumbing is checked against more than one
 * implementation. What all five agree on, per the DOM standard, is
 * `name === 'AbortError'`; the concrete class is not something to assert across
 * runtimes, so this narrows on `name` rather than on `instanceof DOMException`.
 *
 * Aborts *before* the call rather than after a delay. An already-aborted signal
 * has exactly one possible outcome, whereas `setTimeout(() => abort(), n)` races
 * the network: on a fast connection the request completes first and the test
 * passes for the wrong reason, or fails intermittently in CI. The tradeoff is
 * that this covers the pre-aborted branch only, which is the deterministic half,
 * and mid-flight abort stays hermetic.
 */
test('fetch() rejects with an AbortError when the signal is already aborted', async () => {
  const client = createIntegrationClient()
  const controller = new AbortController()
  controller.abort()

  let error: unknown
  try {
    await client.fetch('*[_id == "no-such-document"][0]', {}, {signal: controller.signal})
  } catch (err) {
    error = err
  }

  if (!hasName(error)) {
    throw error ?? new Error('Expected fetch() with an aborted signal to reject, but it resolved')
  }

  expect(error.name).toBe('AbortError')
})
