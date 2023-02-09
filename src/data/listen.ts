import polyfilledEventSource from '@sanity/eventsource'
import {Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {Any, ListenEvent, ListenOptions, MutationEvent, QueryParams} from '../types'
import defaults from '../util/defaults'
import {pick} from '../util/pick'
import {_getDataUrl} from './dataMethods'
import {encodeQueryString} from './encodeQueryString'

// Limit is 16K for a _request_, eg including headers. Have to account for an
// unknown range of headers, but an average EventSource request from Chrome seems
// to have around 700 bytes of cruft, so let us account for 1.2K to be "safe"
const MAX_URL_LENGTH = 16000 - 1200
const EventSource = polyfilledEventSource

const possibleOptions = [
  'includePreviousRevision',
  'includeResult',
  'visibility',
  'effectFormat',
  'tag',
]

const defaultOptions = {
  includeResult: true,
}

/**
 * Set up a listener that will be notified when mutations occur on documents matching the provided query/filter.
 *
 * @param query - GROQ-filter to listen to changes for
 * @param params - Optional query parameters
 * @param options - Listener options
 * @internal
 */
export function _listen<R extends Record<string, Any> = Record<string, Any>>(
  this: SanityClient | ObservableSanityClient,
  query: string,
  params?: QueryParams
): Observable<MutationEvent<R>>
/**
 * Set up a listener that will be notified when mutations occur on documents matching the provided query/filter.
 *
 * @param query - GROQ-filter to listen to changes for
 * @param params - Optional query parameters
 * @param options - Listener options
 * @internal
 */
export function _listen<R extends Record<string, Any> = Record<string, Any>>(
  this: SanityClient | ObservableSanityClient,
  query: string,
  params?: QueryParams,
  options?: ListenOptions
): Observable<ListenEvent<R>>
/** @internal */
export function _listen<R extends Record<string, Any> = Record<string, Any>>(
  this: SanityClient | ObservableSanityClient,
  query: string,
  params?: QueryParams,
  opts: ListenOptions = {}
): Observable<MutationEvent<R> | ListenEvent<R>> {
  const {url, token, withCredentials, requestTagPrefix} = this.config()
  const tag = opts.tag && requestTagPrefix ? [requestTagPrefix, opts.tag].join('.') : opts.tag
  const options = {...defaults(opts, defaultOptions), tag}
  const listenOpts = pick(options, possibleOptions)
  const qs = encodeQueryString({query, params, options: {tag, ...listenOpts}})

  const uri = `${url}${_getDataUrl(this, 'listen', qs)}`
  if (uri.length > MAX_URL_LENGTH) {
    return new Observable((observer) => observer.error(new Error('Query too large for listener')))
  }

  const listenFor = options.events ? options.events : ['mutation']
  const shouldEmitReconnect = listenFor.indexOf('reconnect') !== -1

  const esOptions: EventSourceInit & {headers?: Record<string, string>} = {}
  if (token || withCredentials) {
    esOptions.withCredentials = true
  }

  if (token) {
    esOptions.headers = {
      Authorization: `Bearer ${token}`,
    }
  }

  return new Observable((observer) => {
    let es = getEventSource()
    let reconnectTimer: NodeJS.Timeout
    let stopped = false

    function onError() {
      if (stopped) {
        return
      }

      emitReconnect()

      // Allow event handlers of `emitReconnect` to cancel/close the reconnect attempt
      if (stopped) {
        return
      }

      // Unless we've explicitly stopped the ES (in which case `stopped` should be true),
      // we should never be in a disconnected state. By default, EventSource will reconnect
      // automatically, in which case it sets readyState to `CONNECTING`, but in some cases
      // (like when a laptop lid is closed), it closes the connection. In these cases we need
      // to explicitly reconnect.
      if (es.readyState === EventSource.CLOSED) {
        unsubscribe()
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(open, 100)
      }
    }

    function onChannelError(err: Any) {
      observer.error(cooerceError(err))
    }

    function onMessage(evt: Any) {
      const event = parseEvent(evt)
      return event instanceof Error ? observer.error(event) : observer.next(event)
    }

    function onDisconnect() {
      stopped = true
      unsubscribe()
      observer.complete()
    }

    function unsubscribe() {
      es.removeEventListener('error', onError, false)
      es.removeEventListener('channelError', onChannelError, false)
      es.removeEventListener('disconnect', onDisconnect, false)
      listenFor.forEach((type: string) => es.removeEventListener(type, onMessage, false))
      es.close()
    }

    function emitReconnect() {
      if (shouldEmitReconnect) {
        observer.next({type: 'reconnect'})
      }
    }

    function getEventSource() {
      const evs = new EventSource(uri, esOptions)
      evs.addEventListener('error', onError, false)
      evs.addEventListener('channelError', onChannelError, false)
      evs.addEventListener('disconnect', onDisconnect, false)
      listenFor.forEach((type: string) => evs.addEventListener(type, onMessage, false))
      return evs
    }

    function open() {
      es = getEventSource()
    }

    function stop() {
      stopped = true
      unsubscribe()
    }

    return stop
  })
}

function parseEvent(event: Any) {
  try {
    const data = (event.data && JSON.parse(event.data)) || {}
    return Object.assign({type: event.type}, data)
  } catch (err) {
    return err
  }
}

function cooerceError(err: Any) {
  if (err instanceof Error) {
    return err
  }

  const evt = parseEvent(err)
  return evt instanceof Error ? evt : new Error(extractErrorMessage(evt))
}

function extractErrorMessage(err: Any) {
  if (!err.error) {
    return err.message || 'Unknown listener error'
  }

  if (err.error.description) {
    return err.error.description
  }

  return typeof err.error === 'string' ? err.error : JSON.stringify(err.error, null, 2)
}
