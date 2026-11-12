import type {EventSourceConstructor} from 'eventsource'

/**
 * Globals the `eventsource` package needs. It extends `Event` and `EventTarget`
 * while the module is evaluated, so importing it in an environment without them
 * (eg React Native's Hermes) throws a `ReferenceError` that tells the user nothing.
 */
const REQUIRED_GLOBALS = [
  'Event',
  'EventTarget',
  'MessageEvent',
  'AbortController',
  'URL',
  'TextEncoder',
  'TextDecoder',
]

/**
 * Loads the `eventsource` package on first use, instead of when the client is imported.
 * Most consumers never listen, and the package can't even be evaluated in some runtimes,
 * so importing the client must not depend on it. When the environment lacks what the
 * package needs, rejects with an error naming the missing globals.
 *
 * @internal
 */
export async function loadEventSource(): Promise<EventSourceConstructor> {
  const missing = REQUIRED_GLOBALS.filter(
    (name) => typeof Reflect.get(globalThis, name) !== 'function',
  )
  if (missing.length > 0) {
    throw new Error(
      `Server-sent events (used by \`client.listen()\` and \`client.live.events()\`) are not supported in this environment: missing global ${missing.map((name) => `\`${name}\``).join(', ')}. Add polyfills for ${missing.length === 1 ? 'it' : 'them'} before calling these methods.`,
    )
  }
  const {EventSource} = await import('eventsource')
  return EventSource
}
