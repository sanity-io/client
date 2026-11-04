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
 * Wrap `baseFetch` for a streaming connection (the EventSource behind
 * `listen()`), which does not go through the transport middleware. The
 * request ends when the body stream closes, errors or is cancelled, or when the
 * request's signal aborts. A response the EventSource gives up on without
 * reading it (see `isEventStream`) ends as soon as its headers arrive, as a
 * completed request.
 *
 * @internal
 */
export function instrumentStreamFetch(
  baseFetch: FetchFunction,
  instrumentations: RequestInstrumentation[],
): FetchFunction {
  return async (input, init) => {
    const observed = observeFetch(baseFetch, instrumentations)
    const signal = init?.signal
    function onAbort() {
      end({error: signal?.reason})
    }
    function end(result: EndResult) {
      signal?.removeEventListener('abort', onAbort)
      observed.end(result)
    }
    signal?.addEventListener('abort', onAbort)

    let response: FetchResponse
    try {
      response = await observed.fetch(input, init)
    } catch (error) {
      end({error})
      throw error
    }
    // A signal that was already aborted when passed in fires no `abort` event.
    if (signal?.aborted) {
      end({error: signal.reason})
      return response
    }
    if (!isEventStream(response)) {
      end({})
      return response
    }
    // Only pipe a body this runtime's own streams can pipe. Another
    // implementation's stream (a polyfill, say) is passed through untouched, and
    // its attempt then ends only on abort.
    if (
      typeof TransformStream !== 'function' ||
      typeof ReadableStream !== 'function' ||
      !(response.body instanceof ReadableStream)
    ) {
      return response
    }

    // The EventSource reads the response only through `body`. Piping it through
    // an identity stream reports when it closes (success), or errors or is
    // cancelled by the reader (failure).
    const {readable, writable} = new TransformStream<Uint8Array, Uint8Array>()
    response.body.pipeTo(writable).then(
      () => end({}),
      (error: unknown) => end({error}),
    )
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      url: response.url,
      redirected: response.redirected,
      body: readable,
      // Unusable: the piped body is locked. Present only to satisfy the type.
      text: () => response.text(),
      arrayBuffer: () => response.arrayBuffer(),
    }
  }
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
