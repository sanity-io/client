import type {
  DocumentFromResults,
  DocumentSource,
  DocumentSourceResults,
  PlainConfig,
  QueryFromResults,
} from './types'

export type DocumentSourceHelpers<Results extends DocumentSourceResults> = {
  get(id: string, options: GetOptions): Promise<DocumentFromResults<Results>>
  query<const Query extends string>(
    query: Query,
    options: QueryOptions,
  ): Promise<QueryFromResults<Results, Query>>
}

export function get<Results extends DocumentSourceResults>(
  source: DocumentSource<Results>,
  id: string,
  options: GetOptions,
): Promise<DocumentFromResults<Results>> {
  throw new Error('todo')
}

export type GetOptions = PlainConfig

export function query<const Query extends string, Results extends DocumentSourceResults>(
  source: DocumentSource<Results>,
  query: Query,
  options: QueryOptions,
): Promise<QueryFromResults<Results, Query>> {
  throw new Error('todo')
}

export type QueryOptions = PlainConfig & {params?: Record<string, unknown>}
