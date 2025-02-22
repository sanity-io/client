// deno-lint-ignore-file no-empty-interface
/* eslint-disable @typescript-eslint/no-empty-object-type */

import type {Requester} from 'get-it'

import type {InitializedStegaConfig, StegaConfig} from './stega/types'

/**
 * Used to tag types that is set to `any` as a temporary measure, but should be replaced with proper typings in the future
 * @internal
 */
export type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

declare global {
  // Declare empty stub interfaces for environments where "dom" lib is not included
  interface File {}
}

/** @public */
export type UploadBody = File | Blob | Buffer | NodeJS.ReadableStream

/** @public */
export interface RequestOptions {
  timeout?: number
  token?: string
  tag?: string
  headers?: Record<string, string>
  method?: string
  query?: Any
  body?: Any
  signal?: AbortSignal
}

/**
 * @public
 * @deprecated – The `r`-prefix is not required, use `string` instead
 */
export type ReleaseId = `r${string}`

/**
 * @deprecated use 'drafts' instead
 */
type DeprecatedPreviewDrafts = 'previewDrafts'

/** @public */
export type StackablePerspective = ('published' | 'drafts' | string) & {}

/** @public */
export type ClientPerspective =
  | DeprecatedPreviewDrafts
  | 'published'
  | 'drafts'
  | 'raw'
  | StackablePerspective[]

/** @public */
export type ClientConfig = {
  /** Project ID to connect to */
  projectId?: string

  /** Dataset name to use */
  dataset?: string

  /**
   * Whether to use the Sanity CDN API.
   * Set to `true` to use edge caching for better performance.
   * Set to `false` to always use the live API for fresh data.
   * @defaultValue true
   */
  useCdn?: boolean

  /** Token for authentication. Required for certain operations like mutations or accessing drafts */
  token?: string

  /**
   * The perspective to use when querying documents.
   * - 'published': Only published documents (no drafts)
   * - 'drafts': Published + draft documents (draft preferred if both exist)
   * - 'raw': All documents including drafts and versions
   * @defaultValue 'raw'
   */
  perspective?: ClientPerspective

  /** API host to use. Defaults to 'api.sanity.io' */
  apiHost?: string

  /**
   * API version in YYYY-MM-DD format.
   * Required to prevent breaking changes.
   * Use current date to get latest features.
   */
  apiVersion?: string

  /** HTTP/HTTPS proxy URL to use */
  proxy?: string

  /**
   * Optional prefix added to all request tags.
   * Used to filter and aggregate log data in request logs.
   */
  requestTagPrefix?: string

  /** Ignore warning about tokens in browser environments */
  ignoreBrowserTokenWarning?: boolean

  /** Whether to send credentials with requests */
  withCredentials?: boolean

  /** Whether the client can be reconfigured after initialization */
  allowReconfigure?: boolean

  /** Request timeout in milliseconds */
  timeout?: number

  /**
   * Number of times to retry failed requests
   * @defaultValue 5
   */
  maxRetries?: number

  /**
   * Function to calculate retry delay in milliseconds.
   * Default is exponential backoff with random jitter:
   * delay = 100 * 2^attemptNumber + random(0,100)
   */
  retryDelay?: (attemptNumber: number) => number

  /**
   * Whether to include Content Source Maps in API responses.
   * Useful for visual editing and debugging.
   */
  resultSourceMap?: boolean | 'withKeyArraySelector'

  /**
   * Options for encoding Content Source Maps using steganography.
   * Used for visual editing features.
   */
  stega?: StegaConfig | boolean

  /** @deprecated Don't use */
  useProjectHostname?: boolean

  /** @deprecated Don't use */
  requester?: Requester

  /** @deprecated set `cache` and `next` options on `client.fetch` instead */
  fetch?:
    | {
        cache?: ResponseQueryOptions['cache']
        next?: ResponseQueryOptions['next']
      }
    | boolean
}

/** @public */
export interface InitializedClientConfig extends ClientConfig {
  // These are required in the initialized config
  apiHost: string
  apiVersion: string
  useProjectHostname: boolean
  useCdn: boolean
  // These are added by the initConfig function
  /**
   * @deprecated Internal, don't use
   */
  isDefaultApi: boolean
  /**
   * @deprecated Internal, don't use
   */
  url: string
  /**
   * @deprecated Internal, don't use
   */
  cdnUrl: string
  /**
   * The fully initialized stega config, can be used to check if stega is enabled
   */
  stega: InitializedStegaConfig
}

