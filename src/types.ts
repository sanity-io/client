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

type ClientConfigResource =
  | {
      type: 'canvas'
      id: string
    }
  | {
      type: 'media-library'
      id: string
    }
  | {
      type: 'dataset'
      id: string
    }
  | {
      type: 'dashboard'
      id: string
    }

/** @public */
export interface ClientConfig {
  projectId?: string
  dataset?: string
  /** @defaultValue true */
  useCdn?: boolean
  token?: string

  /** @internal */
  '~experimental_resource'?: ClientConfigResource

  /**
   * What perspective to use for the client. See {@link https://www.sanity.io/docs/perspectives|perspective documentation}
   * @remarks
   * As of API version `v2025-02-19`, the default perspective has changed from `raw` to `published`. {@link https://www.sanity.io/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10|Changelog}
   * @defaultValue 'published'
   */
  perspective?: ClientPerspective
  apiHost?: string

  /**
   @remarks
   * As of API version `v2025-02-19`, the default perspective has changed from `raw` to `published`. {@link https://www.sanity.io/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10|Changelog}
   */
  apiVersion?: string
  proxy?: string

  /**
   * Optional request tag prefix for all request tags
   */
  requestTagPrefix?: string

  /**
   * Optional default headers to include with all requests
   *
   * @remarks request-specific headers will override any default headers with the same name.
   */
  headers?: Record<string, string>

