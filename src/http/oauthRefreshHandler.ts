import type {
  InitializedClientConfig,
  OAuthTokenSetup,
  RequestHandler,
  RequestHandlerOptions,
} from '../types'
import {ClientError} from './errors'

/**
 * The single spot deciding "is this token an OAuth setup" — shared by request
 * handler resolution, SSE and asset uploads so the paths can never disagree on
 * what counts as one.
 *
 * @internal
 */
export function getOAuthTokenSetup(
  token: InitializedClientConfig['token'],
): OAuthTokenSetup | undefined {
  return token && typeof token === 'object' ? token : undefined
}

/**
 * Resolve `getToken()` into an `Authorization` header for request paths that
 * bypass the request handler (asset uploads). A pre-existing `Authorization`
 * header (config `headers`) wins, matching the refresh handler's pass-through.
 *
 * @internal
 */
export async function applyOAuthToken(
  setup: OAuthTokenSetup,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  // `new Headers()` gives a case-insensitive lookup over the plain record.
  if (new Headers(headers).has('authorization')) return headers
  return {...headers, Authorization: `Bearer ${await setup.getToken()}`}
}

/**
 * Per-setup memo of single-flight refreshers, keyed on the setup object itself
 * so every path that can refresh (the request handler, SSE reconnects) and
 * every client holding the same setup (clones, `withConfig()` children, the
 * observable twin) share one in-flight refresh. That is a correctness
 * requirement, not an optimisation: OAuth 2.1 refresh tokens are single-use,
 * so two concurrent refreshes would present the same consumed token and trip
 * reuse detection, which can revoke the whole token family.
 */
const refreshers = new WeakMap<OAuthTokenSetup, () => Promise<string>>()

/**
 * The setup's single-flight `refresh()`: concurrent callers share one attempt,
 * and `onAuthError` fires once per attempt, not once per waiting caller. Only
 * dedupes within this process — cross-tab serialisation is the provider's job.
 *
 * @internal
 */
export function getOAuthRefresher(setup: OAuthTokenSetup): () => Promise<string> {
  let refresher = refreshers.get(setup)
  if (!refresher) {
    // `??=` is synchronous, so two refreshes can never start at once.
    let inFlight: Promise<string> | null = null
    refresher = () =>
      (inFlight ??= setup
        .refresh()
        .catch((error) => {
          setup.onAuthError?.(error)
          throw error
        })
        .finally(() => {
          inFlight = null
        }))
    refreshers.set(setup, refresher)
  }
  return refresher
}

/**
 * 401 handling for paths that can't safely retry — uploads, where a
 * `NodeJS.ReadableStream` body is consumed by the first attempt. Refreshes so
 * `onAuthError` can fire on an unrecoverable refresh and a caller-level retry
 * gets a fresh token, then rethrows the original error: the caller decides
 * whether its body is replayable, not the client.
 *
 * Mirrors the request handler's re-read guard: no refresh when the token has
 * already moved on since the request was built, or when the `Authorization`
 * header wasn't ours to begin with (explicit-header pass-through).
 *
 * @internal
 */
export async function refreshOnAuthError(
  setup: OAuthTokenSetup,
  sentHeaders: Record<string, string>,
  error: unknown,
): Promise<never> {
  if (error instanceof ClientError && error.statusCode === 401) {
    try {
      if (sentHeaders.Authorization === `Bearer ${await setup.getToken()}`) {
        await getOAuthRefresher(setup)()
      }
    } catch {
      // onAuthError already fired inside the refresher; surface the 401 below.
    }
  }
  throw error
}

/**
 * Resolve the effective request handler for a request. The OAuth refresh
 * handler wraps any user-supplied `requestHandler` (rather than being stored
 * in `config.requestHandler`) so a later `withConfig({requestHandler})` swap
 * can't silently drop auth.
 *
 * Resolved from the live config on every request, so reconfiguring the token
 * via `client.config({token})` / `withConfig({token})` swaps refresh behaviour
 * in or out like any other config change.
 *
 * @internal
 */
export function resolveRequestHandler(
  config: InitializedClientConfig,
): RequestHandler | undefined {
  const setup = getOAuthTokenSetup(config.token)
  if (!setup) return config.requestHandler
  const oauthHandler = createOAuthRefreshHandler(setup)
  const userHandler = config.requestHandler
  if (!userHandler) return oauthHandler
  return (request, next) => oauthHandler(request, (r) => userHandler(r, next))
}

function withToken(request: RequestHandlerOptions, token: string): RequestHandlerOptions {
  // `new Headers()` normalises every `FetchHeaders` shape, so no assertion.
  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return {...request, headers}
}

/**
 * Build the request handler that keeps a client authenticated from an
 * {@link OAuthTokenSetup}: it applies the current token to every request and,
 * on a 401, refreshes and retries once.
 *
 * On a 401 it re-reads the token before refreshing: if another request — or
 * another tab, via the provider's storage — already refreshed, it retries with
 * the current token instead of rotating a still-valid refresh token again.
 */
function createOAuthRefreshHandler(setup: OAuthTokenSetup): RequestHandler {
  const refreshOnce = getOAuthRefresher(setup)

  return async function oauthRefreshHandler(request, next) {
    // An explicit `Authorization` header (a per-request `token` override or a
    // config `headers` entry) wins: pass through, with no refresh semantics —
    // a 401 against a token this handler didn't supply isn't its to fix.
    if (new Headers(request.headers).has('authorization')) return next(request)

    const token = await setup.getToken()
    try {
      return await next(withToken(request, token))
    } catch (error) {
      if (!(error instanceof ClientError) || error.statusCode !== 401) throw error

      // Refresh only if the current token is still the one that just failed;
      // otherwise someone already refreshed and we retry with what's current.
      let nextToken = await setup.getToken()
      if (nextToken === token) {
        try {
          nextToken = await refreshOnce()
        } catch {
          // onAuthError already fired inside refreshOnce. Surface the 401, the
          // error the caller's request produced, not the refresh failure.
          throw error
        }
      }

      // A logged-out provider yields no token; don't retry with an empty bearer.
      if (!nextToken) throw error

      // Retry once. A second 401 with a fresh token is a real authz failure.
      return next(withToken(request, nextToken))
    }
  }
}
