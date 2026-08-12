import {ClientError, createClient, ServerError} from '@sanity/client'
import {lastValueFrom, toArray} from 'rxjs'
import {describe, expect, inject, test, vi} from 'vitest'

import {uploadWithProgress} from '../src/http/browserUpload'

// The upload server binds in Node (see globalSetup.upload.ts) while these
// assertions run in the browser - only `vitest.browser.config.ts` collects
// this file (see `browserOnlyExclude` in vitest.config.ts; happy-dom does
// NOT collect it) - so the URL crosses that process boundary through
// vitest's `provide`/`inject` channel rather than being created here.
const getApiHost = () => inject('uploadServerUrl')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shape of `GET /diagnostics?id=` from `test/helpers/uploadServer.ts`. */
interface Diagnostics {
  received: boolean
  aborted: boolean
  bytesReceived: number
  path: string
  query: Record<string, string>
}

function isDiagnostics(value: unknown): value is Diagnostics {
  return (
    isRecord(value) &&
    typeof value.received === 'boolean' &&
    typeof value.aborted === 'boolean' &&
    typeof value.bytesReceived === 'number' &&
    typeof value.path === 'string' &&
    isRecord(value.query)
  )
}

/**
 * Ask the real server what it actually saw for a given `?id=`/`?tag=` value -
 * the only way to prove a real request landed (or was aborted), now that
 * there's no fake XHR instance left to inspect.
 */
async function fetchDiagnostics(id: string): Promise<Diagnostics> {
  const res = await fetch(`${getApiHost()}/diagnostics?id=${encodeURIComponent(id)}`)
  const body: unknown = await res.json()
  if (!isDiagnostics(body)) {
    throw new Error(`unexpected diagnostics response: ${JSON.stringify(body)}`)
  }
  return body
}

