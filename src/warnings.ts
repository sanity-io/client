import {generateHelpUrl} from './generateHelpUrl'
import {type Any} from './types'
import {once} from './util/once'

const createWarningPrinter = (message: string[]) =>
  // eslint-disable-next-line no-console
  once((...args: Any[]) => console.warn(message.join(' '), ...args))

export const printCdnAndWithCredentialsWarning = createWarningPrinter([
  `Because you set \`withCredentials\` to true, we will override your \`useCdn\``,
  `setting to be false since (cookie-based) credentials are never set on the CDN`,
])

export const printCdnWarning = createWarningPrinter([
  `Since you haven't set a value for \`useCdn\`, we will deliver content using our`,
  `global, edge-cached API-CDN. If you wish to have content delivered faster, set`,
  `\`useCdn: false\` to use the Live API. Note: You may incur higher costs using the live API.`,
])

export const printCdnPreviewDraftsWarning = createWarningPrinter([
  `The Sanity client is configured with the \`perspective\` set to \`drafts\` or \`previewDrafts\`, which doesn't support the API-CDN.`,
  `The Live API will be used instead. Set \`useCdn: false\` in your configuration to hide this warning.`,
])

export const printPreviewDraftsDeprecationWarning = createWarningPrinter([
  `The \`previewDrafts\` perspective has been renamed to  \`drafts\` and will be removed in a future API version`,
])

export const printBrowserTokenWarning = createWarningPrinter([
  'You have configured Sanity client to use a token in the browser. This may cause unintentional security issues.',
  `See ${generateHelpUrl(
    'js-client-browser-token',
  )} for more information and how to hide this warning.`,
])

export const printCredentialedTokenWarning = createWarningPrinter([
  'You have configured Sanity client to use a token, but also provided `withCredentials: true`.',
  'This is no longer supported - only token will be used - remove `withCredentials: true`.',
])

export const printNoApiVersionSpecifiedWarning = createWarningPrinter([
  'Using the Sanity client without specifying an API version is deprecated.',
  `See ${generateHelpUrl('js-client-api-version')}`,
])

export const printNoDefaultExport = createWarningPrinter([
  'The default export of @sanity/client has been deprecated. Use the named export `createClient` instead.',
])