/** @public */
export type AssetMetadataType =
  | 'location'
  | 'exif'
  | 'image'
  | 'palette'
  | 'lqip'
  | 'blurhash'
  | 'none'

/** @public */
export interface UploadClientConfig {
  /**
   * Optional request tag for the upload
   */
  tag?: string

  /**
   * Whether or not to preserve the original filename (default: true)
   */
  preserveFilename?: boolean

  /**
   * Filename for this file (optional)
   */
  filename?: string

  /**
   * Milliseconds to wait before timing the request out
   */
  timeout?: number

  /**
   * Mime type of the file
   */
  contentType?: string

  /**
   * Array of metadata parts to extract from asset
   */
  extract?: AssetMetadataType[]

  /**
   * Optional freeform label for the asset. Generally not used.
   */
  label?: string

  /**
   * Optional title for the asset
   */
  title?: string

  /**
   * Optional description for the asset
   */
  description?: string

  /**
   * The credit to person(s) and/or organization(s) required by the supplier of the asset to be used when published
   */
  creditLine?: string

  /**
   * Source data (when the asset is from an external service)
   */
  source?: {
    /**
     * The (u)id of the asset within the source, i.e. 'i-f323r1E'
     */
    id: string

    /**
     * The name of the source, i.e. 'unsplash'
     */
    name: string

    /**
     * A url to where to find the asset, or get more info about it in the source
     */
    url?: string
  }
}

/** @internal */
export interface SanityReference {
  _ref: string
}

/** @internal */
export type SanityDocument<T extends Record<string, Any> = Record<string, Any>> = {
  [P in keyof T]: T[P]
} & {
  _id: string
  _rev: string
  _type: string
  _createdAt: string
  _updatedAt: string
  /**
   * Present when `perspective` is set to `previewDrafts`
   */
  _originalId?: string
}

/** @internal */
export interface SanityAssetDocument extends SanityDocument {
  url: string
  path: string
  size: number
  assetId: string
  mimeType: string
  sha1hash: string
  extension: string
  uploadId?: string
  originalFilename?: string
}

/** @internal */
export interface SanityImagePalette {
  background: string
  foreground: string
  population: number
  title: string
}

/** @internal */
export interface SanityImageAssetDocument extends SanityAssetDocument {
  metadata: {
    _type: 'sanity.imageMetadata'
    hasAlpha: boolean
    isOpaque: boolean
    lqip?: string
    blurHash?: string
    dimensions: {
      _type: 'sanity.imageDimensions'
      aspectRatio: number
      height: number
      width: number
    }
    palette?: {
      _type: 'sanity.imagePalette'
      darkMuted?: SanityImagePalette
      darkVibrant?: SanityImagePalette
      dominant?: SanityImagePalette
      lightMuted?: SanityImagePalette
      lightVibrant?: SanityImagePalette
      muted?: SanityImagePalette
      vibrant?: SanityImagePalette
    }
    image?: {
      _type: 'sanity.imageExifTags'
      [key: string]: Any
    }
    exif?: {
      _type: 'sanity.imageExifMetadata'
      [key: string]: Any
    }
  }
}

/** @public */
export interface ErrorProps {
  message: string
  response: Any
  statusCode: number
  responseBody: Any
  details: Any
}

/** @public */
export type HttpRequest = {
  (options: RequestOptions, requester: Requester): ReturnType<Requester>
}

/** @internal */
export interface RequestObservableOptions extends Omit<RequestOptions, 'url'> {
  url?: string
  uri?: string
  canUseCdn?: boolean
  useCdn?: boolean
  tag?: string
  returnQuery?: boolean
  resultSourceMap?: boolean | 'withKeyArraySelector'
  perspective?: ClientPerspective
  lastLiveEventId?: string
  cacheMode?: 'noStale'
}

/** @public */
export interface ProgressEvent {
  type: 'progress'
  stage: 'upload' | 'download'
  percent: number
  total?: number
  loaded?: number
  lengthComputable: boolean
}

/** @public */
export interface ResponseEvent<T = unknown> {
  type: 'response'
  body: T
  url: string
  method: string
  statusCode: number
  statusMessage?: string
  headers: Record<string, string>
}

/** @public */
export type HttpRequestEvent<T = unknown> = ResponseEvent<T> | ProgressEvent

