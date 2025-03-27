import {generateHelpUrl} from './generateHelpUrl'
import type {ClientConfig, ClientPerspective, InitializedClientConfig} from './types'
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
  } as InitializedClientConfig
  const projectBased = newConfig.useProjectHostname && !newConfig['~experimental_resource']

  if (typeof Promise === 'undefined') {
    const helpUrl = generateHelpUrl('js-client-promise-polyfill')
    throw new Error(`No native Promise-implementation found, polyfill needed - see ${helpUrl}`)
  }

  if (projectBased && !newConfig.projectId) {
    throw new Error('Configuration must contain `projectId`')
  }

  if (newConfig['~experimental_resource']) {
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

  const hasToken = Boolean(newConfig.token)
  if (newConfig.withCredentials && hasToken) {
    warnings.printCredentialedTokenWarning()
    newConfig.withCredentials = false
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
