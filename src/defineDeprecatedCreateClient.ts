import {printNoDefaultExport} from './warnings'

/* @internal */
export function defineDeprecatedCreateClient<SanityClientType, ClientConfigType>(
  createClient: (config: ClientConfigType) => SanityClientType,
) {
  return function deprecatedCreateClient(config: ClientConfigType) {
    printNoDefaultExport()
    return createClient(config)
  }
}
