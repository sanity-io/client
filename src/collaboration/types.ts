import type {
  Any,
  ListenOptions,
  QueryParams,
  RequestOptions,
  ResumableListenOptions,
  SanityDocument,
} from '../types'

/** @internal */
export const possibleRequestOptions = ['headers', 'signal', 'tag', 'timeout', 'token'] as const

/**
 * Request options honored by the collaboration comments methods.
 *
 * @alpha
 */
export type CollaborationCommentsRequestOptions = Pick<
  RequestOptions,
  (typeof possibleRequestOptions)[number]
>

/**
 * Options for collaboration comments write methods.
 *
 * @alpha
 */
export type CollaborationCommentsWriteOptions = CollaborationCommentsRequestOptions & {
  /** Transaction ID to associate the write with */
  transactionId?: string
}

/**
 * Structured query options for `collaboration.comments.fetch`.
 *
 * Request options such as `signal` and `tag` are passed as a trailing argument,
 * the same way as `client.fetch(query, params, options)`.
 *
 * ### Example
 * ```ts
 * // Open comments on a document, newest first
 * await client.collaboration.comments.fetch({
 *   targetDocumentId: 'doc-1',
 *   filter: 'status == "open"',
 *   orderings: [{field: '_createdAt', direction: 'desc'}],
 *   slice: [0, 50],
 * })
 * ```
 *
 * @alpha
 */
export interface CollaborationCommentsStructuredFetchOptions {
  /**
   * GROQ filter appended to the built-in `_type == "sanity.comment"` filter.
   * The string is interpolated into the query as-is, so pass untrusted values
   * through `params` instead of embedding them in the filter.
   */
  filter?: string
  /** Result orderings, applied with the GROQ `order()` function */
  orderings?: {field: string; direction: 'asc' | 'desc'}[]
  /** Values for GROQ parameters (`$param`) used in `filter` */
  params?: QueryParams
  /** Result pagination, applied as a GROQ slice, e.g. `[0...50]` */
  slice?: [number, number]
  /**
   * Only return comments on the given document. The client builds the
   * `target.document._ref` value from the configured `resource` and the
   * published ID of the given document ID (draft and version IDs are
   * normalized, since comment refs always use published IDs).
   */
  targetDocumentId?: string
}

/**
 * Listener options for `collaboration.comments.listen`.
 *
 * @alpha
 */
export type CollaborationCommentsListenOptions = ListenOptions | ResumableListenOptions

/**
 * Structured query options for `collaboration.comments.listen`.
 *
 * Listener options such as `events`, `includeResult` and `tag` are passed as a
 * trailing argument, the same way as `client.listen(query, params, options)`.
 *
 * @alpha
 */
export interface CollaborationCommentsStructuredListenOptions {
  /**
   * GROQ filter appended to the built-in `_type == "sanity.comment"` filter.
   * The string is interpolated into the query as-is, so pass untrusted values
   * through `params` instead of embedding them in the filter.
   */
  filter?: string
  /** Values for GROQ parameters (`$param`) used in `filter` */
  params?: QueryParams
  /**
   * Only listen for comments on the given document. The client builds the
   * `target.document._ref` value from the configured `resource` and the
   * published ID of the given document ID (draft and version IDs are
   * normalized, since comment refs always use published IDs).
   */
  targetDocumentId?: string
}

/** @alpha */
export type CollaborationCommentStatus = 'open' | 'resolved'

/** @alpha */
export type CollaborationCommentReactionShortName =
  | ':-1:'
  | ':+1:'
  | ':eyes:'
  | ':heart:'
  | ':heavy_plus_sign:'
  | ':rocket:'

/** @alpha */
export interface CollaborationCommentPortableTextBlock {
  _type: string
  children: Array<{_type: string; [key: string]: Any}>
  [key: string]: Any
}

/**
 * Comment message, as an array of Portable Text blocks.
 *
 * @alpha
 */
export type CollaborationCommentMessage = CollaborationCommentPortableTextBlock[]

/**
 * A comment document, as stored by the Comments API.
 *
 * @alpha
 */
export interface CollaborationCommentDocument extends SanityDocument {
  _type: 'sanity.comment'
  _system?: {createdBy?: string}
  threadId?: string
  parentCommentId?: string
  message: CollaborationCommentMessage
  reactions: {
    _key: string
    shortName: CollaborationCommentReactionShortName
    userId: string
    addedAt: string
  }[]
  context?: Record<string, unknown>
  target: {
    /** Global document reference (`resourceType:resourceId:documentId`, using the published document ID) */
    document: {
      _ref: `${string}:${string}:${string}`
      _type: 'globalDocumentReference'
      _weak: true
    }
    documentType: string
    /** The exact document ID the comment was created against, e.g. a draft or version ID */
    sourceDocumentId: string
    documentRevisionId?: string
    path?: {
      field: string
      selection?: Record<string, Any>
    }
  }
  contentSnapshot?: CollaborationCommentPortableTextBlock[]
  status: CollaborationCommentStatus
  lastEditedAt?: string
}

/**
 * Target for a top-level comment. Inline selections require both `path` and
 * `range`; field-level comments may set `path` alone.
 *
 * @alpha
 */
export type CollaborationCommentTarget = {
  documentId: string
  documentType: string
  documentRevisionId?: string
} & (
  | {
      /** Path to the field containing the inline comment selection */
      path: string
      /**
       * Inline text selection within `path`.
       * Each endpoint identifies a keyed Portable Text child and a character offset.
       */
      range: {
        start: {_key: string; offset: number}
        end: {_key: string; offset: number}
      }
    }
  | {
      /** Path to the commented field */
      path?: string
      range?: never
    }
)

/**
 * A top-level comment requires `target`; a reply requires `parentCommentId` (never both).
 * Replies inherit `target`, `status`, and `threadId` from the parent comment.
 *
 * ### Examples
 *
 * #### Top-level comment
 * ```ts
 * // `message` is an array of Portable Text blocks
 * await client.collaboration.comments.create({
 *   message,
 *   target: {documentId: 'doc-1', documentType: 'article'},
 * })
 * ```
 *
 * #### Reply
 * ```ts
 * await client.collaboration.comments.create({
 *   message,
 *   parentCommentId: 'comment-1',
 * })
 * ```
 *
 * @alpha
 */
export type CollaborationCommentCreate = {
  /** Provide to control the ID of the created comment document */
  _id?: string
  message: CollaborationCommentMessage
  context?: Record<string, unknown>
} & (
  | {
      target: CollaborationCommentTarget
      threadId?: string
      parentCommentId?: never
    }
  | {
      parentCommentId: string
      target?: never
      threadId?: never
    }
)

/**
 * Fields that can be updated on an existing comment.
 *
 * @alpha
 */
export interface CollaborationCommentUpdate {
  message?: CollaborationCommentMessage
  status?: CollaborationCommentStatus
}
