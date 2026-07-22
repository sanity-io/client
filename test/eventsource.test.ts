import {afterEach, beforeEach, describe, expect, test, vitest} from 'vitest'

import {
  connectEventSource,
  ConnectionExhaustedError,
  type EventSourceInstance,
} from '../src/data/eventsource'

/**
 * A minimal scripted EventSource stand-in that lets tests dispatch `open`/`error`/message
 * events synchronously, so the fruitless-connection accounting in `connectEventSource` can be
 * exercised without real timers or sockets.
 */
class FakeEventSource {
  CONNECTING = 0 as const
  OPEN = 1 as const
  CLOSED = 2 as const

  url = 'https://abc123.api.sanity.io/vX/data/live/events/fake'
  readyState: 0 | 1 | 2 = 0
  closed = false

  #listeners = new Map<string, Set<(evt: unknown) => void>>()

  addEventListener(type: string, listener: (evt: unknown) => void) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
    this.#listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: (evt: unknown) => void) {
    this.#listeners.get(type)?.delete(listener)
  }

  close() {
    this.closed = true
    this.readyState = this.CLOSED
  }

  dispatch(type: string, evt: Record<string, unknown> = {}) {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener({type, ...evt})
    }
  }

  /** Simulates the internal reconnect cycle of a real EventSource: open, then the stream ends. */
  openThenDrop() {
    this.readyState = this.OPEN
    this.dispatch('open')
    // Native and polyfilled EventSource implementations go back to CONNECTING and retry
    // internally when an established stream ends — the error event carries no data or status.
    this.readyState = this.CONNECTING
    this.dispatch('error')
  }
}

describe('connectEventSource - fruitless connections', () => {
  beforeEach(() => {
    vitest.useFakeTimers()
  })
  afterEach(() => {
    vitest.useRealTimers()
  })

  const subscribe = (es: FakeEventSource) => {
    const events: unknown[] = []
    let error: unknown
    const subscription = connectEventSource(
      () => es as unknown as EventSourceInstance,
      ['message', 'welcome', 'reconnect'],
    ).subscribe({
      next: (event) => events.push(event),
      error: (err) => (error = err),
    })
    return {events, getError: () => error, subscription}
  }

  test('gives up with ConnectionExhaustedError when connections are repeatedly dropped right after opening', () => {
    const es = new FakeEventSource()
    const {events, getError} = subscribe(es)

    // First four short-lived connections emit `reconnect` and keep going
    for (let i = 0; i < 4; i++) {
      es.openThenDrop()
    }
    expect(events).toEqual(new Array(4).fill({type: 'reconnect'}))
    expect(getError()).toBeUndefined()

    // The fifth consecutive short-lived connection exhausts the attempts
    es.openThenDrop()
    expect(getError()).toBeInstanceOf(ConnectionExhaustedError)
    expect(es.closed, 'the EventSource must be closed so it stops reconnecting internally').toBe(
      true,
    )
  })

  test('a long-lived connection resets the counter', () => {
    const es = new FakeEventSource()
    const {getError} = subscribe(es)

    for (let i = 0; i < 4; i++) {
      es.openThenDrop()
    }

    // This connection survives well past the fruitless window before dropping
    es.readyState = es.OPEN
    es.dispatch('open')
    vitest.advanceTimersByTime(60_000)
    es.readyState = es.CONNECTING
    es.dispatch('error')
    expect(getError()).toBeUndefined()

    // A fresh run of short-lived connections is tolerated again up to the limit
    for (let i = 0; i < 4; i++) {
      es.openThenDrop()
    }
    expect(getError()).toBeUndefined()

    es.openThenDrop()
    expect(getError()).toBeInstanceOf(ConnectionExhaustedError)
  })

  test('network-level failures without a successful open are not counted', () => {
    const es = new FakeEventSource()
    const {getError} = subscribe(es)

    // Repeated connection attempts that never open, eg while offline. The EventSource keeps
    // retrying internally (readyState CONNECTING) and these must never exhaust the connection.
    for (let i = 0; i < 25; i++) {
      es.dispatch('error')
    }
    expect(getError()).toBeUndefined()

    // Once the network is back a healthy connection proceeds as usual
    es.readyState = es.OPEN
    es.dispatch('open')
    expect(getError()).toBeUndefined()
  })
})
