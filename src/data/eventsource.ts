import type {ErrorEvent, EventSourceConstructor} from 'eventsource'
import {defer, isObservable, mergeMap, Observable, of} from 'rxjs'

import {formatQueryParseError, isQueryParseError} from '../http/errors'
import {isRecord} from '../util/isRecord'

/**
 * Thrown when the EventSource connection could not be established, or was rejected by the server.
 * Transient failures (network drops, 5xx, 408, 429) are reconnected internally and emitted as
 * `reconnect` events; a permanent rejection (any other 4xx, eg an expired token) errors the
 * stream with this class so consumers can react — check `status` for the rejection code.
 *
 * @public
 */
export class ConnectionFailedError extends Error {
  readonly name = 'ConnectionFailedError'
  /**
   * HTTP status code of the rejected connection attempt, if known.
   * Only set when the EventSource implementation exposes it — the `eventsource`
   * package used by the client does (as `code` on its error events), while
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
 * The listener has been told to explicitly disconnect.
 * This is a rare situation, but may occur if the API knows reconnect attempts will fail,
 * eg in the case of a deleted dataset, a blocked project or similar events.
 *
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
 * The server sent a `channelError` message. Usually indicative of a bad or malformed request
 *
 * @public
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
 * The server sent an `error`-event to tell the client that an unexpected error has happened.
 *
 * @public
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
 * An error occurred while parsing the message sent by the server as JSON. Should normally not happen.
 *
 * @public
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
 * @internal
 */
export type EventSourceEvent<Name extends string> = ServerSentEvent<Name>

/**
 * @internal
 */
export type EventSourceInstance = InstanceType<EventSourceConstructor>

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
  }).pipe(mergeMap((es) => connectWithESInstance(es, events)))
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
    // Events actually requested by the caller. Backs `isRequestedEvent`, the type
    // guard used below to narrow plain strings (eg `message.type`) to `EventTypeName`
    // without a cast.
    const requestedEvents = new Set<string>(events)
    const isRequestedEvent = (type: string): type is EventTypeName => requestedEvents.has(type)
    const emitOpen = isRequestedEvent('open')

    // EventSource will emit a regular Event if it fails to connect, however the API may also emit an `error` MessageEvent
    // So we need to handle both cases
    function onError(evt: ErrorEvent | MessageEvent) {
      // If the event has a `data` property, then it`s a MessageEvent emitted by the API and we should forward the error
      if ('data' in evt) {
        const [parseError, event] = parseEvent(evt)
        observer.error(
          parseError || !event
            ? new MessageParseError('Unable to parse EventSource error message', {
                cause: parseError,
              })
            : new MessageError(
                isRecord(event.data) && typeof event.data.message === 'string'
                  ? event.data.message
                  : '',
                event,
              ),
        )
        return
      }

      // We should never be in a disconnected state. By default, EventSource will reconnect
      // automatically, but in some cases (like when a laptop lid is closed), it will trigger onError
      // if it can't reconnect.
      // see https://html.spec.whatwg.org/multipage/server-sent-events.html#sse-processing-model
      // The `eventsource` package exposes the HTTP status of a rejected connection as
      // `code` on the error event (native EventSource implementations expose nothing).
      // A status means the server rejected the connection attempt, so error out
      // regardless of readyState — implementations disagree on whether the connection
      // closes before or after the error event is dispatched — and let
      // `reconnectOnConnectionFailure` classify it (4xx fatal, otherwise retried).
      if (evt.code !== undefined) {
        observer.error(
          new ConnectionFailedError('EventSource connection failed', {status: evt.code}),
        )
        return
      }

      if (es.readyState === es.CLOSED) {
        // In these cases we'll signal to consumers (via the error path) that a retry/reconnect is needed.
        observer.error(new ConnectionFailedError('EventSource connection failed'))
      } else {
        const type = 'reconnect'
        if (isRequestedEvent(type)) {
          observer.next({type})
        }
      }
    }

    function onOpen() {
      // The open event of the EventSource API is fired when a connection with an event source is opened.
      const type = 'open'
      if (isRequestedEvent(type)) {
        observer.next({type})
      }
    }

    function onMessage(message: MessageEvent) {
      const [parseError, event] = parseEvent(message)
      if (parseError || !event) {
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
              (isRecord(event.data) &&
                typeof event.data.reason === 'string' &&
                event.data.reason) ||
              'unknown error'
            }`,
          ),
        )
        return
      }
      // `onMessage` is only ever registered for `REQUIRED_EVENTS` (handled above, and always
      // returned from before reaching here) and the caller-requested `events` (see
      // `cleanedEvents` below), so `message.type` is guaranteed to be a requested event here.
      if (isRequestedEvent(message.type)) {
        observer.next({
          type: message.type,
          id: message.lastEventId,
          ...(event.data ? {data: event.data} : {}),
        })
      }
    }

    es.addEventListener('error', onError)

    if (emitOpen) {
      es.addEventListener('open', onOpen)
    }

    // Make sure we have a unique list of events types to avoid listening multiple times,
    const cleanedEvents = [...new Set([...REQUIRED_EVENTS, ...events])]
      // filter out events that are handled separately
      .filter((type) => type !== 'error' && type !== 'open' && type !== 'reconnect')

    cleanedEvents.forEach((type: string) => es.addEventListener(type, onMessage))

    return () => {
      es.removeEventListener('error', onError)
      if (emitOpen) {
        es.removeEventListener('open', onOpen)
      }
      cleanedEvents.forEach((type: string) => es.removeEventListener(type, onMessage))
      es.close()
    }
  })
}

function parseEvent(
  message: MessageEvent,
): [null, {type: string; id: string; data?: unknown}] | [unknown, null] {
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
    return [err, null]
  }
}

function extractErrorMessage(err: unknown, tag?: string | null): string {
  const error = isRecord(err) ? err.error : undefined

  if (!error) {
    const message = isRecord(err) ? err.message : undefined
    return (typeof message === 'string' && message) || 'Unknown listener error'
  }

  if (isRecord(error)) {
    if (isQueryParseError(error)) {
      return formatQueryParseError(error, tag)
    }

    if (typeof error.description === 'string') {
      return error.description
    }
  }

  return typeof error === 'string' ? error : JSON.stringify(error, null, 2)
}

function isEmptyObject(data: object) {
  for (const _ in data) {
    return false
  }
  return true
}
