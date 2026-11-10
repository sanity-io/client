import {type FetchFunction, isHttpError, type WrappingMiddleware} from 'get-it'

import type {RequestInstrumentation} from '../types'

type FetchResponse = Awaited<ReturnType<FetchFunction>>
type EndResult = {error?: unknown}

/** The content type check the `eventsource` package applies to a response. */
const EVENT_STREAM_CONTENT_TYPE = /^[\t\n\r ]*text\/event-stream[\t\n\r ]*(?:;|$)/i

/**
 * The handlers an instrumentation's `onRequest` returned for one request,
 * wrapped so every call is isolated from the request: an exception is logged
 * instead of failing it. `end` reports at most once, and `headers` is ignored
 * once the request has ended.
 *
 * @internal
 */
export interface SafeRequestObserver {
  headers: (response: {status: number; headers: Headers}) => void
  end: (result: EndResult) => void
}

/**
 * Call `instrumentation.onRequest` for a request that is about to start.
 * Returns `undefined` when it returned no handlers, or threw.
 *
 * @internal
 */
export function observeRequest(
  instrumentation: RequestInstrumentation,
  request: {url: string; method: string},
): SafeRequestObserver | undefined {
  const observer = tryCall(() => instrumentation.onRequest?.(request))
  if (!observer) return undefined
  let ended = false
  return {
    headers: (response) => {
      if (!ended) tryCall(() => observer.onHeaders?.(response))
    },
    end: (result) => {
      if (ended) return
      ended = true
      tryCall(() => observer.onEnd?.(result))
    },
  }
}

/**
 * Transport middleware that observes every attempt of a request whose `meta`
 * carries instrumentations (set by `requestOptions`). It must sit directly
 * inside the retry middleware, so it runs once per attempt.
 *
 * `onRequest` and `onHeaders` come from a wrapped fetch, since the headers have
 * to be reported before the body is read. `onEnd` comes from each attempt
 * settling here, which is the only place that sees get-it's own outcome for
 * it: the body read in full, or its timeout, abort or network error.
 *
 * @internal
 */
export function instrumentRequests(fallbackFetch: FetchFunction): WrappingMiddleware {
  return async (opts, next) => {
    const instrumentations = instrumentationsFrom(opts.meta?.instrumentations)
    if (instrumentations.length === 0) return next(opts)

    const observed = observeFetch(opts.fetch ?? fallbackFetch, instrumentations)
    const response = next({...opts, fetch: observed.fetch})
    // Observe how the attempt settled; the response or error passes through unchanged.
    response.then(
      () => observed.end({}),
      // get-it rejects with an HttpError for an error status only after reading
      // the body, so that attempt still completed.
      (error: unknown) => observed.end(isHttpError(error) ? {} : {error}),
    )
    return response
  }
}

/**
 * Observe the attempts of one EventSource connection (the one behind
 * `listen()`), which does not go through the transport middleware.
 *
 * `instrument` wraps the fetch handed to the EventSource, so each attempt
 * reports `onRequest` and `onHeaders`. `onError` goes on the EventSource's
 * `error` event, which the `eventsource` package fires whenever an attempt
 * ends without the client closing it: the server closed the stream, the stream
 * broke partway, or the connection was rejected. An attempt the client closes
 * ends on its signal's abort instead, since closing fires no event.
 *
 * @internal
 */
export function observeEventSource(instrumentations: RequestInstrumentation[]): {
  instrument: (baseFetch: FetchFunction) => FetchFunction
  onError: (event: Event) => void
} {
  let endCurrent: ((result: EndResult) => void) | undefined

  const instrument =
    (baseFetch: FetchFunction): FetchFunction =>
    async (input, init) => {
      const observed = observeFetch(baseFetch, instrumentations)
      const signal = init?.signal
      function onAbort() {
        end({error: signal?.reason})
      }
      function end(result: EndResult) {
        signal?.removeEventListener('abort', onAbort)
        observed.end(result)
      }
      endCurrent = end
      signal?.addEventListener('abort', onAbort)

      let response: FetchResponse
      try {
        response = await observed.fetch(input, init)
      } catch (error) {
        end({error})
        throw error
      }
      if (signal?.aborted) {
        // A signal that was already aborted when passed in fires no `abort` event.
        end({error: signal.reason})
      } else if (!isEventStream(response)) {
        // The EventSource gives up on this response by closing the connection,
        // which aborts it before the `error` event fires. It is a completed
        // request, so end it here.
        end({})
      }
      return response
    }

  const onError = (event: Event) => {
    // An `error` message the server sends arrives on an open stream and does
    // not end the attempt.
    if ('data' in event) return
    // The package sets `message` only when the attempt failed; a stream the
    // server closed ends without one.
    const message = 'message' in event ? event.message : undefined
    endCurrent?.(message === undefined ? {} : {error: event})
  }

  return {instrument, onError}
}

/**
 * Observe one request with `instrumentations`. The returned `fetch` calls
 * `onRequest` with the final request URL and reports the headers; `end` ends
 * the request for every instrumentation that returned handlers. Both run the
 * instrumentations in order.
 */
function observeFetch(baseFetch: FetchFunction, instrumentations: RequestInstrumentation[]) {
  let observers: SafeRequestObserver[] = []
  const fetch: FetchFunction = async (input, init) => {
    const request = {
      url: input,
      method: (init?.method ?? 'GET').toUpperCase(),
    }
    observers = instrumentations.flatMap((instrumentation) => {
      const observer = observeRequest(instrumentation, request)
      return observer ? [observer] : []
    })
    const response = await baseFetch(input, init)
    observers.forEach((observer) =>
      observer.headers({status: response.status, headers: response.headers}),
    )
    return response
  }
  const end = (result: EndResult) => observers.forEach((observer) => observer.end(result))
  return {fetch, end}
}

/**
 * Whether the EventSource will read this response: a 200 with a body and the
 * `text/event-stream` content type, checked the way the `eventsource` package
 * checks it. It gives up on any other response without reading it.
 */
function isEventStream(response: FetchResponse): boolean {
  const contentType = response.headers.get('content-type') ?? ''
  return (
    response.status === 200 && response.body !== null && EVENT_STREAM_CONTENT_TYPE.test(contentType)
  )
}

function instrumentationsFrom(value: unknown): RequestInstrumentation[] {
  return Array.isArray(value) ? value.filter(isInstrumentation) : []
}

function isInstrumentation(value: unknown): value is RequestInstrumentation {
  return typeof value === 'object' && value !== null
}

/**
 * Call an instrumentation handler. An exception it throws is logged and
 * swallowed, so it never fails the request; the result is then `undefined`.
 */
function tryCall<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch (err) {
    // oxlint-disable-next-line no-console
    console.error(
      new Error('@sanity/client: an instrumentation callback threw an error', {
        cause: err,
      }),
    )
    return undefined
  }
}
