import {ClientError, createClient, ServerError} from '@sanity/client'
import {lastValueFrom, toArray} from 'rxjs'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {uploadWithProgress} from '../src/http/browserUpload'

interface FakeXhrResponse {
  status: number
  statusText: string
  headers: string
  responseText: string
}

interface FakeXhrBehavior {
  progressEvents?: Array<{loaded: number; total: number}>
  /** Never respond — only fire `ontimeout` when a timeout is configured. */
  hang?: boolean
}

interface FakeXhrInstance {
  method: string
  url: string
  timeout: number
  aborted: boolean
}

/**
 * Install a minimal `XMLHttpRequest` double that answers every request with
 * the given response. Returns the created instances so tests can assert on
 * what the client handed the XHR.
 */
function stubXhr(response: FakeXhrResponse, behavior: FakeXhrBehavior = {}): FakeXhrInstance[] {
  const instances: FakeXhrInstance[] = []
  class FakeXhr {
    upload: {
      onprogress: ((e: {lengthComputable: boolean; loaded: number; total: number}) => void) | null
    } = {onprogress: null}
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    ontimeout: (() => void) | null = null
    withCredentials = false
    timeout = 0
    status = 0
    statusText = ''
    responseText = ''
    #record: FakeXhrInstance = {method: '', url: '', timeout: 0, aborted: false}
    #sent = false
    constructor() {
      instances.push(this.#record)
    }
    open(method: string, url: string) {
      this.#record.method = method
      this.#record.url = url
    }
    setRequestHeader() {}
    abort() {
      this.#record.aborted = true
      // Per spec, the `abort` event only fires when `send()` has been called
      // and the request hasn't settled.
      if (this.#sent) this.onabort?.()
    }
    getAllResponseHeaders() {
      return response.headers
    }
    send() {
      this.#sent = true
      this.#record.timeout = this.timeout
      queueMicrotask(() => {
        if (behavior.hang) {
          if (this.timeout > 0) this.ontimeout?.()
          return
        }
        for (const event of behavior.progressEvents ?? []) {
          this.upload.onprogress?.({lengthComputable: true, ...event})
        }
        this.status = response.status
        this.statusText = response.statusText
        this.responseText = response.responseText
        this.onload?.()
      })
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  return instances
}

const successResponse: FakeXhrResponse = {
  status: 201,
  statusText: 'Created',
  headers: 'content-type: application/json',
  responseText: JSON.stringify({document: {url: 'https://some.asset.url'}}),
}

const upload = (options: {timeout?: number | false; signal?: AbortSignal} = {}) =>
  uploadWithProgress<{document: {url: string}}>({
    url: 'https://abc123.api.sanity.io/v1/assets/images/foo',
    method: 'POST',
    headers: {'Content-Type': 'image/jpeg'},
    body: Buffer.from([1, 2, 3]),
    withCredentials: false,
    ...options,
  })

const errorOf = (observable: ReturnType<typeof upload>) =>
  lastValueFrom(observable).then(
    () => {
      throw new Error('expected the upload to fail')
    },
    (err) => err,
  )

describe('uploadWithProgress', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('emits progress events and the parsed response on success', async () => {
    stubXhr(successResponse, {
      progressEvents: [
        {loaded: 50, total: 100},
        {loaded: 100, total: 100},
      ],
    })

    const events = await lastValueFrom(upload().pipe(toArray()))
    expect(events).toEqual([
      {
        type: 'progress',
        stage: 'upload',
        percent: 50,
        total: 100,
        loaded: 50,
        lengthComputable: true,
      },
      {
        type: 'progress',
        stage: 'upload',
        percent: 100,
        total: 100,
        loaded: 100,
        lengthComputable: true,
      },
      {type: 'response', body: {document: {url: 'https://some.asset.url'}}},
    ])
  })

  test('a 4xx rejection surfaces as a ClientError with the structured response', async () => {
    stubXhr({
      status: 401,
      statusText: 'Unauthorized',
      headers:
        'content-type: application/json\r\ntraceparent: 00-abcdef1234567890-0000-01\r\nx-served-by: gradient',
      responseText: JSON.stringify({
        error: {description: 'Session does not have the correct permissions'},
      }),
    })

    const error = await errorOf(upload())
    expect(error).toBeInstanceOf(ClientError)
    expect(error.statusCode).toBe(401)
    expect(error.message).toContain('Session does not have the correct permissions')
    expect(error.details).toEqual({description: 'Session does not have the correct permissions'})
    expect(error.traceId).toBe('abcdef1234567890')
    expect(error.response).toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      method: 'POST',
      url: 'https://abc123.api.sanity.io/v1/assets/images/foo',
      headers: {'x-served-by': 'gradient'},
      body: {error: {description: 'Session does not have the correct permissions'}},
    })
  })

  test('a 5xx rejection surfaces as a ServerError', async () => {
    stubXhr({
      status: 503,
      statusText: 'Service Unavailable',
      headers: 'content-type: text/plain',
      responseText: 'upstream capacity exceeded',
    })

    const error = await errorOf(upload())
    expect(error).toBeInstanceOf(ServerError)
    expect(error.statusCode).toBe(503)
    expect(error.message).toContain('HTTP 503 Service Unavailable')
    expect(error.message).toContain('upstream capacity exceeded')
    expect(error.responseBody).toBe('upstream capacity exceeded')
  })

  test('aborts the in-flight upload when unsubscribed', async () => {
    const instances = stubXhr(successResponse, {hang: true})

    const subscription = upload().subscribe()
    // Let the microtask queue drain so `send()` has run.
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    subscription.unsubscribe()

    expect(instances).toHaveLength(1)
    expect(instances[0].aborted, 'unsubscribing must abort the XHR').toBe(true)
  })

  test('errors immediately when given an already-aborted signal', async () => {
    const instances = stubXhr(successResponse)
    const controller = new AbortController()
    controller.abort()

    const error = await errorOf(upload({signal: controller.signal}))
    expect(error).toBeInstanceOf(DOMException)
    expect(error.name).toBe('AbortError')
    // The request must never have been sent.
    expect(instances[0].timeout).toBe(0)
  })

  test('honors the timeout and rejects with a TimeoutError', async () => {
    const instances = stubXhr(successResponse, {hang: true})

    const error = await errorOf(upload({timeout: 4321}))
    expect(error).toBeInstanceOf(DOMException)
    expect(error.name).toBe('TimeoutError')
    expect(error.message).toContain('timed out after 4321ms')
    expect(instances[0].timeout).toBe(4321)
  })
})

describe('assets.upload() through the XHR path', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('applies the request tag (incl. requestTagPrefix) and timeout', async () => {
    const instances = stubXhr(successResponse)

    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      apiVersion: '1',
      useCdn: false,
      requestTagPrefix: 'studio',
    })

    const events = await lastValueFrom(
      client.observable.assets
        .upload('image', Buffer.from([1, 2, 3]), {tag: 'asset', timeout: 4321})
        .pipe(toArray()),
    )

    expect(events.at(-1)).toMatchObject({type: 'response'})
    expect(instances).toHaveLength(1)
    const requestUrl = new URL(instances[0].url)
    expect(requestUrl.pathname).toBe('/v1/assets/images/foo')
    expect(requestUrl.searchParams.get('tag')).toBe('studio.asset')
    expect(instances[0].timeout).toBe(4321)
  })

  test('has no timeout unless explicitly set - uploads can be slow', async () => {
    const instances = stubXhr(successResponse)

    const client = createClient({
      projectId: 'abc123',
      dataset: 'foo',
      apiVersion: '1',
      useCdn: false,
      // A client-level timeout applies to regular requests but must NOT leak
      // into uploads - upload timeouts are opt-in via the upload options.
      timeout: 30000,
    })

    await lastValueFrom(client.observable.assets.upload('image', Buffer.from([1, 2, 3])))

    expect(instances).toHaveLength(1)
    expect(instances[0].timeout, 'xhr.timeout must stay disabled (0)').toBe(0)
  })
})
