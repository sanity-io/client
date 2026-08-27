import {type FetchFunction} from 'get-it'
import {lastValueFrom, type Observable} from 'rxjs'

import {_observe, _request} from '../data/dataMethods'
import type {ListenEventFromOptions} from '../data/listen'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, QueryParams, SanityDocument} from '../types'
import {
  _listEntries,
  _listInstructions,
  _listIssues,
  _listMcpEndpoints,
  _readConversation,
  _readEntry,
  _readIssue,
  _readMcpEndpoint,
} from './reads'
import {_fetch as _fetchStore, _listen as _listenStore} from './store'
import type {
  ApplyIssuesParams,
  ApplyIssuesResponse,
  ClassifyConversationParams,
  ContextListenOptions,
  ContextRequestOptions,
  Conversation,
  ConversationDoc,
  CreateFileImportParams,
  CreateImportParams,
  CreateInstructionParams,
  CreateInstructionResponse,
  CreateKnowledgeBaseParams,
  DismissIssueResponse,
  EditInstructionParams,
  EditKnowledgeBaseParams,
  Entry,
  EntryDoc,
  ImportDetail,
  ImportDownloadResponse,
  ImportsResponse,
  Instruction,
  InstructionDoc,
  IssueDoc,
  Job,
  JobAccepted,
  KnowledgeBase,
  KnowledgeBasesResponse,
  McpDoc,
  RebuildEntryResponse,
  ReopenIssueResponse,
  RequestOptions,
  ResolveIssueParams,
  ResolveIssueResponse,
  SaveConversationParams,
  Source,
  SourceContentResponse,
  SourceDetail,
  SourcesResponse,
  StagedUpload,
} from './types'

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
function _conversationUrl(client: Client, threadId: string): string {
  const organizationId = client.config().context?.organizationId

  if (!organizationId) {
    throw new Error('`context.organizationId` must be configured to record conversations')
  }

  if (!threadId) {
    throw new Error('`threadId` must be provided')
  }

  return `/context/organizations/${encodeURIComponent(organizationId)}/conversations/${encodeURIComponent(threadId)}`
}

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
    return this.#request<JobAccepted>(
      `/imports/uploads/${encodeURIComponent(staged.importId)}/complete`,
      {
        method: 'POST',
        body: {},
        ...options,
      },
    )
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
   * GROQ over the organization's Context documents (conversation telemetry
   * today; the store holds every Context family and the caller's access
   * decides what a query returns, so filter on `_type`).
   *
   * Requires `context.organizationId` in the client configuration.
   */
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: ContextRequestOptions,
  ): Promise<R> {
    return lastValueFrom(_fetchStore<R>(this.#client, this.#httpRequest, query, params, options))
  }

  /**
   * Listen for changes to the organization's Context documents. Mirrors
   * `client.listen(query, params, options)` and emits mutation events by
   * default.
   */
  listen<Opts extends ContextListenOptions | undefined = undefined>(
    query: string,
    params?: QueryParams,
    options?: Opts,
  ): Observable<ListenEventFromOptions<SanityDocument, Opts>> {
    return _listenStore(this.#client, query, params, options)
  }

  /**
   * Conversation telemetry. `threadId` identifies the conversation within
   * the organization — reuse means the same conversation. Beyond the canned
   * `get`, reads go through {@link fetch} and {@link listen} with GROQ
   * (`_type == "sanity.context.conversation"`).
   *
   * Requires `context.organizationId` in the client configuration.
   */
  conversations = {
    /**
     * Record a conversation. Messages replace the stored transcript
     * wholesale; `metadata` and model fields only overwrite when present.
     * Last write per thread wins — retries are safe.
     */
    save: (
      params: {threadId: string} & SaveConversationParams,
      options?: RequestOptions,
    ): Promise<Conversation> => {
      const {threadId, ...body} = params
      return _request<Conversation>(this.#client, this.#httpRequest, {
        url: _conversationUrl(this.#client, threadId),
        method: 'PUT',
        body,
        ...options,
      })
    },
    /**
     * Record the classification your own model produced for one thread:
     * exactly one of `coreMetrics` (a verdict) or `classificationError`
     * (why classification failed).
     */
    classify: (
      params: {threadId: string} & ClassifyConversationParams,
      options?: RequestOptions,
    ): Promise<Conversation> => {
      const {threadId, ...body} = params
      return _request<Conversation>(this.#client, this.#httpRequest, {
        url: _conversationUrl(this.#client, threadId),
        method: 'PATCH',
        body,
        ...options,
      })
    },
    /**
     * One recorded conversation by its thread id, or `null` when the thread
     * was never recorded. Runs:
     *
     * `*[_type == "sanity.context.conversation" && organizationId == $org && threadId == $threadId][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (
      params: {threadId: string},
      options?: ContextRequestOptions,
    ): Promise<ConversationDoc | null> =>
      _readConversation(this.#client, this.#httpRequest, params.threadId, options),
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
      this.#request<ImportDetail>(`/imports/${encodeURIComponent(params.importId)}`, options),
    /** A short-lived signed URL for the original uploaded bytes. */
    download: (params: {importId: string}, options?: RequestOptions) =>
      this.#request<ImportDownloadResponse>(
        `/imports/${encodeURIComponent(params.importId)}/download`,
        options,
      ),
    delete: async (params: {importId: string}, options?: RequestOptions) => {
      await this.#request<void>(`/imports/${encodeURIComponent(params.importId)}`, {
        method: 'DELETE',
        ...options,
      })
    },
  }

  /** Jobs: poll async work (builds, imports) to a terminal state. */
  jobs = {
    get: (params: {jobId: string}, options?: RequestOptions) =>
      this.#request<Job>(`/jobs/${encodeURIComponent(params.jobId)}`, options),
  }

  /**
   * Issues: findings from builds awaiting triage. Reads are canned GROQ
   * queries against the organization's document store; for anything more,
   * use {@link fetch}. Reads require `context.organizationId` alongside the
   * knowledge-base `resource` in the client configuration.
   */
  issues = {
    /**
     * Every issue on the knowledge base, oldest first, optionally narrowed
     * to one status. Drains keyset pages internally and resolves with the
     * complete set. Runs:
     *
     * `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && status == $status] | order(_createdAt asc, _id asc)`
     *
     * (the status clause only when given). For anything more, use {@link fetch}.
     */
    list: (
      params?: {status?: 'open' | 'accepted' | 'rejected'},
      options?: ContextRequestOptions,
    ): Promise<IssueDoc[]> =>
      _listIssues(
        this.#client,
        this.#httpRequest,
        _resolveKnowledgeBaseId(this.#client),
        params?.status,
        options,
      ),
    /**
     * One issue by its document id, or `null` when it does not exist. Runs:
     *
     * `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && _id == $id][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (params: {issueId: string}, options?: ContextRequestOptions): Promise<IssueDoc | null> =>
      _readIssue(
        this.#client,
        this.#httpRequest,
        _resolveKnowledgeBaseId(this.#client),
        params.issueId,
        options,
      ),
    /** Resolve a conflict issue. Mints the standing instruction, same as the dashboard. */
    resolve: (params: {issueId: string} & ResolveIssueParams, options?: RequestOptions) => {
      const {issueId, ...body} = params
      return this.#request<ResolveIssueResponse>(`/issues/${encodeURIComponent(issueId)}/resolve`, {
        method: 'POST',
        body,
        ...options,
      })
    },
    dismiss: (params: {issueId: string}, options?: RequestOptions) =>
      this.#request<DismissIssueResponse>(`/issues/${encodeURIComponent(params.issueId)}/dismiss`, {
        method: 'POST',
        ...options,
      }),
    reopen: (params: {issueId: string}, options?: RequestOptions) =>
      this.#request<ReopenIssueResponse>(`/issues/${encodeURIComponent(params.issueId)}/reopen`, {
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
    create: (
      params: CreateInstructionParams,
      options?: RequestOptions,
    ): Promise<CreateInstructionResponse> =>
      this.#request<CreateInstructionResponse>('/instructions', {
        method: 'POST',
        body: params,
        ...options,
      }),
    /**
     * Every current-schema instruction on the knowledge base, oldest first.
     * Drains keyset pages internally and resolves with the complete set.
     * Runs:
     *
     * `*[_type == "sanity.context.instruction" && knowledgeBaseId == $kb && schemaVersion == 1] | order(_createdAt asc, _id asc)`
     *
     * For anything more, use {@link fetch}. Requires `context.organizationId`
     * alongside the knowledge-base `resource` in the client configuration.
     */
    list: (options?: ContextRequestOptions): Promise<InstructionDoc[]> =>
      _listInstructions(
        this.#client,
        this.#httpRequest,
        _resolveKnowledgeBaseId(this.#client),
        options,
      ),
    edit: (params: {instructionId: string} & EditInstructionParams, options?: RequestOptions) => {
      const {instructionId, ...body} = params
      return this.#request<Instruction>(`/instructions/${encodeURIComponent(instructionId)}`, {
        method: 'PATCH',
        body,
        ...options,
      })
    },
    delete: async (params: {instructionId: string}, options?: RequestOptions) => {
      await this.#request<void>(`/instructions/${encodeURIComponent(params.instructionId)}`, {
        method: 'DELETE',
        ...options,
      })
    },
  }

  /**
   * Entries: the built outline, one entry per node. Reads are canned GROQ
   * queries against the organization's document store; for anything more,
   * use {@link fetch}. Requires `context.organizationId` alongside the
   * knowledge-base `resource` in the client configuration.
   */
  entries = {
    /**
     * Every entry, path-ordered, as a metadata view (`_id`, `path`,
     * `title`, `tldr`, `status`) with bodies excluded. Drains keyset pages
     * internally and resolves with the complete set. Runs:
     *
     * `*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path > $after] | order(path asc) [0...200] {_id, path, title, tldr, status}`
     *
     * For bodies, use `entries.get` or {@link fetch}.
     */
    list: (options?: ContextRequestOptions): Promise<Entry[]> =>
      _listEntries(this.#client, this.#httpRequest, _resolveKnowledgeBaseId(this.#client), options),
    /**
     * One entry with its full body and citations, by outline path (e.g.
     * `billing/refunds`), or `null` when no entry sits at that path. Runs:
     *
     * `*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path == $path][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (params: {path: string}, options?: ContextRequestOptions): Promise<EntryDoc | null> =>
      _readEntry(
        this.#client,
        this.#httpRequest,
        _resolveKnowledgeBaseId(this.#client),
        params.path,
        options,
      ),
    /**
     * Rebuild one entry from its already-placed sources, by outline path.
     * Poll the returned job with {@link jobs}; `affectedEntries` lists every
     * entry the rebuild touches.
     */
    rebuild: (params: {path: string}, options?: RequestOptions): Promise<RebuildEntryResponse> =>
      this.#request<RebuildEntryResponse>(`/entries/${encodeURIComponent(params.path)}/rebuild`, {
        method: 'POST',
        ...options,
      }),
  }

  /**
   * MCP endpoint configurations, org-owned documents read with canned GROQ
   * queries. Requires `context.organizationId` in the client configuration.
   */
  mcpEndpoints = {
    /**
     * The organization's MCP endpoint configurations, oldest first. Runs:
     *
     * `*[_type == "sanity.context.mcp" && organizationId == $org] | order(_createdAt asc, _id asc) [0...500]`
     *
     * For anything more, use {@link fetch}.
     */
    list: (options?: ContextRequestOptions): Promise<McpDoc[]> =>
      _listMcpEndpoints(this.#client, this.#httpRequest, options),
    /**
     * One MCP endpoint configuration by its URL name, or `null` when none
     * carries that name. Runs:
     *
     * `*[_type == "sanity.context.mcp" && organizationId == $org && name == $name][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (params: {name: string}, options?: ContextRequestOptions): Promise<McpDoc | null> =>
      _readMcpEndpoint(this.#client, this.#httpRequest, params.name, options),
  }

  /** Sources: the distilled units builds cite. */
  sources = {
    /**
     * List sources, optionally filtered by `status` or the `importId` they
     * came from. `ids` is a lookup mode: it resolves those exact sources
     * (e.g. from an entry's citations) and overrides `status` and `cursor`.
     */
    list: (
      params?: {
        status?: Source['status']
        importId?: string
        ids?: string[]
      } & ListOptions,
    ) =>
      this.#list<SourcesResponse>('/sources', params, {
        status: params?.status,
        importId: params?.importId,
        ids: params?.ids?.join(','),
      }),
    get: (params: {sourceId: string}, options?: RequestOptions) =>
      this.#request<SourceDetail>(`/sources/${encodeURIComponent(params.sourceId)}`, options),
    /**
     * Distilled source content, optionally a line range: the evidence behind
     * a citation or an issue.
     */
    content: (
      params: {sourceId: string; startLine?: number; endLine?: number},
      options?: RequestOptions,
    ) =>
      this.#request<SourceContentResponse>(
        `/sources/${encodeURIComponent(params.sourceId)}/content`,
        {
          query: _query({
            startLine: params.startLine,
            endLine: params.endLine,
          }),
          ...options,
        },
      ),
    delete: async (params: {sourceId: string}, options?: RequestOptions) => {
      await this.#request<void>(`/sources/${encodeURIComponent(params.sourceId)}`, {
        method: 'DELETE',
        ...options,
      })
    },
  }
}