/** @internal */
export interface AuthProvider {
  name: string
  title: string
  url: string
}

/** @internal */
export type AuthProviderResponse = {providers: AuthProvider[]}

/** @internal */
export type DatasetAclMode = 'public' | 'private' | 'custom'

/** @internal */
export type DatasetResponse = {datasetName: string; aclMode: DatasetAclMode}
/** @internal */
export type DatasetsResponse = {
  name: string
  aclMode: DatasetAclMode
  createdAt: string
  createdByUserId: string
  addonFor: string | null
  datasetProfile: string
  features: string[]
  tags: string[]
}[]

/** @internal */
export interface SanityProjectMember {
  id: string
  role: string
  isRobot: boolean
  isCurrentUser: boolean
}

/** @internal */
export interface SanityProject {
  id: string
  displayName: string
  /**
   * @deprecated Use the `/user-applications` endpoint instead, which lists all deployed studios/applications
   * @see https://www.sanity.io/help/studio-host-user-applications
   */
  studioHost: string | null
  organizationId: string | null
  isBlocked: boolean
  isDisabled: boolean
  isDisabledByUser: boolean
  createdAt: string
  pendingInvites?: number
  maxRetentionDays?: number
  members: SanityProjectMember[]
  metadata: {
    cliInitializedAt?: string
    color?: string
    /**
     * @deprecated Use the `/user-applications` endpoint instead, which lists all deployed studios/applications
     * @see https://www.sanity.io/help/studio-host-user-applications
     */
    externalStudioHost?: string
  }
}

/** @internal */
export interface SanityUser {
  id: string
  projectId: string
  displayName: string
  familyName: string | null
  givenName: string | null
  middleName: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  isCurrentUser: boolean
}

/** @internal */
export interface CurrentSanityUser {
  id: string
  name: string
  email: string
  profileImage: string | null
  role: string
}

/** @public */
export type SanityDocumentStub<T extends Record<string, Any> = Record<string, Any>> = {
  [P in keyof T]: T[P]
} & {
  _type: string
}

/** @public */
export type IdentifiedSanityDocumentStub<T extends Record<string, Any> = Record<string, Any>> = {
  [P in keyof T]: T[P]
} & {
  _id: string
} & SanityDocumentStub

/** @internal */
export type InsertPatch =
  | {before: string; items: Any[]}
  | {after: string; items: Any[]}
  | {replace: string; items: Any[]}

/**
 * Base options for mutations like create, update, delete, etc.
 * Controls how mutations are executed and what data is returned.
 *
 * @public
 */
export type BaseMutationOptions = RequestOptions & {
  /**
   * When to make changes visible:
   * - 'sync': Wait until changes are visible to queries (default)
   * - 'async': Return immediately after commit
   * - 'deferred': Fastest, bypasses real-time indexing
   */
  visibility?: 'sync' | 'async' | 'deferred'

  /** Whether to return the affected documents */
  returnDocuments?: boolean

  /** Whether to return only the first affected document */
  returnFirst?: boolean

  /** Simulate the mutation without making changes */
  dryRun?: boolean

  /**
   * Automatically add `_key` to array items.
   * Helps prevent race conditions in real-time editing.
   */
  autoGenerateArrayKeys?: boolean

  /** Skip validation of cross dataset references */
  skipCrossDatasetReferenceValidation?: boolean

  /** Custom transaction ID for the mutation */
  transactionId?: string
}

/**
 * Operations that can be applied in a patch.
 * Used to modify existing documents.
 *
 * @example
 * ```ts
 * client.patch('bike-123')
 *   .set({inStock: false})
 *   .inc({numSold: 1})
 *   .unset(['price'])
 *   .commit()
 * ```
 *
 * @public
 */
export interface PatchOperations {
  /** Shallow merge of the provided object */
  set?: {[key: string]: Any}

  /** Set fields only if they're not already present */
  setIfMissing?: {[key: string]: Any}

  /** Apply diff-match-patch operations */
  diffMatchPatch?: {[key: string]: Any}

  /** Remove fields from the document */
  unset?: string[]

  /** Increment numeric fields by the given amount */
  inc?: {[key: string]: number}

  /** Decrement numeric fields by the given amount */
  dec?: {[key: string]: number}

  /** Insert items in arrays at specific positions */
  insert?: InsertPatch

