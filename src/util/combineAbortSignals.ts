import {anySignal} from 'any-signal'

/**
 * Returns a signal that aborts as soon as any of `signals` aborts, carrying
 * the `reason` of the signal that fired.
 *
 * Deliberately not `AbortSignal.any`: Safari only shipped it in 17.4, so on
 * Safari 17.0 to 17.3 the first cancellable request would throw
 * `TypeError: AbortSignal.any is not a function`. `any-signal` provides the
 * same semantics on top of a plain `AbortController`, and detaches its
 * listeners from every source signal once one of them fires, so a long-lived
 * caller signal that is reused across many requests does not accumulate a
 * listener per request as long as the combined signal is eventually aborted
 * (which the per-subscription controllers at the call sites guarantee).
 *
 * @internal
 */
export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  return anySignal(signals)
}
