import {type Observable, of} from 'rxjs'

import {
  authMarkers,
  defineAuthMarkers,
  getStaticAuth,
  isSameAuth,
  peekAuth,
  authFromStaticOptions,
} from './auth'
import {generateHelpUrl} from './generateHelpUrl'
import type {Auth, ClientConfig, ClientPerspective, InitializedClientConfig} from './types'
import * as validate from './validators'
import * as warnings from './warnings'

const defaultCdnHost = 'apicdn.sanity.io'
export const defaultConfig = {
  apiHost: 'https://api.sanity.io',
  apiVersion: '1',
  useProjectHostname: true,
  stega: {enabled: false},
} satisfies ClientConfig

const LOCALHOSTS = ['localhost', '127.0.0.1', '0.0.0.0']
const isLocal = (host: string) => LOCALHOSTS.indexOf(host) !== -1

function validateApiVersion(apiVersion: string) {
  if (apiVersion === '1' || apiVersion === 'X') {
    return
  }

  const apiDate = new Date(apiVersion)
  const apiVersionValid =
    /^\d{4}-\d{2}-\d{2}$/.test(apiVersion) && apiDate instanceof Date && apiDate.getTime() > 0

  if (!apiVersionValid) {
    throw new Error('Invalid API version string, expected `1` or date in format `YYYY-MM-DD`')
  }
}

/**
 * @internal - it may have breaking changes in any release
 */
export function validateApiPerspective(
  perspective: unknown,
): asserts perspective is ClientPerspective {
  if (Array.isArray(perspective) && perspective.length > 1 && perspective.includes('raw')) {
    throw new TypeError(
      `Invalid API perspective value: "raw". The raw-perspective can not be combined with other perspectives`,
    )
  }
}

/**
 * Whether `key` is an own, enumerable property of `obj`. Enumerable only, so the
 * non-enumerable `token` / `withCredentials` getters `exposeConfig` adds under a
 * reactive `auth` do not count as a static credential when a `client.config()`
 * result is passed back in without being spread.
 */
const hasOwn = (obj: object, key: string) => Object.prototype.propertyIsEnumerable.call(obj, key)

/**
 * Whether `config` carries a caller-supplied reactive `auth` observable of its
 * own. The observables `initConfig` wraps the static options in do not count:
 * they travel alongside the `token` / `withCredentials` they were built from
 * (through `withConfig`, or a `{...client.config()}` spread) and are
 * re-derived from those.
 */
const hasOwnReactiveAuth = (config: Partial<ClientConfig>) =>
  hasOwn(config, 'auth') && config.auth !== undefined && !getStaticAuth(config)

/** Whether `config` sets (or clears, with `undefined`) a static credential of its own. */
const hasOwnStaticAuth = (config: Partial<ClientConfig>) =>
  hasOwn(config, 'token') || hasOwn(config, 'withCredentials')

/**
 * Merge a partial configuration onto an existing one for `withConfig()`.
 *
 * Plain spread semantics for everything, with the credential merged
 * explicitly: a `token` / `withCredentials` of its own (an own property, even
 * with the value `undefined`) replaces an inherited `auth` observable, and an
 * `auth` of its own replaces the inherited static options, so the result never
 * mixes the two forms. Absent properties inherit, which keeps a reactive
 * `auth` shared by reference between the parent and the derived client.
 *
 * @internal
 */
export function mergeConfig(
  prev: InitializedClientConfig,
  next: Partial<ClientConfig> = {},
): ClientConfig {
  const merged: ClientConfig = {
    ...prev,
    ...next,
    stega: {
      ...prev.stega,
      ...(typeof next.stega === 'boolean' ? {enabled: next.stega} : next.stega || {}),
    },
  }
  const nextHasReactiveAuth = hasOwnReactiveAuth(next)
  const nextHasStaticAuth = hasOwnStaticAuth(next)
  if (nextHasReactiveAuth && !nextHasStaticAuth) {
    delete merged.token
    delete merged.withCredentials
  } else if (nextHasStaticAuth && !nextHasReactiveAuth) {
    delete merged.auth
  } else if (!nextHasReactiveAuth && !nextHasStaticAuth) {
    // The spread above dropped the parent's non-enumerable markers; carry
    // them so the inherited `auth` is still recognised as static or keeps
    // sharing its resolved-credential record.
    defineAuthMarkers(merged, authMarkers(prev))
  }
  return merged
}

/**
 * The configuration as `client.config()` returns it. A copy, so callers cannot
 * mutate the client's own config. Under a reactive `auth` observable the
 * `token` / `withCredentials` reads are non-enumerable getters onto the
 * last credential the client resolved: they warn when read, and a spread of
 * the result carries `auth` alone instead of snapshotting a stale value.
 *
 * @internal
 */