  /** Only apply patch if document has this revision */
  ifRevisionID?: string
}

/**
 * A mutation operation to be performed.
 * Used in transactions to batch multiple changes.
 *
 * @example
 * ```ts
 * client.transaction()
 *   .create({_type: 'bike', name: 'New Bike'})
 *   .delete('old-bike')
 *   .patch('bike-123', p => p.set({inStock: false}))
 *   .commit()
 * ```
 *
 * @public
 */
export type Mutation<R extends Record<string, Any> = Record<string, Any>> =
  | {create: SanityDocumentStub<R>}
  | {createOrReplace: IdentifiedSanityDocumentStub<R>}
  | {createIfNotExists: IdentifiedSanityDocumentStub<R>}
  | {delete: MutationSelection}
  | {patch: PatchMutationOperation}

/**
 * Result of a single mutation operation.
 * Contains the transaction ID and affected document.
 *
 * @public
 */
export interface SingleMutationResult {
  /** ID of the transaction that performed the mutation */
  transactionId: string

  /** ID of the affected document */
  documentId: string

  /** Details about what happened to each document */
  results: {id: string; operation: MutationOperation}[]
}

/**
 * Result of multiple mutation operations.
 * Contains the transaction ID and affected documents.
 *
 * @public
 */
export interface MultipleMutationResult {
  /** ID of the transaction that performed the mutations */
  transactionId: string

  /** IDs of all affected documents */
  documentIds: string[]

  /** Details about what happened to each document */
  results: {id: string; operation: MutationOperation}[]
}

