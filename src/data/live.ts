import {catchError, concat, EMPTY, mergeMap, Observable, of} from 'rxjs'
import {map} from 'rxjs/operators'

import {CorsOriginError} from '../http/errors'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  LiveEventMessage,
  LiveEventReconnect,
  LiveEventRestart,
  LiveEventWelcome,
  SyncTag,
} from '../types'
import {_getDataUrl} from './dataMethods'
import {connectEventSource} from './eventsource'
import {eventSourcePolyfill} from './eventsourcePolyfill'
import {reconnectOnConnectionFailure} from './reconnectOnConnectionFailure'

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
    const esOptions: EventSourceInit & {headers?: Record<string, string>} = {}
    if (includeDrafts && token) {
      esOptions.headers = {
        Authorization: `Bearer ${token}`,
      }
    }
    if (includeDrafts && withCredentials) {
      esOptions.withCredentials = true
    }

    const initEventSource = () =>
      // use polyfill if there is no global EventSource or if we need to set headers
      (typeof EventSource === 'undefined' || esOptions.headers
        ? eventSourcePolyfill
        : of(EventSource)
      ).pipe(map((EventSource) => new EventSource(url.href, esOptions)))

    const events = connectEventSource(initEventSource, [
      'message',
      'restart',
      'welcome',
      'reconnect',
    ]).pipe(
      reconnectOnConnectionFailure(),
      map((event) => {
        if (event.type === 'message') {
          const {data, ...rest} = event
          // Splat data properties from the eventsource message onto the returned event
          return {...rest, tags: (data as {tags: SyncTag[]}).tags} as LiveEventMessage
        }
        return event as LiveEventRestart | LiveEventReconnect | LiveEventWelcome
      }),
    )

    // Detect if CORS is allowed, the way the CORS is checked supports preflight caching, so when the EventSource boots up it knows it sees the preflight was already made and we're good to go
    const checkCors = fetchObservable(url, {
      method: 'OPTIONS',
      mode: 'cors',
      credentials: esOptions.withCredentials ? 'include' : 'omit',
      headers: esOptions.headers,
    }).pipe(
      mergeMap(() => EMPTY),
      catchError(() => {
        // If the request fails, then we assume it was due to CORS, and we rethrow a special error that allows special handling in userland
        throw new CorsOriginError({projectId: projectId!})
      }),
    )
    return concat(checkCors, events)
  }
}

function fetchObservable(url: URL, init: RequestInit) {
  return new Observable((observer) => {
    const controller = new AbortController()
    const signal = controller.signal
    fetch(url, {...init, signal: controller.signal}).then(
      (response) => {
        observer.next(response)
        observer.complete()
      },
      (err) => {
        if (!signal.aborted) {
          observer.error(err)
        }
      },
    )
    return () => controller.abort()
  })
}
