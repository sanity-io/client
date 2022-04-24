import retry from 'get-it/lib-node/middleware/retry'
import debug from 'get-it/lib-node/middleware/debug'
import headers from 'get-it/lib-node/middleware/headers'

import {name, version} from '../../package.json'

export const middleware = [
  debug({verbose: true, namespace: 'sanity:client'}),
  headers({'User-Agent': `${name} ${version}`}),
  retry({maxRetries: 3}),
]
