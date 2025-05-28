import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {
  AgentActionParams,
  AgentActionPathSegment,
  AgentActionTarget,
  Any,
  HttpRequest,
  IdentifiedSanityDocumentStub,
} from '../../types'
import {hasDataset} from '../../validators'
import type {
  AgentActionAsync,
  AgentActionPath,
  AgentActionRequestBase,
  AgentActionSync,
  AgentActionTargetInclude,
} from './commonTypes'
import type {TransformTargetDocument} from './transform'

/**  @beta */
export interface TranslateRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string

  /**
   * The source document the transformation will use as input.
   * @see #AgentActionSchema.forcePublishedWrite
   */
  documentId: string

  /**
   * The target document will first get content copied over from the source,
   * then it is translated according to the instruction.
   *
   * When omitted, the source document (documentId) is also the target document.
   *
   * @see #AgentActionSchema.forcePublishedWrite
   */
  targetDocument?: TransformTargetDocument

  /**
   * While optional, it is recommended
   */
  fromLanguage?: TranslateLanguage
  toLanguage: TranslateLanguage

  /**
   * `styleGuide` can be used to tailor how the translation should be preformed.
   *
   * String template using $variable from styleGuideParams.
   *
   * Capped to 2000 characters, after variables has been injected.
   *
   * @see #protectedPhrases
   */
  styleGuide?: string
  /** param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable" */
  styleGuideParams?: AgentActionParams

  /**
   * When the input string contains any phrase from `protectedPhrases`, the LLM will be instructed not
   * to translate them.
   *
   * It is recommended to use `protectedPhrases` instead of `styleGuide` for deny-list words and phrases,
   * since it keeps token cost low, resulting in faster responses, and limits how much information the LLM
   * has to process, since only phrases that are actually in the input string will be included in the final prompt.
   */
  protectedPhrases?: string[]

  /**
   * When specified, the `toLanguage.id` will be stored in the specified path in the target document.
   *
   * The file _can_ be hidden: true (unlike other fields in the target, which will be ignored)
   */
  languageFieldPath?: AgentActionPathSegment | AgentActionPath

  /**
   * Target defines which parts of the document will be affected by the instruction.
   * It can be an array, so multiple parts of the document can be separately configured in detail.
   *
   * Omitting target implies that the document itself is the root.
   *
   * Notes:
   * - instruction can only affect fields up to `maxPathDepth`
   * - when multiple targets are provided, they will be coalesced into a single target sharing a common target root.
   * It is therefor an error to provide conflicting include/exclude across targets (ie, include title in one, and exclude it in another)
   *
   * @see AgentActionRequestBase#conditionalPaths
   */
  target?: TranslateTarget | TranslateTarget[]
}

/**  @beta */
export interface TranslateLanguage {
  /**
   * Language code
   */
  id: string

  /**
   * While optional, it is recommended to provide a language title
   */
  title?: string
}

/**  @beta */
export interface TranslateTargetInclude extends AgentActionTargetInclude {
  /** String template using $variable from styleGuideParams.  */
  styleGuide?: string

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | TranslateTargetInclude)[]
}

/**  @beta */
export interface TranslateTarget extends AgentActionTarget {
  /** String template using $variable from styleGuideParams.  */
  styleGuide?: string

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Fields or array items not on the include list, are implicitly excluded.
   */
  include?: (AgentActionPathSegment | TranslateTargetInclude)[]
}

/** @beta */
// need the generics to hold optional call-site response generics
// eslint-disable-next-line unused-imports/no-unused-vars
export type TranslateDocumentSync<T extends Record<string, Any> = Record<string, Any>> =
  TranslateRequestBase & AgentActionSync

/** @beta */
export type TranslateDocumentAsync = TranslateRequestBase & AgentActionAsync

/** @beta */
export type TranslateDocument<T extends Record<string, Any> = Record<string, Any>> =
  | TranslateDocumentSync<T>
  | TranslateDocumentAsync

export function _translate<DocumentShape extends Record<string, Any>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: TranslateDocument<DocumentShape>,
): Observable<
  (typeof request)['async'] extends true
    ? {_id: string}
    : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/agent/action/translate/${dataset}`,
    body: request,
  })
}
