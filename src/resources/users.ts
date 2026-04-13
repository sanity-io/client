import {get, query, type DocumentSourceHelpers, type GetOptions} from '../documents'
import type {DocumentSource, DocumentSourceResults, QueryOptions} from '../types'

export interface UsersResult extends DocumentSourceResults {
  document: {_id: string; _type: 'user'}
}

export type Users = DocumentSource<UsersResult> & DocumentSourceHelpers<UsersResult>

class UsersImpl implements Users {
  resource: [string] = ['role']

  get(id: string, options: GetOptions) {
    return get<UsersResult>(this, id, options)
  }

  query<const Query extends string>(q: Query, options: QueryOptions) {
    return query<Query, UsersResult>(this, q, options)
  }
}

export const users: Users = new UsersImpl()
