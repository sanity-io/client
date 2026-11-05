import type {
  ListenOptions,
  RequestOptions as MainRequestOptions,
  ResumableListenOptions,
  UploadBody,
} from '../types'
import type {components, operations, paths} from './types.gen'

export type {components, operations, paths}

/** @internal */
export const possibleStoreRequestOptions = ['headers', 'signal', 'tag', 'timeout', 'token'] as const

/**
 * Request options honored by `context.fetch`.
 *
 * @beta
 */
export type ContextRequestOptions = Pick<
  MainRequestOptions,
  (typeof possibleStoreRequestOptions)[number]
>

/**
 * Listener options for `context.listen`.
 *
 * `includeAllVersions` is left out: Context documents are written by the
 * Context API with no drafts or versions, so it would never make a
 * difference.
 *
 * @beta
 */
export type ContextListenOptions =
  | Omit<ListenOptions, 'includeAllVersions'>
  | Omit<ResumableListenOptions, 'includeAllVersions'>

type Method = 'get' | 'put' | 'post' | 'patch' | 'delete'
type PathPrefix = '/{apiVersion}/context'
type ContextPath = keyof paths extends infer K
  ? K extends `${PathPrefix}${infer P}`
    ? P
    : never
  : never
type PathItem<P extends ContextPath> = paths[`${PathPrefix}${P}`]

/**
 * A Context API operation as `METHOD /path`, the path as the Context API's
 * OpenAPI spec writes it after `/{apiVersion}/context`, for example
 * `'POST /knowledge-bases/{knowledgeBaseId}/sources'`.
 *
 * @beta
 */
export type Route = {
  [P in ContextPath]: {
    [M in Method]: PathItem<P>[M] extends {responses: unknown} ? `${Uppercase<M>} ${P}` : never
  }[Method]
}[ContextPath]

/**
 * The spec's operation object for a route.
 *
 * @beta
 */
export type Operation<R extends Route> = R extends `${infer M} ${infer P}`
  ? P extends ContextPath
    ? Lowercase<M> extends Method
      ? PathItem<P>[Lowercase<M>]
      : never
    : never
  : never

type OperationParameters<R extends Route, In extends 'path' | 'query' | 'header'> =
  Operation<R> extends {parameters: {[K in In]?: infer T}} ? NonNullable<T> : never

/** Path parameters the client fills in from its configuration when a call leaves them out. */
type ConfiguredParam = 'knowledgeBaseId' | 'organizationId'

type SpecPathParams<R extends Route> = Omit<OperationParameters<R, 'path'>, 'apiVersion'>

/**
 * A route's path parameters. `knowledgeBaseId` defaults to the client's
 * `resource` when it is a knowledge base, and `organizationId` to
 * `context.organizationId`.
 *
 * @beta
 */
export type PathParams<R extends Route> = Omit<SpecPathParams<R>, ConfiguredParam> &
  Partial<Pick<SpecPathParams<R>, Extract<keyof SpecPathParams<R>, ConfiguredParam>>>

/** @beta */
export type QueryParams<R extends Route> = OperationParameters<R, 'query'>

/** @beta */
export type HeaderParams<R extends Route> = OperationParameters<R, 'header'>

/**
 * A route's JSON request body.
 *
 * @beta
 */
export type Body<R extends Route> =
  Operation<R> extends {requestBody: {content: {'application/json': infer B}}} ? B : never

type SuccessStatus = 200 | 201 | 202 | 204

/**
 * What a route resolves with: its success response body, `undefined` for
 * `204 No Content`, and `unknown` where the spec gives no JSON schema.
 *
 * @beta
 */
export type Response<R extends Route> =
  Operation<R> extends {responses: infer Responses}
    ? {
        [S in keyof Responses]: S extends SuccessStatus
          ? S extends 204
            ? undefined
            : Responses[S] extends {content: {'application/json': infer T}}
              ? T
              : unknown
          : never
      }[keyof Responses]
    : never

type RequiredKeys<T> = {[K in keyof T]-?: {} extends Pick<T, K> ? never : K}[keyof T]

/** Required when `T` has a required key, optional when it has none, absent when `never`. */
type Slot<Name extends string, T> = [T] extends [never]
  ? {[K in Name]?: never}
  : [RequiredKeys<T>] extends [never]
    ? {[K in Name]?: T}
    : {[K in Name]: T}

/**
 * The second argument of `context.request`: the route's path parameters,
 * query, headers and body, each typed from the spec, plus `signal` and `tag`.
 *
 * @beta
 */
export type RequestInit<R extends Route> = Slot<'params', PathParams<R>> &
  Slot<'query', QueryParams<R>> &
  Slot<'headers', HeaderParams<R>> &
  ([Body<R>] extends [never] ? {body?: never} : {body: Body<R>}) & {
    signal?: AbortSignal
    tag?: string
  }

/**
 * The init argument as a rest tuple: optional when nothing in it is required.
 *
 * @beta
 */
export type RequestArgs<R extends Route> = [RequiredKeys<RequestInit<R>>] extends [never]
  ? [init?: RequestInit<R>]
  : [init: RequestInit<R>]

/**
 * A file for a `files` source. The client stages an upload, PUTs the bytes
 * straight to storage with a signed URL, and starts the source's sync with
 * it. The Context API never holds the file content.
 *
 * @beta
 */
export type FileUpload = {
  /** Same shapes `assets.upload` accepts, minus node streams: the bytes go
   * out through `fetch`, which has no portable stream support. A single
   * document, or a zip, tar or gzip archive of them. */
  file: Exclude<UploadBody, NodeJS.ReadableStream>
  filename: string
  /** When set, the bytes are PUT with this `Content-Type`. */
  contentType?: string
}

/** @beta */
export type UploadFileParams = FileUpload & {sourceId: string; knowledgeBaseId?: string}

/** @beta */
export type CreateFileSourceParams = FileUpload &
  Omit<
    Extract<Body<'POST /knowledge-bases/{knowledgeBaseId}/sources'>, {type: 'files'}>,
    'content' | 'contentType'
  > & {
    knowledgeBaseId?: string
  }

/** A `sanity.context.entry` document, for typing GROQ reads. @beta */
export type EntryDoc = components['schemas']['EntryDoc']
/** A `sanity.context.issue` document, for typing GROQ reads. @beta */
export type IssueDoc = components['schemas']['IssueDoc']
/** A `sanity.context.instruction` document, for typing GROQ reads. @beta */
export type InstructionDoc = components['schemas']['InstructionDoc']
/** A `sanity.context.mcp` document, for typing GROQ reads. @beta */
export type McpDoc = components['schemas']['McpDoc']
/** A `sanity.context.conversation` document, for typing GROQ reads. @beta */
export type ConversationDoc = components['schemas']['ConversationDoc']

/** @beta */
export type Source = Response<'GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}'>
/** @beta */
export type SyncAccepted =
  Response<'POST /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}/syncs'>
