import type {FetchRequest} from './http/requestOptions'
import type {Any, Auth, ClientConfig} from './types'

/**
 * Turn the static config options into the `Auth` union. Token mode wins
 * when both are set, matching the credentialed-token warning `initConfig`
 * prints for that combination.
 *
 * @internal
 */
export function authFromStaticOptions(token: unknown, withCredentials: unknown): Auth {
  if (typeof token === 'string' && token) return {token}
  if (withCredentials) return {withCredentials: true}
  return undefined
}

/** The slice of a config the credential helpers read. */
export type AuthFields = Pick<ClientConfig, 'auth' | 'token' | 'withCredentials'>

/**
 * The credential of a static config, read from its `token` / `withCredentials`
 * options; `undefined` for a config with a reactive `auth` observable.
 *
 * @internal
 */
export function getStaticAuth(config: AuthFields): {value: Auth} | undefined {
  return config.auth
    ? undefined
    : {value: authFromStaticOptions(config.token, config.withCredentials)}
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
export function applyAuth(request: FetchRequest, auth: Auth): FetchRequest {
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