export function exposeConfig(config: InitializedClientConfig): InitializedClientConfig {
  const copy = {...config}
  defineAuthMarkers(copy, authMarkers(config))
  if (getStaticAuth(config)) {
    // Derived from `token` / `withCredentials`, so a spread of this copy
    // reproduces the source of truth rather than the derivation: keep the
    // observable readable but out of the enumerable keys.
    Object.defineProperty(copy, 'auth', {
      value: config.auth,
      enumerable: false,
      writable: true,
      configurable: true,
    })
    return copy
  }
  Object.defineProperty(copy, 'token', {
    enumerable: false,
    configurable: true,
    get: () => {
      warnings.printDeprecatedConfigTokenWarning()
      const auth = peekAuth(config)
      return auth !== undefined && 'token' in auth ? auth.token : undefined
    },
  })
  Object.defineProperty(copy, 'withCredentials', {
    enumerable: false,
    configurable: true,
    get: () => {
      warnings.printDeprecatedConfigTokenWarning()
      const auth = peekAuth(config)
      return auth === undefined ? undefined : 'withCredentials' in auth
    },
  })
  return copy
}

/**
 * Decide which credential the new configuration carries: a reactive `auth`
 * source (its own, or inherited), or the static options.
 */
function resolveAuthInput(
  config: Partial<ClientConfig>,
  prevConfig: Partial<ClientConfig>,
  merged: Partial<ClientConfig>,
): {auth: Observable<Promise<Auth>>} | {token: unknown; withCredentials: unknown} {
  const ownAuth = config.auth
  if (ownAuth !== undefined && hasOwnReactiveAuth(config)) {
    if (hasOwnStaticAuth(config) && (config.token || config.withCredentials)) {
      throw new Error(
        '`auth` cannot be combined with `token` or `withCredentials`. ' +
          'Pass the credential through `auth` alone, or use the static options without `auth`. ' +
          "Note that `client.config()` includes `auth`; to replace an existing client's credential, " +
          'use `client.withConfig({token})` rather than spreading its config into `createClient()`.',
      )
    }
    return {auth: ownAuth}
  }
  // An inherited `auth` is static when the previous config's marker says so;
  // the spread that built `merged` dropped the non-enumerable marker.
  if (!hasOwnStaticAuth(config) && merged.auth && !getStaticAuth(prevConfig)) {
    return {auth: merged.auth}
  }
  return {token: merged.token, withCredentials: merged.withCredentials}
}

