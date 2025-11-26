import {Observable, of, throwError} from 'rxjs'
import {filter, map} from 'rxjs/operators'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import {
  type Any,
  type ListenEvent,
  type ListenEventName,
  type ListenOptions,
  type ListenParams,
  type MutationEvent,
  type OpenEvent,
  type ReconnectEvent,
  type WelcomeEvent,
} from '../types'
import defaults from '../util/defaults'
import {pick} from '../util/pick'
import {_getDataUrl} from './dataMethods'
import {encodeQueryString} from './encodeQueryString'
import {connectEventSource} from './eventsource'
import {eventSourcePolyfill} from './eventsourcePolyfill'
import {reconnectOnConnectionFailure} from './reconnectOnConnectionFailure'

// Limit is 16K for a _request_, eg including headers. Have to account for an
// unknown range of headers, but an average EventSource request from Chrome seems
// to have around 700 bytes of cruft, so let us account for 1.2K to be "safe"
const MAX_URL_LENGTH = 16000 - 1200

const possibleOptions = [
  'includePreviousRevision',
  'includeResult',
  'includeMutations',
  'includeAllVersions',
  'visibility',
  'effectFormat',
  'tag',
]

const defaultOptions = {
  includeResult: true,
}

/**
 * Maps an array of listen events names to their corresponding listen event type, e.g:
 * ```
 * type Test = MapListenEventNamesToListenEvents<Doc, ['welcome']>
 *    // ^? WelcomeEvent
 * ```
 *
 * @public
 */
export type MapListenEventNamesToListenEvents<
  R extends Record<string, Any> = Record<string, Any>,
  Events extends ListenEventName[] = ListenEventName[],
> = Events extends (infer E)[]
  ? E extends 'welcome'
    ? WelcomeEvent
    : E extends 'mutation'
      ? MutationEvent<R>
      : E extends 'reconnect'
        ? ReconnectEvent
        : E extends 'open'
          ? OpenEvent
          : never
  : never

/**
 * Maps a ListenOptions object and returns the Listen events opted for, e.g:
 * ```
 * type Test = ListenEventFromOptions<Doc, {events: ['welcome', 'mutation']}>
 *    // ^? WelcomeEvent | MutationEvent<Doc>
 * ```
 *
 * @public
 */
export type ListenEventFromOptions<
  R extends Record<string, Any> = Record<string, Any>,
  Opts extends ListenOptions | undefined = undefined,
> = Opts extends ListenOptions
  ? Opts['events'] extends ListenEventName[]
    ? MapListenEventNamesToListenEvents<R, Opts['events']>
    : // fall back to ListenEvent if opts events is present, but we can't infer the literal event names
      ListenEvent<R>
  : MutationEvent<R>

/**
 * Set up a listener that will be notified when mutations occur on documents matching the provided query/filter.
 *
 * @param query - GROQ-filter to listen to changes for
 * @param params - Optional query parameters
 * @param options - Optional listener options
 * @public
 */
export function _listen<R extends Record<string, Any> = Record<string, Any>>(
  this: SanityClient | ObservableSanityClient,
  query: string,
  params?: ListenParams,
): Observable<MutationEvent<R>>
/**
 * Set up a listener that will be notified when mutations occur on documents matching the provided query/filter.
 *
 * @param query - GROQ-filter to listen to changes for
 * @param params - Optional query parameters
 * @param options - Optional listener options
 * @public
 */
export function _listen<
  R extends Record<string, Any> = Record<string, Any>,
  Opts extends ListenOptions = ListenOptions,
>(
  this: SanityClient | ObservableSanityClient,
  query: string,
  params?: ListenParams,
  options?: Opts,
): Observable<ListenEventFromOptions<R, Opts>>
/** @public */
export function _listen<
  R extends Record<string, Any> = Record<string, Any>,
  Opts extends ListenOptions = ListenOptions,
>(
  this: SanityClient | ObservableSanityClient,
  query: string,
  params?: ListenParams,
  opts: Opts = {} as Opts,
): Observable<ListenEventFromOptions<R, Opts>> {
  const {url, token, withCredentials, requestTagPrefix, headers: configHeaders} = this.config()
  const tag = opts.tag && requestTagPrefix ? [requestTagPrefix, opts.tag].join('.') : opts.tag
  const options = {...defaults(opts, defaultOptions), tag}
  const listenOpts = pick(options, possibleOptions)
  const qs = encodeQueryString({query, params, options: {tag, ...listenOpts}})

  const uri = `${url}${_getDataUrl(this, 'listen', qs)}`
  if (uri.length > MAX_URL_LENGTH) {
    return throwError(() => new Error('Query too large for listener'))
  }

  const listenFor = (options.events ? options.events : ['mutation']) satisfies Opts['events']

  const esOptions: EventSourceInit & {headers?: Record<string, string>} = {}
  if (withCredentials) {
    esOptions.withCredentials = true
  }

  if (token || configHeaders) {
    esOptions.headers = {}

    if (token) {
      esOptions.headers.Authorization = `Bearer ${token}`
    }

    if (configHeaders) {
      Object.assign(esOptions.headers, configHeaders)
    }
  }

  const initEventSource = () =>
    // use polyfill if there is no global EventSource or if we need to set headers
    (typeof EventSource === 'undefined' || esOptions.headers
      ? eventSourcePolyfill
      : of(EventSource)
    ).pipe(map((EventSource) => new EventSource(uri, esOptions)))

  return connectEventSource(initEventSource, listenFor).pipe(
    reconnectOnConnectionFailure(),
    filter((event) => listenFor.includes(event.type)),
    map((event) => ({
      type: event.type,
      ...('data' in event ? (event.data as object) : {}),
    })),
  ) as Observable<ListenEventFromOptions<R, Opts>>
}