/** @public */
export interface QueryParams {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  [key: string]: any
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  body?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  cache?: 'next' extends keyof RequestInit ? never : any
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  filterResponse?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  headers?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  method?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  next?: 'next' extends keyof RequestInit ? never : any
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  perspective?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  query?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  resultSourceMap?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  returnQuery?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  signal?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  stega?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  tag?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  timeout?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  token?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  useCdn?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  lastLiveEventId?: never
  /** @deprecated you're using a fetch option as a GROQ parameter, this is likely a mistake */
  cacheMode?: never
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * This type can be used with `client.fetch` to indicate that the query has no GROQ parameters.
 * @public
 */
export type QueryWithoutParams = Record<string, never> | undefined

/** @internal */
export type MutationSelectionQueryParams = {[key: string]: Any}
/** @internal */
export type MutationSelection =
  | {query: string; params?: MutationSelectionQueryParams}
  | {id: string | string[]}
/** @internal */
export type PatchSelection = string | string[] | MutationSelection
/** @internal */
export type PatchMutationOperation = PatchOperations & MutationSelection

/** @public */
export type MutationEvent<R extends Record<string, Any> = Record<string, Any>> = {
  type: 'mutation'

  /**
   * The ID of the document that was affected
   */
  documentId: string

  /**
   * A unique ID for this event
   */
  eventId: string

  /**
   * The user ID of the user that performed the mutation
   */
  identity: string

  /**
   * An array of mutations that were performed. Note that this can differ slightly from the
   * mutations sent to the server, as the server may perform some mutations automatically.
   */
  mutations: Mutation[]

  /**
   * The revision ID of the document before the mutation was performed
   */
  previousRev?: string

  /**
   * The revision ID of the document after the mutation was performed
   */
  resultRev?: string

  /**
   * The document as it looked after the mutation was performed. This is only included if
   * the listener was configured with `includeResult: true`.
   */
  result?: SanityDocument<R>

  /**
   * The document as it looked before the mutation was performed. This is only included if
   * the listener was configured with `includePreviousRevision: true`.
   */
  previous?: SanityDocument<R> | null

  /**
   * The effects of the mutation, if the listener was configured with `effectFormat: 'mendoza'`.
   * Object with `apply` and `revert` arrays, see {@link https://github.com/sanity-io/mendoza}.
   */
  effects?: {apply: unknown[]; revert: unknown[]}

  /**
   * A timestamp for when the mutation was performed
   */
  timestamp: string

  /**
   * The transaction ID for the mutation
   */
  transactionId: string

  /**
   * The type of transition the document went through.
   *
   * - `update` means the document was previously part of the subscribed set of documents,
   *   and still is.
   * - `appear` means the document was not previously part of the subscribed set of documents,
   *   but is now. This can happen both on create or if updating to a state where it now matches
   *   the filter provided to the listener.
   * - `disappear` means the document was previously part of the subscribed set of documents,
   *   but is no longer. This can happen both on delete or if updating to a state where it no
   *   longer matches the filter provided to the listener.
   */
  transition: 'update' | 'appear' | 'disappear'

  /**
   * Whether the change that triggered this event is visible to queries (query) or only to
   * subsequent transactions (transaction). The listener client can specify a preferred visibility
   * through the `visibility` parameter on the listener, but this is only on a best-effort basis,
   * and may yet not be accurate.
   */
  visibility: 'query' | 'transaction'

  /**
   * The total number of events that will be sent for this transaction.
   * Note that this may differ from the amount of _documents_ affected by the transaction, as this
   * number only includes the documents that matches the given filter.
   *
   * This can be useful if you need to perform changes to all matched documents atomically,
   * eg you would wait for `transactionTotalEvents` events with the same `transactionId` before
   * applying the changes locally.
   */
  transactionTotalEvents: number

  /**
   * The index of this event within the transaction. Note that events may be delivered out of order,
   * and that the index is zero-based.
   */
  transactionCurrentEvent: number
}

/**
 * An error occurred. This is different from a network-level error (which will be emitted as 'error').
 * Possible causes are things such as malformed filters, non-existant datasets or similar.
 *
 * @public
 */
export type ChannelErrorEvent = {
  type: 'channelError'
  message: string
}

/**
 * The listener has been told to explicitly disconnect and not reconnect.
 * This is a rare situation, but may occur if the API knows reconnect attempts will fail,
 * eg in the case of a deleted dataset, a blocked project or similar events.
 *
 * Note that this is not treated as an error on the observable, but will complete the observable.
 *
 * @public
 */
export type DisconnectEvent = {
  type: 'disconnect'
  reason: string
}

/**
 * The listener has been disconnected, and a reconnect attempt is scheduled.
 *
 * @public
 */
export type ReconnectEvent = {
  type: 'reconnect'
}

/**
 * The listener connection has been established
 * note: it's usually a better option to use the 'welcome' event
 * @public
 */
export type OpenEvent = {
  type: 'open'
}

/**
 * The listener has been established, and will start receiving events.
 * Note that this is also emitted upon _reconnection_.
 *
 * @public
 */
export type WelcomeEvent = {
  type: 'welcome'
  listenerName: string
}

/** @public */
export type ListenEvent<R extends Record<string, Any>> =
  | MutationEvent<R>
  | ChannelErrorEvent
  | DisconnectEvent
  | ReconnectEvent
  | WelcomeEvent
  | OpenEvent

/** @public */
export type ListenEventName =
  /** A mutation was performed */
  | 'mutation'
  /** The listener has been (re)established */
  | 'welcome'
  /** The listener has been disconnected, and a reconnect attempt is scheduled */
  | 'reconnect'

/** @public */
export type ListenParams = {[key: string]: Any}

/**
 * Options for listening to real-time updates.
 * Used with `client.listen()` to subscribe to document changes.
 *
 * @public
 */
export interface ListenOptions {
  /**
   * Whether to include the resulting document in addition to mutations.
   * Set to `false` to reduce bandwidth if you only need mutation info.
   * @defaultValue true
   */
  includeResult?: boolean

  /**
   * Whether to include the mutations that were performed.
   * Set to `false` to reduce bandwidth if you only need the final document.
   * @defaultValue true
   */
  includeMutations?: boolean

  /**
   * Whether to include the document state before the mutation.
   * Useful for tracking what changed.
   * @defaultValue false
   */
  includePreviousRevision?: boolean

  /**
   * When to send events:
   * - 'transaction': As soon as transaction is committed (default)
   * - 'query': Only after changes are visible to queries
   * @defaultValue 'transaction'
   */
  visibility?: 'transaction' | 'query'

  /**
   * Event types to include in the observable.
   * @defaultValue ['mutation']
   */
  events?: ListenEventName[]

  /**
   * Format for mutation effects.
   * 'mendoza' includes `apply` and `revert` arrays.
   */
  effectFormat?: 'mendoza'

  /** Optional tag to identify the listener in logs */
  tag?: string