/**
 * Observable counterpart of {@link ContextClient}. Collection-level
 * methods and the GROQ-backed reads; knowledge-base scoped write
 * operations are promise-based, so use the promise client
 * (`client.context`) for those.
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

  /**
   * GROQ over the organization's Context documents (conversation telemetry
   * today; the store holds every Context family and the caller's access
   * decides what a query returns, so filter on `_type`).
   *
   * Requires `context.organizationId` in the client configuration.
   */
  fetch<R = unknown>(
    query: string,
    params?: QueryParams,
    options?: ContextRequestOptions,
  ): Observable<R> {
    return _fetchStore<R>(this.#client, this.#httpRequest, query, params, options)
  }

  /**
   * Listen for changes to the organization's Context documents. Mirrors
   * `client.listen(query, params, options)` and emits mutation events by
   * default.
   */
  listen<Opts extends ContextListenOptions | undefined = undefined>(
    query: string,
    params?: QueryParams,
    options?: Opts,
  ): Observable<ListenEventFromOptions<SanityDocument, Opts>> {
    return _listenStore(this.#client, query, params, options)
  }

  /**
   * Conversation telemetry. `threadId` identifies the conversation within
   * the organization — reuse means the same conversation. Beyond the canned
   * `get`, reads go through {@link fetch} and {@link listen} with GROQ
   * (`_type == "sanity.context.conversation"`).
   *
   * Requires `context.organizationId` in the client configuration.
   */
  conversations = {
    /**
     * Record a conversation. Messages replace the stored transcript
     * wholesale; `metadata` and model fields only overwrite when present.
     * Last write per thread wins — retries are safe.
     */
    save: (
      params: {threadId: string} & SaveConversationParams,
      options?: RequestOptions,
    ): Observable<Conversation> => {
      const {threadId, ...body} = params
      return _observe(options?.signal, (signal) =>
        _request<Conversation>(this.#client, this.#httpRequest, {
          url: _conversationUrl(this.#client, threadId),
          method: 'PUT',
          body,
          tag: options?.tag,
          signal,
        }),
      )
    },
    /**
     * Record the classification your own model produced for one thread:
     * exactly one of `coreMetrics` (a verdict) or `classificationError`
     * (why classification failed).
     */
    classify: (
      params: {threadId: string} & ClassifyConversationParams,
      options?: RequestOptions,
    ): Observable<Conversation> => {
      const {threadId, ...body} = params
      return _observe(options?.signal, (signal) =>
        _request<Conversation>(this.#client, this.#httpRequest, {
          url: _conversationUrl(this.#client, threadId),
          method: 'PATCH',
          body,
          tag: options?.tag,
          signal,
        }),
      )
    },
    /**
     * One recorded conversation by its thread id, or `null` when the thread
     * was never recorded. Runs:
     *
     * `*[_type == "sanity.context.conversation" && organizationId == $org && threadId == $threadId][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (
      params: {threadId: string},
      options?: ContextRequestOptions,
    ): Observable<ConversationDoc | null> =>
      _observe(options?.signal, (signal) =>
        _readConversation(this.#client, this.#httpRequest, params.threadId, {
          ...options,
          signal,
        }),
      ),
  }

  /**
   * Entries: the built outline, one entry per node. Reads are canned GROQ
   * queries against the organization's document store; for anything more,
   * use {@link fetch}. Requires `context.organizationId` alongside the
   * knowledge-base `resource` in the client configuration.
   */
  entries = {
    /**
     * Every entry, path-ordered, as a metadata view (`_id`, `path`,
     * `title`, `tldr`, `status`) with bodies excluded. Drains keyset pages
     * internally and emits the complete set. Runs:
     *
     * `*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path > $after] | order(path asc) [0...200] {_id, path, title, tldr, status}`
     *
     * For bodies, use `entries.get` or {@link fetch}.
     */
    list: (options?: ContextRequestOptions): Observable<Entry[]> =>
      _observe(options?.signal, (signal) =>
        _listEntries(this.#client, this.#httpRequest, _resolveKnowledgeBaseId(this.#client), {
          ...options,
          signal,
        }),
      ),
    /**
     * One entry with its full body and citations, by outline path (e.g.
     * `billing/refunds`), or `null` when no entry sits at that path. Runs:
     *
     * `*[_type == "sanity.context.entry" && knowledgeBaseId == $kb && path == $path][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (params: {path: string}, options?: ContextRequestOptions): Observable<EntryDoc | null> =>
      _observe(options?.signal, (signal) =>
        _readEntry(
          this.#client,
          this.#httpRequest,
          _resolveKnowledgeBaseId(this.#client),
          params.path,
          {...options, signal},
        ),
      ),
    /**
     * Rebuild one entry from its already-placed sources, by outline path.
     * Poll the returned job with the promise client's `jobs`;
     * `affectedEntries` lists every entry the rebuild touches.
     */
    rebuild: (params: {path: string}, options?: RequestOptions): Observable<RebuildEntryResponse> =>
      _observe(options?.signal, (signal) =>
        _request<RebuildEntryResponse>(this.#client, this.#httpRequest, {
          url: _knowledgeBaseUrl(
            _resolveKnowledgeBaseId(this.#client),
            `/entries/${encodeURIComponent(params.path)}/rebuild`,
          ),
          method: 'POST',
          tag: options?.tag,
          signal,
        }),
      ),
  }

  /**
   * Issues: findings from builds awaiting triage. Reads are canned GROQ
   * queries against the organization's document store; for anything more,
   * use {@link fetch}. Requires `context.organizationId` alongside the
   * knowledge-base `resource` in the client configuration.
   */
  issues = {
    /**
     * Every issue on the knowledge base, oldest first, optionally narrowed
     * to one status. Drains keyset pages internally and emits the complete
     * set. Runs:
     *
     * `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && status == $status] | order(_createdAt asc, _id asc)`
     *
     * (the status clause only when given). For anything more, use {@link fetch}.
     */
    list: (
      params?: {status?: 'open' | 'accepted' | 'rejected'},
      options?: ContextRequestOptions,
    ): Observable<IssueDoc[]> =>
      _observe(options?.signal, (signal) =>
        _listIssues(
          this.#client,
          this.#httpRequest,
          _resolveKnowledgeBaseId(this.#client),
          params?.status,
          {...options, signal},
        ),
      ),
    /**
     * One issue by its document id, or `null` when it does not exist. Runs:
     *
     * `*[_type == "sanity.context.issue" && knowledgeBaseId == $kb && _id == $id][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (
      params: {issueId: string},
      options?: ContextRequestOptions,
    ): Observable<IssueDoc | null> =>
      _observe(options?.signal, (signal) =>
        _readIssue(
          this.#client,
          this.#httpRequest,
          _resolveKnowledgeBaseId(this.#client),
          params.issueId,
          {...options, signal},
        ),
      ),
  }

  /**
   * Instructions: standing decisions that steer every build. The canned
   * GROQ read; writes are promise-based on `client.context`.
   */
  instructions = {
    /**
     * Every current-schema instruction on the knowledge base, oldest first.
     * Drains keyset pages internally and emits the complete set. Runs:
     *
     * `*[_type == "sanity.context.instruction" && knowledgeBaseId == $kb && schemaVersion == 1] | order(_createdAt asc, _id asc)`
     *
     * For anything more, use {@link fetch}. Requires `context.organizationId`
     * alongside the knowledge-base `resource` in the client configuration.
     */
    list: (options?: ContextRequestOptions): Observable<InstructionDoc[]> =>
      _observe(options?.signal, (signal) =>
        _listInstructions(this.#client, this.#httpRequest, _resolveKnowledgeBaseId(this.#client), {
          ...options,
          signal,
        }),
      ),
  }

  /**
   * MCP endpoint configurations, org-owned documents read with canned GROQ
   * queries. Requires `context.organizationId` in the client configuration.
   */
  mcpEndpoints = {
    /**
     * The organization's MCP endpoint configurations, oldest first. Runs:
     *
     * `*[_type == "sanity.context.mcp" && organizationId == $org] | order(_createdAt asc, _id asc) [0...500]`
     *
     * For anything more, use {@link fetch}.
     */
    list: (options?: ContextRequestOptions): Observable<McpDoc[]> =>
      _observe(options?.signal, (signal) =>
        _listMcpEndpoints(this.#client, this.#httpRequest, {
          ...options,
          signal,
        }),
      ),
    /**
     * One MCP endpoint configuration by its URL name, or `null` when none
     * carries that name. Runs:
     *
     * `*[_type == "sanity.context.mcp" && organizationId == $org && name == $name][0]`
     *
     * For anything more, use {@link fetch}.
     */
    get: (params: {name: string}, options?: ContextRequestOptions): Observable<McpDoc | null> =>
      _observe(options?.signal, (signal) =>
        _readMcpEndpoint(this.#client, this.#httpRequest, params.name, {
          ...options,
          signal,
        }),
      ),
  }
}
