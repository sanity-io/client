import {defer, isObservable, mergeMap, Observable, of} from 'rxjs'

import {formatQueryParseError, isQueryParseError} from '../http/errors'
import {type Any} from '../types'

/**
 * @public
 * Thrown when the EventSource connection could not be established, or was rejected by the server.
 * Transient failures (network drops, 5xx, 408, 429) are reconnected internally and emitted as
 * `reconnect` events; a permanent rejection (any other 4xx, eg an expired token) errors the
 * stream with this class so consumers can react — check `status` for the rejection code.
 */
export class ConnectionFailedError extends Error {
  readonly name = 'ConnectionFailedError'
  /**
   * HTTP status code of the rejected connection attempt, if known.
   * Only set when the EventSource implementation exposes it — the polyfill used in
   * Node.js and when custom headers (eg authorization) are required does, while
   * native EventSource implementations (browser and Node.js) do not.
   */
  readonly status?: number
  constructor(message?: string, options: ErrorOptions & {status?: number} = {}) {
    const {status, ...errorOptions} = options
    super(message, errorOptions)
    this.status = status
  }
}

/**
 * @public
 * Thrown when the EventSource connection repeatedly connects successfully, only for the server
 * to end the stream right away.
 *
 * EventSource implementations treat a 200 response with a `text/event-stream` content-type as a
 * successful connection — even when the body is not valid SSE (eg an error payload) — and will
 * reconnect indefinitely when the stream ends. Successful connections also reset the reconnection
 * backoff, so a server that repeatedly accepts the connection and then drops it creates an
 * infinite, tight request loop that never surfaces an error. This error breaks that loop:
 * reconnect handling gives up and the stream errors so consumers can react.
 */
export class ConnectionExhaustedError extends Error {
  readonly name = 'ConnectionExhaustedError'
}

/**
 * The listener has been told to explicitly disconnect.
 *  This is a rare situation, but may occur if the API knows reconnect attempts will fail,
 *  eg in the case of a deleted dataset, a blocked project or similar events.
 * @public
 */
export class DisconnectError extends Error {
  readonly name = 'DisconnectError'
  readonly reason?: string
  constructor(message: string, reason?: string, options: ErrorOptions = {}) {
    super(message, options)
    this.reason = reason
  }
}

/**
 * @public
 * The server sent a `channelError` message. Usually indicative of a bad or malformed request
 */
export class ChannelError extends Error {
  readonly name = 'ChannelError'
  readonly data?: unknown
  constructor(message: string, data: unknown) {
    super(message)
    this.data = data
  }
}

/**
 * @public
 * The server sent an `error`-event to tell the client that an unexpected error has happened.
 */
export class MessageError extends Error {
  readonly name = 'MessageError'
  readonly data?: unknown
  constructor(message: string, data: unknown, options: ErrorOptions = {}) {
    super(message, options)
    this.data = data
  }
}

/**
 * @public
 * An error occurred while parsing the message sent by the server as JSON. Should normally not happen.
 */
export class MessageParseError extends Error {
  readonly name = 'MessageParseError'
}

/**
 * @public
 */
export interface ServerSentEvent<Name extends string> {
  type: Name
  id?: string
  data?: unknown
}

// Always listen for these events, no matter what
const REQUIRED_EVENTS = ['channelError', 'disconnect']

/**
 * A connection that dies within this window of the `open` event without delivering any events is
 * considered "fruitless": the server accepted the request but hung up without serving the stream.
 * Healthy SSE connections are long-lived — surviving past this window, or delivering an event
 * (which proves the server can serve the stream), resets the counter below.
 */
const FRUITLESS_CONNECTION_WINDOW = 1000

/**
 * How many consecutive fruitless connections to tolerate before giving up.
 *
 * EventSource implementations auto-reconnect internally when an established stream ends, and a
 * successful `open` resets their retry backoff — so a server that repeatedly accepts the
 * connection and immediately drops it (eg a 200 `text/event-stream` response carrying an error
 * payload instead of SSE frames) causes an infinite reconnect loop at a constant, tight cadence
 * that never errors. Those internal reconnects never reach RxJS-level retry logic, so the cap
 * must live here, at the EventSource event handlers themselves.
 */
const MAX_CONSECUTIVE_FRUITLESS_CONNECTIONS = 5

/**
 * @internal
 */
export type EventSourceEvent<Name extends string> = ServerSentEvent<Name>

/**
 * @internal
 */
