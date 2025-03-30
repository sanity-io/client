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
   *  Optional document path output target for the instruction.
   *  When provided, the instruction will apply to this path in the document and its children.
   *
   *  ## Examples
   *  - `path: 'title'` will output to the title field in the document
   * - `path: 'array[_key="xx"]'` will output to the item with `_key: 'xx'` in the array field
   */
  path?: string

  /**
   * Controls sub-paths in the document that can be output to.
   *
   * The string-paths are relative to the `path` param
   *
   * Note: these path strings are less strictly validated than the `path` param itself:
   * if an relative-path does not exist or is invalid, it will be silently ignored.
   *
   * @see InstructRequestBase#conditionalPaths
   * @see InstructRequestBase#outputTypes
   */
  relativeOutputPaths?: {include: string[]} | {exclude: string[]}

  /**
   * Controls which types the instruction is allowed to output to.
   *
   * @see InstructRequestBase#relativeOutputPaths
   * @see InstructRequestBase#conditionalPaths
   */
  outputTypes?: {include: string[]} | {exclude: string[]}

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
