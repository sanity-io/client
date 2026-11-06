import {lastValueFrom} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {HttpRequest, QueryParams} from '../types'
import {_fetch, _organizationId} from './store'
import type {
  ContextRequestOptions,
  ConversationDoc,
  Entry,
  EntryDoc,
  InstructionDoc,
  IssueDoc,
  McpDoc,
} from './types'

type Client = SanityClient | ObservableSanityClient

const ENTRY_TYPE = 'sanity.context.entry'
const ISSUE_TYPE = 'sanity.context.issue'
const INSTRUCTION_TYPE = 'sanity.context.instruction'
const MCP_TYPE = 'sanity.context.mcp'
const CONVERSATION_TYPE = 'sanity.context.conversation'

/** Documents per page while a list read drains the store to completion. */
const PAGE_SIZE = 200

/** MCP endpoint configurations are few; one capped page covers them all. */
const MCP_LIST_LIMIT = 500

/** Keyset cursor over the `| order(_createdAt asc, _id asc)` total order. */
const CREATED_AT_KEYSET = '(_createdAt > $c || (_createdAt == $c && _id > $i))'

function _one<R>(
  client: Client,
  httpRequest: HttpRequest,
  query: string,
  params: QueryParams,
  options?: ContextRequestOptions,
): Promise<R | null> {
  return lastValueFrom(_fetch<R | null>(client, httpRequest, query, params, options))
}

/**
 * Drain every page of a `(_createdAt, _id)`-keyset read. Termination keys on
 * the raw page length before anything looks at the rows: a short page means
 * the store had nothing more to give, and filtering must never shorten a
 * full page into a false stop.
 */
async function _drainByCreatedAt<T extends {_createdAt: string; _id: string}>(
  client: Client,
  httpRequest: HttpRequest,
  filter: string,
  params: QueryParams,
  options?: ContextRequestOptions,
): Promise<T[]> {
  const all: T[] = []
  let cursor: {c: string; i: string} | undefined
  for (;;) {
    const pagedFilter = cursor ? `${filter} && ${CREATED_AT_KEYSET}` : filter
    const query = `*[${pagedFilter}] | order(_createdAt asc, _id asc) [0...${PAGE_SIZE}]`
    const page = await lastValueFrom(
      _fetch<T[]>(client, httpRequest, query, cursor ? {...params, ...cursor} : params, options),
    )
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
    const last = page[page.length - 1]
    cursor = {c: last._createdAt, i: last._id}
  }
}

/** @internal */
export function _readEntry(
  client: Client,
  httpRequest: HttpRequest,
  knowledgeBaseId: string,
  path: string,
  options?: ContextRequestOptions,
): Promise<EntryDoc | null> {
  return _one<EntryDoc>(
    client,
    httpRequest,
    `*[_type == "${ENTRY_TYPE}" && knowledgeBaseId == $kb && path == $path][0]`,
    {kb: knowledgeBaseId, path},
    options,
  )
}

/** @internal */
export async function _listEntries(
  client: Client,
  httpRequest: HttpRequest,
  knowledgeBaseId: string,
  options?: ContextRequestOptions,
): Promise<Entry[]> {
  const all: Entry[] = []
  let after = ''
  for (;;) {
    const query = `*[_type == "${ENTRY_TYPE}" && knowledgeBaseId == $kb && path > $after] | order(path asc) [0...${PAGE_SIZE}] {_id, path, title, tldr, status}`
    const page = await lastValueFrom(
      _fetch<Entry[]>(client, httpRequest, query, {kb: knowledgeBaseId, after}, options),
    )
    all.push(...page)
    if (page.length < PAGE_SIZE) return all
    after = page[page.length - 1].path
  }
}

/** @internal */
export function _listIssues(
  client: Client,
  httpRequest: HttpRequest,
  knowledgeBaseId: string,
  status: 'open' | 'accepted' | 'rejected' | undefined,
  options?: ContextRequestOptions,
): Promise<IssueDoc[]> {
  const statusFilter = status === undefined ? '' : ' && status == $status'
  return _drainByCreatedAt<IssueDoc>(
    client,
    httpRequest,
    `_type == "${ISSUE_TYPE}" && knowledgeBaseId == $kb${statusFilter}`,
    status === undefined ? {kb: knowledgeBaseId} : {kb: knowledgeBaseId, status},
    options,
  )
}

/** @internal */
export function _readIssue(
  client: Client,
  httpRequest: HttpRequest,
  knowledgeBaseId: string,
  issueId: string,
  options?: ContextRequestOptions,
): Promise<IssueDoc | null> {
  return _one<IssueDoc>(
    client,
    httpRequest,
    `*[_type == "${ISSUE_TYPE}" && knowledgeBaseId == $kb && _id == $id][0]`,
    {kb: knowledgeBaseId, id: issueId},
    options,
  )
}

/** @internal */
export function _listInstructions(
  client: Client,
  httpRequest: HttpRequest,
  knowledgeBaseId: string,
  options?: ContextRequestOptions,
): Promise<InstructionDoc[]> {
  return _drainByCreatedAt<InstructionDoc>(
    client,
    httpRequest,
    `_type == "${INSTRUCTION_TYPE}" && knowledgeBaseId == $kb && schemaVersion == 1`,
    {kb: knowledgeBaseId},
    options,
  )
}

/** @internal */
export function _listMcpEndpoints(
  client: Client,
  httpRequest: HttpRequest,
  options?: ContextRequestOptions,
): Promise<McpDoc[]> {
  return lastValueFrom(
    _fetch<McpDoc[]>(
      client,
      httpRequest,
      `*[_type == "${MCP_TYPE}" && organizationId == $org] | order(_createdAt asc, _id asc) [0...${MCP_LIST_LIMIT}]`,
      {org: _organizationId(client)},
      options,
    ),
  )
}

/** @internal */
export function _readMcpEndpoint(
  client: Client,
  httpRequest: HttpRequest,
  name: string,
  options?: ContextRequestOptions,
): Promise<McpDoc | null> {
  return _one<McpDoc>(
    client,
    httpRequest,
    `*[_type == "${MCP_TYPE}" && organizationId == $org && name == $name][0]`,
    {org: _organizationId(client), name},
    options,
  )
}

/** @internal */
export function _readConversation(
  client: Client,
  httpRequest: HttpRequest,
  threadId: string,
  options?: ContextRequestOptions,
): Promise<ConversationDoc | null> {
  return _one<ConversationDoc>(
    client,
    httpRequest,
    `*[_type == "${CONVERSATION_TYPE}" && organizationId == $org && threadId == $threadId][0]`,
    {org: _organizationId(client), threadId},
    options,
  )
}
