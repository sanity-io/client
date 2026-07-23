import {ClientError, ServerError} from '@sanity/client'
import {lastValueFrom, toArray} from 'rxjs'
import {afterEach, describe, expect, test, vi} from 'vitest'

import {uploadWithProgress} from '../src/http/browserUpload'

interface FakeXhrResponse {
  status: number
  statusText: string
  headers: string
  responseText: string
}

/**
 * Install a minimal `XMLHttpRequest` double that answers every request with
 * the given response, optionally emitting upload progress events first.
 */
function stubXhr(
  response: FakeXhrResponse,
  progressEvents: Array<{loaded: number; total: number}> = [],
) {
  class FakeXhr {
    upload: {
      onprogress: ((e: {lengthComputable: boolean; loaded: number; total: number}) => void) | null
    } = {onprogress: null}
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    withCredentials = false
    status = 0
    statusText = ''
    responseText = ''
    open() {}
    setRequestHeader() {}
    abort() {
      this.onabort?.()
    }
    getAllResponseHeaders() {
      return response.headers
    }
    send() {
      queueMicrotask(() => {
        for (const event of progressEvents) {
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
}

const upload = () =>
  uploadWithProgress<{document: {url: string}}>({
    url: 'https://abc123.api.sanity.io/v1/assets/images/foo',
    method: 'POST',
    headers: {'Content-Type': 'image/jpeg'},
    body: new Uint8Array([1, 2, 3]),
    withCredentials: false,
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
    stubXhr(
      {
        status: 201,
        statusText: 'Created',
        headers: 'content-type: application/json',
        responseText: JSON.stringify({document: {url: 'https://some.asset.url'}}),
      },
      [
        {loaded: 50, total: 100},
        {loaded: 100, total: 100},
      ],
    )

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
})
