import {EventSource, type EventSourceFetchInit} from 'eventsource'
import {defer, Observable, of, switchMap, tap} from 'rxjs'

import {getStaticAuth} from '../auth'
import {resolveAuth, settledAuth} from '../reactiveAuth'
import type {Auth, InitializedClientConfig} from '../types'
import {connectEventSource, type EventSourceEvent} from './eventsource'
import {reconnectOnConnectionFailure} from './reconnectOnConnectionFailure'
import {type EventSourceFetch, resolveEventSourceFetch} from './resolveEventSourceFetch'

/** @internal */
export interface AuthenticatedEventSourceOptions {
  /** Custom headers from the client config. */
  headers?: Record<string, string>
  /**
   * Whether the connection carries the client's credential. When `false`
   * the stream connects anonymously and ignores credential changes.
   */
  withAuth: boolean
  /** Called with the credential each connection attempt is about to send. */
  onSend?: (auth: Auth) => void
}

/**
 * An EventSource connection that follows the client's credential. A static
 * one is sent as is; the rest of this describes a reactive `auth`.
 *
 * Two mechanisms, both needed:
 *
 * - `switchMap` on every credential `config.auth` settles to closes the
 *   current connection and opens a new one, which carries `Last-Event-ID` so the
 *   server resumes after the last event the consumer saw. A successful resume
 *   answers `welcomeback` (listen) and nothing is refetched; a failed one
 *   (position aged out) answers `reset` / `restart` and the consumer's normal
 *   refetch path runs. No `distinctUntilChanged`: the observable decides what
 *   counts as a change, and a cookie-mode re-login is
 *   `{withCredentials: true}` → `{withCredentials: true}`.
 * - The credential each attempt actually sends is resolved inside the fetch
 *   handed to the `eventsource` package, not taken from the value `switchMap`
 *   received, so the package's own reconnects after a network blip send the
 *   credential the observable holds at that moment. When the observable is
 *   withholding (a refresh in flight), the reconnect waits behind it like
 *   every request, cancelled by the abort signal the package passes in `init`.
 *
 * Transient connection failures are retried per credential by
 * `reconnectOnConnectionFailure`. A rejection (4xx, including a 401) errors
 * the stream with a `ConnectionFailedError`, and what to do about it is the
 * consumer's call. An error from `auth` itself ends the stream with that error.
 *
 * @internal
 */
export function connectAuthenticatedEventSource<EventName extends string>(
  config: InitializedClientConfig,
  url: string,
  events: EventName[],
  options: AuthenticatedEventSourceOptions,
): Observable<EventSourceEvent<EventName> | {type: 'reconnect'}> {
  return defer(() => {
    // Per subscription: the resume position belongs to this consumer's stream,
    // and one credential change reconnects every connection on its own.
    let lastEventId: string | undefined
    // Reconnect when a credential settles, never while a renewal is pending:
    // the open connection is still valid until a new credential replaces it.
    // A rejected renewal ends the stream, since the credential behind the
    // connection has failed.
    const auth$: Observable<Auth> = options.withAuth ? settledAuth(config) : of(undefined)
    const transport = resolveEventSourceFetch(config)
    // The credential when it is known without waiting: the static value, or
    // `undefined` for an anonymous connection. Absent for a reactive `auth`,
    // which each attempt resolves on its own.
    const syncAuth = options.withAuth ? getStaticAuth(config) : {value: undefined}

    return auth$.pipe(
      switchMap(() => {
        const send = (
          fetchUrl: string | URL,
          init: EventSourceFetchInit | undefined,
          auth: Auth,
        ) => {
          options.onSend?.(auth)
          return transport(fetchUrl, withAuthAndResume(init, options.headers, auth, lastEventId))
        }
        // A credential known without waiting is sent in the same tick, and the
        // transport's promise is handed to the package as is, exactly as
        // before `auth` existed. Only a reactive credential is awaited.
        const fetch: EventSourceFetch = (fetchUrl, init) =>
          syncAuth
            ? send(fetchUrl, init, syncAuth.value)
            : resolveAuth(config, isAbortSignal(init?.signal) ? init.signal : undefined).then(
                (auth) => send(fetchUrl, init, auth),
              )

        return connectEventSource(() => new EventSource(url, {fetch}), events).pipe(
          reconnectOnConnectionFailure(),
        )
      }),
      tap((event) => {
        if ('id' in event && event.id) {
          lastEventId = event.id
        }
      }),
    )
  })
}

/**
 * The request init for one attempt: the package's own init plus the config's
 * custom `headers`, the credential (a bearer token as `Authorization`, cookie
 * mode as `credentials: 'include'`) and the resume position as
 * `Last-Event-ID`. The credential is applied after the config headers, so the
 * client's token replaces an `Authorization` set there, as it does for
 * requests. The package sets `Last-Event-ID` itself on its own reconnects;
 * that value is kept, and ours only fills the gap on a fresh instance opened
 * after a credential change or a client-driven reconnect.
 */
function withAuthAndResume(
  init: EventSourceFetchInit | undefined,
  configHeaders: Record<string, string> | undefined,
  auth: Auth,
  lastEventId: string | undefined,
): EventSourceFetchInit | undefined {
  if (init === undefined) return init
  const headers: Record<string, string> = {...init.headers}
  for (const [name, value] of Object.entries(configHeaders ?? {})) {
    setHeader(headers, name, value)
  }
  if (auth !== undefined && 'token' in auth) {
    setHeader(headers, 'Authorization', `Bearer ${auth.token}`)
  }
  if (lastEventId && !hasHeader(headers, 'last-event-id')) {
    headers['Last-Event-ID'] = lastEventId
  }
  // The package's `Accept: text/event-stream` wins over any config spelling.
  deleteHeader(headers, 'accept')
  return {
    ...init,
    headers: {...headers, Accept: init.headers.Accept},
    ...(auth !== undefined && 'withCredentials' in auth ? {credentials: 'include'} : {}),
  }
}

/** Set a header, replacing any existing spelling of the same name. */
function setHeader(headers: Record<string, string>, name: string, value: string): void {
  deleteHeader(headers, name)
  headers[name] = value
}

/** Remove every spelling of a header. */
function deleteHeader(headers: Record<string, string>, name: string): void {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key]
  }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === name)
}

/**
 * The `eventsource` package types the signal it passes as `any` (polyfills
 * disagree on the shape), and realms differ on `AbortSignal` identity, so
 * narrow structurally.
 */
function isAbortSignal(value: unknown): value is AbortSignal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'aborted' in value &&
    'addEventListener' in value &&
    typeof value.addEventListener === 'function'
  )
}
