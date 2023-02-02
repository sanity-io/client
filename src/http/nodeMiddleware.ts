import {debug, headers, retry} from 'get-it/middleware'

import {name, version} from '../../package.json'

const middleware = [
  debug({verbose: true, namespace: 'sanity:client'}),
  headers({'User-Agent': `${name} ${version}`}),
  retry({maxRetries: 3}),
]

export default middleware
