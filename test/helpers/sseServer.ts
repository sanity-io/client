import http from 'node:http'

import SseChannel from 'sse-channel'

export type OnRequest = (options: {
  request: http.IncomingMessage
  channel: SseChannel | undefined
  response: http.ServerResponse
}) => void

export const createSseServer = (onRequest: OnRequest): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      let channel
      if (
        request?.url?.indexOf('/v1/data/listen/') === 0 ||
        request?.url?.indexOf('/vX/data/live/events/') === 0 ||
        request?.url?.indexOf('/listen/beerns?query=') === 0
      ) {
        channel = new SseChannel({jsonEncode: true})
        channel.addClient(request, response)
      }

      onRequest({request, channel, response})
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
