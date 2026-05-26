import http from 'node:http'

import SseChannel from 'sse-channel'

export type OnRequest = (options: {
  request: http.IncomingMessage
  channel: SseChannel | undefined
  response: http.ServerResponse
}) => void

export const createSseServer = (
  onRequest: OnRequest,
  options?: {corsAllowed?: boolean},
): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const corsAllowed = options?.corsAllowed ?? true
    const server = http.createServer((request, response) => {
      // Handle /check/cors requests
      if (request?.url?.indexOf('/check/cors') !== -1) {
        response.writeHead(200, {'Content-Type': 'application/json'})
        response.end(
          JSON.stringify({result: {allowed: corsAllowed, withCredentials: false}}),
        )
        return
      }

      let channel
      if (
        request?.url?.indexOf('/v1/data/listen/') === 0 ||
        /\/live\/events/.test(request?.url || '') ||
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