  ignoreBrowserTokenWarning?: boolean
  /**
   * Ignore specific warning messages from the client.
   *
   * @remarks
   * - String values perform substring matching (not exact matching) against warning messages
   * - RegExp values are tested against the full warning message
   * - Array values allow multiple patterns to be specified
   *
   * @example
   * ```typescript
   * // Ignore warnings containing "experimental"
   * ignoreWarnings: 'experimental'
   *
   * // Ignore multiple warning types
   * ignoreWarnings: ['experimental', 'deprecated']
   *
   * // Use regex for exact matching
   * ignoreWarnings: /^This is an experimental API version$/
   *
   * // Mix strings and regex patterns
   * ignoreWarnings: ['rate limit', /^deprecated/i]
   * ```
   */
  ignoreWarnings?: string | RegExp | Array<string | RegExp>
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
  resultSourceMap?: boolean | 'withKeyArraySelector'
  /**
   *@deprecated set `cache` and `next` options on `client.fetch` instead
   */
  fetch?:
    | {
        cache?: ResponseQueryOptions['cache']
        next?: ResponseQueryOptions['next']
      }
    | boolean
  /**
   * Options for how, if enabled, Content Source Maps are encoded into query results using steganography
   */
  stega?: StegaConfig | boolean
  /**
   * Lineage token for recursion control
   */
  lineage?: string
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
  /**
   * Default headers to include with all requests
   *
   * @remarks request-specific headers will override any default headers with the same name.
   */
  headers?: Record<string, string>
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

/** @public */
export type DatasetAclMode = 'public' | 'private' | 'custom'

/** @public */
export type DatasetResponse = {datasetName: string; aclMode: DatasetAclMode}
/** @public */
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

/** @public */
export interface SanityProjectMember {
  id: string
  role: string
  isRobot: boolean
  isCurrentUser: boolean
}

/** @public */
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

/** @public */
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

/** @public */
export interface CurrentSanityUser {
  id: string
  name: string
  email: string
  profileImage: string | null
  role: string
  provider: string
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
export type Mutation<R extends Record<string, Any> = Record<string, Any>> =
  | {create: SanityDocumentStub<R>}
  | {createOrReplace: IdentifiedSanityDocumentStub<R>}
  | {createIfNotExists: IdentifiedSanityDocumentStub<R>}
  | {delete: MutationSelection}
  | {patch: PatchMutationOperation}

/** @public */
export type ReleaseAction =
  | CreateReleaseAction
  | EditReleaseAction
  | PublishReleaseAction
  | ArchiveReleaseAction
  | UnarchiveReleaseAction
  | ScheduleReleaseAction
  | UnscheduleReleaseAction
  | DeleteReleaseAction
  | ImportReleaseAction

/** @public */
export type VersionAction =
  | CreateVersionAction
  | DiscardVersionAction
  | ReplaceVersionAction
  | UnpublishVersionAction

/** @public */
export type Action =
  | CreateAction
  | ReplaceDraftAction
  | EditAction
  | DeleteAction
  | DiscardAction
  | PublishAction
  | UnpublishAction
  | VersionAction
  | ReleaseAction

/** @public */
export type ImportReleaseAction =
  | {
      actionType: 'sanity.action.release.import'
      attributes: IdentifiedSanityDocumentStub
      releaseId: string
      ifExists: 'fail' | 'ignore' | 'replace'
    }
  | {
      actionType: 'sanity.action.release.import'
      document: IdentifiedSanityDocumentStub
      releaseId: string
      ifExists: 'fail' | 'ignore' | 'replace'
    }

/**
 * Creates a new release under the given id, with metadata.
 *
 * @public
 */
export interface CreateReleaseAction {
  actionType: 'sanity.action.release.create'
  releaseId: string
  metadata?: Partial<ReleaseDocument['metadata']>
}

/**
 * Edits an existing release, updating the metadata.
 *
 * @public
 */
export interface EditReleaseAction {
  actionType: 'sanity.action.release.edit'
  releaseId: string
  patch: PatchOperations
}

/**
 * Publishes all documents in a release at once.
 *
 * @public
 */
export interface PublishReleaseAction {
  actionType: 'sanity.action.release.publish'
  releaseId: string
}

/**
 * Archives an `active` release, and deletes all the release documents.
 *
 * @public
 */
export interface ArchiveReleaseAction {
  actionType: 'sanity.action.release.archive'
  releaseId: string
}

/**
 * Unarchived an `archived` release, and restores all the release documents.
 *
 * @public
 */
export interface UnarchiveReleaseAction {
  actionType: 'sanity.action.release.unarchive'
  releaseId: string
}

/**
 * Queues release for publishing at the given future time.
 *
 * @public
 */
export interface ScheduleReleaseAction {
  actionType: 'sanity.action.release.schedule'
  releaseId: string
  publishAt: string
}

/**
 * Unschedules a `scheduled` release, stopping it from being published.
 *
 * @public
 */
export interface UnscheduleReleaseAction {
  actionType: 'sanity.action.release.unschedule'
  releaseId: string
}

/**
 * Deletes a `archived` or `published` release, and all the release documents versions.
 *
 * @public
 */
export interface DeleteReleaseAction {
  actionType: 'sanity.action.release.delete'
  releaseId: string
}

/**
 * Creates a new version of an existing document.
 *
 * If the `document` is provided, the version is created from the document
 * attached to the release as given by `document._id`
 *
 * If the `baseId` and `versionId` are provided, the version is created from the base document
 * and the version is attached to the release as given by `publishedId` and `versionId`
 *
 * @public
 */
export type CreateVersionAction = {
  actionType: 'sanity.action.document.version.create'
  publishedId: string
} & (
  | {
      document: IdentifiedSanityDocumentStub
    }
  | {
      baseId: string
      versionId: string
      ifBaseRevisionId?: string
    }
)

/**
 * Delete a version of a document.
 *
 * @public
 */
export interface DiscardVersionAction {
  actionType: 'sanity.action.document.version.discard'
  versionId: string
  purge?: boolean
}

/**
 * Replace an existing version of a document.
 *
 * @public
 */
export interface ReplaceVersionAction {
  actionType: 'sanity.action.document.version.replace'
  document: IdentifiedSanityDocumentStub
}

/**
 * Identify that a version of a document should be unpublished when
 * the release that version is contained within is published.
 *
 * @public
 */
export interface UnpublishVersionAction {
  actionType: 'sanity.action.document.version.unpublish'
  versionId: string
  publishedId: string
}

/**
 * Creates a new draft document. The published version of the document must not already exist.
 * If the draft version of the document already exists the action will fail by default, but
 * this can be adjusted to instead leave the existing document in place.
 *
 * @public
 */
export type CreateAction = {
  actionType: 'sanity.action.document.create'

  /**
   * ID of the published document to create a draft for.
   */
  publishedId: string

  /**
   * Document to create. Requires a `_type` property.
   */
  attributes: IdentifiedSanityDocumentStub

  /**
   * ifExists controls what to do if the draft already exists
   */
  ifExists: 'fail' | 'ignore'
}

/**
 * Replaces an existing draft document.
 * At least one of the draft or published versions of the document must exist.
 *
 * @public
 * @deprecated Use {@link ReplaceVersionAction} instead
 */
export type ReplaceDraftAction = {
  actionType: 'sanity.action.document.replaceDraft'

  /**
   * Published document ID to create draft from, if draft does not exist
   */
  publishedId: string

  /**
   * Document to create if it does not already exist. Requires `_id` and `_type` properties.
   */
  attributes: IdentifiedSanityDocumentStub
}

/**
 * Modifies an existing draft document.
 * It applies the given patch to the document referenced by draftId.
 * If there is no such document then one is created using the current state of the published version and then that is updated accordingly.
 *
 * @public
 */
export type EditAction = {
  actionType: 'sanity.action.document.edit'

  /**
   * Draft document ID to edit
   */
  draftId: string

  /**
   * Published document ID to create draft from, if draft does not exist
   */
  publishedId: string

  /**
   * Patch operations to apply
   */
  patch: PatchOperations
}

/**
 * Deletes the published version of a document and optionally some (likely all known) draft versions.
 * If any draft version exists that is not specified for deletion this is an error.
 * If the purge flag is set then the document history is also deleted.
 *
 * @public
 */
export type DeleteAction = {
  actionType: 'sanity.action.document.delete'

  /**
   * Published document ID to delete
   */
  publishedId: string

  /**
   * Draft document ID to delete
   */
  includeDrafts: string[]

  /**
   * Delete document history
   */
  purge?: boolean
}

/**
 * Delete the draft version of a document.
 * It is an error if it does not exist. If the purge flag is set, the document history is also deleted.
 *
 * @public
 * @deprecated Use {@link DiscardVersionAction} instead
 */
export type DiscardAction = {
  actionType: 'sanity.action.document.discard'

  /**
   * Draft document ID to delete
   */
  draftId: string

  /**
   * Delete document history
   */
  purge?: boolean
}

/**
 * Publishes a draft document.
 * If a published version of the document already exists this is replaced by the current draft document.
 * In either case the draft document is deleted.
 * The optional revision id parameters can be used for optimistic locking to ensure
 * that the draft and/or published versions of the document have not been changed by another client.
 *
 * @public
 */
export type PublishAction = {
  actionType: 'sanity.action.document.publish'

  /**
   * Draft document ID to publish
   */
  draftId: string

  /**
   * Draft revision ID to match
   */
  ifDraftRevisionId?: string

  /**
   * Published document ID to replace
   */
  publishedId: string

  /**
   * Published revision ID to match
   */
  ifPublishedRevisionId?: string
}

/**
 * Retract a published document.
 * If there is no draft version then this is created from the published version.
 * In either case the published version is deleted.
 *
 * @public
 */
export type UnpublishAction = {
  actionType: 'sanity.action.document.unpublish'

  /**
   * Draft document ID to replace the published document with
   */
  draftId: string

  /**
   * Published document ID to delete
   */
  publishedId: string
}

/**
 * A mutation was performed. Note that when updating multiple documents in a transaction,
 * each document affected will get a separate mutation event.
 *
 * @public
 */
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
  /**
   * The listener connection has been established
   * note: it's usually a better option to use the 'welcome' event
   */
  | 'open'

/** @public */
export type ListenParams = {[key: string]: Any}

/** @public */
export interface ListenOptions {
  /**
   * Whether or not to include the resulting document in addition to the mutations performed.
   * If you do not need the actual document, set this to `false` to reduce bandwidth usage.
   * The result will be available on the `.result` property of the events.
   * @defaultValue `true`
   */
  includeResult?: boolean

