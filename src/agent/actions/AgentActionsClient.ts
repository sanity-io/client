import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {Any, HttpRequest, IdentifiedSanityDocumentStub, TranslateDocument} from '../../types'
import {
  _generate,
  type GenerateAsyncInstruction,
  type GenerateInstruction,
  type GenerateSyncInstruction,
} from './generate'
import {
  _transform,
  type TransformDocument,
  type TransformDocumentAsync,
  type TransformDocumentSync,
} from './transform'
import {_translate, type TranslateDocumentAsync, type TranslateDocumentSync} from './translate'

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

  transform(request: TransformDocumentAsync): Observable<{_id: string}>

  transform<DocumentShape extends Record<string, Any>>(
    request: TransformDocumentSync,
  ): Observable<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Transform a target document based on a source.
   * @param request translation request
   */
  transform<DocumentShape extends Record<string, Any>, Req extends TransformDocument>(
    request: Req,
  ): Observable<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _transform(this.#client, this.#httpRequest, request)
  }

  translate(request: TranslateDocumentAsync): Observable<{_id: string}>

  translate<DocumentShape extends Record<string, Any>>(
    request: TranslateDocumentSync,
  ): Observable<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Translate a target document based on a source.
   * @param request translation request
   */
  translate<DocumentShape extends Record<string, Any>, Req extends TranslateDocument>(
    request: Req,
  ): Observable<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _translate(this.#client, this.#httpRequest, request)
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

  transform(request: TransformDocumentAsync): Promise<{_id: string}>

  transform<DocumentShape extends Record<string, Any>>(
    request: TransformDocumentSync,
  ): Promise<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Transform a target document based on a source.
   * @param request translation request
   */
  transform<DocumentShape extends Record<string, Any>, Req extends TransformDocument>(
    request: Req,
  ): Promise<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_transform(this.#client, this.#httpRequest, request))
  }

  translate(request: TranslateDocumentAsync): Promise<{_id: string}>

  translate<DocumentShape extends Record<string, Any>>(
    request: TranslateDocumentSync,
  ): Promise<IdentifiedSanityDocumentStub & DocumentShape>

  /**
   * Translate a target document based on a source.
   * @param request translation request
   */
  translate<DocumentShape extends Record<string, Any>, Req extends TranslateDocument>(
    request: Req,
  ): Promise<
    Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_translate(this.#client, this.#httpRequest, request))
  }
}
