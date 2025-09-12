import {get, query, type DocumentSourceHelpers, type GetOptions} from '../documents'
import type {
  DefaultDocumentSourceResults,
  DocumentSource,
  DocumentSourceResults,
  QueryOptions,
} from '../types'

export function dataset<Results extends DocumentSourceResults = DefaultDocumentSourceResults>(
  projectId: string,
  dataset: string,
): Dataset<Results> {
  return new DatasetImpl(`${projectId}.${dataset}`)
}

export type Dataset<Results extends DocumentSourceResults> = DocumentSource<Results> &
  DocumentSourceHelpers<Results>

class DatasetImpl<Results extends DocumentSourceResults> implements Dataset<Results> {
  resource: [string, string]

  constructor(id: string) {
    this.resource = ['dataset', id]
  }

  get(id: string, options: GetOptions) {
    return get<Results>(this, id, options)
  }

  query<const Query extends string>(q: Query, options: QueryOptions) {
    return query<Query, Results>(this, q, options)
  }
}
