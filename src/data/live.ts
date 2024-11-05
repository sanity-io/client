import {Observable} from 'rxjs'

import {CorsOriginError} from '../http/errors'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  Any,
  LiveEventMessage,
  LiveEventReconnect,
  LiveEventRestart,
  LiveEventWelcome,
} from '../types'
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
  events({
    includeDrafts = false,
    tag: _tag,
  }: {
    /** @alpha this API is experimental and may change or even be removed */
    includeDrafts?: boolean
    /**
     * Optional request tag for the listener. Use to identify the request in logs.
     *
     * @defaultValue `undefined`
     */
    tag?: string
  } = {}): Observable<LiveEventMessage | LiveEventRestart | LiveEventReconnect | LiveEventWelcome> {
    const {
      projectId,
      apiVersion: _apiVersion,
      token,
      withCredentials,
      requestTagPrefix,
    } = this.#client.config()
    const apiVersion = _apiVersion.replace(/^v/, '')
    if (apiVersion !== 'X' && apiVersion < requiredApiVersion) {
      throw new Error(
        `The live events API requires API version ${requiredApiVersion} or later. ` +
          `The current API version is ${apiVersion}. ` +
          `Please update your API version to use this feature.`,
      )
    }
    if (includeDrafts && !token && !withCredentials) {
      throw new Error(
        `The live events API requires a token or withCredentials when 'includeDrafts: true'. Please update your client configuration. The token should have the lowest possible access role.`,
      )
    }
    if (includeDrafts && apiVersion !== 'X') {
      throw new Error(
        `The live events API requires API version X when 'includeDrafts: true'. This API is experimental and may change or even be removed.`,
      )
    }
    const path = _getDataUrl(this.#client, 'live/events')
    const url = new URL(this.#client.getUrl(path, false))
    const tag = _tag && requestTagPrefix ? [requestTagPrefix, _tag].join('.') : _tag
    if (tag) {
      url.searchParams.set('tag', tag)
    }
    if (includeDrafts) {
      url.searchParams.set('includeDrafts', 'true')
    }

    const listenFor = ['restart', 'message', 'welcome', 'reconnect'] as const
    const esOptions: EventSourceInit & {headers?: Record<string, string>} = {}
    if (includeDrafts && token) {
      esOptions.headers = {
        Authorization: `Bearer ${token}`,
      }
    }
    if (includeDrafts && withCredentials) {
      esOptions.withCredentials = true
    }

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
          typeof EventSource === 'undefined' || esOptions.headers || esOptions.withCredentials
            ? ((await import('@sanity/eventsource')).default as unknown as typeof EventSource)
            : EventSource

        // If the listener has been unsubscribed from before we managed to load the module,
        // do not set up the EventSource.
        if (unsubscribed) {
          return
        }

        // Detect if CORS is allowed, the way the CORS is checked supports preflight caching, so when the EventSource boots up it knows it sees the preflight was already made and we're good to go
        try {
          await fetch(url, {
            method: 'OPTIONS',
            mode: 'cors',
            credentials: esOptions.withCredentials ? 'include' : 'omit',
            headers: esOptions.headers,
          })
          if (unsubscribed) {
            return
          }
        } catch {
          // If the request fails, then we assume it was due to CORS, and we rethrow a special error that allows special handling in userland
          throw new CorsOriginError({projectId: projectId!})
        }

        const evs = new EventSourceImplementation(url.toString(), esOptions)
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
