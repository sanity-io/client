import {type FetchFunction} from 'get-it'
import {type Observable} from 'rxjs'

import {_observe, _request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest} from '../types'
import type {
  ApplyIssuesParams,
  ApplyIssuesResponse,
  ActivityResponse,
  Changes,
  EntriesResponse,
  EntryDetail,
  EntryStatus,
  ImportDetail,
  ImportsResponse,
  Instruction,
  InstructionsResponse,
  IssueDetail,
  IssuesResponse,
  Job,
  JobAccepted,
  Outline,
  RevisionOutline,
  RevisionReport,
  RevisionsResponse,
  SourceDetail,
  SourcesResponse,
  CrawlOptions,
  CrawlPreviewParams,
  CrawlPreviewResponse,
  CreateImportParams,
  CreateInstructionParams,
  CreateKnowledgeBaseParams,
  DismissIssueResponse,
  EditCrawlOptionsParams,
  EditInstructionParams,
  EditKnowledgeBaseParams,
  ImportDownloadResponse,
  KnowledgeBase,
  KnowledgeBasesResponse,
  ReopenIssueResponse,
  ResolveIssueParams,
  ResolveIssueResponse,
  SourceContentResponse,
  StagedUpload,
} from './types'
import type {CreateFileImportParams, RenderFormat, RequestOptions} from './types'

type ListOptions = RequestOptions & {cursor?: string; limit?: number}

type Client = SanityClient | ObservableSanityClient

const COLLECTION_URL = '/context/knowledge-bases'

/**
 * The knowledge base every scoped method operates on comes from the client's
 * `resource` configuration, matching how media libraries and canvases are
 * addressed. Resolved per call so `withConfig` clones behave.
 */
function _resolveKnowledgeBaseId(client: Client): string {
  const resource = client.config().resource

  if (resource?.type !== 'knowledge-base') {
    throw new Error(
      '`resource` of type `knowledge-base` must be configured to use knowledge-base methods',
    )
  }

  return resource.id
}

function _knowledgeBaseUrl(knowledgeBaseId: string, suffix = ''): string {
  return `${COLLECTION_URL}/${encodeURIComponent(knowledgeBaseId)}${suffix}`
}

/** Serialize defined values into query params, dropping the undefined ones. */
function _query(entries: Record<string, string | number | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, `${value}`]],
    ),
  )
}

function _fetchBody(file: CreateFileImportParams['file']) {
  if (!ArrayBuffer.isView(file)) return file
  return file.buffer instanceof ArrayBuffer
    ? new Uint8Array(file.buffer, file.byteOffset, file.byteLength)
    : Uint8Array.from(file)
}

/**
 * `client.context` — knowledge bases and everything scoped to them.
 *
 * Collection-level management (create, list, get, edit, delete) addresses
 * knowledge bases per call, like `client.projects`. Everything scoped to one
 * knowledge base (imports, builds, issues, entries, ...) operates on the
 * client's configured `resource`, like media libraries:
 *
 * @example Full lifecycle
 * ```ts
 * const created = await client.context.knowledgeBases.create({
 *   organizationId: 'org123',
 *   title: 'Support docs',
 *   description: 'Product docs and troubleshooting guides',
 * })
 *
 * const kb = createClient({
 *   apiVersion: '2026-08-25',
 *   token,
 *   resource: {type: 'knowledge-base', id: created.publicId},
 * })
 *
 * await kb.context.imports.create({type: 'text', title: 'Refund policy', content: refundMd})
 * const {jobId} = await kb.context.build()
 * ```
 *
 * @beta
 */
