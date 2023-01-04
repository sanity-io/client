/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@sanity/eventsource' {
  // re-exports default window.EventSource
  export default window.EventSource
}

declare module 'sse-channel' {
  export default class SseChannel {
    constructor(options?: {jsonEncode?: boolean})
    addClient(request: any, response: any): void
    send(data: any): void
    close(): void
  }
}
