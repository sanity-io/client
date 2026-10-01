import {
  firstValueFrom,
  from,
  identity,
  type Observable,
  of,
  switchMap,
  take,
  tap,
  throwError,
  throwIfEmpty,
  timeout,
} from 'rxjs'

import {DEFAULT_REQUEST_TIMEOUT_MS, type FetchRequest} from './http/requestOptions'
import type {Any, AuthState, GetAuthOptions, InitializedClientConfig, ResolvedAuth} from './types'
import {withAbortSignal} from './util/abortSignal'

/**
 * Turn the static config options into the `AuthState` union. Token mode wins
 * when both are set, matching the credentialed-token warning `initConfig`
 * prints for that combination.
 *
 * @internal
 */
export function staticAuthState(token: unknown, withCredentials: unknown): AuthState {
  if (typeof token === 'string' && token) return {token}
  if (withCredentials) return {withCredentials: true}
  return undefined
}

/** The slice of a config the credential helpers read. */
/**
 * Internal bookkeeping that rides on an initialised config as non-enumerable
 * properties, so it never shows in `client.config()` output, a spread, or the
 * public `ClientConfig` type. `auth` is listed so a config is assignable here.
 *
 * @internal
 */
export interface AuthMarkers {
  auth?: Observable<Promise<AuthState>>
  /**
   * Present when `auth` wraps the static `token` / `withCredentials` options:
   * the observable it describes and the value inside it.
   */
  staticAuth?: {source: Observable<Promise<AuthState>>; value: AuthState}
  /**
   * Present for a reactive `auth`: records the last credential a request or
   * stream resolved from it, which backs the deprecated `config().token` read.
   * One object per observable, shared with clients derived via `withConfig`.
   */
  resolvedAuth?: {source: Observable<Promise<AuthState>>; current?: AuthState}
}

/**
 * The markers describing `config.auth`, read off the config's own
 * non-enumerable properties. Each is trusted only while it still points at
 * `config.auth`, so a marker that outlived a swapped observable is ignored.
 *
 * @internal
 */
export function authMarkers(config: AuthMarkers): Pick<AuthMarkers, 'staticAuth' | 'resolvedAuth'> {
  const {auth, staticAuth, resolvedAuth} = config
  return {
    staticAuth: auth !== undefined && staticAuth?.source === auth ? staticAuth : undefined,
    resolvedAuth: auth !== undefined && resolvedAuth?.source === auth ? resolvedAuth : undefined,
  }
}

/**
 * Attach markers to a config as non-enumerable properties. Absent keys are
 * removed, so a config never carries a marker for an observable it no longer
 * holds.
 *
 * @internal
 */
export function defineAuthMarkers(
  config: object,
  markers: Pick<AuthMarkers, 'staticAuth' | 'resolvedAuth'>,
): void {
  for (const key of ['staticAuth', 'resolvedAuth'] as const) {
    const value = markers[key]
    if (value === undefined) {
      Reflect.deleteProperty(config, key)
    } else {
      Object.defineProperty(config, key, {
        value,
        enumerable: false,
        writable: true,
        configurable: true,
      })
    }
  }
}

/**
 * The static credential a config's `auth` wraps, when `initConfig` built it
 * from `token` / `withCredentials`; `undefined` for a caller-supplied reactive
 * observable.
 *
 * @internal
 */
export function getStaticAuth(
  config: AuthMarkers,
): {source: Observable<Promise<AuthState>>; value: AuthState} | undefined {
  return authMarkers(config).staticAuth
}

/**
 * A best-effort synchronous view of the config's current credential: the
 * static value, or the last one a request or stream resolved from a reactive
 * `auth` (`undefined` before the first). For internal readers such as the
 * live CORS probe; the public `config().token` read adds its warning on top.
 *
 * @internal
 */
export function peekAuth(config: AuthMarkers): AuthState {
  const {staticAuth, resolvedAuth} = authMarkers(config)
  return staticAuth !== undefined ? staticAuth.value : resolvedAuth?.current
}

/**
 * Whether two static states are the same credential.
 *
 * @internal
 */
export function isSameAuthState(a: AuthState, b: AuthState): boolean {
  if (a === undefined || b === undefined) return a === b
  if ('token' in a) return 'token' in b && a.token === b.token
  return 'withCredentials' in b
}

/**
 * The config's `auth` with each emitted promise awaited: emits a credential
 * when one settles, and nothing while a renewal is pending; a static config
 * emits its value at once. A newer emission supersedes a still-pending older
 * promise, which is what overlapping refreshes want.
 *
 * @internal
 */
export function settledAuth(config: InitializedClientConfig): Observable<AuthState> {
  // A static credential is known synchronously; keep it that way so streams
  // on a static config connect in the same tick they always did.
  const staticAuth = getStaticAuth(config)
  if (staticAuth) return of(staticAuth.value)
  return config.auth.pipe(switchMap((pending) => from(pending)))
}

