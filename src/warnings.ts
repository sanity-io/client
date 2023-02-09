import {generateHelpUrl} from './generateHelpUrl'
import {Any} from './types'
import {once} from './util/once'

const createWarningPrinter = (message: string[]) =>
  // eslint-disable-next-line no-console
  once((...args: Any[]) => console.warn(message.join(' '), ...args))

export const printCdnWarning = createWarningPrinter([
  'You are not using the Sanity CDN. That means your data is always fresh, but the CDN is faster and',
  `cheaper. Think about it! For more info, see ${generateHelpUrl('js-client-cdn-configuration')} `,
  'To hide this warning, please set the `useCdn` option to either `true` or `false` when creating',
  'the client.',
])

export const printBrowserTokenWarning = createWarningPrinter([
  'You have configured Sanity client to use a token in the browser. This may cause unintentional security issues.',
  `See ${generateHelpUrl(
    'js-client-browser-token'
  )} for more information and how to hide this warning.`,
])

export const printNoApiVersionSpecifiedWarning = createWarningPrinter([
  'Using the Sanity client without specifying an API version is deprecated.',
  `See ${generateHelpUrl('js-client-api-version')}`,
])

export const printNoDefaultExport = createWarningPrinter([
  'The default export of @sanity/client has been deprecated. Use the named export `createClient` instead',
])
