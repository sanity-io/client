import type {
  Any,
  ListenOptions,
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
 * Listener options for `collaboration.comments.listen`.
 *
 * @alpha
 */
export type CollaborationCommentsListenOptions = ListenOptions | ResumableListenOptions

/**
 * Status of a comment thread. Replies always share the status of their parent comment.
 *
 * @alpha
 */
export type CollaborationCommentStatus = 'open' | 'resolved'

/**
 * Emoji short names that can be used as comment reactions.
 *
 * @alpha
 */
export type CollaborationCommentReactionShortName =
  ':-1:' | ':+1:' | ':eyes:' | ':heart:' | ':heavy_plus_sign:' | ':rocket:'

/**
 * A single Portable Text block, as used in comment messages and content snapshots.
 *
 * @alpha
 */
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
  _system?: {
    /** ID of the user that created the comment */
    createdBy?: string
  }
  /** ID shared by a top-level comment and all of its replies */
  threadId?: string
  /** Set on replies, pointing to the comment being replied to */
  parentCommentId?: string
  message: CollaborationCommentMessage
  reactions: {
    _key: string
    shortName: CollaborationCommentReactionShortName
    userId: string
    addedAt: string
  }[]
  /** Arbitrary metadata stored with the comment by the creating application */
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
  /** Copy of the commented content, as it looked when the comment was created */
  contentSnapshot?: CollaborationCommentPortableTextBlock[]
  status: CollaborationCommentStatus
  /** Set when the message has been updated after creation */
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
 * Comment to create with `collaboration.comments.create`.
 *
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
  /** Replaces the current message */
  message?: CollaborationCommentMessage
  /** Cascades to the comment's replies */
  status?: CollaborationCommentStatus
}