/**
 * The current credential: the first value the config's `auth` observable
 * settles to, then complete. Bounded by `timeoutMs` when given: a source that
 * never settles then fails the way a hung request does, with a `TimeoutError`,
 * instead of silently. Unsubscribing tears the wait down at once, so a caller
 * that goes away while a renewal is pending leaves no subscription behind.
 *
 * @internal
 */
export function currentAuth(
  config: InitializedClientConfig,
  timeoutMs?: number,
): Observable<AuthState> {
  const staticAuth = getStaticAuth(config)
  if (staticAuth) return of(staticAuth.value)
  return settledAuth(config).pipe(
    // The request's deadline bounds the wait, with the same `TimeoutError`
    // shape a hung request produces (get-it's `isTimeoutError` recognises it);
    // `0` disables.
    typeof timeoutMs === 'number' && timeoutMs > 0
      ? timeout({
          first: timeoutMs,
          with: () =>
            throwError(
              () =>
                new DOMException(
                  `The \`auth\` observable did not settle on a credential within ${timeoutMs}ms. ` +
                    'It must emit the current credential to every subscriber; a `BehaviorSubject` or `shareReplay(1)` does.',
                  'TimeoutError',
                ),
            ),
        })
      : identity,
    take(1),
    throwIfEmpty(
      () =>
        new Error(
          'The `auth` observable completed without emitting a credential. ' +
            '`auth` must emit the current credential to every subscriber and then every change, and never complete; ' +
            'a `BehaviorSubject` or `shareReplay(1)` satisfies this.',
        ),
    ),
    tap((state) => {
      const {resolvedAuth} = authMarkers(config)
      if (resolvedAuth !== undefined) resolvedAuth.current = state
    }),
  )
}

/**
 * {@link currentAuth} as a promise, for the request pipeline. A static config
 * answers without subscribing. The wait is cancelled by `signal`, so a request
 * aborted while a renewal is pending rejects instead of hanging on it.
 *
 * @internal
 */
export function resolveAuth(
  config: InitializedClientConfig,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<AuthState> {
  const staticAuth = getStaticAuth(config)
  if (staticAuth) return Promise.resolve(staticAuth.value)
  // Not `async`: the promise goes back to the caller as is, so a source that
  // fails synchronously (`EMPTY`, `throwError`) rejects a promise the caller
  // handles in the same tick. Through an `async` function the handler would
  // only attach a microtask later, which some runtimes (workerd) report as an
  // unhandled rejection.
  return firstValueFrom(
    currentAuth(config, timeoutMs).pipe(signal ? withAbortSignal<AuthState>(signal) : identity),
  )
}

/**
 * The credential the client would attach to a request right now, as an
 * object (`{}` for anonymous) so callers can destructure it. Backs
 * `client.getAuth()`: static configs answer at once; a reactive `auth` is
 * awaited, cancelled by `options.signal` and bounded by the client's `timeout`
 * like a request is.
 *
 * @internal
 */
export async function resolveCurrentAuth(
  config: InitializedClientConfig,
  options: GetAuthOptions = {},
): Promise<ResolvedAuth> {
  // The same default deadline requests run under; `timeout: 0` disables it.
  const timeoutMs = config.timeout === undefined ? DEFAULT_REQUEST_TIMEOUT_MS : config.timeout
  const auth = await resolveAuth(config, options.signal, timeoutMs)
  return auth ?? {}
}

/**
 * Whether the request options themselves carry a bearer credential (a
 * `token`, or an `Authorization` header), which replaces the client's `auth`
 * for that one request, whether that is static or reactive. A per-request
 * `withCredentials` is not a replacement: `true` adds cookies alongside
 * whatever the client sends, as it always has, and `false` only keeps cookies
 * off (see `_prepareAuthenticatedRequest`).
 *
 * @internal
 */
export function hasRequestAuth(options: Any): boolean {
  return (
    Boolean(options?.token) ||
    (typeof options?.headers === 'object' &&
      options.headers !== null &&
      hasAuthorizationHeader(options.headers))
  )
}

/**
 * Attach a resolved credential to a request: `Authorization: Bearer …` in
 * token mode (replacing an `Authorization` set through the config-level
 * `headers`, as the static `token` always has), `credentials: 'include'` in
 * cookie mode, nothing when anonymous.
 *
 * @internal
 */
export function applyAuth(request: FetchRequest, auth: AuthState): FetchRequest {
  if (auth === undefined) return request
  if ('token' in auth) {
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(request.headers)) {
      if (name.toLowerCase() !== 'authorization') headers[name] = value
    }
    headers['Authorization'] = `Bearer ${auth.token}`
    return {...request, headers}
  }
  return {...request, credentials: 'include'}
}

function hasAuthorizationHeader(headers: Record<string, unknown>): boolean {
  return Object.keys(headers).some((name) => name.toLowerCase() === 'authorization')
}