export type EventSourceInstance = InstanceType<typeof globalThis.EventSource>

/**
 * Sanity API specific EventSource handler shared between the listen and live APIs
 *
 * Since the `EventSource` API is not provided by all environments, this function enables custom initialization of the EventSource instance
 * for runtimes that requires polyfilling or custom setup logic (e.g. custom HTTP headers)
 * via the passed `initEventSource` function which must return an EventSource instance.
 *
 * Possible errors to be thrown on the returned observable are:
 * - {@link MessageError}
 * - {@link MessageParseError}
 * - {@link ChannelError}
 * - {@link DisconnectError}
 * - {@link ConnectionFailedError}
 * - {@link ConnectionExhaustedError}
 *
 * @param initEventSource - A function that returns an EventSource instance or an Observable that resolves to an EventSource instance
 * @param events - an array of named events from the API to listen for.
 *
 * @internal
 */
export function connectEventSource<EventName extends string>(
  initEventSource: () => EventSourceInstance | Observable<EventSourceInstance>,
  events: EventName[],
) {
  return defer(() => {
    const es = initEventSource()
    return isObservable(es) ? es : of(es)
  }).pipe(mergeMap((es) => connectWithESInstance(es, events))) as Observable<
    ServerSentEvent<EventName>
  >
}

/**
 * Provides an observable from the passed EventSource instance, subscribing to the passed list of names of events types to listen for
 * Handles connection logic, adding/removing event listeners, payload parsing, error propagation, etc.
 *
 * @param es - The EventSource instance
 * @param events - List of event names to listen for
 */
