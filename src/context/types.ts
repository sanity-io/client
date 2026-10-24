import type {
  ListenOptions,
  RequestOptions as MainRequestOptions,
  ResumableListenOptions,
  UploadBody,
} from '../types'
import type {components, paths} from './types.gen'

/** Options accepted by every Context method. @beta */
export type RequestOptions = {signal?: AbortSignal; tag?: string}

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

/**
 * A file for a `files` source. The client stages an upload, PUTs the bytes
 * straight to storage with a signed URL, and starts the source's sync with
 * it. The Context API never holds the file content.
 * @beta
 */
export type SourceFileUpload = {
  /** Same shapes `assets.upload` accepts, minus node streams: the bytes go
   * out through `fetch`, which has no portable stream support. A single
   * document, or a zip, tar or gzip archive of them. */
  file: Exclude<UploadBody, NodeJS.ReadableStream>
  filename: string
  /** When set, the bytes are PUT with this `Content-Type`. */
  contentType?: string
}

type KnowledgeBasesPath = '/{apiVersion}/context/knowledge-bases'
type ConversationPath =
  '/{apiVersion}/context/organizations/{organizationId}/conversations/{threadId}'
type KnowledgeBasePath = '/{apiVersion}/context/knowledge-bases/{knowledgeBaseId}'
type McpEndpointsPath = '/{apiVersion}/context/organizations/{organizationId}/mcp'
type McpEndpointPath = `${McpEndpointsPath}/{mcpEndpoint}`
type EntryRebuildPath = `${KnowledgeBasePath}/entries/{entryPath}/rebuild`
type SourcesPath = `${KnowledgeBasePath}/sources`
type SourcePath = `${KnowledgeBasePath}/sources/{sourceId}`
type SyncsPath = `${SourcePath}/syncs`
type SyncPath = `${SourcePath}/syncs/{syncId}`
type UploadsPath = `${SourcePath}/uploads`
type DocumentsPath = `${KnowledgeBasePath}/documents`
type DocumentPath = `${KnowledgeBasePath}/documents/{documentId}`
type DocumentContentPath = `${DocumentPath}/content`
type IssuesApplyPath = `${KnowledgeBasePath}/issues/apply`
type InstructionPath = `${KnowledgeBasePath}/instructions/{instructionId}`
type JobPath = `${KnowledgeBasePath}/jobs/{jobId}`
type IssueResolvePath = `${KnowledgeBasePath}/issues/{issueId}/resolve`
type IssueDismissPath = `${KnowledgeBasePath}/issues/{issueId}/dismiss`
type IssueReopenPath = `${KnowledgeBasePath}/issues/{issueId}/reopen`
type InstructionsPath = `${KnowledgeBasePath}/instructions`

type JsonResponse<T> = T extends {content: {'application/json': infer R}} ? R : never
type QueryParams<T> = T extends {parameters: {query?: infer Q}} ? NonNullable<Q> : never
type JsonBody<T> = T extends {
  requestBody: {content: {'application/json': infer R}}
}
  ? R
  : never

/**
 * A knowledge base: one buildable body of knowledge inside Context.
 * @beta
 */
export type KnowledgeBase = JsonResponse<paths[KnowledgeBasePath]['get']['responses']['200']>

/**
 * Parameters for creating a knowledge base.
 * @beta
 */
export type CreateKnowledgeBaseParams = JsonBody<paths[KnowledgeBasesPath]['post']>
/** @beta */
export type EditKnowledgeBaseParams = JsonBody<paths[KnowledgeBasePath]['patch']>

/**
 * Accepted async work. Poll the job with `jobs.get` until it reaches a
 * terminal state.
 * @beta
 */
export type JobAccepted = JsonResponse<
  paths[`${KnowledgeBasePath}/build`]['post']['responses']['202']
>

/**
 * A background job: a `build`, an `update` (applied issues, rebuilt entries)
 * or a `sync` (a `files` source reading its file). Narrow on `kind` to read `result`,
 * which `build` and `update` jobs carry once they succeed.
 * @beta
 */
export type Job = JsonResponse<paths[JobPath]['get']['responses']['200']> & {
  // Every job carried `result?: unknown` before results were typed. Keeping it
  // on each kind lets `job.result` compile without narrowing; `sync` jobs never
  // send one.
  result?: unknown
}

/**
 * Accepted entry rebuild: the job to poll plus every entry the rebuild
 * touches.
 * @beta
 */
export type RebuildEntryResponse = JsonResponse<paths[EntryRebuildPath]['post']['responses']['202']>

