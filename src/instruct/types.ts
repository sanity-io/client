//Request shape

import type {Any, SanityDocumentStub} from '@sanity/client'

/** @beta */
export interface InstructConstantInstructionParam {
  type: 'constant'
  value: string
}

/**
 *
 * Includes a LLM-friendly version of the field value in the instruction
 * @beta
 * */
export interface InstructFieldInstructionParam {
  type: 'field'
  /**
   * Examples: 'title', 'array[_key=="key"].field'
   */
  path: string
  /**
   * If omitted, implicitly uses the documentId of the instruction target
   */
  documentId?: string
}

/**
 *
 * Includes a LLM-friendly version of the document in the instruction
 * @beta
 * */
export interface DocumentInstructionParam {
  type: 'document'
  /**
   * If omitted, implicitly uses the documentId of the instruction target
   */
  documentId?: string
}

/**
 * Includes a LLM-friendly version of GROQ query result in the instruction
 * @beta
 * */
export interface InstructGroqInstructionParam {
  type: 'groq'
  query: string
  params?: Record<string, string>
}

export type InstructTypeConfig =
  | {include: string[]; exclude?: never}
  | {exclude: string[]; include?: never}

export type InstructPathSegment = string | number | {_key: string}
export type InstructPath = InstructPathSegment[]
export type InstructOperation = 'set' | 'append' | 'mixed'

export interface InstructTargetInclude {
  member: InstructPathSegment

  /**
   * Sets the operation for this member, and all its children.
   * This overrides any operation set parents or the root target.
   * @see #InstructTarget.operation
   * @see #include
   */
  operation?: InstructOperation

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Members not on the include list, are implicitly excluded.
   */
  include?: (InstructPathSegment | InstructTargetInclude)[]

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   * Members not on the exclude list, are implicitly included.
   */
  exclude?: InstructPathSegment[]

  /**
   * Types can be used to exclude array member types or all fields of a certain type.
   * If you do exclude: ['string'] all string fields under the path segment will be excluded, for instance.
   *
   * Types config is propagated to members. Use `include` recursively to override.
   *
   * `types.include` and `types.exclude` are mutually exclusive.
   */
  types?: InstructTypeConfig
}

/**
 * @beta
 */
export interface InstructTarget {
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
   * `target: ['body', {_key: 'someKey'}, 'nestedObject']`
   *
   * Here, the instruction will only write to fields under the nestedObject.
   *
   * Default: [] = the document itself
   *
   * @see #InstructPathSegment
   * */
  path?: InstructPath

  /**
   * Sets the default operation for all paths in the target.
   * Instruct runs in `'mixed'` operation mode by default:
   * Changes are set in all non-array fields, and append to all array fields.
   *
   * ### Operation types
   * - `'set'` – an *overwriting* operation, and replaces the full field value.
   * - `'append'`:
   *    – array fields: appends new items to the end of the array,
   *    - string fields: '<existing content> <new content>'
   *    - text fields: '<existing content>\n<new content>'
   *    - number fields: existing + new
   *    - other field types not mentioned will set instead (dates, url)
   * - `'mixed'` – (default) sets non-array fields, and appends to array fields
   *
   * The default operation can be overridden on a per-path basis using `include`.
   *
   * Nested fields inherit the operation specified by their parent and falls back to the
   * top level target operation if not otherwise specified.
   *
   * Use `include` to change the `operation` of individual members.
   *
   * #### Appending in the middle of arrays
   * `target: {path: ['array'], operation: 'append'}` will append the output of the instruction to the end of the array.
   *
   * To insert in the middle of the array, use `target: {path: ['array', {_key: 'appendAfterKey'}], operation: 'append'}`.
   * Here, the output of the instruction will be appended after the array item with key `'appendAfterKey'`.
   *
   * @see #InstructTargetInclude.operation
   * @see #include
   * @see #InstructTargetInclude.include
   */
  operation?: InstructOperation

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
   *
   * When `include` is specified, only segments explicitly listed will be included.
   *
   * Members not on the include list, are implicitly excluded.
   */
  include?: (InstructPathSegment | InstructTargetInclude)[]

  /**
   * By default, all children up to `target.maxPathDepth` are included.
   * Members not on the exclude list, are implicitly included.
   */
  exclude?: InstructPathSegment[]

