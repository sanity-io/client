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
 * A file import. The client stages the upload, PUTs the bytes straight to
 * storage with a signed URL, and confirms. The Context API never holds the
 * file content.
 * @beta
 */
export type CreateFileImportParams = {
  type: 'file'
  /** Same shapes `assets.upload` accepts, minus node streams: the bytes go
   * out through `fetch`, which has no portable stream support. */
  file: Exclude<UploadBody, NodeJS.ReadableStream>
  filename: string
  contentType?: string
}

type KnowledgeBasesPath = '/{apiVersion}/context/knowledge-bases'
type ConversationPath =
  '/{apiVersion}/context/organizations/{organizationId}/conversations/{threadId}'
type KnowledgeBasePath = '/{apiVersion}/context/knowledge-bases/{knowledgeBaseId}'
type ImportsPath = `${KnowledgeBasePath}/imports`
type ImportPath = `${KnowledgeBasePath}/imports/{importId}`
type UploadsPath = `${KnowledgeBasePath}/imports/uploads`
type EntryRebuildPath = `${KnowledgeBasePath}/entries/{entryPath}/rebuild`
type SourcesPath = `${KnowledgeBasePath}/sources`
type SourcePath = `${KnowledgeBasePath}/sources/{sourceId}`
type SourceContentPath = `${KnowledgeBasePath}/sources/{sourceId}/content`
type IssuesApplyPath = `${KnowledgeBasePath}/issues/apply`
type InstructionPath = `${KnowledgeBasePath}/instructions/{instructionId}`
type JobPath = `${KnowledgeBasePath}/jobs/{jobId}`
type IssueResolvePath = `${KnowledgeBasePath}/issues/{issueId}/resolve`
type IssueDismissPath = `${KnowledgeBasePath}/issues/{issueId}/dismiss`
type IssueReopenPath = `${KnowledgeBasePath}/issues/{issueId}/reopen`
type InstructionsPath = `${KnowledgeBasePath}/instructions`

type JsonResponse<T> = T extends {content: {'application/json': infer R}} ? R : never
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
 * Parameters for importing content. Discriminated on `type`:
 * inline text, a website crawl, or a Sanity dataset bind.
 * @beta
 */
export type CreateImportParams = JsonBody<paths[ImportsPath]['post']>

/**
 * Accepted async work. Poll the job with `jobs.get` until it reaches a
 * terminal state.
 * @beta
 */
export type JobAccepted = JsonResponse<
  paths[`${KnowledgeBasePath}/build`]['post']['responses']['202']
>

/** @beta */
export type Job = JsonResponse<paths[JobPath]['get']['responses']['200']>

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

/** @beta */
export type KnowledgeBasesResponse = JsonResponse<
  paths[KnowledgeBasesPath]['get']['responses']['200']
>

/** @beta */
export type ImportsResponse = JsonResponse<paths[ImportsPath]['get']['responses']['200']>
/** @beta */
export type Import = ImportsResponse['data'][number]
/** @beta */
export type ImportDetail = JsonResponse<paths[ImportPath]['get']['responses']['200']>
/** @beta */
export type ImportDownloadResponse = JsonResponse<
  paths[`${ImportPath}/download`]['get']['responses']['200']
>

/**
 * The staged half of a file upload: PUT the bytes to `uploadUrl`, then
 * confirm with the complete endpoint. `imports.create({type: 'file'})` does
 * all of this in one call.
 * @beta
 */
export type StagedUpload = JsonResponse<paths[UploadsPath]['post']['responses']['201']>

/** @beta */
export type SourcesResponse = JsonResponse<paths[SourcesPath]['get']['responses']['200']>
/** @beta */
export type Source = SourcesResponse['data'][number]
/** @beta */
export type SourceDetail = JsonResponse<paths[SourcePath]['get']['responses']['200']>
/** @beta */
export type SourceContentResponse = JsonResponse<
  paths[SourceContentPath]['get']['responses']['200']
>

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