export class ContextClient {
  #client: SanityClient
  #httpRequest: HttpRequest

  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /** Request against the configured knowledge base. */
  #request<R>(
    suffix: string,
    reqOptions: {
      method?: string
      body?: unknown
      query?: Record<string, string>
    } & RequestOptions = {},
  ): Promise<R> {
    return _request<R>(this.#client, this.#httpRequest, {
      url: _knowledgeBaseUrl(_resolveKnowledgeBaseId(this.#client), suffix),
      ...reqOptions,
    })
  }

  /** Shared shape of every paginated list endpoint scoped to the knowledge base. */
  #list<R>(
    suffix: string,
    params?: ListOptions,
    extraQuery?: Record<string, string | undefined>,
  ): Promise<R> {
    return this.#request<R>(suffix, {
      query: _query({
        cursor: params?.cursor,
        limit: params?.limit,
        ...extraQuery,
      }),
      signal: params?.signal,
      tag: params?.tag,
    })
  }

  async #uploadFile(
    params: CreateFileImportParams,
    options?: RequestOptions,
  ): Promise<JobAccepted> {
    const staged = await this.#request<StagedUpload>('/imports/uploads', {
      method: 'POST',
      body: {
        filename: params.filename,
        ...(params.contentType && {contentType: params.contentType}),
      },
      ...options,
    })
    // The signed URL PUT goes straight to storage, outside the API pipeline:
    // no auth header, and the body is raw bytes rather than JSON. Still uses
    // the client's fetch resolution so proxy config applies in Node.
    const config = this.#client.config()
    const doFetch: FetchFunction = config.resolveFetch?.(config.proxy) ?? globalThis.fetch
    const putResponse = await doFetch(staged.uploadUrl, {
      method: 'PUT',
      body: _fetchBody(params.file),
      ...(params.contentType && {
        headers: {'content-type': params.contentType},
      }),
      signal: options?.signal,
    })
    if (!putResponse.ok) {
      throw new Error(`File upload failed: ${putResponse.status} ${putResponse.statusText}`)
    }
    return this.#request<JobAccepted>(`/imports/uploads/${staged.importId}/complete`, {
      method: 'POST',
      body: {},
      ...options,
    })
  }

  /** The knowledge base collection: management addressed per call. */
  knowledgeBases = {
    /** Create a knowledge base. Requires the org-level knowledge-base create grant. */
    create: (params: CreateKnowledgeBaseParams, options?: RequestOptions): Promise<KnowledgeBase> =>
      _request<KnowledgeBase>(this.#client, this.#httpRequest, {
        url: COLLECTION_URL,
        method: 'POST',
        body: params,
        ...options,
      }),
    /** List the organization's knowledge bases. */
    list: (params: {organizationId: string} & ListOptions): Promise<KnowledgeBasesResponse> =>
      _request<KnowledgeBasesResponse>(this.#client, this.#httpRequest, {
        url: COLLECTION_URL,
        query: _query({
          organizationId: params.organizationId,
          cursor: params.cursor,
          limit: params.limit,
        }),
        signal: params.signal,
        tag: params.tag,
      }),
    /** Fetch a knowledge base by its id. */
    get: (knowledgeBaseId: string, options?: RequestOptions): Promise<KnowledgeBase> =>
      _request<KnowledgeBase>(this.#client, this.#httpRequest, {
        url: _knowledgeBaseUrl(knowledgeBaseId),
        ...options,
      }),
    /** Edit a knowledge base's configuration. */
    edit: (
      knowledgeBaseId: string,
      params: EditKnowledgeBaseParams,
      options?: RequestOptions,
    ): Promise<KnowledgeBase> =>
      _request<KnowledgeBase>(this.#client, this.#httpRequest, {
        url: _knowledgeBaseUrl(knowledgeBaseId),
        method: 'PATCH',
        body: params,
        ...options,
      }),
    /** Delete a knowledge base and its generated content. */
    delete: async (knowledgeBaseId: string, options?: RequestOptions): Promise<void> => {
      await _request<void>(this.#client, this.#httpRequest, {
        url: _knowledgeBaseUrl(knowledgeBaseId),
        method: 'DELETE',
        ...options,
      })
    },
  }

  /**
   * Build the configured knowledge base. The server waits for pending import
   * processing before assembling, so importing and building back to back is
   * safe. Track the returned job with {@link jobs}.
   */
  build(options?: RequestOptions): Promise<JobAccepted> {
    return this.#request('/build', {method: 'POST', ...options})
  }

  /** Cancel the running build, if any. */
  cancelBuild(options?: RequestOptions): Promise<{cancelled: boolean}> {
    return this.#request('/build/cancel', {method: 'POST', ...options})
  }

  /** Run an incremental refresh: re-check sources and apply what changed. */
  refresh(options?: RequestOptions): Promise<{jobId: string; started: boolean}> {
    return this.#request('/refresh', {method: 'POST', ...options})
  }

  /**
   * The built outline: every entry, ordered, with stats. The default
   * `json` format resolves to {@link Outline}; `markdown` and
   * `plain` resolve to a string.
   */
  outline<const F extends RenderFormat = 'json'>(
    params?: {format?: F},
    options?: RequestOptions,
  ): Promise<F extends 'json' ? Outline : string> {
    return this.#request('/outline', {
      query: params?.format ? {format: params.format} : {},
      ...options,
    })
  }

  /** What changed in the corpus since the last build. */
  changes(options?: RequestOptions): Promise<Changes> {
    return this.#request('/changes', options)
  }

  /** Imports: feed content into the configured knowledge base. */
  imports = {
    /**
     * Import content. One entry point, discriminated on `type`: inline
     * `text`, a website `crawl`, a Sanity `dataset` bind, or a `file`
     * upload. Processing queues automatically. The file variant stages the
     * upload, PUTs the bytes to a signed storage URL, and confirms; the
     * bytes never pass through the Context API.
     */
    create: (
      params: CreateImportParams | CreateFileImportParams,
      options?: RequestOptions,
    ): Promise<JobAccepted> =>
      params.type === 'file'
        ? this.#uploadFile(params, options)
        : this.#request('/imports', {
            method: 'POST',
            body: params,
            ...options,
          }),
    list: (params?: ListOptions) => this.#list<ImportsResponse>('/imports', params),
    get: (params: {importId: string}, options?: RequestOptions) =>
      this.#request<ImportDetail>(`/imports/${params.importId}`, options),
    /** A short-lived signed URL for the original uploaded bytes. */
    download: (params: {importId: string}, options?: RequestOptions) =>
      this.#request<ImportDownloadResponse>(`/imports/${params.importId}/download`, options),
    delete: async (params: {importId: string}, options?: RequestOptions) => {
      await this.#request<void>(`/imports/${params.importId}`, {
        method: 'DELETE',
        ...options,
      })
    },
    /** Preview which pages a crawl would ingest, before committing to it. */
    crawlPreview: (params: CrawlPreviewParams, options?: RequestOptions) =>
      this.#request<CrawlPreviewResponse>('/imports/crawl-preview', {
        method: 'POST',
        body: params,
        ...options,
      }),
  }

  /** Jobs: poll async work (builds, imports) to a terminal state. */
  jobs = {
    get: (params: {jobId: string}, options?: RequestOptions) =>
      this.#request<Job>(`/jobs/${params.jobId}`, options),
  }

  /** Issues: findings from builds awaiting triage. */
  issues = {
    list: (params?: {status?: 'open' | 'accepted' | 'rejected'} & ListOptions) =>
      this.#list<IssuesResponse>('/issues', params, {
        status: params?.status,
      }),
    get: (params: {issueId: string}, options?: RequestOptions) =>
      this.#request<IssueDetail>(`/issues/${params.issueId}`, options),
    /** Resolve a conflict issue. Mints the standing instruction, same as the dashboard. */
    resolve: (params: {issueId: string} & ResolveIssueParams, options?: RequestOptions) => {
      const {issueId, ...body} = params
      return this.#request<ResolveIssueResponse>(`/issues/${issueId}/resolve`, {
        method: 'POST',
        body,
        ...options,
      })
    },
    dismiss: (params: {issueId: string}, options?: RequestOptions) =>
      this.#request<DismissIssueResponse>(`/issues/${params.issueId}/dismiss`, {
        method: 'POST',
        ...options,
      }),
    reopen: (params: {issueId: string}, options?: RequestOptions) =>
      this.#request<ReopenIssueResponse>(`/issues/${params.issueId}/reopen`, {
        method: 'POST',
        ...options,
      }),
    /** Apply already-accepted issues to the knowledge base in one batch. */
    apply: (params: ApplyIssuesParams, options?: RequestOptions) =>
      this.#request<ApplyIssuesResponse>('/issues/apply', {
        method: 'POST',
        body: params,
        ...options,
      }),
  }

  /** Instructions: standing decisions that steer every build. */
  instructions = {
    create: (params: CreateInstructionParams, options?: RequestOptions) =>
      this.#request<Instruction>('/instructions', {
        method: 'POST',
        body: params,
        ...options,
      }),
    list: (params?: ListOptions) => this.#list<InstructionsResponse>('/instructions', params),
    edit: (params: {instructionId: string} & EditInstructionParams, options?: RequestOptions) => {
      const {instructionId, ...body} = params
      return this.#request<Instruction>(`/instructions/${instructionId}`, {
        method: 'PATCH',
        body,
        ...options,
      })
    },
    delete: async (params: {instructionId: string}, options?: RequestOptions) => {
      await this.#request<void>(`/instructions/${params.instructionId}`, {
        method: 'DELETE',
        ...options,
      })
    },
  }

  /** Entries: the built outline, one entry per node. */
  entries = {
    /** List entries, optionally filtered by status or searched (`q`). */
    list: (
      params?: {
        status?: EntryStatus
        q?: string
        mode?: 'keyword' | 'hybrid'
        include?: 'metadata' | 'body'
        paths?: string
      } & ListOptions,
    ) =>
      this.#list<EntriesResponse>('/entries', params, {
        status: params?.status,
        q: params?.q,
        mode: params?.mode,
        include: params?.include,
        paths: params?.paths,
      }),
    /**
     * One entry with its full body, by outline path (e.g. `billing/refunds`).
     * The default `json` format resolves to {@link EntryDetail};
     * `markdown` and `plain` resolve to a string.
     */
    get: <const F extends RenderFormat = 'json'>(
      params: {path: string; format?: F},
      options?: RequestOptions,
    ) =>
      this.#request<F extends 'json' ? EntryDetail : string>(
        `/entries/${encodeURIComponent(params.path)}`,
        {
          query: params.format ? {format: params.format} : {},
          ...options,
        },
      ),
  }

  /** Sources: the distilled units builds cite. */
  sources = {
    list: (params?: ListOptions) => this.#list<SourcesResponse>('/sources', params),
    get: (params: {sourceId: string}, options?: RequestOptions) =>
      this.#request<SourceDetail>(`/sources/${params.sourceId}`, options),
    /**
     * Distilled source content, optionally a line range: the evidence behind
     * a citation or an issue.
     */
    content: (
      params: {sourceId: string; startLine?: number; endLine?: number},
      options?: RequestOptions,
    ) =>
      this.#request<SourceContentResponse>(`/sources/${params.sourceId}/content`, {
        query: _query({
          startLine: params.startLine,
          endLine: params.endLine,
        }),
        ...options,
      }),
    delete: async (params: {sourceId: string}, options?: RequestOptions) => {
      await this.#request<void>(`/sources/${params.sourceId}`, {
        method: 'DELETE',
        ...options,
      })
    },
  }

  /** The audit feed: who did what, when. */
  activity = {
    list: (params?: ListOptions) => this.#list<ActivityResponse>('/activity', params),
  }

  /** Revisions: one per build, with an accounting report per revision. */
  revisions = {
    list: (params?: ListOptions) => this.#list<RevisionsResponse>('/revisions', params),
    report: (params: {revisionId: string}, options?: RequestOptions) =>
      this.#request<RevisionReport>(`/revisions/${params.revisionId}/report`, options),
    /** The outline as it was at a past build revision. */
    outline: (params: {revisionId: string}, options?: RequestOptions) =>
      this.#request<RevisionOutline>(`/revisions/${params.revisionId}/outline`, options),
  }

  /** Crawl options for the configured knowledge base's web source. */
  crawlOptions = {
    edit: (params: EditCrawlOptionsParams, options?: RequestOptions) =>
      this.#request<CrawlOptions>('/crawl-options', {
        method: 'PATCH',
        body: params,
        ...options,
      }),
  }
}

