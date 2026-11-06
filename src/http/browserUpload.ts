import {Observable} from 'rxjs'

import type {RequestInstrumentation, UploadEvent} from '../types'
import {ClientError, httpResponseFromFetch, ServerError} from './errors'
import {observeRequest} from './instrumentation'
import {parseJsonText} from './request'

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
  /** The client's `instrumentation` option, which observes the upload request. */
  instrumentation?: RequestInstrumentation
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
    const {url, method, headers, body, withCredentials, timeout, signal, instrumentation} = options
    let requestObserver: ReturnType<typeof observeRequest>
    // Ends the upload with `error`, reporting it to the instrumentation first.
    const fail = (error: unknown) => {
      requestObserver?.end({error})
      subscriber.error(error)
    }

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

    xhr.onreadystatechange = () => {
      if (requestObserver && xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        requestObserver.headers({
          status: xhr.status,
          headers: parseXhrResponseHeaders(xhr.getAllResponseHeaders()),
        })
      }
    }

    xhr.onload = () => {
      // The body has been read in full, so the request itself completed.
      requestObserver?.end({})
      const responseHeaders = parseXhrResponseHeaders(xhr.getAllResponseHeaders())
      if (xhr.status >= 400) {
        // Same typed errors as the fetch transport, so consumers can keep
        // detecting `ClientError`/`ServerError` and reading `statusCode`,
        // `responseBody` and the structured API `details` on failed uploads.
        const canonical = httpResponseFromFetch(
          {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: responseHeaders,
            body: parseJsonText(xhr.responseText, responseHeaders),
            url: xhr.responseURL,
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
      fail(new Error('XHR upload network error'))
    }

    xhr.ontimeout = () => {
      // Same error shape as the fetch transport's timeout rejection.
      fail(
        new DOMException(
          `The operation timed out after ${timeout}ms while attempting to reach ${url}`,
          'TimeoutError',
        ),
      )
    }

    xhr.onabort = () => {
      fail(new DOMException('Upload aborted', 'AbortError'))
    }

    const onSignalAbort = () => xhr.abort()
    if (signal) {
      if (signal.aborted) {
        // `xhr.abort()` before `send()` fires no `abort` event per spec, so
        // error out directly instead of relying on `onabort`.
        subscriber.error(new DOMException('Upload aborted', 'AbortError'))
        return undefined
      }
      signal.addEventListener('abort', onSignalAbort, {once: true})
    }

    if (instrumentation) {
      requestObserver = observeRequest(instrumentation, {
        url,
        method: method.toUpperCase(),
      })
    }
    xhr.send(body as XMLHttpRequestBodyInit)

    // Unsubscribing cancels the in-flight upload, mirroring how the fetch
    // path aborts its request (`_observe`). After settle this is a no-op —
    // except for detaching from the caller's signal, which may be long-lived
    // and must not accumulate a listener per upload.
    return () => {
      signal?.removeEventListener('abort', onSignalAbort)
      xhr.abort()
    }
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
