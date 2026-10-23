import {
  firstValueFrom,
  from,
  identity,
  map,
  Observable,
  of,
  switchMap,
  take,
  throwError,
  throwIfEmpty,
  timeout,
} from 'rxjs'

import {authFromStaticOptions, type AuthFields, getStaticAuth} from './auth'
import {DEFAULT_REQUEST_TIMEOUT_MS} from './http/requestOptions'
import type {Auth, GetAuthOptions, InitializedClientConfig, ResolvedAuth} from './types'
import {withAbortSignal} from './util/abortSignal'

/*
 * The adapter for a reactive `auth` observable: settling its emissions,
 * waiting for a renewal in progress, and following the latest credential.
 * Kept apart from `./auth`, whose helpers serve static credentials as well
 * and do not depend on RxJS.
 */

/**
 * The config's credential, emitted when it settles: the static value at once,
 * or each promise the reactive `auth` emits once it settles (nothing while a
 * renewal is pending). A newer emission supersedes a
 * still-pending older promise, which is what overlapping refreshes want.
 *
 * @internal
 */
export function settledAuth(config: AuthFields): Observable<Auth> {
  // A static credential is known synchronously; keep it that way so streams
  // on a static config connect in the same tick they always did.
  const source = config.auth
  if (!source) return of(authFromStaticOptions(config.token, config.withCredentials))
  return source.pipe(switchMap((pending) => from(pending)))
}

/**
 * The config's credential as `client.observeAuth()` emits it: every settled
 * credential, as an object (`{}` for anonymous) so it can be destructured.
 * A static config emits once and completes.
 *
 * @internal
 */
export function observeResolvedAuth(config: AuthFields): Observable<ResolvedAuth> {
  return settledAuth(config).pipe(map((auth): ResolvedAuth => auth ?? {}))
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
export function currentAuth(config: AuthFields, timeoutMs?: number): Observable<Auth> {
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
  config: AuthFields,
  signal?: AbortSignal,
  timeoutMs?: number,
): Promise<Auth> {
  const staticAuth = getStaticAuth(config)
  if (staticAuth) return Promise.resolve(staticAuth.value)
  // Not `async`: the promise goes back to the caller as is, so a source that
  // fails synchronously (`EMPTY`, `throwError`) rejects a promise the caller
  // handles in the same tick. Through an `async` function the handler would
  // only attach a microtask later, which some runtimes (workerd) report as an
  // unhandled rejection.
  return firstValueFrom(
    currentAuth(config, timeoutMs).pipe(signal ? withAbortSignal<Auth>(signal) : identity),
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
  config: Pick<InitializedClientConfig, 'auth' | 'token' | 'withCredentials' | 'timeout'>,
  options: GetAuthOptions = {},
): Promise<ResolvedAuth> {
  // The same default deadline requests run under; `timeout: 0` disables it.
  const timeoutMs = config.timeout === undefined ? DEFAULT_REQUEST_TIMEOUT_MS : config.timeout
  const auth = await resolveAuth(config, options.signal, timeoutMs)
  return auth ?? {}
}