/**
 * Observable counterpart of {@link ContextClient}. Collection-level methods
 * only; knowledge-base scoped operations are promise-based, so use the
 * promise client (`client.context`) for those.
 *
 * @beta
 */
export class ObservableContextClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest

  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /** The knowledge base collection: management addressed per call. */
  knowledgeBases = {
    /** Create a knowledge base. Requires the org-level knowledge-base create grant. */
    create: (
      params: CreateKnowledgeBaseParams,
      options?: RequestOptions,
    ): Observable<KnowledgeBase> =>
      _observe(options?.signal, (signal) =>
        _request<KnowledgeBase>(this.#client, this.#httpRequest, {
          url: COLLECTION_URL,
          method: 'POST',
          body: params,
          tag: options?.tag,
          signal,
        }),
      ),
    /** List the organization's knowledge bases. */
    list: (params: {organizationId: string} & ListOptions): Observable<KnowledgeBasesResponse> =>
      _observe(params.signal, (signal) =>
        _request<KnowledgeBasesResponse>(this.#client, this.#httpRequest, {
          url: COLLECTION_URL,
          query: _query({
            organizationId: params.organizationId,
            cursor: params.cursor,
            limit: params.limit,
          }),
          tag: params.tag,
          signal,
        }),
      ),
    /** Fetch a knowledge base by its id. */
    get: (knowledgeBaseId: string, options?: RequestOptions): Observable<KnowledgeBase> =>
      _observe(options?.signal, (signal) =>
        _request<KnowledgeBase>(this.#client, this.#httpRequest, {
          url: _knowledgeBaseUrl(knowledgeBaseId),
          tag: options?.tag,
          signal,
        }),
      ),
    /** Edit a knowledge base's configuration. */
    edit: (
      knowledgeBaseId: string,
      params: EditKnowledgeBaseParams,
      options?: RequestOptions,
    ): Observable<KnowledgeBase> =>
      _observe(options?.signal, (signal) =>
        _request<KnowledgeBase>(this.#client, this.#httpRequest, {
          url: _knowledgeBaseUrl(knowledgeBaseId),
          method: 'PATCH',
          body: params,
          tag: options?.tag,
          signal,
        }),
      ),
    /** Delete a knowledge base and its generated content. */
    delete: (knowledgeBaseId: string, options?: RequestOptions): Observable<void> =>
      _observe(options?.signal, (signal) =>
        _request<void>(this.#client, this.#httpRequest, {
          url: _knowledgeBaseUrl(knowledgeBaseId),
          method: 'DELETE',
          tag: options?.tag,
          signal,
        }),
      ),
  }
}
