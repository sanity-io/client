import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {
  Any,
  GenerateAsyncInstruction,
  GenerateInstruction,
  GenerateSyncInstruction,
  HttpRequest,
  IdentifiedSanityDocumentStub,
} from '../../types'
import {_generate} from './generate'

/** @public */
export class ObservableAgentsActionClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  generate(request: GenerateAsyncInstruction): Observable<{_id: string}>

  generate<DocumentShape extends Record<string, Any>>(
    request: GenerateSyncInstruction<DocumentShape>,
  ): Observable<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Run an instruction to generate content in a target document.
   * @param request instruction request
   */
  generate<
    DocumentShape extends Record<string, Any>,
    Req extends GenerateInstruction<DocumentShape>,
  >(
    request: Req,
  ): Observable<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _generate(this.#client, this.#httpRequest, request)
  }
}

/** @public */
export class AgentActionsClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  generate(request: GenerateAsyncInstruction): Promise<{_id: string}>

  generate<DocumentShape extends Record<string, Any>>(
    request: GenerateSyncInstruction<DocumentShape>,
  ): Promise<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Run an instruction to generate content in a target document.
   * @param request instruction request
   */
  generate<
    DocumentShape extends Record<string, Any>,
    Req extends GenerateInstruction<DocumentShape>,
  >(
    request: Req,
  ): Promise<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_generate(this.#client, this.#httpRequest, request))
  }
}
