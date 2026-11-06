import type {SanityClient} from '../SanityClient'
import type {QueryParams as GroqParams} from '../types'
import type {
  Body,
  ContextRequestOptions,
  EntryDoc,
  IssueDoc,
  McpDoc,
  QueryParams,
  Response,
  Route,
} from './types'

/**
 * The `client.context` namespaces `@sanity/client` 8.14 and earlier had, kept so the Sanity CLI
 * versions that still call them keep working. Each REST method calls a route the Context API
 * still serves; `imports` and `refresh()` went with their routes, so they throw.
 */

/** @beta @deprecated Use `client.context.request`. */
export type LegacyRequestOptions = {signal?: AbortSignal; tag?: string}

/** @beta @deprecated Use `client.context.request`. */
export type LegacyEntry = Pick<EntryDoc, '_id' | 'path' | 'title' | 'tldr' | 'status'>

/** @internal */
export type LegacyRequest = <R extends Route>(route: R, init: object) => Promise<Response<R>>
/** @internal */
export type LegacyFetch = <R>(
  query: string,
  params: GroqParams,
  options?: ContextRequestOptions,
) => Promise<R>

const ENTRY_TYPE = 'sanity.context.entry'
const ISSUE_TYPE = 'sanity.context.issue'
const MCP_TYPE = 'sanity.context.mcp'
const PAGE_SIZE = 200
const MCP_LIST_LIMIT = 500
const CREATED_AT_KEYSET = '(_createdAt > $c || (_createdAt == $c && _id > $i))'

function knowledgeBaseId(client: SanityClient): string {
  const resource = client.config().resource
  if (resource?.type !== 'knowledge-base') {
    throw new Error(
      '`resource` of type `knowledge-base` must be configured to use knowledge-base methods',
    )
  }
  return resource.id
}

function organizationId(client: SanityClient): string {
  const id = client.config().context?.organizationId
  if (!id) throw new Error('`context.organizationId` must be configured to use MCP endpoints')
  return id
}

function removed(name: string): never {
  throw new Error(
    `\`client.context.${name}\` was removed with the Context API's imports. Upgrade the Sanity CLI, or use \`client.context.request\` with the sources, syncs and documents routes.`,
  )
}

async function drainByCreatedAt<T extends {_createdAt: string; _id: string}>(
  fetch: LegacyFetch,
  filter: string,
  params: GroqParams,
  options?: ContextRequestOptions,
): Promise<T[]> {
  const all: T[] = []
  let cursor: {c: string; i: string} | undefined
  for (;;) {
    const pagedFilter = cursor ? `${filter} && ${CREATED_AT_KEYSET}` : filter
    const query = `*[${pagedFilter}] | order(_createdAt asc, _id asc) [0...${PAGE_SIZE}]`
    const page = await fetch<T[]>(query, cursor ? {...params, ...cursor} : params, options)
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
    const last = page[page.length - 1]
    cursor = {c: last._createdAt, i: last._id}
  }
}