  /** @internal */
  includeAllVersions?: boolean
}

/** @public */
export interface ResponseQueryOptions extends RequestOptions {
  perspective?: ClientPerspective
  resultSourceMap?: boolean | 'withKeyArraySelector'
  returnQuery?: boolean
  useCdn?: boolean
  stega?: boolean | StegaConfig
  // The `cache` and `next` options are specific to the Next.js App Router integration
  cache?: 'next' extends keyof RequestInit ? RequestInit['cache'] : never
  next?: ('next' extends keyof RequestInit ? RequestInit : never)['next']
  lastLiveEventId?: string | string[] | null

  /**
   * When set to `noStale`, APICDN will not return a cached response if the content is stale.
   * Tradeoff between latency and freshness of content.
   *
   * Only to be used with live content queries and when useCdn is true.
   */
  cacheMode?: 'noStale'
}

/** @public */
export interface FilteredResponseQueryOptions extends ResponseQueryOptions {
  filterResponse?: true
}

/** @public */
export interface UnfilteredResponseQueryOptions extends ResponseQueryOptions {
  filterResponse: false

  /**
   * When `filterResponse` is `false`, `returnQuery` also defaults to `true` for
   * backwards compatibility (on the client side, not from the content lake API).
   * Can also explicitly be set to `true`.
   */
  returnQuery?: true
}

/**
 * When using `filterResponse: false`, but you do not wish to receive back the query from
 * the content lake API.
 *
 * @public
 */
export interface UnfilteredResponseWithoutQuery extends ResponseQueryOptions {
  filterResponse: false
  returnQuery: false
}

/** @public */
export type QueryOptions =
  | FilteredResponseQueryOptions
  | UnfilteredResponseQueryOptions
  | UnfilteredResponseWithoutQuery

/** @public */
export interface RawQueryResponse<R> {
  query: string
  ms: number
  result: R
  resultSourceMap?: ContentSourceMap
  /** Requires `apiVersion` to be `2021-03-25` or later. */
  syncTags?: SyncTag[]
}

/** @public */
export type RawQuerylessQueryResponse<R> = Omit<RawQueryResponse<R>, 'query'>

/** @internal */
export type AllDocumentIdsMutationOptions = BaseMutationOptions & {
  returnFirst: false
  returnDocuments: false
}

/** @internal */
export type AttributeSet = {[key: string]: Any}

/** @internal */
export type TransactionFirstDocumentMutationOptions = BaseMutationOptions & {
  returnFirst: true
  returnDocuments: true
}

/** @internal */
export type TransactionFirstDocumentIdMutationOptions = BaseMutationOptions & {
  returnFirst: true
  returnDocuments?: false
}

/** @internal */
export type TransactionAllDocumentsMutationOptions = BaseMutationOptions & {
  returnFirst?: false
  returnDocuments: true
}

/** @internal */
export type TransactionAllDocumentIdsMutationOptions = BaseMutationOptions & {
  returnFirst?: false
  returnDocuments?: false
}

/** @internal */
export type TransactionMutationOptions =
  | TransactionFirstDocumentMutationOptions
  | TransactionFirstDocumentIdMutationOptions
  | TransactionAllDocumentsMutationOptions
  | TransactionAllDocumentIdsMutationOptions

/** @internal */
export type BaseActionOptions = RequestOptions & {
  transactionId?: string
  skipCrossDatasetReferenceValidation?: boolean
  dryRun?: boolean
}

/** @internal */
export interface SingleActionResult {
  transactionId: string
}

/** @internal */
export interface MultipleActionResult {
  transactionId: string
}

/** @internal */
export interface RawRequestOptions {
  url?: string
  uri?: string
  method?: string
  token?: string
  json?: boolean
  tag?: string
  useGlobalApi?: boolean
  withCredentials?: boolean
  query?: {[key: string]: string | string[]}
  headers?: {[key: string]: string}
  timeout?: number
  proxy?: string
  body?: Any
  maxRedirects?: number
  signal?: AbortSignal
}

/** @internal */
export interface ApiError {
  error: string
  message: string
  statusCode: number
}

/** @internal */
export interface MutationError {
  error: {
    type: 'mutationError'
    description: string
    items?: MutationErrorItem[]
  }
}

/** @internal */
export interface MutationErrorItem {
  error: {
    type: string
    description: string
    value?: unknown
  }
}

/** @internal */
export interface ActionError {
  error: {
    type: 'actionError'
    description: string
    items?: ActionErrorItem[]
  }
}

/** @internal */
export interface ActionErrorItem {
  error: {
    type: string
    description: string
    value?: unknown
  }
  index: number
}

/**
 * DocumentValueSource is a path to a value within a document
 * @public
 */
export interface ContentSourceMapDocumentValueSource {
  type: 'documentValue'
  // index location of the document
  document: number
  // index location of the path
  path: number
}
/**
 * When a value is not from a source, its a literal
 * @public
 */
export interface ContentSourceMapLiteralSource {
  type: 'literal'
}
/**
 * When a field source is unknown
 * @public
 */
export interface ContentSourceMapUnknownSource {
  type: 'unknown'
}
/** @public */
export type ContentSourceMapSource =
  | ContentSourceMapDocumentValueSource
  | ContentSourceMapLiteralSource
  | ContentSourceMapUnknownSource
/**
 * ValueMapping is a mapping when for value that is from a single source value
 * It may refer to a field within a document or a literal value
 * @public
 */
export interface ContentSourceMapValueMapping {
  type: 'value'
  // source of the value
  source: ContentSourceMapSource
}
/** @public */
export type ContentSourceMapMapping = ContentSourceMapValueMapping

/** @public */
export type ContentSourceMapMappings = Record<string, ContentSourceMapMapping>

/** @public */
export interface ContentSourceMapDocumentBase {
  _id: string
  _type: string
}

/** @public */
export interface ContentSourceMapDocument extends ContentSourceMapDocumentBase {
  _projectId?: undefined
  _dataset?: undefined
}

/** @public */
export interface ContentSourceMapRemoteDocument extends ContentSourceMapDocumentBase {
  _projectId: string
  _dataset: string
}

/** @public */
export type ContentSourceMapDocuments = (
  | ContentSourceMapDocument
  | ContentSourceMapRemoteDocument
)[]

/** @public */
export type ContentSourceMapPaths = string[]

/** @public */
export interface ContentSourceMap {
  mappings: ContentSourceMapMappings
  documents: ContentSourceMapDocuments
  paths: ContentSourceMapPaths
}

/** @public */
export type SyncTag = `s1:${string}`
/** @public */
export interface LiveEventRestart {
  type: 'restart'
  id: string
}
/** @public */
export interface LiveEventReconnect {
  type: 'reconnect'
}
/** @public */
export interface LiveEventMessage {
  type: 'message'
  id: string
  tags: SyncTag[]
}
/** @public */
export interface LiveEventWelcome {
  type: 'welcome'
}
/** @public */
export type LiveEvent = LiveEventRestart | LiveEventReconnect | LiveEventMessage | LiveEventWelcome

/** @public */
export interface SanityQueries {}

/** @public */
export type ClientReturn<
  GroqString extends string,
  Fallback = Any,
> = GroqString extends keyof SanityQueries ? SanityQueries[GroqString] : Fallback

export type {
  ContentSourceMapParsedPath,
  ContentSourceMapParsedPathKeyedSegment,
  FilterDefault,
  InitializedStegaConfig,
  Logger,
  ResolveStudioUrl,
  StegaConfig,
  StegaConfigRequiredKeys,
  StudioBaseRoute,
  StudioBaseUrl,
  StudioUrl,
} from './stega/types'

/**
 * Actions that can be performed on documents.
 * These are high-level operations that combine multiple mutations.
 *
 * @example
 * ```ts
 * // Create a draft
 * await client.action({
 *   actionType: 'sanity.action.document.create',
 *   publishedId: 'bike-123',
 *   attributes: {name: 'New Bike', _type: 'bike'},
 *   ifExists: 'fail'
 * })
 *
 * // Publish a draft
 * await client.action({
 *   actionType: 'sanity.action.document.publish',
 *   draftId: 'drafts.bike-123',
 *   publishedId: 'bike-123'
 * })
 * ```
 *
 * @public
 */
export type Action =
  | CreateAction
  | ReplaceDraftAction
  | EditAction
  | DeleteAction
  | DiscardAction
  | PublishAction
  | UnpublishAction

/**
 * Creates a new draft document.
 * The published version must not already exist.
 * If a draft exists, the action will fail by default.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.create',
 *   publishedId: 'bike-123',
 *   attributes: {name: 'New Bike', _type: 'bike'},
 *   ifExists: 'fail' // or 'ignore' to keep existing draft
 * })
 * ```
 *
 * @public
 */
export type CreateAction = {
  actionType: 'sanity.action.document.create'

  /** ID of the published document to create a draft for */
  publishedId: string

  /** Document to create. Must have `_type` property */
  attributes: IdentifiedSanityDocumentStub

  /** What to do if draft exists: 'fail' or 'ignore' */
  ifExists: 'fail' | 'ignore'
}

/**
 * Replaces an existing draft document.
 * At least one of draft or published versions must exist.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.replaceDraft',
 *   publishedId: 'bike-123',
 *   attributes: {
 *     _id: 'drafts.bike-123',
 *     _type: 'bike',
 *     name: 'Updated Bike'
 *   }
 * })
 * ```
 *
 * @public
 */
export type ReplaceDraftAction = {
  actionType: 'sanity.action.document.replaceDraft'

  /** Published document ID to base draft on */
  publishedId: string

  /** Document to create. Must have `_id` and `_type` */
  attributes: IdentifiedSanityDocumentStub
}

/**
 * Modifies an existing draft document.
 * If no draft exists, creates one from published version.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.edit',
 *   draftId: 'drafts.bike-123',
 *   publishedId: 'bike-123',
 *   patch: {set: {inStock: false}}
 * })
 * ```
 *
 * @public
 */
export type EditAction = {
  actionType: 'sanity.action.document.edit'

  /** Draft document ID to edit */
  draftId: string

  /** Published document ID to base draft on */
  publishedId: string

  /** Patch operations to apply */
  patch: PatchOperations
}

/**
 * Deletes the published version and optionally drafts.
 * Fails if any unspecified drafts exist.
 * Can optionally purge document history.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.delete',
 *   publishedId: 'bike-123',
 *   includeDrafts: ['drafts.bike-123'],
 *   purge: true
 * })
 * ```
 *
 * @public
 */
export type DeleteAction = {
  actionType: 'sanity.action.document.delete'

  /** Published document ID to delete */
  publishedId: string

  /** Draft document IDs to delete */
  includeDrafts: string[]

  /** Whether to delete document history */
  purge?: boolean
}

/**
 * Deletes a draft document.
 * Fails if draft doesn't exist.
 * Can optionally purge document history.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.discard',
 *   draftId: 'drafts.bike-123',
 *   purge: false
 * })
 * ```
 *
 * @public
 */
export type DiscardAction = {
  actionType: 'sanity.action.document.discard'

  /** Draft document ID to delete */
  draftId: string

  /** Whether to delete document history */
  purge?: boolean
}

/**
 * Publishes a draft document.
 * Replaces published version if it exists.
 * Deletes the draft after publishing.
 * Can check revision IDs for optimistic locking.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.publish',
 *   draftId: 'drafts.bike-123',
 *   publishedId: 'bike-123',
 *   ifDraftRevisionId: 'abc123',
 *   ifPublishedRevisionId: 'def456'
 * })
 * ```
 *
 * @public
 */
export type PublishAction = {
  actionType: 'sanity.action.document.publish'

  /** Draft document ID to publish */
  draftId: string

  /** Draft revision ID to match (optional) */
  ifDraftRevisionId?: string

  /** Published document ID to replace */
  publishedId: string

  /** Published revision ID to match (optional) */
  ifPublishedRevisionId?: string
}

/**
 * Retracts (unpublishes) a published document.
 * Creates draft from published if none exists.
 * Deletes the published version.
 *
 * @example
 * ```ts
 * await client.action({
 *   actionType: 'sanity.action.document.unpublish',
 *   draftId: 'drafts.bike-123',
 *   publishedId: 'bike-123'
 * })
 * ```
 *
 * @public
 */
export type UnpublishAction = {
  actionType: 'sanity.action.document.unpublish'

  /** Draft document ID to keep/create */
  draftId: string

  /** Published document ID to delete */
  publishedId: string
}

/** @internal */
export type MutationOperation =
  | 'create'
  | 'createOrReplace'
  | 'createIfNotExists'
  | 'delete'
  | 'patch'

/** @internal */
export type FirstDocumentMutationOptions = BaseMutationOptions & {
  returnFirst: true
  returnDocuments: true
}

/** @internal */
export type FirstDocumentIdMutationOptions = BaseMutationOptions & {
  returnFirst: true
  returnDocuments?: false
}

/** @internal */
export type AllDocumentsMutationOptions = BaseMutationOptions & {
  returnFirst?: false
  returnDocuments: true
}
