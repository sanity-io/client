import type {ClientPerspective} from '@sanity/client'

/**
 * Include a string in the instruction: do not have to escape $ signs in the string.
 *
 * ```ts
 * client.agent.action.generate({
 *   schemaId,
 *   documentId,
 *   instruction: 'Give the following topic:\n $topic \n ---\nGenerate the full article.',
 *   instructionParams: {
 *     topic: {
 *       type: 'constant',
 *       value: 'Grapefruit'
 *     },
 *   },
 * })
 * ```
 *
 * `type: 'constant'` can also be provided directly as a string, as a shorthand:
 *
 * ```ts
 * client.agent.action.generate({
 *   schemaId,
 *   documentId,
 *   instruction: 'Give the following topic:\n $topic \n ---\nGenerate the full article.',
 *   instructionParams: {
 *     topic: 'Grapefruit'
 *   },
 * })
 * ```
 *
 * @beta
 * */
export interface ConstantAgentActionParam {
  type: 'constant'
  value: string
}

type DocIdParam<TParamConfig extends {docIdRequired: boolean} = {docIdRequired: false}> =
  TParamConfig['docIdRequired'] extends true
    ? {documentId: string}
    : {
        /**
         * If omitted, implicitly uses the documentId of the instruction target
         */
        documentId?: string
      }

/**
 *
 *
 * Includes a LLM-friendly version of the field value in the instruction
 *
 * ```ts
 * client.agent.action.generate({
 *   schemaId,
 *   documentId,
 *   instruction: 'Give the following field value:\n $pte \n ---\nGenerate keywords.',
 *   instructionParams: {
 *     pte: {
 *       type: 'field',
 *       path: ['pteField'],
 *     },
 *   },
 *   target: {path: 'keywords' }
 * })
 *
 * ```
 *
 * @beta
 * */
export type FieldAgentActionParam<
  TParamConfig extends {docIdRequired: boolean} = {docIdRequired: false},
> = {
  type: 'field'
  /**
   * Examples: 'title', ['array', \{_key: 'arrayItemKey'\}, 'field']
   */
  path: AgentActionPathSegment | AgentActionPath
} & DocIdParam<TParamConfig>

/**
 *
 * Includes a LLM-friendly version of the document in the instruction
 *
 * ```ts
 * client.agent.action.generate({
 *   schemaId,
 *   documentId,
 *   instruction: 'Give the following document value:\n $document \n ---\nGenerate keywords.',
 *   instructionParams: {
 *     document: {
 *       type: 'document',
 *     },
 *   },
 *   target: {path: 'keywords' }
 * })
 * ```
 *
 * @beta
 * */
export type DocumentAgentActionParam<
  TParamConfig extends {docIdRequired: boolean} = {docIdRequired: false},
> = {
  type: 'document'
} & DocIdParam<TParamConfig>

/**
 * Includes a LLM-friendly version of GROQ query result in the instruction
 *
 * ```ts
 * client.agent.action.generate({
 *   schemaId,
 *   documentId,
 *   instruction: 'Give the following list of titles:\n $list \n ---\nGenerate a similar title.',
 *   instructionParams: {
 *     list: {
 *       type: 'groq',
 *       query: '* [_type==$type].title',
 *       params: {type: 'article'}
 *     },
 *   },
 *   target: {path: 'title' }
 * })
 * ```
 * @beta
 * */
export interface GroqAgentActionParam {
  type: 'groq'
  query: string
  params?: Record<string, string>
  perspective?: ClientPerspective
}

/**  @beta */
export type AgentActionTypeConfig =
  | {include: string[]; exclude?: never}
  | {exclude: string[]; include?: never}

/**  @beta */
export type AgentActionPathSegment = string | {_key: string}

/**  @beta */
export type AgentActionPath = AgentActionPathSegment[]

/**  @beta */
export interface AgentActionTargetInclude {
  path: AgentActionPathSegment | AgentActionPath

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   * Fields or array items not on the exclude list, are implicitly included.
   */
  exclude?: AgentActionPathSegment[]

  /**
   * Types can be used to exclude array item types or all fields directly under the target path of a certain type.
   * If you do exclude: ['string'] all string fields under the target will be excluded, for instance.
   *
   * `types.include` and `types.exclude` are mutually exclusive.
   */
  types?: AgentActionTypeConfig
}

/**
 * @beta
 */
export interface AgentActionTarget {
  /**
   * Root target path.
   *
   * Use this to have the instruction only affect a part of the document.
   *
   * To further control the behavior of individual paths under the root, use `include`, `exclude`, `types.include`
   * and `types.exclude`.
   *
   * Example:
   *
   * `path: ['body', {_key: 'someKey'}, 'nestedObject']`
   *
   * Here, the instruction will only write to fields under the nestedObject.
   *
   * Default: [] = the document itself
   *
   * @see #AgentActionPathSegment
   * @see #AgentActionPath
   * */
  path?: AgentActionPathSegment | AgentActionPath

  /**
   * maxPathDepth controls how deep into the schema from the target root the instruction will affect.
   *
   * Depth is based on path segments:
   * - `title` has depth 1
   * - `array[_key="no"].title` has depth 3
   *
   * Be careful not to set this too high in studios with recursive document schemas, as it could have
   * negative impact on performance; both for runtime and quality of responses.
   *
   * Default: 4
   */
  maxPathDepth?: number

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   * Fields or array items not on the exclude list, are implicitly included.
   */
  exclude?: AgentActionPathSegment[]

