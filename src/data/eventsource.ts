import {defer, isObservable, mergeMap, Observable, of} from 'rxjs'

import {formatQueryParseError, isQueryParseError} from '../http/errors'
import {type Any} from '../types'

/**
 * @public
 * Thrown if the EventSource connection could not be established.
 * Note that ConnectionFailedErrors are rare, and disconnects will normally be handled by the EventSource instance itself and emitted as `reconnect` events.
 */
export class ConnectionFailedError extends Error {
  readonly name = 'ConnectionFailedError'
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
      if (es.readyState === es.CLOSED) {
        // In these cases we'll signal to consumers (via the error path) that a retry/reconnect is needed.
        observer.error(new ConnectionFailedError('EventSource connection failed'))
      } else if (emitReconnect) {
        observer.next({type: 'reconnect' as EventTypeName})
      }
    }

    function onOpen() {
      // The open event of the EventSource API is fired when a connection with an event source is opened.
      observer.next({type: 'open' as EventTypeName})
    }

    function onMessage(message: MessageEvent) {
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
