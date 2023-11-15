import type {ClientConfig} from '../types'
import type {ClientStegaConfig, InitializedStegaConfig, StegaConfig} from './types'

export const defaultStegaConfig: StegaConfig = {
  enabled: false,
  filter: (props) => props.filterDefault(props),
}

export function splitConfig(config: ClientStegaConfig): {
  clientConfig: ClientConfig
  stegaConfig: StegaConfig
} {
  const {stega = {}, ...clientConfig} = config
  return {clientConfig, stegaConfig: typeof stega === 'boolean' ? {enabled: stega} : stega}
}

export const initStegaConfig = (
  config: Partial<StegaConfig>,
  prevConfig: Partial<StegaConfig>,
): InitializedStegaConfig => {
  const specifiedConfig = Object.assign({} as StegaConfig, prevConfig, config)
  const newConfig = Object.assign({} as InitializedStegaConfig, defaultStegaConfig, specifiedConfig)

  if ('encodeSourceMap' in newConfig) {
    throw new Error(
      `It looks like you're using options meant for '@sanity/preview-kit/client'. 'encodeSourceMap' is not supported in '@sanity/client/stega'. Did you mean 'enabled'?`,
    )
  }

  if ('encodeSourceMapAtPath' in newConfig) {
    throw new Error(
      `It looks like you're using options meant for '@sanity/preview-kit/client'. 'encodeSourceMapAtPath' is not supported in '@sanity/client/stega'. Did you mean 'filter'?`,
    )
  }

  if (typeof newConfig.enabled !== 'boolean') {
    throw new Error(`config.enabled must be a boolean, received ${newConfig.enabled}`)
  }

  if (newConfig.enabled && newConfig.studioUrl === undefined) {
    throw new Error(`config.studioUrl must be defined when config.enabled is true`)
  }

  if (
    newConfig.enabled &&
    typeof newConfig.studioUrl !== 'string' &&
    typeof newConfig.studioUrl !== 'function'
  ) {
    throw new Error(
      `config.studioUrl must be a string or a function, received ${newConfig.studioUrl}`,
    )
  }

  return newConfig
}