  /**
   * Whether or not to include the mutations that was performed.
   * If you do not need the mutations, set this to `false` to reduce bandwidth usage.
   * @defaultValue `true`
   */
  includeMutations?: boolean

  /**
   * Whether or not to include the document as it looked before the mutation event.
   * The previous revision will be available on the `.previous` property of the events,
   * and may be `null` in the case of a new document.
   * @defaultValue `false`
   */
  includePreviousRevision?: boolean

  /*
   * Whether to include events for drafts and versions. As of API Version >= v2025-02-19, only events
   * for published documents will be included by default (see {@link https://www.sanity.io/changelog/676aaa9d-2da6-44fb-abe5-580f28047c10|Changelog})
   * If you need events from drafts and versions, set this to `true`.
   * Note: Keep in mind that additional document variants may be introduced in the future, so it's
   * recommended to respond to events in a way that's tolerant of potential future variants, e.g. by
   * explicitly checking whether the event is for a draft or a version.
   * @defaultValue `false`
   */
  includeAllVersions?: boolean

  /**
   * Whether events should be sent as soon as a transaction has been committed (`transaction`, default),
   * or only after they are available for queries (query). Note that this is on a best-effort basis,
   * and listeners with `query` may in certain cases (notably with deferred transactions) receive events
   * that are not yet visible to queries.
   *
   * @defaultValue `'transaction'`
   */
  visibility?: 'transaction' | 'query'

