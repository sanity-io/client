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
 * `includeAllVersions` is left out: comments are stored as `sanity.comment`
 * documents with no drafts or versions, so it would never make a difference.
 *
 * @alpha
 */
export type CollaborationCommentsListenOptions =
  | Omit<ListenOptions, 'includeAllVersions'>
  | Omit<ResumableListenOptions, 'includeAllVersions'>

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
  | ':-1:'
  | ':+1:'
  | ':eyes:'
  | ':heart:'
  | ':heavy_plus_sign:'
  | ':rocket:'

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
 * The text an inline comment was anchored to, resolved by the API when the
 * comment was created.
 *
 * Holds one entry per Portable Text block the selection spans, keyed by the
 * block it came from. `text` is the plain text of that block with the selected
 * part wrapped in the marker characters `\uF000` (start) and `\uF001` (end).
 *
 * @alpha
 */
export interface CollaborationCommentSelection {
  type: 'text'
  value: {_key: string; text: string}[]
}

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
    /**
     * Set for field and inline comments. `field` is the `path` the comment was
     * created with; `selection` is set for inline comments only.
     */
    path?: {
      field: string
      selection?: CollaborationCommentSelection
    }
  }
  /**
   * Copy of the commented content, as it looked when the comment was created.
   * Set for inline comments only, and holds just the selected fragment of each
   * Portable Text block the selection spans.
   */
  contentSnapshot?: CollaborationCommentPortableTextBlock[]
  status: CollaborationCommentStatus
  /** Set when the message has been updated after creation */
  lastEditedAt?: string
}

/**
 * Inline text selection within a Portable Text field.
 * Each endpoint pairs the `_key` of a Portable Text block with a character
 * offset into that block's plain text.
 *
 * @deprecated Use {@link CollaborationCommentAnchor}.
 * @alpha
 */
export interface CollaborationCommentRange {
  start: {_key: string; offset: number}
  end: {_key: string; offset: number}
}

/**
 * Portable Text covering an inline comment anchor. Callers can send just the
 * blocks from the anchor start `_key` through end `_key`, or the full field.
 *
 * @alpha
 */
export type CollaborationCommentFieldValue = Array<{
  _type: string
  _key: string
  [key: string]: Any
}>

/**
 * Where in `path` a comment is anchored.
 *
 * For `portable-text`, each endpoint pairs the `_key` of a Portable Text
 * block with a character offset into that block's plain text. An optional
 * `fieldValue` is Portable Text covering the anchor. When set, the selection
 * is resolved from those blocks instead of from the live document.
 *
 * @alpha
 */
export type CollaborationCommentAnchor = {
  type: 'portable-text'
  start: {_key: string; offset: number}
  end: {_key: string; offset: number}
  fieldValue?: CollaborationCommentFieldValue
}

/**
 * Target for a top-level comment. Inline selections require both `path` and
 * `anchor`; field-level comments may set `path` alone.
 *
 * The created comment stores this in a different shape: `path` becomes
 * `target.path.field`, and `anchor` is resolved against the document into
 * `target.path.selection` and `contentSnapshot` rather than being stored.
 *
 * Deprecated `range` + top-level `fieldValue` are still accepted and converted
 * to a `portable-text` `anchor` before the request is sent.
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
      anchor: CollaborationCommentAnchor
      /**
       * @deprecated Use `anchor`.
       */
      range?: never
      /**
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: never
    }
  | {
      /** Path to the field containing the inline comment selection */
      path: string
      /**
       * @deprecated Use `anchor`.
       */
      range: CollaborationCommentRange
      /**
       * Portable Text covering the `range`. When set, the selection is resolved
       * from these blocks instead of from the live document.
       *
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: CollaborationCommentFieldValue
      anchor?: never
    }
  | {
      /** Path to the commented field */
      path?: string
      anchor?: never
      /**
       * @deprecated Use `anchor`.
       */
      range?: never
      /**
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: never
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
 * #### Inline comment
 * ```ts
 * await client.collaboration.comments.create({
 *   message,
 *   target: {
 *     documentId: 'doc-1',
 *     documentType: 'article',
 *     path: 'body',
 *     anchor: {
 *       type: 'portable-text',
 *       start: {_key: 'block-1', offset: 0},
 *       end: {_key: 'block-1', offset: 5},
 *     },
 *   },
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
 * An `anchor` re-anchors the comment within the field it already targets.
 * Pass `null` to remove the selection and leave a field-level comment.
 * An optional `fieldValue` on a `portable-text` anchor is resolved from those
 * blocks instead of from the live document.
 *
 * Deprecated `range` + top-level `fieldValue` (and `range: null`) are still
 * accepted and converted to `anchor` before the request is sent.
 *
 * @alpha
 */
export type CollaborationCommentUpdate = {
  /** Replaces the current message */
  message?: CollaborationCommentMessage
  /** Cascades to the comment's replies */
  status?: CollaborationCommentStatus
} & (
  | {
      anchor: CollaborationCommentAnchor
      /**
       * @deprecated Use `anchor`.
       */
      range?: never
      /**
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: never
    }
  | {
      anchor: null
      /**
       * @deprecated Use `anchor`.
       */
      range?: never
      /**
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: never
    }
  | {
      /**
       * @deprecated Use `anchor`.
       */
      range: CollaborationCommentRange
      /**
       * Portable Text covering the `range`. When set, the selection is resolved
       * from these blocks instead of from the live document.
       *
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: CollaborationCommentFieldValue
      anchor?: never
    }
  | {
      /**
       * @deprecated Use `anchor: null`.
       */
      range: null
      /**
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: never
      anchor?: never
    }
  | {
      anchor?: undefined
      /**
       * @deprecated Use `anchor`.
       */
      range?: undefined
      /**
       * @deprecated Use `anchor.fieldValue`.
       */
      fieldValue?: never
    }
)