/** Poll diagnostics until `predicate` is satisfied, rather than a fixed wait. */
async function waitForDiagnostics(
  id: string,
  predicate: (diagnostics: Diagnostics) => boolean,
  timeoutMs = 2000,
): Promise<Diagnostics> {
  const start = Date.now()
  for (;;) {
    const diagnostics = await fetchDiagnostics(id)
    if (predicate(diagnostics)) return diagnostics
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for a diagnostics condition on id "${id}"`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

// `Buffer` isn't a real browser global - `UploadBody` (the public type for
// `assets.upload()`'s body param) doesn't accept a plain `Uint8Array` either,
// so a `Blob` is the one small-body shape that works everywhere here.
const smallBody = () => new Blob([new Uint8Array([1, 2, 3])])

const upload = (options: {url?: string; timeout?: number | false; signal?: AbortSignal} = {}) =>
  uploadWithProgress<{document: {_id: string; _type: string}}>({
    method: 'POST',
    headers: {'Content-Type': 'image/jpeg'},
    body: smallBody(),
    withCredentials: false,
    ...options,
    url: options.url ?? `${getApiHost()}/success`,
  })

const errorOf = (observable: ReturnType<typeof upload>): Promise<unknown> =>
  lastValueFrom(observable).then(
    () => {
      throw new Error('expected the upload to fail')
    },
    (err: unknown) => err,
  )

describe('uploadWithProgress', () => {
  test('a 4xx rejection surfaces as a ClientError with the structured response', async () => {
    const url = `${getApiHost()}/error400`
    const error = await errorOf(upload({url}))

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ClientError)
    if (!(error instanceof ClientError)) throw error

    expect(error.statusCode).toBe(401)
    expect(error.message).toContain('Session does not have the correct permissions')
    expect(error.details).toEqual({description: 'Session does not have the correct permissions'})
    expect(error.traceId).toBe('abcdef1234567890')
    expect(error.response).toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      method: 'POST',
      url,
      headers: {'x-served-by': 'gradient'},
      body: {error: {description: 'Session does not have the correct permissions'}},
    })
  })

  test('a 5xx rejection surfaces as a ServerError', async () => {
    const error = await errorOf(upload({url: `${getApiHost()}/error500`}))

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ServerError)
    if (!(error instanceof ServerError)) throw error

    expect(error.statusCode).toBe(503)
    expect(error.message).toContain('HTTP 503 Service Unavailable')
    expect(error.message).toContain('upstream capacity exceeded')
    expect(error.responseBody).toBe('upstream capacity exceeded')
  })

  test('aborts the in-flight upload when unsubscribed', async () => {
    const id = `abort-unsubscribe-${crypto.randomUUID()}`
    const subscription = upload({url: `${getApiHost()}/hang?id=${id}`}).subscribe()

    // Wait for the server to confirm the request actually arrived - real
    // proof `send()` happened, rather than a fixed wait for the microtask
    // queue to drain.
    await waitForDiagnostics(id, (d) => d.received)
    subscription.unsubscribe()

    const diagnostics = await waitForDiagnostics(id, (d) => d.aborted)
    expect(diagnostics.aborted, 'unsubscribing must abort the real connection').toBe(true)
  })

  test('detaches its abort listener from the caller signal once the upload settles', async () => {
    const controller = new AbortController()
    const added = vi.spyOn(controller.signal, 'addEventListener')
    const removed = vi.spyOn(controller.signal, 'removeEventListener')

    await lastValueFrom(upload({signal: controller.signal}))
    await lastValueFrom(upload({signal: controller.signal}))

    // A long-lived caller signal must not accumulate listeners: every abort
    // listener added has to be removed again on teardown, handler-for-handler.
    const addedAbort = added.mock.calls.filter(([type]) => type === 'abort')
    const removedAbort = removed.mock.calls.filter(([type]) => type === 'abort')
    expect(addedAbort).toHaveLength(2)
    expect(removedAbort.map(([, handler]) => handler)).toEqual(
      addedAbort.map(([, handler]) => handler),
    )
  })

  test('errors immediately when given an already-aborted signal', async () => {
    const id = `already-aborted-${crypto.randomUUID()}`
    const controller = new AbortController()
    controller.abort()

    const error = await errorOf(
      upload({url: `${getApiHost()}/hang?id=${id}`, signal: controller.signal}),
    )

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(DOMException)
    if (!(error instanceof DOMException)) throw error
    expect(error.name).toBe('AbortError')

    // The request must never have been sent.
    const diagnostics = await fetchDiagnostics(id)
    expect(diagnostics.received, 'an already-aborted signal must short-circuit before send()').toBe(
      false,
    )
  })
})

describe('assets.upload() through the XHR path', () => {
  test('emits upload progress events and the parsed response on success', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'prod',
      apiVersion: '1',
      useCdn: false,
      useProjectHostname: false,
      apiHost: getApiHost(),
    })

    const tag = `progress-${crypto.randomUUID()}`
    // 256KB is enough for every engine tested to fire at least one real
    // `xhr.upload.onprogress` event - that's the bar here, not an exact or
    // minimum count, which differs by browser and isn't asserted.
    const bodySize = 256 * 1024
    const events = await lastValueFrom(
      client.observable.assets
        .upload('image', new Blob([new Uint8Array(bodySize)]), {filename: 'big.bin', tag})
        .pipe(toArray()),
    )

    const progress = events.filter((event) => event.type === 'progress')
    expect(progress.length).toBeGreaterThan(0)
    expect(events.at(-1)?.type).toBe('response')

    // Real proof the whole body arrived at the server, not just that the
    // browser fired local progress events.
    const diagnostics = await fetchDiagnostics(tag)
    expect(diagnostics.bytesReceived).toBe(bodySize)
  })

  // The `timeout` option isn't exercised anywhere in this file: `xhr.timeout`
  // is a plain client-side property, never sent over the wire and not
  // exposed by any public API, so proving a *specific* configured value
  // reached it needs either a fake XHR (ruled out) or waiting for a real
  // timer to fire (timing-sensitive, and measured flaky under this file's
  // own concurrent load in practice). Accepted as an untested gap rather
  // than inventing a mechanism to close it - see the task report.
  test('applies the request tag (incl. requestTagPrefix) through assets.upload()', async () => {
    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      apiVersion: '1',
      useCdn: false,
      useProjectHostname: false,
      apiHost: getApiHost(),
      requestTagPrefix: 'studio',
    })

    const tag = `asset-${crypto.randomUUID()}`
    const events = await lastValueFrom(
      client.observable.assets.upload('image', smallBody(), {tag}).pipe(toArray()),
    )
    expect(events.at(-1)).toMatchObject({type: 'response'})

    // What the server actually received on the wire - stronger proof than
    // reading a field off a fake XHR instance.
    const diagnostics = await fetchDiagnostics(`studio.${tag}`)
    expect(diagnostics.path).toBe('/v1/assets/images/foo')
    expect(diagnostics.query.tag).toBe(`studio.${tag}`)
  })
})