export const initConfig = (
  config: Partial<ClientConfig>,
  prevConfig: Partial<ClientConfig>,
): InitializedClientConfig => {
  const specifiedConfig = {
    ...prevConfig,
    ...config,
    stega: {
      ...(typeof prevConfig.stega === 'boolean'
        ? {enabled: prevConfig.stega}
        : prevConfig.stega || defaultConfig.stega),
      ...(typeof config.stega === 'boolean' ? {enabled: config.stega} : config.stega || {}),
    },
  }
  if (!specifiedConfig.apiVersion) {
    warnings.printNoApiVersionSpecifiedWarning()
  }

  const newConfig = {
    ...defaultConfig,
    ...specifiedConfig,
    apiHost: specifiedConfig.apiHost ?? defaultConfig.apiHost,
  } as InitializedClientConfig

  // Normalize resource configuration - prefer `resource` over deprecated `~experimental_resource`
  if (newConfig['~experimental_resource'] && !newConfig.resource) {
    warnings.printDeprecatedResourceConfigWarning()
    newConfig.resource = newConfig['~experimental_resource']
  }

  const resourceConfig = newConfig.resource
  const projectBased = newConfig.useProjectHostname && !resourceConfig

  if (typeof Promise === 'undefined') {
    const helpUrl = generateHelpUrl('js-client-promise-polyfill')
    throw new Error(`No native Promise-implementation found, polyfill needed - see ${helpUrl}`)
  }

  if (projectBased && !newConfig.projectId) {
    throw new Error('Configuration must contain `projectId`')
  }

  if (resourceConfig) {
    validate.resourceConfig(newConfig)
  }

  if (typeof newConfig.perspective !== 'undefined') {
    validateApiPerspective(newConfig.perspective)
  }

  if ('encodeSourceMap' in newConfig) {
    throw new Error(
      `It looks like you're using options meant for '@sanity/preview-kit/client'. 'encodeSourceMap' is not supported in '@sanity/client'. Did you mean 'stega.enabled'?`,
    )
  }
  if ('encodeSourceMapAtPath' in newConfig) {
    throw new Error(
      `It looks like you're using options meant for '@sanity/preview-kit/client'. 'encodeSourceMapAtPath' is not supported in '@sanity/client'. Did you mean 'stega.filter'?`,
    )
  }
  if (typeof newConfig.stega.enabled !== 'boolean') {
    throw new Error(`stega.enabled must be a boolean, received ${newConfig.stega.enabled}`)
  }
  if (newConfig.stega.enabled && newConfig.stega.studioUrl === undefined) {
    throw new Error(`stega.studioUrl must be defined when stega.enabled is true`)
  }
  if (
    newConfig.stega.enabled &&
    typeof newConfig.stega.studioUrl !== 'string' &&
    typeof newConfig.stega.studioUrl !== 'function'
  ) {
    throw new Error(
      `stega.studioUrl must be a string or a function, received ${newConfig.stega.studioUrl}`,
    )
  }

  const isBrowser = typeof window !== 'undefined' && window.location && window.location.hostname
  const isLocalhost = isBrowser && isLocal(window.location.hostname)

  // Normalise the credential into `auth`, the one representation everything
  // below the config layer reads. A reactive observable is carried by reference:
  // the live transport cache keys on its identity. The static options stay
  // readable on the config; under a reactive observable they are removed, and
  // `exposeConfig` bridges those reads onto the resolved value.
  const authInput = resolveAuthInput(config, prevConfig, newConfig)
  // Markers describing the observable we are about to keep, from whichever
  // config carried it in: a `withConfig` merge, or the previous config on
  // reconfiguration. `newConfig` itself lost them to the spread above.
  const inheritedMarkers = config.auth !== undefined ? authMarkers(config) : authMarkers(prevConfig)
  if ('auth' in authInput) {
    newConfig.auth = authInput.auth
    delete newConfig.token
    delete newConfig.withCredentials
    // Keep the record when the observable is the one the previous config
    // had, so derived clients keep sharing it; start a fresh one otherwise.
    const resolved = inheritedMarkers.resolvedAuth
    defineAuthMarkers(newConfig, {
      resolvedAuth:
        resolved !== undefined && resolved.source === authInput.auth
          ? resolved
          : {source: authInput.auth},
    })
  } else {
    if (authInput.token === undefined) delete newConfig.token
    if (authInput.withCredentials === undefined) delete newConfig.withCredentials
  }

  const hasToken = Boolean(newConfig.token)
  if (newConfig.withCredentials && hasToken) {
    warnings.printCredentialedTokenWarning()
    newConfig.withCredentials = false
  }

  if (!('auth' in authInput)) {
    const state = authFromStaticOptions(newConfig.token, newConfig.withCredentials)
    // An unchanged static credential keeps its observable, so clients derived
    // through `withConfig` share one identity (the live cache keys on it).
    const inherited = inheritedMarkers.staticAuth
    const source =
      inherited !== undefined &&
      inherited.source === newConfig.auth &&
      isSameAuth(inherited.value, state)
        ? inherited.source
        : of(Promise.resolve(state))
    newConfig.auth = source
    defineAuthMarkers(newConfig, {staticAuth: {source, value: state}})
  }

  if (isBrowser && isLocalhost && hasToken && newConfig.ignoreBrowserTokenWarning !== true) {
    warnings.printBrowserTokenWarning()
  } else if (typeof newConfig.useCdn === 'undefined') {
    warnings.printCdnWarning()
  }

  if (projectBased) {
    validate.projectId(newConfig.projectId!)
  }

  if (newConfig.dataset) {
    validate.dataset(newConfig.dataset)
  }

  if ('requestTagPrefix' in newConfig) {
    // Allow setting and unsetting request tag prefix
    newConfig.requestTagPrefix = newConfig.requestTagPrefix
      ? validate.requestTag(newConfig.requestTagPrefix).replace(/\.+$/, '')
      : undefined
  }

  newConfig.apiVersion = `${newConfig.apiVersion}`.replace(/^v/, '')
  newConfig.isDefaultApi = newConfig.apiHost === defaultConfig.apiHost

  if (newConfig.useCdn === true && newConfig.withCredentials) {
    warnings.printCdnAndWithCredentialsWarning()
  }

  // If `useCdn` is undefined, we treat it as `true`
  newConfig.useCdn = newConfig.useCdn !== false && !newConfig.withCredentials

  validateApiVersion(newConfig.apiVersion)

  const hostParts = newConfig.apiHost.split('://', 2)
  const protocol = hostParts[0]
  const host = hostParts[1]
  const cdnHost = newConfig.isDefaultApi ? defaultCdnHost : host

  if (projectBased) {
    newConfig.url = `${protocol}://${newConfig.projectId}.${host}/v${newConfig.apiVersion}`
    newConfig.cdnUrl = `${protocol}://${newConfig.projectId}.${cdnHost}/v${newConfig.apiVersion}`
  } else {
    newConfig.url = `${newConfig.apiHost}/v${newConfig.apiVersion}`
    newConfig.cdnUrl = newConfig.url
  }

  return newConfig
}