function connectWithESInstance<EventTypeName extends string>(
  es: EventSourceInstance,
  events: EventTypeName[],
) {
  return new Observable<EventSourceEvent<EventTypeName>>((observer) => {
    const emitOpen = (events as string[]).includes('open')
    const emitReconnect = (events as string[]).includes('reconnect')

    // Tracks when the current connection was established, so that error events can tell a
    // long-lived connection dropping (fine, reconnect) apart from the server hanging up right
    // after accepting the request (fruitless — see MAX_CONSECUTIVE_FRUITLESS_CONNECTIONS).
    // `undefined` means no `open` has happened since the last error, eg the connection attempt
    // failed at the network level — those are not counted, as backing off while offline and
    // recovering when the network returns is exactly what the internal reconnects are for.
    let openedAt: number | undefined
    let consecutiveFruitlessConnections = 0

    // EventSource will emit a regular Event if it fails to connect, however the API may also emit an `error` MessageEvent
    // So we need to handle both cases
    function onError(evt: MessageEvent | Event) {
      // If the event has a `data` property, then it`s a MessageEvent emitted by the API and we should forward the error
      if ('data' in evt) {
        const [parseError, event] = parseEvent(evt as MessageEvent)
        observer.error(
          parseError
            ? new MessageParseError('Unable to parse EventSource error message', {cause: event})
            : new MessageError((event?.data as {message: string}).message, event),
        )
        return
      }

      // We should never be in a disconnected state. By default, EventSource will reconnect
      // automatically, but in some cases (like when a laptop lid is closed), it will trigger onError
      // if it can't reconnect.
      // see https://html.spec.whatwg.org/multipage/server-sent-events.html#sse-processing-model
      // The polyfills expose the HTTP status of a rejected connection on the error event
      // (native EventSource implementations do not). A status means the server rejected the
      // connection attempt, so error out regardless of readyState — the polyfills disagree
      // on whether the connection closes before or after the error event is dispatched —
      // and let `reconnectOnConnectionFailure` classify it (4xx fatal, otherwise retried).
      const rawStatus = (evt as {status?: unknown}).status
      const status = typeof rawStatus === 'number' ? rawStatus : undefined
      if (status !== undefined) {
        observer.error(new ConnectionFailedError('EventSource connection failed', {status}))
        return
      }

      // The connection was established (`open` fired) but died again without delivering any
      // events — classify it. A connection that survived the window is healthy and resets the
      // counter (so does delivering an event, see `onMessage`); one that died right away is
      // fruitless, and too many in a row means the server keeps accepting the request only to
      // drop it (eg an error payload served as 200 `text/event-stream`).
      // The EventSource reconnects internally — invisible to RxJS retry operators — and resets
      // its retry backoff on every successful open, so without this cap such a server is
      // hammered in a tight, infinite loop that never surfaces an error to consumers.
      if (openedAt !== undefined) {
        consecutiveFruitlessConnections =
          Date.now() - openedAt < FRUITLESS_CONNECTION_WINDOW
            ? consecutiveFruitlessConnections + 1
            : 0
        openedAt = undefined
        if (consecutiveFruitlessConnections >= MAX_CONSECUTIVE_FRUITLESS_CONNECTIONS) {
          observer.error(
            new ConnectionExhaustedError(
              `The EventSource connection was repeatedly closed right after being established. Giving up after ${consecutiveFruitlessConnections} consecutive short-lived connections — this usually means the server accepts the request but is unable to serve the event stream.`,
            ),
          )
          return
        }
      }

      if (es.readyState === es.CLOSED) {
        // In these cases we'll signal to consumers (via the error path) that a retry/reconnect is needed.
        observer.error(new ConnectionFailedError('EventSource connection failed'))
      } else if (emitReconnect) {
        observer.next({type: 'reconnect' as EventTypeName})
      }
    }

    function onOpen() {
      openedAt = Date.now()
      if (emitOpen) {
        // The open event of the EventSource API is fired when a connection with an event source is opened.
        observer.next({type: 'open' as EventTypeName})
      }
    }

    function onMessage(message: MessageEvent) {
      // The server delivered an event, proving it can serve the stream — the connection is not
      // fruitless, even if it ends up shorter-lived than the fruitless window (eg a `goaway`
      // followed by a prompt close). Mirrors `reconnectOnConnectionFailure`, which resets its
      // backoff on any delivered event.
      openedAt = undefined
      consecutiveFruitlessConnections = 0

      const [parseError, event] = parseEvent(message)
      if (parseError) {
        observer.error(
          new MessageParseError('Unable to parse EventSource message', {cause: parseError}),
        )
        return
      }
      if (message.type === 'channelError') {
        // An error occurred. This is different from a network-level error (which will be emitted as 'error').
        // Possible causes are things such as malformed filters, non-existant datasets
        // or similar.
        const tag = new URL(es.url).searchParams.get('tag')
        observer.error(new ChannelError(extractErrorMessage(event?.data, tag), event.data))
        return
      }
      if (message.type === 'disconnect') {
        // The listener has been told to explicitly disconnect and not reconnect.
        // This is a rare situation, but may occur if the API knows reconnect attempts will fail,
        // eg in the case of a deleted dataset, a blocked project or similar events.
        observer.error(
          new DisconnectError(
            `Server disconnected client: ${
              (event.data as {reason?: string})?.reason || 'unknown error'
            }`,
          ),
        )
        return
      }
      observer.next({
        type: message.type as EventTypeName,
        id: message.lastEventId,
        ...(event.data ? {data: event.data} : {}),
      })
    }

    es.addEventListener('error', onError)
    // Always observe `open` (not only when the consumer subscribes to it) — the error handler
    // above needs it to detect connections that are repeatedly dropped right after opening.
    es.addEventListener('open', onOpen)

    // Make sure we have a unique list of events types to avoid listening multiple times,
    const cleanedEvents = [...new Set([...REQUIRED_EVENTS, ...events])]
      // filter out events that are handled separately
      .filter((type) => type !== 'error' && type !== 'open' && type !== 'reconnect')

    cleanedEvents.forEach((type: string) => es.addEventListener(type, onMessage))

    return () => {
      es.removeEventListener('error', onError)
      es.removeEventListener('open', onOpen)
      cleanedEvents.forEach((type: string) => es.removeEventListener(type, onMessage))
      es.close()
    }
  })
}

function parseEvent(
  message: MessageEvent,
): [null, {type: string; id: string; data?: unknown}] | [Error, null] {
  try {
    const data = typeof message.data === 'string' && JSON.parse(message.data)
    return [
      null,
      {
        type: message.type,
        id: message.lastEventId,
        ...(isEmptyObject(data) ? {} : {data}),
      },
    ]
  } catch (err) {
    return [err as Error, null]
  }
}

function extractErrorMessage(err: Any, tag?: string | null) {
  const error = err.error

  if (!error) {
    return err.message || 'Unknown listener error'
  }

  if (isQueryParseError(error)) {
    return formatQueryParseError(error, tag)
  }

  if (error.description) {
    return error.description
  }

  return typeof error === 'string' ? error : JSON.stringify(error, null, 2)
}

function isEmptyObject(data: object) {
  for (const _ in data) {
    return false
  }
  return true
}
