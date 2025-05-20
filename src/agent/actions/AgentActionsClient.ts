import {lastValueFrom, type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {Any, HttpRequest, IdentifiedSanityDocumentStub} from '../../types'
import {_generate, type GenerateInstruction} from './generate'
import {_patch, type PatchDocument} from './patch'
import {_prompt, type PromptRequest} from './prompt'
import {_transform, type TransformDocument} from './transform'
import {_translate, type TranslateDocument} from './translate'

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

  /**
   * Run a raw instruction and return the result either as text or json
   * @param request - prompt request
   */
  prompt<const DocumentShape extends Record<string, Any>>(
    request: PromptRequest<DocumentShape>,
  ): Promise<(typeof request)['format'] extends 'json' ? DocumentShape : string> {
    return lastValueFrom(_prompt(this.#client, this.#httpRequest, request))
  }

  /**
   * Patch a document using a schema aware API.
   * Does not use an LLM, but uses the schema to ensure paths and values matches the schema.
   * @param request - instruction request
   */
  patch<DocumentShape extends Record<string, Any>>(
    request: PatchDocument<DocumentShape>,
  ): Promise<
    (typeof request)['async'] extends true
      ? {_id: string}
      : IdentifiedSanityDocumentStub & DocumentShape
  > {
    return lastValueFrom(_patch(this.#client, this.#httpRequest, request))
  }
}
