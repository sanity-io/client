import {catchError, mergeMap, Observable, of} from 'rxjs'
import {finalize, map} from 'rxjs/operators'

import {CorsOriginError} from '../http/errors'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  LiveEvent,
  LiveEventGoAway,
  LiveEventMessage,
  LiveEventReconnect,
  LiveEventRestart,
  LiveEventWelcome,
  SyncTag,
} from '../types'
import {shareReplayLatest} from '../util/shareReplayLatest'
import * as validate from '../validators'
import {_getDataUrl} from './dataMethods'
import {connectEventSource} from './eventsource'
import {eventSourcePolyfill} from './eventsourcePolyfill'
import {reconnectOnConnectionFailure} from './reconnectOnConnectionFailure'

const requiredApiVersion = '2021-03-25'

/**
 * @public
 */
export class LiveClient {
  #client: SanityClient | ObservableSanityClient
  constructor(client: SanityClient | ObservableSanityClient) {
    this.#client = client
  }

  /**
   * Requires `apiVersion` to be `2021-03-25` or later.
   */
  events({
    includeDrafts = false,
    tag: _tag,
  }: {
    includeDrafts?: boolean
    /**
     * Optional request tag for the listener. Use to identify the request in logs.
     *
     * @defaultValue `undefined`
     */
    tag?: string
  } = {}): Observable<LiveEvent> {
    validate.resourceGuard('live', this.#client.config())
    const {
      projectId,
      apiVersion: _apiVersion,
      token,
      withCredentials,
      requestTagPrefix,
      headers: configHeaders,
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
    if (includeDrafts && withCredentials) {
      esOptions.withCredentials = true
    }

    if ((includeDrafts && token) || configHeaders) {
      esOptions.headers = {}

      if (includeDrafts && token) {
        esOptions.headers.Authorization = `Bearer ${token}`
      }

      if (configHeaders) {
        Object.assign(esOptions.headers, configHeaders)
      }
    }

    const key = `${url.href}::${JSON.stringify(esOptions)}`
    const existing = eventsCache.get(key)

    if (existing) {
      return existing
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
      'goaway',
    ])

    const checkCors = fetchObservable(url, {
      method: 'OPTIONS',
      mode: 'cors',
      credentials: esOptions.withCredentials ? 'include' : 'omit',
      headers: esOptions.headers,
    }).pipe(
      catchError(() => {
        // If the request fails, then we assume it was due to CORS, and we rethrow a special error that allows special handling in userland
        throw new CorsOriginError({projectId: projectId!})
      }),
    )

    const observable = events
      .pipe(
        reconnectOnConnectionFailure(),
        mergeMap((event) => {
          if (event.type === 'reconnect') {
            // Check for CORS on reconnect events (which happen on 403s)
            return checkCors.pipe(mergeMap(() => of(event)))
          }
          return of(event)
        }),
        catchError((err) => {
          return checkCors.pipe(
            mergeMap(() => {
              // rethrow the original error if checkCors passed
              throw err
            }),
          )
        }),
        map((event) => {
          if (event.type === 'message') {
            const {data, ...rest} = event
            // Splat data properties from the eventsource message onto the returned event
            return {...rest, tags: (data as {tags: SyncTag[]}).tags} as LiveEventMessage
          }
          return event as LiveEventRestart | LiveEventReconnect | LiveEventWelcome | LiveEventGoAway
        }),
      )
      .pipe(
        finalize(() => eventsCache.delete(key)),
        shareReplayLatest({
          predicate: (event) => event.type === 'welcome',
        }),
      )
    eventsCache.set(key, observable)
    return observable
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

const eventsCache = new Map<string, Observable<LiveEvent>>()
