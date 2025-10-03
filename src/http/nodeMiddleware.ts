import type {Middleware, RequestOptions} from 'get-it'
import {agent, debug, headers} from 'get-it/middleware'

import {name, version} from '../../package.json'

const middleware: Middleware[] = [
  debug({verbose: true, namespace: 'sanity:client'}),
  headers({'User-Agent': `${name} ${version}`}),

  // Lineage is used for recursion control/tracing and can be passed either through
  // client constructor or through environent variable.
  // Not used in browser environments.
  {
    processOptions(opts: RequestOptions & {lineage?: string}) {
      const lineage =
        (typeof process !== 'undefined' && process.env.X_SANITY_LINEAGE) || opts.lineage

      if (lineage) {
        opts.headers = opts.headers || {}
        opts.headers['x-sanity-lineage'] = lineage
      }
      return opts
    },
  },

  // Enable keep-alive, and in addition limit the number of sockets that can be opened.
  // This avoids opening too many connections to the server if someone tries to execute
  // a bunch of requests in parallel. It's recommended to have a concurrency limit
  // at a "higher limit" (i.e. you shouldn't actually execute hundreds of requests in parallel),
  // and this is mainly to minimize the impact for the network and server.
  //
  // We're currently matching the same defaults as browsers:
  // https://stackoverflow.com/questions/26003756/is-there-a-limit-practical-or-otherwise-to-the-number-of-web-sockets-a-page-op
  agent({
    keepAlive: true,
    maxSockets: 30,
    maxTotalSockets: 256,
  }),
]

export default middleware