/** @internal */
export function legacyNamespaces(
  client: () => SanityClient,
  request: LegacyRequest,
  fetch: LegacyFetch,
) {
  const kb = () => ({knowledgeBaseId: knowledgeBaseId(client())})

  return {
    knowledgeBases: {
      create: (
        params: Body<'POST /knowledge-bases'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /knowledge-bases'>> =>
        request('POST /knowledge-bases', {body: params, ...options}),
      list: (
        params: {organizationId: string; cursor?: string; limit?: number} & LegacyRequestOptions,
      ): Promise<Response<'GET /knowledge-bases'>> => {
        const {signal, tag, ...query} = params
        return request('GET /knowledge-bases', {query, signal, tag})
      },
      get: (
        id: string,
        options?: LegacyRequestOptions,
      ): Promise<Response<'GET /knowledge-bases/{knowledgeBaseId}'>> =>
        request('GET /knowledge-bases/{knowledgeBaseId}', {
          params: {knowledgeBaseId: id},
          ...options,
        }),
      edit: (
        id: string,
        params: Body<'PATCH /knowledge-bases/{knowledgeBaseId}'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'PATCH /knowledge-bases/{knowledgeBaseId}'>> =>
        request('PATCH /knowledge-bases/{knowledgeBaseId}', {
          params: {knowledgeBaseId: id},
          body: params,
          ...options,
        }),
      delete: async (id: string, options?: LegacyRequestOptions): Promise<void> => {
        await request('DELETE /knowledge-bases/{knowledgeBaseId}', {
          params: {knowledgeBaseId: id},
          ...options,
        })
      },
    },

    build: (
      options?: LegacyRequestOptions,
    ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/build'>> =>
      request('POST /knowledge-bases/{knowledgeBaseId}/build', {params: kb(), ...options}),

    cancelBuild: (
      options?: LegacyRequestOptions,
    ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/build/cancel'>> =>
      request('POST /knowledge-bases/{knowledgeBaseId}/build/cancel', {params: kb(), ...options}),

    refresh: (): never => removed('refresh()'),

    imports: {
      create: (): never => removed('imports.create'),
      list: (): never => removed('imports.list'),
      get: (): never => removed('imports.get'),
      download: (): never => removed('imports.download'),
      delete: (): never => removed('imports.delete'),
    },

    jobs: {
      get: (
        params: {jobId: string},
        options?: LegacyRequestOptions,
      ): Promise<Response<'GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}'>> =>
        request('GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}', {
          params: {...kb(), jobId: params.jobId},
          ...options,
        }),
    },

    issues: {
      list: (
        params?: {status?: 'open' | 'accepted' | 'rejected'},
        options?: ContextRequestOptions,
      ): Promise<IssueDoc[]> => {
        const status = params?.status
        return drainByCreatedAt<IssueDoc>(
          fetch,
          `_type == "${ISSUE_TYPE}" && knowledgeBaseId == $kb${status ? ' && status == $status' : ''}`,
          status ? {kb: kb().knowledgeBaseId, status} : {kb: kb().knowledgeBaseId},
          options,
        )
      },
      get: (params: {issueId: string}, options?: ContextRequestOptions): Promise<IssueDoc | null> =>
        fetch<IssueDoc | null>(
          `*[_type == "${ISSUE_TYPE}" && knowledgeBaseId == $kb && _id == $id][0]`,
          {kb: kb().knowledgeBaseId, id: params.issueId},
          options,
        ),
      resolve: (
        params: {
          issueId: string
        } & Body<'POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/resolve'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/resolve'>> => {
        const {issueId, ...body} = params
        return request('POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/resolve', {
          params: {...kb(), issueId},
          body,
          ...options,
        })
      },
      dismiss: (
        params: {issueId: string},
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/dismiss'>> =>
        request('POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/dismiss', {
          params: {...kb(), issueId: params.issueId},
          ...options,
        }),
      reopen: (
        params: {issueId: string},
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/reopen'>> =>
        request('POST /knowledge-bases/{knowledgeBaseId}/issues/{issueId}/reopen', {
          params: {...kb(), issueId: params.issueId},
          ...options,
        }),
      apply: (
        params: Body<'POST /knowledge-bases/{knowledgeBaseId}/issues/apply'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/issues/apply'>> =>
        request('POST /knowledge-bases/{knowledgeBaseId}/issues/apply', {
          params: kb(),
          body: params,
          ...options,
        }),
    },

    entries: {
      list: async (options?: ContextRequestOptions): Promise<LegacyEntry[]> => {
        const all: LegacyEntry[] = []
        let after = ''
        for (;;) {
          const page = await fetch<LegacyEntry[]>(
            `*[_type == "${ENTRY_TYPE}" && knowledgeBaseId == $kb && path > $after] | order(path asc) [0...${PAGE_SIZE}] {_id, path, title, tldr, status}`,
            {kb: kb().knowledgeBaseId, after},
            options,
          )
          all.push(...page)
          if (page.length < PAGE_SIZE) return all
          after = page[page.length - 1].path
        }
      },
      get: (params: {path: string}, options?: ContextRequestOptions): Promise<EntryDoc | null> =>
        fetch<EntryDoc | null>(
          `*[_type == "${ENTRY_TYPE}" && knowledgeBaseId == $kb && path == $path][0]`,
          {kb: kb().knowledgeBaseId, path: params.path},
          options,
        ),
      rebuild: (
        params: {path: string},
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /knowledge-bases/{knowledgeBaseId}/entries/{entryPath}/rebuild'>> =>
        request('POST /knowledge-bases/{knowledgeBaseId}/entries/{entryPath}/rebuild', {
          params: {...kb(), entryPath: params.path},
          ...options,
        }),
    },

    mcpEndpoints: {
      list: (options?: ContextRequestOptions): Promise<McpDoc[]> =>
        fetch<McpDoc[]>(
          `*[_type == "${MCP_TYPE}" && organizationId == $org] | order(_createdAt asc, _id asc) [0...${MCP_LIST_LIMIT}]`,
          {org: organizationId(client())},
          options,
        ),
      get: (params: {name: string}, options?: ContextRequestOptions): Promise<McpDoc | null> =>
        fetch<McpDoc | null>(
          `*[_type == "${MCP_TYPE}" && organizationId == $org && name == $name][0]`,
          {org: organizationId(client()), name: params.name},
          options,
        ),
      create: (
        params: Body<'POST /organizations/{organizationId}/mcp'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'POST /organizations/{organizationId}/mcp'>> =>
        request('POST /organizations/{organizationId}/mcp', {
          params: {organizationId: organizationId(client())},
          body: params,
          ...options,
        }),
      edit: (
        params: {name: string} & Body<'PATCH /organizations/{organizationId}/mcp/{mcpEndpoint}'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'PATCH /organizations/{organizationId}/mcp/{mcpEndpoint}'>> => {
        const {name, ...body} = params
        return request('PATCH /organizations/{organizationId}/mcp/{mcpEndpoint}', {
          params: {organizationId: organizationId(client()), mcpEndpoint: name},
          body,
          ...options,
        })
      },
      status: (
        params: {
          name: string
        } & QueryParams<'GET /organizations/{organizationId}/mcp/{mcpEndpoint}/status'>,
        options?: LegacyRequestOptions,
      ): Promise<Response<'GET /organizations/{organizationId}/mcp/{mcpEndpoint}/status'>> => {
        const {name, ...query} = params
        return request('GET /organizations/{organizationId}/mcp/{mcpEndpoint}/status', {
          params: {organizationId: organizationId(client()), mcpEndpoint: name},
          query,
          ...options,
        })
      },
      delete: async (params: {name: string}, options?: LegacyRequestOptions): Promise<void> => {
        await request('DELETE /organizations/{organizationId}/mcp/{mcpEndpoint}', {
          params: {organizationId: organizationId(client()), mcpEndpoint: params.name},
          ...options,
        })
      },
      initialContext: (
        params: {
          name: string
        } & QueryParams<'GET /organizations/{organizationId}/mcp/{mcpEndpoint}/initial-context'>,
        options?: LegacyRequestOptions,
      ): Promise<
        Response<'GET /organizations/{organizationId}/mcp/{mcpEndpoint}/initial-context'>
      > => {
        const {name, ...query} = params
        return request('GET /organizations/{organizationId}/mcp/{mcpEndpoint}/initial-context', {
          params: {organizationId: organizationId(client()), mcpEndpoint: name},
          query,
          ...options,
        })
      },
    },
  }
}

/** @beta @deprecated Use `client.context.request`. */
export type LegacyNamespaces = ReturnType<typeof legacyNamespaces>
