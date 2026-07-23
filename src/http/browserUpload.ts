import createDebugLogger from 'debug'
import {Observable} from 'rxjs'

import type {UploadEvent} from '../types'
import {ClientError, httpResponseFromFetch, ServerError} from './errors'
import {parseJsonText} from './request'

const log = createDebugLogger('sanity:client')

let nextRequestId = 1

/**
 * Options for a browser-side asset upload that needs progress events.
 *
 * @internal
 */
export interface BrowserUploadOptions {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
  withCredentials: boolean
  /** Milliseconds before the upload is aborted; `false` and `0` both disable the timeout. */
  timeout?: number | false
  signal?: AbortSignal
}

/**
 * Run an asset upload through `XMLHttpRequest` so we can surface per-chunk
 * upload progress events. get-it v9 / fetch has no equivalent hook in the
 * browser, so the observable asset-upload API falls back to this path when
 * `XMLHttpRequest` is available.
 *
 * @internal
 */
export function uploadWithProgress<T>(options: BrowserUploadOptions): Observable<UploadEvent<T>> {
  return new Observable<UploadEvent<T>>((subscriber) => {
    const xhr = new XMLHttpRequest()
    const requestId = nextRequestId++
    const {url, method, headers, body, withCredentials, timeout, signal} = options

    log('[%d] %s %s (XHR upload with progress)', requestId, method, url)

    xhr.open(method, url)
    xhr.withCredentials = withCredentials
    if (typeof timeout === 'number' && timeout > 0) {
      xhr.timeout = timeout
    }

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value)
    }

    xhr.upload.onprogress = (e) => {
      subscriber.next({
        type: 'progress',
        stage: 'upload',
        percent: e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 0,
        total: e.total || undefined,
        loaded: e.loaded,
        lengthComputable: e.lengthComputable,
      })
    }

    xhr.onload = () => {
      log('[%d] %s %s — %d', requestId, method, url, xhr.status)

      if (xhr.status >= 400) {
        // Same typed errors as the fetch transport, so consumers can keep
        // detecting `ClientError`/`ServerError` and reading `statusCode`,
        // `responseBody` and the structured API `details` on failed uploads.
        const errorHeaders = parseXhrResponseHeaders(xhr.getAllResponseHeaders())
        const canonical = httpResponseFromFetch(
          {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: errorHeaders,
            body: parseJsonText(xhr.responseText, errorHeaders),
          },
          url,
          method,
        )
        subscriber.error(
          xhr.status >= 500 ? new ServerError(canonical) : new ClientError(canonical),
        )
        return
      }

      let responseBody: T
      try {
        responseBody = JSON.parse(xhr.responseText) as T
      } catch {
        subscriber.error(new Error('Failed to parse upload response as JSON'))
        return
      }

      subscriber.next({type: 'response', body: responseBody})
      subscriber.complete()
    }

    xhr.onerror = () => {
      log('[%d] %s %s — network error', requestId, method, url)
      subscriber.error(new Error('XHR upload network error'))
    }

    xhr.ontimeout = () => {
      log('[%d] %s %s — timed out after %dms', requestId, method, url, timeout)
      // Same error shape as the fetch transport's timeout rejection.
      subscriber.error(
        new DOMException(
          `The operation timed out after ${timeout}ms while attempting to reach ${url}`,
          'TimeoutError',
        ),
      )
    }

    xhr.onabort = () => {
      subscriber.error(new DOMException('Upload aborted', 'AbortError'))
    }

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), {once: true})
    }

    xhr.send(body as XMLHttpRequestBodyInit)
  })
}

/**
 * Parse `XMLHttpRequest.getAllResponseHeaders()` output (CRLF-separated
 * `name: value` lines) into a `Headers` instance.
 */
function parseXhrResponseHeaders(raw: string): Headers {
  const headers = new Headers()
  for (const line of raw.split('\r\n')) {
    const separator = line.indexOf(':')
    if (separator <= 0) continue
    try {
      headers.append(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
    } catch {
      // Skip header lines the Headers constructor rejects — better a partial
      // header record on the error than no error details at all.
    }
  }
  return headers
}
