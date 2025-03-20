import {lastValueFrom, type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  Any,
  HttpRequest,
  IdentifiedSanityDocumentStub,
  InstructAsyncInstruction,
  InstructInstruction,
  InstructSyncInstruction,
} from '../types'
import {hasDataset} from '../validators'

function _instruct<
  DocumentShape extends Record<string, Any>,
  Req extends InstructInstruction<DocumentShape>,
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
export class ObservableAiClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  instruct(request: InstructAsyncInstruction): Observable<{_id: string}>

  instruct<DocumentShape extends Record<string, Any>>(
    request: InstructSyncInstruction<DocumentShape>,
  ): Observable<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Run an ad-hoc instruction for a target document.
   * @param request instruction request
   */
  instruct<
    DocumentShape extends Record<string, Any>,
    Req extends InstructInstruction<DocumentShape>,
  >(
    request: Req,
  ): Observable<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _instruct(this.#client, this.#httpRequest, request)
  }
}

/** @public */
export class AiClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  instruct(request: InstructAsyncInstruction): Promise<{_id: string}>

  instruct<DocumentShape extends Record<string, Any>>(
    request: InstructSyncInstruction<DocumentShape>,
  ): Promise<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Run an ad-hoc instruction for a target document.
   * @param request instruction request
   */
  instruct<
    DocumentShape extends Record<string, Any>,
    Req extends InstructInstruction<DocumentShape>,
  >(
    request: Req,
  ): Promise<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_instruct(this.#client, this.#httpRequest, request))
  }
}
