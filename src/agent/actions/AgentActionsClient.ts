import {type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {Any, HttpRequestPromise, IdentifiedSanityDocumentStub} from '../../types'
import {_generate, _generatePromise, type GenerateInstruction} from './generate'
import {_patchPromise, type PatchDocument} from './patch'
import {_promptPromise, type PromptRequest} from './prompt'
import {_transform, _transformPromise, type TransformDocument} from './transform'
import {_translate, _translatePromise, type TranslateDocument} from './translate'

/** @public */
export class ObservableAgentsActionClient {
  #client: ObservableSanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: ObservableSanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
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
    return _generate(this.#client, this.#httpRequestPromise, request)
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
    return _transform(this.#client, this.#httpRequestPromise, request)
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
    return _translate(this.#client, this.#httpRequestPromise, request)
  }
}

/** @public */
export class AgentActionsClient {
  #client: SanityClient
  #httpRequestPromise: HttpRequestPromise
  constructor(client: SanityClient, httpRequestPromise: HttpRequestPromise) {
    this.#client = client
    this.#httpRequestPromise = httpRequestPromise
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
    return _generatePromise(this.#client, this.#httpRequestPromise, request)
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
    return _transformPromise(this.#client, this.#httpRequestPromise, request)
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
    return _translatePromise(this.#client, this.#httpRequestPromise, request)
  }

  /**
   * Run a raw instruction and return the result either as text or json
   * @param request - prompt request
   */
  prompt<const DocumentShape extends Record<string, Any>>(
    request: PromptRequest<DocumentShape>,
  ): Promise<(typeof request)['format'] extends 'json' ? DocumentShape : string> {
    return _promptPromise(this.#client, this.#httpRequestPromise, request)
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
    return _patchPromise(this.#client, this.#httpRequestPromise, request)
  }
}
