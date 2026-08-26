import {type Observable, throwError} from 'rxjs'
import {map} from 'rxjs/operators'

import {_requestObservable, getQuerySizeLimit} from '../data/dataMethods'
import {encodeQueryString} from '../data/encodeQueryString'
import {
  _connectListenEventSource,
  defaultOptions as defaultListenOptions,
  type ListenEventFromOptions,
  MAX_URL_LENGTH,
  possibleOptions as possibleListenOptions,
} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, QueryParams, ResumableListenEventNames, SanityDocument} from '../types'
import defaults from '../util/defaults'
import {pick} from '../util/pick'
import {
  type ContextInsightsListenOptions,
  type ContextInsightsRequestOptions,
  possibleInsightsRequestOptions,
} from './types'

type Client = SanityClient | ObservableSanityClient

function insightsUrl(client: Client, suffix: 'query' | 'listen'): string {
  const organizationId = client.config().context?.organizationId

  if (!organizationId) {
    throw new Error('`context.organizationId` must be configured to use context insights')
  }

  return `/context/organizations/${encodeURIComponent(organizationId)}/insights/${suffix}`
}

/** @internal */
export function _fetch<R>(
  client: Client,
  httpRequest: HttpRequest,
  query: string,
  params?: QueryParams,
  options?: ContextInsightsRequestOptions,
): Observable<R> {
  const url = insightsUrl(client, 'query')

  // Mirrors `client.fetch`: GET while the query fits in the URL, POST beyond that.
  const useGet = encodeQueryString({query, params}).length < getQuerySizeLimit
  const request = useGet
    ? {
        method: 'GET',
        url: `${url}${encodeQueryString({query, params})}`,
      }
    : {
        method: 'POST',
        url,
        body: {query, params: params ?? {}},
      }

  return _requestObservable<{result: R}>(client, httpRequest, {
    ...request,
    ...pick(options || {}, possibleInsightsRequestOptions),
  }).pipe(map((response) => response.result))
}

/** @internal */
export function _listen<Opts extends ContextInsightsListenOptions | undefined = undefined>(
  client: Client,
  query: string,
  params?: QueryParams,
  options?: Opts,
): Observable<ListenEventFromOptions<SanityDocument, Opts>> {
  const opts: ContextInsightsListenOptions = options ?? {}

  // Mirrors `_listen` in data/listen.ts, but against the insights listen endpoint
  const {requestTagPrefix} = client.config()
  const tag = opts.tag && requestTagPrefix ? [requestTagPrefix, opts.tag].join('.') : opts.tag
  const listenOpts = pick({...defaults(opts, defaultListenOptions), tag}, possibleListenOptions)
  const qs = encodeQueryString({
    query,
    params,
    options: listenOpts,
  })

  const uri = `${client.getUrl(insightsUrl(client, 'listen'))}${qs}`
  if (uri.length > MAX_URL_LENGTH) {
    return throwError(() => new Error('Query too large for listener'))
  }

  const events: ResumableListenEventNames[] = opts.events ? opts.events : ['mutation']

  return _connectListenEventSource<ListenEventFromOptions<SanityDocument, Opts>>(
    client,
    uri,
    events,
  )
}
