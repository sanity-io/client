import type {UploadBody} from '../types'
import type {components, paths} from './types.gen'

/** Options accepted by every Context method. @beta */
export type RequestOptions = {signal?: AbortSignal; tag?: string}

/**
 * Render format for outline and entry reads. `json` returns the typed
 * shape; `markdown` and `plain` return the rendered text as a string.
 * @beta
 */
export type RenderFormat = 'json' | 'markdown' | 'plain'

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

type KnowledgeBasesPath = '/{apiVersion}/context/organizations/{organizationId}/knowledge-bases'
type KnowledgeBasePath =
  '/{apiVersion}/context/organizations/{organizationId}/knowledge-bases/{knowledgeBaseSlug}'
type KnowledgeBaseByIdPath = '/{apiVersion}/context/knowledge-bases/{knowledgeBaseId}'
type ImportsPath = `${KnowledgeBasePath}/imports`
type ImportPath = `${KnowledgeBasePath}/imports/{importId}`
type UploadsPath = `${KnowledgeBasePath}/imports/uploads`
type CrawlPreviewPath = `${KnowledgeBasePath}/imports/crawl-preview`
type OutlinePath = `${KnowledgeBasePath}/outline`
type EntryPath = `${KnowledgeBasePath}/entries/{entryPath}`
type SourcesPath = `${KnowledgeBasePath}/sources`
type SourcePath = `${KnowledgeBasePath}/sources/{sourceId}`
type SourceContentPath = `${KnowledgeBasePath}/sources/{sourceId}/content`
type ChangesPath = `${KnowledgeBasePath}/changes`
type ActivityPath = `${KnowledgeBasePath}/activity`
type RevisionsPath = `${KnowledgeBasePath}/revisions`
type RevisionReportPath = `${KnowledgeBasePath}/revisions/{revisionId}/report`
type RevisionOutlinePath = `${KnowledgeBasePath}/revisions/{revisionId}/outline`
type IssuePath = `${KnowledgeBasePath}/issues/{issueId}`
type IssuesApplyPath = `${KnowledgeBasePath}/issues/apply`
type InstructionPath = `${KnowledgeBasePath}/instructions/{instructionId}`
type CrawlOptionsPath = `${KnowledgeBasePath}/crawl-options`
type JobPath = `${KnowledgeBasePath}/jobs/{jobId}`
type IssuesPath = `${KnowledgeBasePath}/issues`
type IssueResolvePath = `${KnowledgeBasePath}/issues/{issueId}/resolve`
type IssueDismissPath = `${KnowledgeBasePath}/issues/{issueId}/dismiss`
type IssueReopenPath = `${KnowledgeBasePath}/issues/{issueId}/reopen`
type InstructionsPath = `${KnowledgeBasePath}/instructions`
type EntriesPath = `${KnowledgeBasePath}/entries`

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
export type KnowledgeBase = JsonResponse<paths[KnowledgeBaseByIdPath]['get']['responses']['200']>

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

/** @beta */
export type IssuesResponse = JsonResponse<paths[IssuesPath]['get']['responses']['200']>
/** @beta */
export type Issue = IssuesResponse['data'][number]
/** @beta */
export type IssueDetail = JsonResponse<paths[IssuePath]['get']['responses']['200']>
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
/** @beta */
export type InstructionsResponse = JsonResponse<paths[InstructionsPath]['get']['responses']['200']>
/** @beta */
export type Instruction = InstructionsResponse['data'][number]
/** @beta */
export type EditInstructionParams = JsonBody<paths[InstructionPath]['patch']>

/** @beta */
export type EntriesResponse = JsonResponse<paths[EntriesPath]['get']['responses']['200']>
/** @beta */
export type Entry = EntriesResponse['data'][number]

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
export type StageUploadParams = JsonBody<paths[UploadsPath]['post']>

/** @beta */
export type CrawlPreviewParams = JsonBody<paths[CrawlPreviewPath]['post']>
/** @beta */
export type CrawlPreviewResponse = JsonResponse<paths[CrawlPreviewPath]['post']['responses']['200']>

/** @beta */
export type Outline = JsonResponse<paths[OutlinePath]['get']['responses']['200']>
/** @beta */
export type EntryDetail = JsonResponse<paths[EntryPath]['get']['responses']['200']>

/** @beta */
export type SourcesResponse = JsonResponse<paths[SourcesPath]['get']['responses']['200']>
/** @beta */
export type Source = SourcesResponse['data'][number]
/** @beta */
export type SourceDetail = JsonResponse<paths[SourcePath]['get']['responses']['200']>
/** @beta */
export type DeleteSourceResponse = JsonResponse<paths[SourcePath]['delete']['responses']['202']>
/** @beta */
export type SourceContentResponse = JsonResponse<
  paths[SourceContentPath]['get']['responses']['200']
>

/** @beta */
export type Changes = JsonResponse<paths[ChangesPath]['get']['responses']['200']>
/** @beta */
export type ActivityResponse = JsonResponse<paths[ActivityPath]['get']['responses']['200']>
/** @beta */
export type ActivityEvent = ActivityResponse['data'][number]

/** @beta */
export type RevisionsResponse = JsonResponse<paths[RevisionsPath]['get']['responses']['200']>
/** @beta */
export type Revision = RevisionsResponse['data'][number]
/** @beta */
export type RevisionReport = JsonResponse<paths[RevisionReportPath]['get']['responses']['200']>
/** @beta */
export type RevisionOutline = JsonResponse<paths[RevisionOutlinePath]['get']['responses']['200']>

/** @beta */
export type EditCrawlOptionsParams = JsonBody<paths[CrawlOptionsPath]['patch']>
/** @beta */
export type CrawlOptions = JsonResponse<paths[CrawlOptionsPath]['patch']['responses']['200']>
/** @beta */
export type EntryStatus = 'virtual' | 'outlined' | 'filled' | 'stale' | 'generation_failed'

/**
 * The raw `sanity.context.entry` document shape, as stored in the bound
 * dataset. For typing GROQ reads made with a regular dataset client.
 * @beta
 */
export type EntryDoc = components['schemas']['EntryDoc']
/** @beta */
export type IssueDoc = components['schemas']['IssueDoc']
/** @beta */
export type InstructionDoc = components['schemas']['InstructionDoc']
