import type {FetchFunction, FetchInit} from 'get-it'
import {firstValueFrom} from 'rxjs'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'

import {_observe} from '../src/data/dataMethods'
import {defineRequester} from '../src/http/request'
import {combineAbortSignals} from '../src/util/combineAbortSignals'
import {createClient, clientConfig, projectHost} from './client/helpers'
import {getActiveFetch, getActiveMock} from './helpers/mockFetch'

/**
 * Safari 17.0 to 17.3 ship `AbortSignal` without the static `any`, so the
 * client's own signal combination (a caller's signal plus the
 * per-subscription controller that fires on unsubscribe) must not call it.
 * Every runtime this suite runs on does have it, so the Safari 17 case is
 * simulated by undefining the static for the duration of a test, and the
 * Safari 18+ case by leaving it in place. Both must behave identically.
 *
 * The static is shadowed with an own `undefined` property rather than
 * deleted: happy-dom's global `AbortSignal` is a subclass that inherits `any`
 * from its parent, where a delete would not reach it.
 */
const nativeAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')

function undefineNativeAny(): void {
  Object.defineProperty(AbortSignal, 'any', {value: undefined, configurable: true, writable: true})
}

function restoreNativeAny(): void {
  if (nativeAny) {
    Object.defineProperty(AbortSignal, 'any', nativeAny)
  } else {
    Reflect.deleteProperty(AbortSignal, 'any')
  }
}

/** A `run` for `_observe` that never settles, exposing the signal it was given. */
function pendingRun() {
  const signals: AbortSignal[] = []
  const run = (signal: AbortSignal): Promise<never> => {
    signals.push(signal)
    return new Promise<never>(() => {})
  }
  return {run, signals}
}

/**
 * Wraps the active mock fetch so a test can wait for the transport to be
 * reached (and read the `init` it was reached with) before aborting, instead
 * of racing the abort against the request pipeline on a timer.
 */
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
    if (!hasNativeAny) undefineNativeAny()
  })

  afterEach(() => {
    restoreNativeAny()
  })

  test('the simulated environment is in effect', () => {
    expect(typeof AbortSignal.any).toBe(hasNativeAny ? 'function' : 'undefined')
  })

  test('combineAbortSignals aborts when the first source aborts, with its reason', () => {
    const first = new AbortController()
    const second = new AbortController()
    const combined = combineAbortSignals([first.signal, second.signal])
    expect(combined.aborted).toBe(false)

    const reason = new Error('caller cancelled')
    first.abort(reason)
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(reason)
    expect(second.signal.aborted).toBe(false)
  })

  test('combineAbortSignals aborts when the second source aborts', () => {
    const first = new AbortController()
    const second = new AbortController()
    const combined = combineAbortSignals([first.signal, second.signal])

    second.abort()
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(second.signal.reason)
    expect(first.signal.aborted).toBe(false)
  })

  test('combineAbortSignals starts out aborted when a source already is', () => {
    const aborted = AbortSignal.abort(new Error('already cancelled'))
    const combined = combineAbortSignals([aborted, new AbortController().signal])
    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe(aborted.reason)
  })

  test('_observe aborts the request when the caller signal aborts', () => {
    const caller = new AbortController()
    const {run, signals} = pendingRun()
    const subscription = _observe(caller.signal, run).subscribe()

    expect(signals).toHaveLength(1)
    const [requestSignal] = signals
    expect(requestSignal.aborted).toBe(false)

    caller.abort()
    expect(requestSignal.aborted).toBe(true)
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
    // own signal combination, out of this request: what is under test here is
    // the combination this client does before handing the request to get-it.
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
