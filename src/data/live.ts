import type {FetchFunction} from 'get-it'
import {catchError, mergeMap, Observable, of, throwError} from 'rxjs'
import {finalize, map} from 'rxjs/operators'

import {getStaticAuth, peekAuth} from '../auth'
import {CorsOriginError} from '../http/errors'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  Auth,
  InitializedClientConfig,
  LiveEvent,
  LiveEventGoAway,
  LiveEventMessage,
  LiveEventReconnect,
  LiveEventRestart,
  LiveEventWelcome,
  SyncTag,
} from '../types'
import {isRecord} from '../util/isRecord'
import {shareReplayLatest} from '../util/shareReplayLatest'
import {connectAuthenticatedEventSource} from './authenticatedEventSource'
import {_getDataUrl} from './dataMethods'
import {pickBaseFetch} from './resolveEventSourceFetch'

const requiredApiVersion = '2021-03-25'

/**
 * @public
 * @inline
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
    const config = this.#client.config()
    const {projectId, apiVersion: _apiVersion, requestTagPrefix, headers: configHeaders} = config
    const apiVersion = _apiVersion.replace(/^v/, '')
    if (apiVersion !== 'X' && apiVersion < requiredApiVersion) {
      throw new Error(
        `The live events API requires API version ${requiredApiVersion} or later. ` +
          `The current API version is ${apiVersion}. ` +
          `Please update your API version to use this feature.`,
      )
    }
    // Only a static config can be checked up front; a reactive `auth` observable
    // is unknown until subscribed, and an anonymous value there surfaces as
    // the server's own rejection.
    const staticAuth = getStaticAuth(config)
    if (includeDrafts && staticAuth !== undefined && staticAuth.value === undefined) {
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
    // Drafts are only visible to authenticated connections, so that is the
    // one case the credential travels on the EventSource request itself.
    const withAuth = Boolean(includeDrafts)
    // Whether the connection being diagnosed sent cookies. Read when the CORS
    // probe runs, not up front: under a reactive `auth` observable the value
    // is only known once a connection has resolved it.
    const sentCredentials = () => {
      if (!withAuth) return false
      const auth = peekAuth(config)
      return auth !== undefined && 'withCredentials' in auth
    }

    // Two clients whose auth is the same static value, or the same reactive
    // observable (by reference), share one stream; a reactive observable is keyed by
    // identity because its value is not knowable here. Anonymous connections
    // (`includeDrafts: false`) share regardless of the client's credential.
    const authKey: Observable<Promise<Auth>> | null =
      withAuth && staticAuth === undefined ? config.auth : null
    const transportCache = getOrCreate(eventsCache, config.resolveFetch, () => new Map())
    const authCache = getOrCreate(transportCache, authKey, () => new Map())
    const cacheKey = JSON.stringify([
      url.href,
      typeof config.proxy === 'string' ? config.proxy : null,
      configHeaders ?? null,
      withAuth ? (staticAuth?.value ?? null) : null,
    ])
    const existing = authCache.get(cacheKey)

    if (existing) {
      return existing
    }

    const events = connectAuthenticatedEventSource(
      config,
      url.href,
      ['message', 'restart', 'welcome', 'reconnect', 'goaway'],
      {headers: configHeaders, withAuth},
    )

    const checkCors = checkCorsObservable(
      new URL(this.#client.getUrl('/check/cors', false)),
      projectId,
      sentCredentials,
      pickBaseFetch(config),
    )

    const observable = events
      .pipe(
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
        finalize(() => {
          authCache.delete(cacheKey)
          if (authCache.size === 0) transportCache.delete(authKey)
          if (transportCache.size === 0) eventsCache.delete(config.resolveFetch)
        }),
        shareReplayLatest({
          predicate: (event) => event.type === 'welcome',
        }),
      )
    authCache.set(cacheKey, observable)
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
  sentCredentials: () => boolean,
  fetcher: FetchFunction,
): Observable<void> {
  return new Observable<void>((observer) => {
    const requireCredentials = sentCredentials()
    const controller = new AbortController()
    const {signal} = controller
    fetcher(url.href, {method: 'GET', credentials: 'omit', signal})
      .then((response) => {
        // Aborted or non-2xx: not a confirmed CORS rejection. Fall through with
        // an undefined body so the next step takes the silent-completion path.
        if (signal.aborted || !response.ok) return undefined
        return response.text()
      })
      .then((text) => {
        if (signal.aborted) return
        // `get-it`'s `FetchResponse` only guarantees `.text()`/`.arrayBuffer()`,
        // not `.json()`, so the body is parsed by hand here. An empty/aborted
        // fall-through (`text === undefined`) and malformed JSON both leave
        // `result` unresolved, taking the same "no signal either way" path.
        const parsed: unknown = text === undefined ? undefined : JSON.parse(text)
        const result = isRecord(parsed) ? parsed.result : undefined
        // Check the credentialed case first: if the EventSource was about to
        // send credentials but the project's CORS config doesn't permit them,
        // the credentialed request would fail with a missing
        // `access-control-allow-credentials` header. Surface this as a CORS
        // rejection with `credentials: true` so the deep-link pre-selects the
        // "Allow credentials" toggle.
        if (requireCredentials && isRecord(result) && result.withCredentials === false) {
          observer.error(new CorsOriginError({projectId, credentials: true}))
          return
        }
        // Generic case: the server actively rejected this origin. Propagate
        // `credentials: requireCredentials` so the deep-link still pre-selects
        // credentials when the caller needed them.
        if (isRecord(result) && result.allowed === false) {
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

/**
 * Cached observables capture their transport (`config.resolveFetch` and
 * `config.proxy`) and, for draft streams, their credential source, so the
 * cache is scoped per resolver (`undefined` covers the `globalThis.fetch`
 * fallback), then per reactive `auth` observable (`null` for static and anonymous
 * connections, whose credential is part of the string key instead).
 */
const eventsCache = new Map<
  InitializedClientConfig['resolveFetch'],
  Map<Observable<Promise<Auth>> | null, Map<string, Observable<LiveEvent>>>
>()

function getOrCreate<K, V>(cache: Map<K, V>, key: K, create: () => V): V {
  const existing = cache.get(key)
  if (existing) return existing
  const created = create()
  cache.set(key, created)
  return created
}
