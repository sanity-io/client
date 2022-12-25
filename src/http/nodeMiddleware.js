import retry from 'get-it/lib-node/middleware/retry'
import debug from 'get-it/lib-node/middleware/debug'
import headers from 'get-it/lib-node/middleware/headers'

const pkg = require('../../package.json')

const middleware = [
  debug({verbose: true, namespace: 'sanity:client'}),
  headers({'User-Agent': `${pkg.name} ${pkg.version}`}),
  retry({maxRetries: 3}),
]

export default middleware
