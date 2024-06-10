import {Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {Any, LiveEventMessage, LiveEventRestart} from '../types'
import {_getDataUrl} from './dataMethods'

const requiredApiVersion = '2021-03-26'

/**
 * @public
 */
export class LiveClient {
  #client: SanityClient | ObservableSanityClient
  constructor(client: SanityClient | ObservableSanityClient) {
    this.#client = client
  }

  /**
   * Requires `apiVersion` to be `2021-03-26` or later.
   */
  events(): Observable<LiveEventMessage | LiveEventRestart> {
    const apiVersion = this.#client.config().apiVersion.replace(/^v/, '')
    if (apiVersion !== 'X' && apiVersion < requiredApiVersion) {
      throw new Error(
        `The live events API requires API version ${requiredApiVersion} or later. ` +
          `The current API version is ${apiVersion}. ` +
          `Please update your API version to use this feature.`,
      )
    }
    const path = _getDataUrl(this.#client, 'live/events')
    const url = new URL(this.#client.getUrl(path, false))

    const listenFor = ['restart', 'message'] as const

    return new Observable((observer) => {
      let es: InstanceType<typeof EventSource> | undefined
      let reconnectTimer: NodeJS.Timeout
      let stopped = false
      // Unsubscribe differs from stopped in that we will never reopen.
      // Once it is`true`, it will never be `false` again.
      let unsubscribed = false

      open()

      // EventSource will emit a regular event if it fails to connect, however the API will emit an `error` MessageEvent if the server goes down
      // So we need to handle both cases
      function onError(evt: MessageEvent | Event) {
        if (stopped) {
          return
        }

        // If the event has a `data` property, then it`s a MessageEvent emitted by the API and we should forward the error and close the connection
        if ('data' in evt) {
          const event = parseEvent(evt)
          observer.error(new Error(event.message, {cause: event}))
        }

        // Unless we've explicitly stopped the ES (in which case `stopped` should be true),
        // we should never be in a disconnected state. By default, EventSource will reconnect
        // automatically, in which case it sets readyState to `CONNECTING`, but in some cases
        // (like when a laptop lid is closed), it closes the connection. In these cases we need
        // to explicitly reconnect.
        if (es!.readyState === es!.CLOSED) {
          unsubscribe()
          clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(open, 100)
        }
      }

      function onMessage(evt: Any) {
        const event = parseEvent(evt)
        return event instanceof Error ? observer.error(event) : observer.next(event)
      }

      function unsubscribe() {
        if (!es) return
        es.removeEventListener('error', onError)
        for (const type of listenFor) {
          es.removeEventListener(type, onMessage)
        }
        es.close()
      }

      async function getEventSource() {
        const EventSourceImplementation: typeof EventSource =
          typeof EventSource === 'undefined'
            ? ((await import('@sanity/eventsource')).default as typeof EventSource)
            : EventSource

        // If the listener has been unsubscribed from before we managed to load the module,
        // do not set up the EventSource.
        if (unsubscribed) {
          return
        }

        const evs = new EventSourceImplementation(url.toString())
        evs.addEventListener('error', onError)
        for (const type of listenFor) {
          evs.addEventListener(type, onMessage)
        }
        return evs
      }

      function open() {
        getEventSource()
          .then((eventSource) => {
            if (eventSource) {
              es = eventSource
              // Handle race condition where the observer is unsubscribed before the EventSource is set up
              if (unsubscribed) {
                unsubscribe()
              }
            }
          })
          .catch((reason) => {
            observer.error(reason)
            stop()
          })
      }

      function stop() {
        stopped = true
        unsubscribe()
        unsubscribed = true
      }

      return stop
    })
  }
}

function parseEvent(event: MessageEvent) {
  try {
    const data = (event.data && JSON.parse(event.data)) || {}
    return {type: event.type, id: event.lastEventId, ...data}
  } catch (err) {
    return err
  }
}
