/* eslint-disable strict */
// (Node 4 compat)

'use strict'
// eslint-disable-next-line no-global-assign -- we know what we're doing ESlint ;)
require = require('esm')(module)
const http = require('http')
const SseChannel = require('sse-channel')

module.exports = (onRequest, cb) => {
  const server = http.createServer((request, response) => {
    let channel
    if (
      request.url.indexOf('/v1/data/listen/') === 0 ||
      request.url.indexOf('/listen/beerns?query=') === 0
    ) {
      channel = new SseChannel({jsonEncode: true})
      channel.addClient(request, response)
    }

    onRequest({request, channel, response})
  })

  server.listen(0, '127.0.0.1', (err) => {
    cb(err, err ? null : server)
  })
}