/** @beta */
export type ApplyIssuesParams = JsonBody<paths[IssuesApplyPath]['post']>
/** @beta */
export type ApplyIssuesResponse = JsonResponse<paths[IssuesApplyPath]['post']['responses']['202']>
/** @beta */
export type ResolveIssueParams = JsonBody<paths[IssueResolvePath]['post']>
/** @beta */
export type ResolveIssueResponse = JsonResponse<paths[IssueResolvePath]['post']['responses']['200']>
/** @beta */
export type DismissIssueResponse = JsonResponse<paths[IssueDismissPath]['post']['responses']['200']>
/** @beta */
export type ReopenIssueResponse = JsonResponse<paths[IssueReopenPath]['post']['responses']['200']>

/** @beta */
export type CreateInstructionParams = JsonBody<paths[InstructionsPath]['post']>
/**
 * A standing instruction, as the instruction endpoints return it.
 * @beta
 */
export type Instruction = JsonResponse<paths[InstructionPath]['patch']['responses']['200']>
/** The created instruction, wrapped the way the create endpoint returns it. @beta */
export type CreateInstructionResponse = JsonResponse<
  paths[InstructionsPath]['post']['responses']['201']
>
/** @beta */
export type EditInstructionParams = JsonBody<paths[InstructionPath]['patch']>
/**
 * The rebuild a delete started: `rebuildJobId` is `null` unless `rebuild: true`
 * was passed and an entry cites the instruction's sources.
 * @beta
 */
export type DeleteInstructionResponse = JsonResponse<
  paths[InstructionPath]['delete']['responses']['200']
>

/** @beta */
export type KnowledgeBasesResponse = JsonResponse<
  paths[KnowledgeBasesPath]['get']['responses']['200']
>

/** @beta */
export type SourcesResponse = JsonResponse<paths[SourcesPath]['get']['responses']['200']>
/**
 * Something that yields documents for a knowledge base: a website (`web`),
 * a Sanity dataset (`sanity-dataset`) or files (`files`). Narrow on `type`
 * for the settings each kind carries.
 * @beta
 */
export type Source = JsonResponse<paths[SourcePath]['get']['responses']['200']>

type SourceBody = JsonBody<paths[SourcesPath]['post']>

/**
 * A `files` source that holds a file, uploaded as part of creating it.
 * `sources.create` adds the source, uploads the file and starts its sync.
 * @beta
 */
export type CreateFileSourceParams = {
  type: 'files'
  title: string
  content?: never
} & SourceFileUpload

type WebSourceBody = Extract<SourceBody, {type: 'web'}>

/**
 * Parameters for adding a source. Discriminated on `type`: a `web` crawl, a
 * `sanity-dataset` query, or a `files` source with inline `content`, an
 * uploaded `file`, or neither (an empty source to upload to later).
 * @beta
 */
export type CreateSourceParams =
  | Omit<WebSourceBody, 'dryRun'>
  | Exclude<SourceBody, {type: 'web' | 'files'}>
  | (Extract<SourceBody, {type: 'files'}> & {file?: never})
  | CreateFileSourceParams

/**
 * Parameters for previewing a website crawl without adding the source.
 * @beta
 */
export type PreviewWebSourceParams = Omit<WebSourceBody, 'type' | 'dryRun'>

/**
 * The pages a `web` source's crawl would fetch, grouped by path.
 * @beta
 */
export type CrawlPreview = JsonResponse<paths[SourcesPath]['post']['responses']['200']>

/** @beta */
export type EditSourceParams = JsonBody<paths[SourcePath]['patch']>

/** @beta */
export type SyncsResponse = JsonResponse<paths[SyncsPath]['get']['responses']['200']>
/**
 * One run of a source's connector. A `held` sync waits for `syncs.confirm`
 * or `syncs.discard` before it deletes anything.
 * @beta
 */
export type Sync = JsonResponse<paths[SyncPath]['get']['responses']['200']>
/**
 * A started or queued sync. `jobId` is set when a `files` source's sync
 * starts at once; follow a website or dataset with its source's
 * `latestSync`.
 * @beta
 */
export type SyncAccepted = JsonResponse<paths[SyncsPath]['post']['responses']['202']>
/** The syncs `context.sync()` queued, one per website and dataset source. @beta */
export type SyncAllAccepted = JsonResponse<
  paths[`${KnowledgeBasePath}/sync`]['post']['responses']['202']
>

/**
 * The staged half of a file upload: PUT the bytes to `uploadUrl`, then sync
 * the source with `uploadId`. `sources.upload` does all of this in one call.
 * @beta
 */
