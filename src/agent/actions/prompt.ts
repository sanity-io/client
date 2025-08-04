import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {AgentActionParams, Any, HttpRequest} from '../../types'
import {hasDataset} from '../../validators'

/**  @beta */
export interface PromptRequestBase {
  /**
   * Instruct the LLM how it should generate content. Be as specific and detailed as needed.
   *
   * The LLM only has access to information in the instruction, plus the target schema.
   *
   * String template with support for $variable from `instructionParams`.
   * */
  instruction: string
  /**
   * param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable"
   *
   * ### Examples
   *
   * #### Constant
   *
   * ##### Shorthand
   * ```ts
   * client.agent.action.prompt({
   *   instruction: 'Give the following topic:\n $topic \n ---\nReturns some facts about it',
   *   instructionParams: {
   *     topic: 'Grapefruit'
   *   },
   * })
   * ```
   * ##### Object-form
   *
   * ```ts
   * client.agent.action.prompt({
   *   instruction: 'Give the following topic:\n $topic \n ---\nReturns some facts about it.',
   *   instructionParams: {
   *     topic: {
   *       type: 'constant',
   *       value: 'Grapefruit'
   *     },
   *   },
   * })
   * ```
   * #### Field
   * ```ts
   * client.agent.action.prompt({
   *   instruction: 'Give the following field value:\n $pte \n ---\nGenerate keywords.',
   *   instructionParams: {
   *     pte: {
   *       type: 'field',
   *       path: ['pteField'],
   *       documentId: 'someSanityDocId'
   *     },
   *   },
   * })
   * ```
   * #### Document
   * ```ts
   * client.agent.action.prompt({
   *   json: true,
   *   instruction: 'Given the following document:$document\nCreate a JSON string[] array with keywords describing it.',
   *   instructionParams: {
   *     document: {
   *       type: 'document',
   *       documentId: 'someSanityDocId'
   *     },
   *   },
   * })
   * ```
   *
   * #### GROQ
   * ```ts
   * client.agent.action.prompt({
   *   instruction: 'Return the best title amongst these: $titles.',
   *   instructionParams: {
   *     titles: {
   *       type: 'groq',
   *       query: '* [_type==$type].title',
   *       params: {type: 'article'}
   *     },
   *   },
   * })
   * ```
   * */
  instructionParams?: AgentActionParams<{docIdRequired: true}>

  /**
   * Controls how much variance the instructions will run with.
   *
   * Value must be in the range [0, 1] (inclusive).
   *
   * Default: 0.3
   */
  temperature?: number
}

/**
 * @beta
 */
// need the unused generic here to allow for optional callsite casting
// eslint-disable-next-line unused-imports/no-unused-vars
interface PromptJsonResponse<T extends Record<string, Any> = Record<string, Any>> {
  /**
   *
   * When format is 'json', the response will be json according to the instruction.
   * Note: In addition to setting this to 'json',  `instruction` MUST include the word 'JSON', or 'json' for this to work.
   */
  format: 'json'
}

interface PromptTextResponse {
  /**
   * When format is 'string', the response will be a raw text response to the instruction.
   */
  format?: 'string'
}

/** @beta */
export type PromptRequest<T extends Record<string, Any> = Record<string, Any>> = (
  | PromptTextResponse
  | PromptJsonResponse<T>
) &
  PromptRequestBase

export function _prompt<const DocumentShape extends Record<string, Any>>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: PromptRequest<DocumentShape>,
): Observable<(typeof request)['format'] extends 'json' ? DocumentShape : string> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/agent/action/prompt/${dataset}`,
    body: request,
  })
}
