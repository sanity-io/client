import type {FetchFunction, FetchInit} from 'get-it'
import {firstValueFrom} from 'rxjs'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'

import {_observe} from '../src/data/dataMethods'
import {defineRequester} from '../src/http/request'
import {anySignal} from '../src/util/anySignal'
import {clientConfig, createClient, projectHost} from './client/helpers'
import {getActiveFetch, getActiveMock} from './helpers/mockFetch'

// Safari 17.0-17.3 ship `AbortSignal` without the static `any`. Every runtime
// this suite runs on has it, so that case is simulated by shadowing the static
// with an own `undefined` property for the duration of a test. Shadowed rather
// than deleted because happy-dom's global `AbortSignal` is a subclass that
// inherits `any` from its parent, where a delete would not reach it.
const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')

function pendingRun() {
  const signals: AbortSignal[] = []
  const run = (signal: AbortSignal): Promise<never> => {
    signals.push(signal)
    return new Promise<never>(() => {})
  }
  return {run, signals}
}

// Resolves `reached` once the transport is called, so a test can abort after
// the request is in flight instead of racing it on a timer.
function trackedFetch(): {fetch: FetchFunction; reached: Promise<FetchInit | undefined>} {
  let onReached: (init: FetchInit | undefined) => void = () => {}
  const reached = new Promise<FetchInit | undefined>((resolve) => {
    onReached = resolve
  })
  const fetch: FetchFunction = (input, init) => {
    onReached(init)
    return getActiveFetch()(input, init)
  }
  return {fetch, reached}
}

describe.each([
  {environment: 'Safari 17.0 (no native AbortSignal.any)', hasNativeAny: false},
  {environment: 'Safari 18 (native AbortSignal.any)', hasNativeAny: true},
])('combining abort signals on $environment', ({hasNativeAny}) => {
  beforeEach(() => {
    if (!hasNativeAny) {
      Object.defineProperty(AbortSignal, 'any', {
        value: undefined,
        configurable: true,
        writable: true,
      })
    }
  })

  afterEach(() => {
    if (nativeAny) {
      Object.defineProperty(AbortSignal, 'any', nativeAny)
    } else {
      Reflect.deleteProperty(AbortSignal, 'any')
    }
  })

  test('the simulated environment is in effect', () => {
    expect(typeof AbortSignal.any).toBe(hasNativeAny ? 'function' : 'undefined')
  })

  test('anySignal aborts when the first source aborts, with its reason', () => {
    const first = new AbortController()
    const second = new AbortController()
    const combined = anySignal([first.signal, second.signal])
    expect(combined.aborted).toBe(false)

    const reason = new Error('caller cancelled')
    first.abort(reason)
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
    expect(second.signal.aborted).toBe(false)
  })

  test('anySignal aborts when the second source aborts, with its reason', () => {
    const first = new AbortController()
    const second = new AbortController()
    const combined = anySignal([first.signal, second.signal])

    const reason = new Error('unsubscribed')
    second.abort(reason)
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
    expect(first.signal.aborted).toBe(false)
  })

  test('anySignal is already aborted when a source already is', () => {
    const aborted = AbortSignal.abort(new Error('already cancelled'))
    const combined = anySignal([aborted, new AbortController().signal])
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(aborted.reason)
  })

  test('anySignal aborts only once', () => {
    const first = new AbortController()
    const second = new AbortController()
    const combined = anySignal([first.signal, second.signal])

    const reason = new Error('first')
    first.abort(reason)
    second.abort(new Error('second'))
    expect(combined.reason).toBe(reason)
  })

  test('_observe aborts the request when the caller signal aborts', () => {
    const caller = new AbortController()
    const {run, signals} = pendingRun()
    const subscription = _observe(caller.signal, run).subscribe()

    expect(signals).toHaveLength(1)
    const [requestSignal] = signals
    expect(requestSignal.aborted).toBe(false)

    const reason = new Error('caller cancelled')
    caller.abort(reason)
    expect(requestSignal.aborted).toBe(true)
    expect(requestSignal.reason).toBe(reason)
    subscription.unsubscribe()
  })

  test('_observe aborts the request on unsubscribe without aborting the caller signal', () => {
    const caller = new AbortController()
    const {run, signals} = pendingRun()
    const subscription = _observe(caller.signal, run).subscribe()

    subscription.unsubscribe()
    const [requestSignal] = signals
    expect(requestSignal.aborted).toBe(true)
    expect(caller.signal.aborted).toBe(false)
  })

  test('the observable requester aborts the fetch when the caller signal aborts', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/ping')
      .respond({status: 200, body: {}, delay: 60_000})

    const {fetch, reached} = trackedFetch()
    const {observable} = defineRequester({middleware: [], fetch})
    const caller = new AbortController()
    // `timeout: false` keeps get-it's own timeout signal, and with it get-it's
    // own signal combination, out of this request: what is under test is the
    // combination this client does before handing the request to get-it.
    const response = firstValueFrom(
      observable({url: `${projectHost()}/v1/ping`, timeout: false, signal: caller.signal}),
    )

    const init = await reached
    expect(init?.signal?.aborted).toBe(false)
    caller.abort()
    expect(init?.signal?.aborted).toBe(true)
    await expect(response).rejects.toHaveProperty('name', 'AbortError')
  })

  test('client.observable.fetch() aborts the fetch when the caller signal aborts', async () => {
    getActiveMock()
      .scope(projectHost())
      .on('GET', '/v1/data/query/foo?query=*&returnQuery=false')
      .respond({status: 200, body: {result: []}, delay: 60_000})

    const {fetch, reached} = trackedFetch()
    const client = createClient({...clientConfig, resolveFetch: () => fetch})
    const caller = new AbortController()
    // `timeout: 0` for the same reason as `timeout: false` above.
    const result = firstValueFrom(
      client.observable.fetch('*', {}, {signal: caller.signal, timeout: 0}),
    )

    const init = await reached
    expect(init?.signal?.aborted).toBe(false)
    caller.abort()
    expect(init?.signal?.aborted).toBe(true)
    await expect(result).rejects.toHaveProperty('name', 'AbortError')
  })
})
