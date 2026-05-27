import {catchError, mergeMap, Observable, of, throwError} from 'rxjs'
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
      projectId,
      esOptions.withCredentials === true,
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
          // If a prior `reconnect` already ran the CORS probe and produced a
          // `CorsOriginError`, just rethrow it instead of calling `/check/cors`
          // a second time only to get the same answer.
          if (err instanceof CorsOriginError) {
            return throwError(() => err)
          }
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
 * Probes the `/check/cors` endpoint to confirm whether the current origin is
 * allowed by the project's CORS configuration. EventSource failures are opaque,
 * so we use this side-channel purely to tell "the server actively rejected our
 * origin" apart from every other class of failure.
 *
 * Errors with `CorsOriginError` when either:
 *
 * - `requireCredentials` is `true` (the EventSource was about to send
 *   credentials) and `/check/cors` reports `result.withCredentials === false`.
 *   The credentialed request would fail due to a missing
 *   `access-control-allow-credentials` header. The resulting error carries
 *   `credentials: true` so its `addOriginUrl` deep-link pre-selects the
 *   "Allow credentials" toggle in the Sanity management form.
 * - `/check/cors` reports `result.allowed === false` (origin is not on the
 *   project's CORS allow-list). The error carries `credentials: requireCredentials`
 *   so the deep-link still pre-selects credentials when the caller needed them.
 *
 * Every other outcome is intentionally treated as "we don't know": the
 * observable emits a single `void` value and then completes, so downstream
 * `mergeMap(() => ...)` consumers can continue. No error is surfaced for any
 * of these cases:
 *
 * - `allowed: true` (with credentials satisfied if required) or an
 *   unrecognised body shape: the server did not confirm a CORS rejection.
 * - Non-2xx HTTP response from `/check/cors`: same - no signal either way, and
 *   a 5xx on the probe shouldn't poison the EventSource's original error.
 * - `fetch` / network / JSON parse failures: indistinguishable from ordinary
 *   connectivity hiccups (offline, DNS, certs, transient outages). Reporting
 *   those as CORS errors is exactly the false-positive class this helper
 *   exists to prevent.
 * - The subscription was aborted: nothing to emit and nothing to complete.
 *
 * In all of those cases the caller's original underlying error from the
 * EventSource is allowed to propagate unchanged.
 */
function checkCorsObservable(
  url: URL,
  projectId: string | undefined,
  requireCredentials: boolean,
): Observable<void> {
  return new Observable<void>((observer) => {
    const controller = new AbortController()
    const {signal} = controller
    fetch(url, {method: 'GET', mode: 'cors', credentials: 'omit', signal})
      .then((response) => {
        // Aborted or non-2xx: not a confirmed CORS rejection. Fall through with
        // an undefined body so the next step takes the silent-completion path.
        if (signal.aborted || !response.ok) return
        return response.json() as Promise<{
          result?: {allowed?: boolean; withCredentials?: boolean}
        }>
      })
      .then((body) => {
        if (signal.aborted) return
        // Check the credentialed case first: if the EventSource was about to
        // send credentials but the project's CORS config doesn't permit them,
        // the credentialed request would fail with a missing
        // `access-control-allow-credentials` header. Surface this as a CORS
        // rejection with `credentials: true` so the deep-link pre-selects the
        // "Allow credentials" toggle.
        if (requireCredentials && body?.result?.withCredentials === false) {
          observer.error(new CorsOriginError({projectId, credentials: true}))
          return
        }
        // Generic case: the server actively rejected this origin. Propagate
        // `credentials: requireCredentials` so the deep-link still pre-selects
        // credentials when the caller needed them.
        if (body?.result?.allowed === false) {
          observer.error(new CorsOriginError({projectId, credentials: requireCredentials}))
          return
        }
        // Anything else (allowed + credentials satisfied, unrecognised body)
        // is treated as "not a confirmed CORS rejection" - let the caller's
        // original error surface instead.
        observer.next()
        observer.complete()
      })
      // Fetch/network/JSON parse errors are intentionally ignored - see the
      // helper's docblock for the rationale. We still need to settle the
      // observer so downstream `mergeMap(checkCors, ...)` consumers can proceed.
      .catch(() => {
        if (signal.aborted || observer.closed) return
        observer.next()
        observer.complete()
      })
    return () => controller.abort()
  })
}

const eventsCache = new Map<string, Observable<LiveEvent>>()
