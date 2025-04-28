import type {
  AgentActionAsync,
  AgentActionPath,
  AgentActionRequestBase,
  AgentActionSync,
  AgentActionTargetInclude,
} from '@sanity/client/agent/actions/commonTypes'
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
import type {TransformTargetDocument} from './transform'

/**  @beta */
export interface TranslateRequestBase extends AgentActionRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string

  documentId: string
  targetDocument?: TransformTargetDocument

  fromLanguage?: TranslateLanguage
  toLanguage: TranslateLanguage

  /** string template using $variable  */
  styleGuide?: string
  /** param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable" */
  styleGuideParams?: AgentActionParams

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

  languageFieldPath?: AgentActionPathSegment | AgentActionPath

  protectedPhrases?: string[]
}

/**  @beta */
export interface TranslateLanguage {
  id: string
  title?: string
}

/**  @beta */
export interface TranslateTargetInclude extends AgentActionTargetInclude {
  /** string template using $variable from instructionParams  */
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
  /** string template using $variable from instructionParams  */
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
export type TranslateDocumentSync = TranslateRequestBase & AgentActionSync

/** @beta */
export type TranslateDocumentAsync = TranslateRequestBase & AgentActionAsync

/** @beta */
export type TranslateDocument = TranslateDocumentSync | TranslateDocumentAsync

export function _translate<
  DocumentShape extends Record<string, Any>,
  Req extends TranslateDocument,
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
    uri: `/agent/action/translate/${dataset}`,
    body: request,
  })
}