export type StagedUpload = JsonResponse<paths[UploadsPath]['post']['responses']['201']>
/** @beta */
export type CreateUploadParams = JsonBody<paths[UploadsPath]['post']>

/** @beta */
export type DocumentsResponse = JsonResponse<paths[DocumentsPath]['get']['responses']['200']>
/**
 * One page, dataset document or file that a source yields: what builds
 * read and cite.
 * @beta
 */
export type Document = DocumentsResponse['data'][number]
/** A document with the chunks of its markdown, which entry citations point at. @beta */
export type DocumentDetail = JsonResponse<paths[DocumentPath]['get']['responses']['200']>
/** @beta */
export type EditDocumentParams = JsonBody<paths[DocumentPath]['patch']>
/** @beta */
export type DocumentContentOptions = QueryParams<paths[DocumentContentPath]['get']>
/** A document's markdown with its line numbers, or a range of its lines. @beta */
export type DocumentContentResponse = JsonResponse<
  paths[DocumentContentPath]['get']['responses']['200']
>
/**
 * What `documents.content` resolves with for a `format`: the JSON view by
 * default, the text alone for `markdown` and `plain`, and the bytes the
 * source gave for `raw`.
 * @beta
 */
export type DocumentContent<F extends DocumentContentOptions['format']> = F extends 'raw'
  ? Uint8Array
  : F extends 'markdown' | 'plain'
    ? string
    : DocumentContentResponse

/**
 * A recorded conversation: one agent thread's transcript plus the
 * classification recorded on it. Standalone org-level telemetry — dimensions
 * (MCP endpoints, app, the customer's own keys) live in the `metadata` bag.
 * @beta
 */
export type Conversation = JsonResponse<paths[ConversationPath]['put']['responses']['200']>
/**
 * Body for the conversation ingest upsert. Messages replace the stored
 * transcript wholesale; `metadata` and model fields only overwrite when
 * present.
 * @beta
 */
export type SaveConversationParams = JsonBody<paths[ConversationPath]['put']>
/** Exactly one of a verdict (`coreMetrics`) or a failure (`classificationError`). @beta */
export type ClassifyConversationParams = JsonBody<paths[ConversationPath]['patch']>

/**
 * The raw `sanity.context.entry` document shape, as stored in the
 * organization's document store. For typing GROQ reads.
 * @beta
 */
export type EntryDoc = components['schemas']['EntryDoc']
/** @beta */
export type IssueDoc = components['schemas']['IssueDoc']
/** @beta */
export type InstructionDoc = components['schemas']['InstructionDoc']
/**
 * The raw `sanity.context.mcp` document shape (an MCP endpoint
 * configuration), as stored in the organization's document store. For
 * typing GROQ reads.
 * @beta
 */
export type McpDoc = components['schemas']['McpDoc']

/**
 * The metadata view of an entry, as `entries.list` projects it. Bodies stay
 * behind `entries.get` (or a GROQ read through `context.fetch`).
 * @beta
 */
export type Entry = Pick<EntryDoc, '_id' | 'path' | 'title' | 'tldr' | 'status'>

/**
 * The raw `sanity.context.conversation` document shape, as stored in the
 * organization's document store. For typing GROQ reads.
 * @beta
 */
export type ConversationDoc = components['schemas']['ConversationDoc']

/**
 * An MCP endpoint as the management methods return it, including the `url`
 * agents connect to.
 * @beta
 */
export type McpEndpoint = JsonResponse<paths[McpEndpointsPath]['post']['responses']['201']>

/** @beta */
export type CreateMcpEndpointParams = JsonBody<paths[McpEndpointsPath]['post']>

/** @beta */
export type EditMcpEndpointParams = JsonBody<paths[McpEndpointPath]['patch']>

/**
 * Per-request overrides a connection to an MCP endpoint accepts, such as
 * `mode` to serve one side of an endpoint with both knowledge bases and a
 * dataset, or `knowledgeBases` to replace its knowledge base list.
 * @beta
 */
export type McpEndpointRuntimeOptions = QueryParams<paths[`${McpEndpointPath}/status`]['get']>

/**
 * Whether an agent connecting to an MCP endpoint with your credentials and
 * the same runtime options can use it. A check is `null` when it doesn't
 * apply to the connection; `requiredOk` is true when every check that
 * applies passed, except `semanticSearch`.
 * @beta
 */
export type McpEndpointStatus = JsonResponse<
  paths[`${McpEndpointPath}/status`]['get']['responses']['200']
>

/** Options for an MCP endpoint's initial context. @beta */
export type McpEndpointInitialContextOptions = QueryParams<
  paths[`${McpEndpointPath}/initial-context`]['get']
>
