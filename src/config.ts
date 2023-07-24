import {generateHelpUrl} from './generateHelpUrl'
import type {ClientConfig, ClientPerspective, InitializedClientConfig} from './types'
import * as validate from './validators'
import * as warnings from './warnings'

const defaultCdnHost = 'apicdn.sanity.io'
export const defaultConfig = {
  apiHost: 'https://api.sanity.io',
  apiVersion: '1',
  useProjectHostname: true,
} satisfies ClientConfig

const LOCALHOSTS = ['localhost', '127.0.0.1', '0.0.0.0']
const isLocal = (host: string) => LOCALHOSTS.indexOf(host) !== -1

export const validateApiVersion = function validateApiVersion(apiVersion: string) {
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

export const validateApiPerspective = function validateApiPerspective(perspective: string) {
  switch (perspective as ClientPerspective) {
    case 'previewDrafts':
    case 'published':
    case 'raw':
      return
    default:
      throw new TypeError(
        'Invalid API perspective string, expected `published`, `previewDrafts` or `raw`',
      )
  }
}

export const initConfig = (
  config: Partial<ClientConfig>,
  prevConfig: Partial<ClientConfig>,
): InitializedClientConfig => {
  const specifiedConfig = Object.assign({}, prevConfig, config)
  if (!specifiedConfig.apiVersion) {
    warnings.printNoApiVersionSpecifiedWarning()
  }

  const newConfig = Object.assign({} as InitializedClientConfig, defaultConfig, specifiedConfig)
  const projectBased = newConfig.useProjectHostname

  if (typeof Promise === 'undefined') {
    const helpUrl = generateHelpUrl('js-client-promise-polyfill')
    throw new Error(`No native Promise-implementation found, polyfill needed - see ${helpUrl}`)
  }

  if (projectBased && !newConfig.projectId) {
    throw new Error('Configuration must contain `projectId`')
  }

  if (typeof newConfig.perspective === 'string') {
    validateApiPerspective(newConfig.perspective)
  }

  if (
    'encodeSourceMapAtPath' in newConfig ||
    'encodeSourceMap' in newConfig ||
    'studioUrl' in newConfig ||
    'logger' in newConfig
  ) {
    throw new Error(
      `It looks like you're using options meant for '@sanity/preview-kit/client', such as 'encodeSourceMapAtPath', 'encodeSourceMap', 'studioUrl' and 'logger'. Make sure you're using the right import.`,
    )
  }

  const isBrowser = typeof window !== 'undefined' && window.location && window.location.hostname
  const isLocalhost = isBrowser && isLocal(window.location.hostname)

  if (isBrowser && isLocalhost && newConfig.token && newConfig.ignoreBrowserTokenWarning !== true) {
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
  // If `useCdn` is undefined, we treat it as `true`
  newConfig.useCdn = newConfig.useCdn !== false && !newConfig.withCredentials

  validateApiVersion(newConfig.apiVersion)

  const hostParts = newConfig.apiHost.split('://', 2)
  const protocol = hostParts[0]
  const host = hostParts[1]
  const cdnHost = newConfig.isDefaultApi ? defaultCdnHost : host

  if (newConfig.useProjectHostname) {
    newConfig.url = `${protocol}://${newConfig.projectId}.${host}/v${newConfig.apiVersion}`
    newConfig.cdnUrl = `${protocol}://${newConfig.projectId}.${cdnHost}/v${newConfig.apiVersion}`
  } else {
    newConfig.url = `${newConfig.apiHost}/v${newConfig.apiVersion}`
    newConfig.cdnUrl = newConfig.url
  }

  return newConfig
}