  /**
   * Types can be used to exclude array member types or all fields of a certain type.
   * If you do exclude: ['string'] all string fields under the target will be excluded, for instance.
   *
   * Types config is propagated to members. Use `include` recursively to override.
   *
   * `types.include` and `types.exclude` are mutually exclusive.
   */
  types?: InstructTypeConfig
}

/** @beta */
export type InstructInstructionParam =
  | string
  | InstructConstantInstructionParam
  | InstructFieldInstructionParam
  | DocumentInstructionParam
  | InstructGroqInstructionParam

/** @beta */
export type InstructInstructionParams = Record<string, InstructInstructionParam>

interface InstructRequestBase {
  /** schemaId as reported by sanity deploy / sanity schema store */
  schemaId: string
  /** string template using $variable – more on this below under "Dynamic instruction" */
  instruction: string
  /** param values for the string template, keys are the variable name, ie if the template has "$variable", one key must be "variable" */
  instructionParams?: InstructInstructionParams

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
   */
  target?: InstructTarget | InstructTarget[]

  /**
   * When a type or field in the schema has a function set for `hidden` or `readOnly`, it is conditional.
   *
   * By default, AI Instruct will not output to conditional `readOnly` and `hidden` fields,
   * ie, they are considered to resolve to `readOnly: true` / `hidden: true`.
   *
   * `conditionalPaths` param allows setting the default conditional value for
   * `hidden` and `readOnly` to false,
   * or individually set `hidden` and `readOnly` state for individual document paths.
   *
   *
   * Note: fields and types with explicit readOnly: true or hidden: true in the schema, are not available to AI Instruct,
   * and cannot be changed via conditionalPaths.
   *
   * conditionalPaths state only apply to fields and types that have conditional `hidden` or `readOnly` in their schema definition.
   *
   * @see InstructRequestBase#relativeOutputPaths
   * @see InstructRequestBase#outputTypes
   */
  conditionalPaths?: {
    defaultReadOnly?: boolean
    defaultHidden?: boolean
    paths?: {
      /** path here is not a relative path: it must be the full document path, regardless of `path` param on the request itself */
      path: string
      readOnly: boolean
      hidden: boolean
    }[]
  }

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
   * Default: 0.3
   */
  temperature?: number
}

interface Sync {
  /**
   * By default, skipWrite: false.
   * Write enabled operations will mutate the target document, and emit AI presence in the studio.
   *
   * When skipWrite: true, the api will not mutate any documents nor emit presence.
   * Ie, when true, no changes will be made to content-lake
   *
   * skipWrite: true is incompatible with async: true,
   * as skipWrite implies that you will use the return value of the operation
   */
  skipWrite?: boolean

  /**
   * When async: true, requests responds with status 201 and {_id} as response body as soon as the request is validated.
   * The instruction operation will carry on in the background.
   *
   * When async: false (default), requests respond with status 200 and the document value after instruction has been applied.
   *
   * async: true is incompatible with skipWrite: true, as async: true does not return the resulting document
   */
  async?: false
}

interface Async {
  /**
   * When async: true, requests responds with status 201 and {_id} as response body as soon as the request is validated.
   * The instruction operation will carry on in the background.
   *
   * When async: false (default), requests respond with status 200 and the document value after instruction has been applied.
   *
   * async: true is incompatible with skipWrite, as async: true does not return the resulting document
   */
  async: true
}

/**
 * Instruction for an existing document.
 * @beta
 */
interface ExistingDocumentRequest {
  documentId: string
  createDocument?: never
}

/**
 * Instruction to create a new document
 * @beta
 */
interface CreateDocumentRequest<T extends Record<string, Any> = Record<string, Any>> {
  createDocument: {
    /** if no _id is provided, one will be generated. _id is always returned when the requests succeed */
    _id?: string
    _type: string
  } & SanityDocumentStub<T>
  documentId?: never
}

/** @beta */
export type InstructSyncInstruction<T extends Record<string, Any> = Record<string, Any>> = (
  | ExistingDocumentRequest
  | CreateDocumentRequest<T>
) &
  InstructRequestBase &
  Sync

/** @beta */
export type InstructAsyncInstruction<T extends Record<string, Any> = Record<string, Any>> = (
  | ExistingDocumentRequest
  | CreateDocumentRequest<T>
) &
  InstructRequestBase &
  Async

/** @beta */
export type InstructInstruction<T extends Record<string, Any> = Record<string, Any>> =
  | InstructSyncInstruction<T>
  | InstructAsyncInstruction<T>
