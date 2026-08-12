import {type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {Any, HttpRequest, IdentifiedSanityDocumentStub} from '../../types'
import {_generate, _generateObservable, type GenerateInstruction} from './generate'
import {_patch, type PatchDocument} from './patch'
import {_prompt, type PromptRequest} from './prompt'
import {_transform, _transformObservable, type TransformDocument} from './transform'
import {_translate, _translateObservable, type TranslateDocument} from './translate'

/** @public */
export class ObservableAgentsActionClient {
  /**
   * Private properties. These do not use `#` (JS private) because TS collapses them to a
   * to a single `#private` in the emitted declaration, and that brands nominally, which
   * creates all sorts of type issues when there's multiple versions of `@sanity/client`
   * in the dependency tree. Instead, we rely on `@internal` to remove them from definitions,
   * the underscore prefix as a runtime "do not use" signal to external users.
   */

  /** @internal */
  _client: ObservableSanityClient

  /** @internal */
  _httpRequest: HttpRequest

  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this._client = client
    this._httpRequest = httpRequest
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
    return _generateObservable(this._client, this._httpRequest, request)
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
    return _transformObservable(this._client, this._httpRequest, request)
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
    return _translateObservable(this._client, this._httpRequest, request)
  }
}

/** @public */
export class AgentActionsClient {
  /**
   * Private properties. These do not use `#` (JS private) because TS collapses them to a
   * to a single `#private` in the emitted declaration, and that brands nominally, which
   * creates all sorts of type issues when there's multiple versions of `@sanity/client`
   * in the dependency tree. Instead, we rely on `@internal` to remove them from definitions,
   * the underscore prefix as a runtime "do not use" signal to external users.
   */

  /** @internal */
  _client: SanityClient

  /** @internal */
  _httpRequest: HttpRequest

  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this._client = client
    this._httpRequest = httpRequest
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
    return _generate(this._client, this._httpRequest, request)
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
    return _transform(this._client, this._httpRequest, request)
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
    return _translate(this._client, this._httpRequest, request)
  }

  /**
   * Run a raw instruction and return the result either as text or json
   * @param request - prompt request
   */
  prompt<const DocumentShape extends Record<string, Any>>(
    request: PromptRequest<DocumentShape>,
  ): Promise<(typeof request)['format'] extends 'json' ? DocumentShape : string> {
    return _prompt(this._client, this._httpRequest, request)
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
    return _patch(this._client, this._httpRequest, request)
  }
}
