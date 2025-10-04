import {get, query, type DocumentSourceHelpers, type GetOptions} from '../documents'
import type {DocumentSource, DocumentSourceResults, PlainConfig, QueryOptions} from '../types'

export interface DefaultMediaLibraryResults {}

export function mediaLibrary<Results extends DocumentSourceResults = DefaultMediaLibraryResults>(
  id: string,
): MediaLibrary<Results> {
  return new MediaLibraryImpl(id)
}

export type MediaLibrary<Results extends DocumentSourceResults> = DocumentSource<Results> &
  DocumentSourceHelpers<Results> & {
    upload(config: PlainConfig): Promise<void>
  }

class MediaLibraryImpl<Results extends DocumentSourceResults> implements MediaLibrary<Results> {
  resource: [string, string]

  /**
   * @internal
   */
  constructor(id: string) {
    this.resource = ['mediaLibrary', id]
  }

  get(id: string, options: GetOptions) {
    return get<Results>(this, id, options)
  }

  query<const Query extends string>(q: Query, options: QueryOptions) {
    return query<Query, Results>(this, q, options)
  }

  async upload(config: PlainConfig): Promise<void> {
    throw new Error('todo')
  }
}