  /**
   * Types can be used to exclude array item types or all fields directly under the target path of a certain type.
   * If you do exclude: ['string'] all string fields under the target will be excluded, for instance.
   *
   * `types.include` and `types.exclude` are mutually exclusive.
   */
  types?: AgentActionTypeConfig
}

/** @beta */
export type AgentActionParam<
  TParamConfig extends {docIdRequired: boolean} = {docIdRequired: false},
> =
  | string
  | ConstantAgentActionParam
  | FieldAgentActionParam<TParamConfig>
  | DocumentAgentActionParam<TParamConfig>
  | GroqAgentActionParam

/** @beta */
export type AgentActionParams<
  TParamConfig extends {docIdRequired: boolean} = {docIdRequired: false},
> = Record<string, AgentActionParam<TParamConfig>>

/** @beta */
export interface AgentActionSchema {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string

  /**
   * ### forcePublishedWrite: false (default)
   * By default, agent actions will never write to a published document.
   *
   * Instead, they will force the use of a draft ID ("drafts.some-id") instead of the published ID ("some-id"),
   * even when a published ID is provided.
   *
   * Actions will use state from an existing draft if it exists,
   * or use the published document to create a draft, if no draft exists.
   *
   * Successful responses contains the _id that was mutated by the action.
   *
   *
   * ### forcePublishedWrite: true
   *
   * When forcePublishedWrite: true an agent action will write to the exact id provided.
   * The action will also not fallback to published state for draft ids.
   *
   *
   * ### Versioned ids (releases)
   *
   * When an ID on the form "versions.<release>.some-id" is provided, agent actions will
   * always behave as if `forcePublishedWrite: true`.
   * That is, only the exact document state of the id provided is considered and mutated.
   * */
  forcePublishedWrite?: boolean

  /**
   * When a type or field in the schema has a function set for `hidden` or `readOnly`, it is conditional.
   *
   * By default, Generate will not output to conditional `readOnly` and `hidden` fields,
   * ie, they are considered to resolve to `readOnly: true` / `hidden: true`.
   *
   * `conditionalPaths` param allows setting the default conditional value for
   * `hidden` and `readOnly` to false,
   * or individually set `hidden` and `readOnly` state for individual document paths.
   *
   * Note: fields and types with explicit readOnly: true or hidden: true in the schema, are not available to Generate,
   * and cannot be changed via conditionalPaths
   *
   * conditionalPaths state only apply to fields and types that have conditional `hidden` or `readOnly` in their schema definition.
   *
   * Consider using `hidden: () => true` in schema config, if a field should be writeable only by Generate and never
   * visible in the studio – then make the field visible to the Generate using `conditionalPaths`.
   *
   * @see GenerateRequestBase#target
   */
  conditionalPaths?: {
    defaultReadOnly?: boolean
    defaultHidden?: boolean
    paths?: {
      /** path here is not a relative path: it must be the full document path, regardless of `path` param used in targets */
      path: AgentActionPath
      readOnly: boolean
      hidden: boolean
    }[]
  }
}

/** @beta */
export interface AgentActionRequestBase extends AgentActionSchema {
  /**
   * When localeSettings is provided on the request, instruct can write to date and datetime fields.
   * Otherwise, such fields will be ignored.
   */
  localeSettings?: {
    /**
     * A valid Unicode BCP 47 locale identifier used to interpret and format
     * natural language inputs and date output. Examples include "en-US", "fr-FR", or "ja-JP".
     *
     * This affects how phrases like "next Friday" or "in two weeks" are parsed,
     * and how resulting dates are presented (e.g., 12-hour vs 24-hour format).
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl#getcanonicalocales
     */
    locale: string

    /**
     * A valid IANA time zone identifier used to resolve relative and absolute
     * date expressions to a specific point in time. Examples include
     * "America/New_York", "Europe/Paris", or "Asia/Tokyo".
     *
     * This ensures phrases like "tomorrow at 9am" are interpreted correctly
     * based on the user's local time.
     *
     * @see https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
     */
    timeZone: string
  }

  /**
   * Controls how much variance the instructions will run with.
   *
   * Value must be in the range [0, 1] (inclusive).
   *
   * Defaults:
   * - generate: 0.3
   * - translate: 0
   * - transform: 0
   */
  temperature?: number
}

/** @beta */
export interface AgentActionSync {
  /**
   * By default, noWrite: false.
   * Write enabled operations will mutate the target document, and emit AI presence in the studio.
   *
   * When noWrite: true, the api will not mutate any documents nor emit presence.
   * Ie, when true, no changes will be made to content-lake
   *
   * noWrite: true is incompatible with async: true,
   * as noWrite implies that you will use the return value of the operation
   */
  noWrite?: boolean

  /**
   * When async: true, requests responds with status 201 and \{_id\} as response body as soon as the request is validated.
   * The instruction operation will carry on in the background.
   *
   * When async: false (default), requests respond with status 200 and the document value after instruction has been applied.
   *
   * async: true is incompatible with noWrite: true, as async: true does not return the resulting document
   */
  async?: false
}

/** @beta */
export interface AgentActionAsync {
  /**
   * When async: true, requests responds with status 201 and \{_id\} as response body as soon as the request is validated.
   * The instruction operation will carry on in the background.
   *
   * When async: false (default), requests respond with status 200 and the document value after instruction has been applied.
   *
   * async: true is incompatible with noWrite, as async: true does not return the resulting document
   */
  async: true
}
