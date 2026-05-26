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
    waitFor,
  }: {
    includeDrafts?: boolean
    /**
     * Optional request tag for the listener. Use to identify the request in logs.
     *
     * @defaultValue `undefined`
     */
    tag?: string
    /**
     * Delays events until after a Sanity Function has processed them and called the callback endpoint.
     * When omitted, events are delivered immediately.
     */
    waitFor?: 'function'
  } = {}): Observable<LiveEvent> {
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
    if (waitFor) {
      url.searchParams.set('waitFor', waitFor)
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

    const checkCors = checkCorsObservable(
      new URL(this.#client.getUrl('/check/cors', false)),
      projectId!,
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

/**
 * Probes the `/check/cors` endpoint to verify whether the current
 * origin is allowed by the project's CORS configuration. The endpoint responds
 * with `{result: {allowed: boolean, withCredentials: boolean}}`; we only inspect
 * `result.allowed` (the live events API does not require credentials).
 *
 * - Emits `true` and completes when the server reports `allowed: true` (or
 *   returns an unrecognised shape).
 * - Emits `true` and completes when the request itself fails (network error,
 *   non-2xx status, malformed JSON, etc.) so callers don't misreport unrelated
 *   failures as CORS errors.
 * - Errors with `CorsOriginError` only when the server explicitly reports
 *   `allowed: false`.
 */
function checkCorsObservable(url: URL, projectId: string): Observable<true> {
  return new Observable<true>((observer) => {
    const controller = new AbortController()
    const signal = controller.signal
    fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal,
    })
      .then((response) => response.json() as Promise<{result?: {allowed?: boolean}}>)
      .then((body) => {
        if (body?.result?.allowed === false) {
          throw new CorsOriginError({projectId})
        }
        observer.next(true)
        observer.complete()
      })
      .catch((err) => {
        if (signal.aborted) return
        if (err instanceof CorsOriginError) {
          observer.error(err)
          return
        }
        observer.next(true)
        observer.complete()
      })
    return () => controller.abort()
  })
}

const eventsCache = new Map<string, Observable<LiveEvent>>()
