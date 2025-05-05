import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {Any, HttpRequest, IdentifiedSanityDocumentStub, TranslateDocument} from '../../types'
import {_generate, type GenerateInstruction} from './generate'
import {_transform, type TransformDocument} from './transform'
import {_translate} from './translate'

/** @public */
export class ObservableAgentsActionClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * Run an instruction to generate content in a target document.
   * @param request - instruction request
   */
  generate<DocumentShape extends Record<string, Any>>(
    request: GenerateInstruction<DocumentShape>,
  ): Observable<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _generate(this.#client, this.#httpRequest, request)
  }

  /**
   * Transform a target document based on a source.
   * @param request - translation request
   */
  transform<DocumentShape extends Record<string, Any>>(
    request: TransformDocument<DocumentShape>,
  ): Observable<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return _transform(this.#client, this.#httpRequest, request)
  }

  /**
   * Translate a target document based on a source.
   * @param request - translation request
   */
  translate<DocumentShape extends Record<string, Any>>(
    request: TranslateDocument<DocumentShape>,
  ): Observable<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
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

  /**
   * Run an instruction to generate content in a target document.
   * @param request - instruction request
   */
  generate<DocumentShape extends Record<string, Any>>(
    request: GenerateInstruction<DocumentShape>,
  ): Promise<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_generate(this.#client, this.#httpRequest, request))
  }

  /**
   * Transform a target document based on a source.
   * @param request - translation request
   */
  transform<DocumentShape extends Record<string, Any>>(
    request: TransformDocument<DocumentShape>,
  ): Promise<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_transform(this.#client, this.#httpRequest, request))
  }

  /**
   * Translate a target document based on a source.
   * @param request - translation request
   */
  translate<DocumentShape extends Record<string, Any>>(
    request: TranslateDocument<DocumentShape>,
  ): Promise<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_translate(this.#client, this.#httpRequest, request))
  }
}
