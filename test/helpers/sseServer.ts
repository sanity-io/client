import http from 'node:http'

import {encode, type EventSourceMessage} from 'eventsource-encoder'

// Tell the client to reconnect almost immediately instead of waiting for the
// EventSource default (~3s). Keeps the reconnect tests fast.
const RECONNECT_DELAY_MS = 25

/**
 * A message to send over the channel. `data` is JSON-encoded before being
 * written, and any extra fields (e.g. `reason`) are ignored by the encoder.
 */
export interface SseMessage {
  event?: string
  id?: string | number
  data?: unknown
  retry?: number
  [key: string]: unknown
}

/**
 * A minimal server-sent events channel: writes the SSE handshake on connect,
 * JSON-encodes and sends events, and closes the connection. Reconnect/resume is
 * left to the caller - the reconnect tests re-send events manually.
 */
export class SseChannel {
  private responses: http.ServerResponse[] = []

  addClient(request: http.IncomingMessage, response: http.ServerResponse): void {
    request.socket.setTimeout(0)
    request.socket.setNoDelay(true)
    request.socket.setKeepAlive(true)
    response.writeHead(200, {
      'Content-Type': 'text/event-stream;charset=UTF-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    response.write(':ok\n\n')
    response.write(encode({retry: RECONNECT_DELAY_MS}))
    this.responses.push(response)
  }

  send(message: SseMessage): void {
    const chunk: EventSourceMessage = {
      data: JSON.stringify(message.data === undefined ? '' : message.data),
    }
    if (typeof message.event === 'string') chunk.event = message.event
    if (typeof message.id === 'string' || typeof message.id === 'number') chunk.id = message.id
    if (typeof message.retry === 'number') chunk.retry = message.retry

    const encoded = encode(chunk)
    for (const response of this.responses) {
      response.write(encoded)
    }
  }

  close(): void {
    for (const response of this.responses) {
      response.end()
    }
  }
}

export type OnRequest = (options: {
  request: http.IncomingMessage
  channel: SseChannel | undefined
  response: http.ServerResponse
}) => void

export const createSseServer = (onRequest: OnRequest): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      // Respond to the CORS-check endpoint with a permissive `allowed: true` so
      // tests that trigger reconnect/error paths in `live.events()` don't hang
      // on a missing `/check/cors` handler.
      if (/\/check\/cors$/.test(request?.url || '')) {
        response.writeHead(200, {'content-type': 'application/json'})
        response.end(JSON.stringify({result: {allowed: true, withCredentials: false}}))
        return
      }

      let channel
      if (
        request?.url?.indexOf('/v1/data/listen/') === 0 ||
        /\/live\/events/.test(request?.url || '') ||
        request?.url?.indexOf('/listen/beerns?query=') === 0
      ) {
        channel = new SseChannel()
        channel.addClient(request, response)
      }

      onRequest({request, channel, response})
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
