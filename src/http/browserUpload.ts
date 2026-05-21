import createDebugLogger from 'debug'
import {Observable} from 'rxjs'

import type {UploadEvent} from '../types'

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
    const {url, method, headers, body, withCredentials, signal} = options

    log('[%d] %s %s (XHR upload with progress)', requestId, method, url)

    xhr.open(method, url)
    xhr.withCredentials = withCredentials

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
        subscriber.error(new Error(`XHR upload failed with status ${xhr.status}`))
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
