// deno-lint-ignore-file no-empty-interface

import type {Requester} from 'get-it'

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

/** @public */
export interface ClientConfig {
  projectId?: string
  dataset?: string
  /** @defaultValue true */
  useCdn?: boolean
  token?: string
  perspective?: 'previewDrafts' | 'published' | 'all'
  apiHost?: string
  apiVersion?: string
  proxy?: string
  requestTagPrefix?: string
  ignoreBrowserTokenWarning?: boolean
  withCredentials?: boolean
  allowReconfigure?: boolean
  timeout?: number

  /** Number of retries for requests. Defaults to 5. */
  maxRetries?: number

  /**
   * The amount of time, in milliseconds, to wait before retrying, given an attemptNumber (starting at 0).
   *
   * Defaults to exponential back-off, starting at 100ms, doubling for each attempt, together with random
   * jitter between 0 and 100 milliseconds. More specifically the following algorithm is used:
   *
   *   Delay = 100 * 2^attemptNumber + randomNumberBetween0and100
   */
  retryDelay?: (attemptNumber: number) => number

  /**
   * @deprecated Don't use
   */
  useProjectHostname?: boolean

  /**
   * @deprecated Don't use
   */
  requester?: Requester

  /**
   * Adds a `resultSourceMap` key to the API response, with the type `ContentSourceMap`
   */
  resultSourceMap?: boolean
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
  defaultRequester: Requester
  (options: RequestOptions, requester: Requester): ReturnType<Requester>
}

/** @internal */
export interface RequestObservableOptions extends Omit<RequestOptions, 'url'> {
  url?: string
  uri?: string
  canUseCdn?: boolean
  tag?: string
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
export type DatasetsResponse = {name: string; aclMode: DatasetAclMode}[]

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
    color?: string
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

// Note: this is actually incorrect/invalid, but implemented as-is for backwards compatibility
/** @internal */
export interface PatchOperations {
  set?: {[key: string]: Any}
  setIfMissing?: {[key: string]: Any}
  diffMatchPatch?: {[key: string]: Any}
  unset?: string[]
  inc?: {[key: string]: number}
  dec?: {[key: string]: number}
  insert?: InsertPatch
  ifRevisionID?: string
}

/** @public */
export type QueryParams = {[key: string]: Any}
/** @internal */
export type MutationSelection = {query: string; params?: QueryParams} | {id: string | string[]}
/** @internal */
export type PatchSelection = string | string[] | MutationSelection
/** @internal */
export type PatchMutationOperation = PatchOperations & MutationSelection

/** @public */
export type Mutation<R extends Record<string, Any> = Record<string, Any>> =
  | {create: SanityDocumentStub<R>}
  | {createOrReplace: IdentifiedSanityDocumentStub<R>}
  | {createIfNotExists: IdentifiedSanityDocumentStub<R>}
  | {delete: MutationSelection}
  | {patch: PatchMutationOperation}

/** @public */
export type MutationEvent<R extends Record<string, Any> = Record<string, Any>> = {
  type: 'mutation'
  documentId: string
  eventId: string
  identity: string
  mutations: Mutation[]
  previousRev?: string
  resultRev?: string
  result?: SanityDocument<R>
  previous?: SanityDocument<R> | null
  effects?: {apply: unknown[]; revert: unknown[]}
  timestamp: string
  transactionId: string
  transition: 'update' | 'appear' | 'disappear'
  visibility: 'query' | 'transaction'
}

/** @public */
export type ChannelErrorEvent = {
  type: 'channelError'
  message: string
}

/** @public */
export type DisconnectEvent = {
  type: 'disconnect'
  reason: string
}

/** @public */
export type ReconnectEvent = {
  type: 'reconnect'
}

/** @public */
export type WelcomeEvent = {
  type: 'welcome'
}

/** @public */
export type ListenEvent<R extends Record<string, Any>> =
  | MutationEvent<R>
  | ChannelErrorEvent
  | DisconnectEvent
  | ReconnectEvent
  | WelcomeEvent

/** @public */
export type ListenEventName = 'mutation' | 'welcome' | 'reconnect'

/** @public */
export interface ListenOptions {
  includeResult?: boolean
  includePreviousRevision?: boolean
  visibility?: 'sync' | 'async' | 'query'
  events?: ListenEventName[]
  effectFormat?: 'mendoza'
  tag?: string
}

/** @public */
export type FilteredResponseQueryOptions = RequestOptions & {
  filterResponse?: true
}

/** @public */
export type UnfilteredResponseQueryOptions = RequestOptions & {
  filterResponse: false
}

/** @public */
export interface RawQueryResponse<R> {
  query: string
  ms: number
  result: R
  resultSourceMap?: ContentSourceMap
}

/** @internal */
export type BaseMutationOptions = RequestOptions & {
  visibility?: 'sync' | 'async' | 'deferred'
  returnDocuments?: boolean
  returnFirst?: boolean
  dryRun?: boolean
  autoGenerateArrayKeys?: boolean
  skipCrossDatasetReferenceValidation?: boolean
  transactionId?: string
}

/** @internal */
export type FirstDocumentMutationOptions = BaseMutationOptions & {
  returnFirst?: true
  returnDocuments?: true
}

/** @internal */
export type FirstDocumentIdMutationOptions = BaseMutationOptions & {
  returnFirst?: true
  returnDocuments: false
}

/** @internal */
export type AllDocumentsMutationOptions = BaseMutationOptions & {
  returnFirst: false
  returnDocuments?: true
}

/** @internal */
export type MutationOperation = 'create' | 'delete' | 'update' | 'none'

/** @internal */
export interface SingleMutationResult {
  transactionId: string
  documentId: string
  results: {id: string; operation: MutationOperation}[]
}

/** @internal */
export interface MultipleMutationResult {
  transactionId: string
  documentIds: string[]
  results: {id: string; operation: MutationOperation}[]
}

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
export interface ContentSourceMapDocument {
  _id: string
}

/** @public */
export interface ContentSourceMapRemoteDocument extends ContentSourceMapDocument {
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
