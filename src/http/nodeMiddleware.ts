import {debug, headers} from 'get-it/middleware'

import {name, version} from '../../package.json'

const middleware = [
  debug({verbose: true, namespace: 'sanity:client'}),
  headers({'User-Agent': `${name} ${version}`}),
]

export default middleware
