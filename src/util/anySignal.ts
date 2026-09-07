/**
 * `AbortSignal.any` ponyfill. Uses the native static where it exists and
 * falls back to a plain `AbortController` on Safari 17.0-17.3, which lack it.
 *
 * To be replaced by `get-it/any-signal` once get-it publishes it.
 *
 * @internal
 */
export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals)

  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
  }
  const onAbort = () => {
    controller.abort(signals.find((signal) => signal.aborted)?.reason)
    for (const signal of signals) signal.removeEventListener('abort', onAbort)
  }
  for (const signal of signals) signal.addEventListener('abort', onAbort)
  return controller.signal
}
