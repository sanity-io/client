import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  Any,
  AssistAsyncInstruction,
  AssistInstruction,
  AssistSyncInstruction,
  HttpRequest,
  IdentifiedSanityDocumentStub,
} from '../types'
import {hasDataset} from '../validators'

function _instruct<
  DocumentShape extends Record<string, Any>,
  Req extends AssistInstruction<DocumentShape>,
>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: Req,
): Observable<
  Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/assist/tasks/instruct/${dataset}`,
    body: request,
  })
}

/** @public */
export class ObservableAssistClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  instruct(request: AssistAsyncInstruction): Observable<{_id: string}>

  instruct<DocumentShape extends Record<string, Any>>(
    request: AssistSyncInstruction<DocumentShape>,
  ): Observable<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Run an ad-hoc instruction for a target document.
   * @param request instruction request
   */
  instruct<DocumentShape extends Record<string, Any>, Req extends AssistInstruction<DocumentShape>>(
    request: Req,
  ): Observable<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _instruct(this.#client, this.#httpRequest, request)
  }
}

/** @public */
export class AssistClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  instruct(request: AssistAsyncInstruction): Promise<{_id: string}>

  instruct<DocumentShape extends Record<string, Any>>(
    request: AssistSyncInstruction<DocumentShape>,
  ): Promise<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Run an ad-hoc instruction for a target document.
   * @param request instruction request
   */
  instruct<DocumentShape extends Record<string, Any>, Req extends AssistInstruction<DocumentShape>>(
    request: Req,
  ): Promise<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_instruct(this.#client, this.#httpRequest, request))
  }
}