  /**
   * Array of event names to include in the observable. By default, only mutation events are included.
   *
   * @defaultValue `['mutation']`
   */
  events?: ListenEventName[]

  /**
   * Format of "effects", eg the resulting changes of a mutation.
   * Currently only `mendoza` is supported, and (if set) will include `apply` and `revert` arrays
   * in the mutation events under the `effects` property.
   *
   * See {@link https://github.com/sanity-io/mendoza | The mendoza docs} for more info
   *
   * @defaultValue `undefined`
   */
  effectFormat?: 'mendoza'

  /**
   * Optional request tag for the listener. Use to identify the request in logs.
   *
   * @defaultValue `undefined`
   */
  tag?: string
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
  type: 'mutationError'
  description: string
  items?: MutationErrorItem[]
}

/**
 * Returned from the Content Lake API when a query is malformed, usually with a start
 * and end column to indicate where the error occurred, but not always. Can we used to
 * provide a more structured error message to the user.
 *
 * This will be located under the response `error` property.
 *
 * @public
 */
export interface QueryParseError {
  type: 'queryParseError'
  description: string
  start?: number
  end?: number
  query?: string
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
  type: 'actionError'
  description: string
  items?: ActionErrorItem[]
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

/** @internal */
export type PartialExcept<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>

/** @beta */
export type ReleaseState =
  | 'active'
  | 'archiving'
  | 'unarchiving'
  | 'archived'
  | 'published'
  | 'publishing'
  | 'scheduled'
  | 'scheduling'

/** @internal */
export type ReleaseType = 'asap' | 'scheduled' | 'undecided'

/** @public */
export type ReleaseCardinality = 'many' | 'one' | undefined

/** @internal */
export interface ReleaseDocument extends SanityDocument {
  /**
   * typically
   * `_.releases.<name>`
   */
  _id: string
  /**
   * where a release has _id `_.releases.foo`, the name is `foo`
   */
  name: string
  _type: 'system.release'
  _createdAt: string
  _updatedAt: string
  _rev: string
  state: ReleaseState
  error?: {
    message: string
  }
  finalDocumentStates?: {
    /** Document ID */
    id: string
  }[]
  /**
   * If defined, it takes precedence over the intendedPublishAt, the state should be 'scheduled'
   */
  publishAt?: string
  /**
   * If defined, it provides the time the release was actually published
   */
  publishedAt?: string
  metadata: {
    title?: string
    description?: string
    intendedPublishAt?: string
    releaseType: ReleaseType
    cardinality?: ReleaseCardinality
  }
}

/** @internal */
export type EditableReleaseDocument = Omit<
  PartialExcept<ReleaseDocument, '_id'>,
  'metadata' | '_type'
> & {
  _id: string
  metadata: Partial<ReleaseDocument['metadata']>
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
/**
 * The `id` field is the position at which the connection was rejected or closed.
 * The `reason` field will specify why the connection rejected/closed.
 * @public
 */
export interface LiveEventGoAway {
  type: 'goaway'
  id: string
  reason: string
}
/** @public */
export type LiveEvent =
  | LiveEventRestart
  | LiveEventReconnect
  | LiveEventMessage
  | LiveEventWelcome
  | LiveEventGoAway

/** @public */
export interface SanityQueries {}

/** @public */
export type ClientReturn<
  GroqString extends string,
  Fallback = Any,
> = GroqString extends keyof SanityQueries ? SanityQueries[GroqString] : Fallback

export type {
  AgentActionParam,
  AgentActionParams,
  AgentActionPath,
  AgentActionPathSegment,
  AgentActionTarget,
  ConstantAgentActionParam,
  DocumentAgentActionParam,
  FieldAgentActionParam,
  GroqAgentActionParam,
} from './agent/actions/commonTypes'
export type {
  GenerateInstruction,
  GenerateOperation,
  GenerateTarget,
  GenerateTargetDocument,
  GenerateTargetInclude,
} from './agent/actions/generate'
export type {PatchDocument, PatchOperation, PatchTarget} from './agent/actions/patch'
export type {PromptRequest} from './agent/actions/prompt'
export type {
  ImageDescriptionOperation,
  TransformDocument,
  TransformOperation,
  TransformTarget,
  TransformTargetDocument,
  TransformTargetInclude,
} from './agent/actions/transform'
export type {
  TranslateDocument,
  TranslateTarget,
  TranslateTargetInclude,
} from './agent/actions/translate'
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
 * A string constant containing the experimental API version warning message.
 * Use this with the `ignoreWarnings` option to suppress warnings when using experimental API versions.
 *
 * @example
 * ```typescript
 * import { createClient, EXPERIMENTAL_API_WARNING } from '@sanity/client'
 *
 * const client = createClient({
 *   projectId: 'your-project-id',
 *   dataset: 'production',
 *   apiVersion: 'vX', // experimental version
 *   ignoreWarnings: EXPERIMENTAL_API_WARNING
 * })
 * ```
 *
 * @public
 */
export const EXPERIMENTAL_API_WARNING = 'This is an experimental API version'

// Media Libraries types
/**
 * Fit / resize modes accepted for thumbnail params.
 * @public
 */
export type FitMode = 'preserve' | 'stretch' | 'crop' | 'smartcrop' | 'pad'

/**
 * Allowed still image formats (thumbnail + storyboard).
 * @public
 */
export type StillImageFormat = 'jpg' | 'png' | 'webp'

/**
 * Allowed animated image formats.
 * @public
 */
export type AnimatedImageFormat = 'gif' | 'webp'

/**
 * Thumbnail rendition (single frame) options.
 * @public
 */
export interface ThumbnailTransformOptions {
  /** Pixel width of the thumbnail frame. */
  width?: number
  /** Pixel height of the thumbnail frame. */
  height?: number
  /** Timestamp (seconds) from which to grab the frame. */
  time?: number
  /** Resize / fit mode applied to the extracted frame. */
  fit?: FitMode
  /** Output image format. */
  format?: StillImageFormat
}

/**
 * Animated preview rendition options (e.g. GIF / animated WebP).
 * @public
 */
export interface AnimatedTransformOptions {
  /** Pixel width of the animated output. Max 640 px. */
  width?: number
  /** Pixel height of the animated output. Max 640 px. */
  height?: number
  /** Start time in seconds (inclusive). */
  start?: number
  /** End time in seconds. */
  end?: number
  /** Frames per second (1–30). */
  fps?: number
  /** Output animated format. */
  format?: AnimatedImageFormat
}

/**
 * Storyboard (contact sheet) options.
 * @public
 */
export interface StoryboardTransformOptions {
  /** Output image format for the storyboard. */
  format?: StillImageFormat
}

/**
 * Video-specific playback transformation option groups.
 * Only explicitly provided values are serialized into query parameters.
 * @public
 */
export interface MediaLibraryVideoPlaybackTransformations {
  /** Static thumbnail (single frame) options. */
  thumbnail?: ThumbnailTransformOptions
  /** Animated preview options (GIF / animated WebP). */
  animated?: AnimatedTransformOptions
  /** Storyboard (contact sheet) options. */
  storyboard?: StoryboardTransformOptions
}

/**
 * Options for requesting playback info (URLs + optional tokens) for a Media Library video asset.
 *
 * Removed: generic fallback parameters (width, height, fit, format). Supply per‑transformation values instead.
 * Animated transformations intentionally exclude any fit option (not supported by Mux).
 *
 * includeTokens is a client-side flag (not sent to the server) controlling whether
 * returned tokens should be appended to URLs when consumed.
 * @public
 */
export interface MediaLibraryPlaybackInfoOptions {
  /** Explicit per-video transformation options (thumbnail, animated, storyboard). */
  transformations?: MediaLibraryVideoPlaybackTransformations
  /** Expiration hint for secured/signed URLs (string or number, number will be stringified). */
  expiration?: string | number
}

/** @public */
export interface VideoPlaybackInfoItemPublic {
  url: string
}

/** @public */
export interface VideoPlaybackInfoItemSigned extends VideoPlaybackInfoItemPublic {
  token: string
}

/** @public */
export type VideoPlaybackInfoItem = VideoPlaybackInfoItemPublic | VideoPlaybackInfoItemSigned

/** @public */
export interface VideoPlaybackInfo<T extends VideoPlaybackInfoItem = VideoPlaybackInfoItem> {
  id: string
  thumbnail: T
  animated: T
  storyboard: T
  stream: T
  duration: number
  aspectRatio: number
}

/** @public */
export type VideoPlaybackInfoSigned = VideoPlaybackInfo<VideoPlaybackInfoItemSigned>

/** @public */
export type VideoPlaybackInfoPublic = VideoPlaybackInfo<VideoPlaybackInfoItemPublic>

/** @public */
export interface VideoPlaybackTokens {
  stream?: string
  thumbnail?: string
  storyboard?: string
  animated?: string
}

/** @public */
export type MediaLibraryAssetInstanceIdentifier = string | SanityReference
