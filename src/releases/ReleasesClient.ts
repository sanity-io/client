import {lastValueFrom, map, Observable} from 'rxjs'

import {_action, _getDocument, _getReleaseDocuments} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  ArchiveReleaseAction,
  BaseActionOptions,
  BaseMutationOptions,
  DeleteReleaseAction,
  EditReleaseAction,
  HttpRequest,
  PatchOperations,
  PublishReleaseAction,
  RawQueryResponse,
  ReleaseDocument,
  SanityDocument,
  ScheduleReleaseAction,
  SingleActionResult,
  UnarchiveReleaseAction,
  UnscheduleReleaseAction,
} from '../types'
import {createRelease} from './createRelease'

/** @public */
export class ObservableReleasesClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * @public
   *
   * Retrieve a release by id.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to retrieve.
   * @param options - Additional query options including abort signal and query tag.
   * @returns An observable that resolves to the release document {@link ReleaseDocument}.
   *
   * @example Retrieving a release by id
   * ```ts
   * client.observable.releases.get({releaseId: 'my-release'}).pipe(
   *   tap((release) => console.log(release)),
   *   // {
   *   //   _id: '_.releases.my-release',
   *   //   name: 'my-release'
   *   //   _type: 'system.release',
   *   //   metadata: {releaseType: 'asap'},
   *   //   _createdAt: '2021-01-01T00:00:00.000Z',
   *   //   ...
   *   // }
   * ).subscribe()
   * ```
   */
  get(
    {releaseId}: {releaseId: string},
    options?: {signal?: AbortSignal; tag?: string},
  ): Observable<ReleaseDocument | undefined> {
    return _getDocument<ReleaseDocument>(
      this.#client,
      this.#httpRequest,
      `_.releases.${releaseId}`,
      options,
    )
  }

  /**
   * @public
   *
   * Creates a new release under the given id, with metadata.
   *
   * @remarks
   * * If no releaseId is provided, a release id will be generated.
   * * If no metadata is provided, then an `undecided` releaseType will be used.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to create.
   *   - `metadata` - The metadata to associate with the release {@link ReleaseDocument}.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId` and the release id and metadata.
   *
   * @example Creating a release with a custom id and metadata
   * ```ts
   * const releaseId = 'my-release'
   * const metadata: ReleaseDocument['metadata'] = {
   *   releaseType: 'asap',
   * }
   *
   * client.observable.releases.create({releaseId, metadata}).pipe(
   *   tap(({transactionId, releaseId, metadata}) => console.log(transactionId, releaseId, metadata)),
   *   // {
   *   //   transactionId: 'transaction-id',
   *   //   releaseId: 'my-release',
   *   //   metadata: {releaseType: 'asap'},
   *   // }
   * ).subscribe()
   * ```
   *
   * @example Creating a release with generated id and metadata
   * ```ts
   * client.observable.releases.create().pipe(
   *   tap(({metadata}) => console.log(metadata)),
   *   // {
   *   //   metadata: {releaseType: 'undecided'},
   *   // }
   * ).subscribe()
   * ```
   *
   * @example Creating a release using a custom transaction id
   * ```ts
   * client.observable.releases.create({transactionId: 'my-transaction-id'}).pipe(
   *   tap(({transactionId, metadata}) => console.log(transactionId, metadata)),
   *   // {
   *   //   transactionId: 'my-transaction-id',
   *   //   metadata: {releaseType: 'undecided'},
   *   // }
   * ).subscribe()
   * ```
   */
  create(
    options: BaseActionOptions,
  ): Observable<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}>
  create(
    release: {releaseId?: string; metadata?: Partial<ReleaseDocument['metadata']>},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}>
  create(
    releaseOrOptions?:
      | {releaseId?: string; metadata?: Partial<ReleaseDocument['metadata']>}
      | BaseActionOptions,
    maybeOptions?: BaseActionOptions,
  ): Observable<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}> {
    const {action, options} = createRelease(releaseOrOptions, maybeOptions)
    const {releaseId, metadata} = action

    return _action(this.#client, this.#httpRequest, action, options).pipe(
      map((actionResult) => ({
        ...actionResult,
        releaseId,
        metadata,
      })),
    )
  }

  /**
   * @public
   *
   * Edits an existing release, updating the metadata.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to edit.
   *   - `patch` - The patch operation to apply on the release metadata {@link PatchMutationOperation}.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  edit(
    {releaseId, patch}: {releaseId: string; patch: PatchOperations},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const editAction: EditReleaseAction = {
      actionType: 'sanity.action.release.edit',
      releaseId,
      patch,
    }

    return _action(this.#client, this.#httpRequest, editAction, options)
  }

  /**
   * @public
   *
   * Publishes all documents in a release at once. For larger releases the effect of the publish
   * will be visible immediately when querying but the removal of the `versions.<releasesId>.*`
   * documents and creation of the corresponding published documents with the new content may
   * take some time.
   *
   * During this period both the source and target documents are locked and cannot be
   * modified through any other means.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to publish.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  publish(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const publishAction: PublishReleaseAction = {
      actionType: 'sanity.action.release.publish',
      releaseId,
    }

    return _action(this.#client, this.#httpRequest, publishAction, options)
  }

  /**
   * @public
   *
   * An archive action removes an active release. The documents that comprise the release
   * are deleted and therefore no longer queryable.
   *
   * While the documents remain in retention the last version can still be accessed using document history endpoint.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to archive.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  archive(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const archiveAction: ArchiveReleaseAction = {
      actionType: 'sanity.action.release.archive',
      releaseId,
    }

    return _action(this.#client, this.#httpRequest, archiveAction, options)
  }

  /**
   * @public
   *
   * An unarchive action restores an archived release and all documents
   * with the content they had just prior to archiving.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to unarchive.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  unarchive(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const unarchiveAction: UnarchiveReleaseAction = {
      actionType: 'sanity.action.release.unarchive',
      releaseId,
    }

    return _action(this.#client, this.#httpRequest, unarchiveAction, options)
  }

  /**
   * @public
   *
   * A schedule action queues a release for publishing at the given future time.
   * The release is locked such that no documents in the release can be modified and
   * no documents that it references can be deleted as this would make the publish fail.
   * At the given time, the same logic as for the publish action is triggered.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to schedule.
   *   - `publishAt` - The serialised date and time to publish the release. If the `publishAt` is in the past, the release will be published immediately.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  schedule(
    {releaseId, publishAt}: {releaseId: string; publishAt: string},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const scheduleAction: ScheduleReleaseAction = {
      actionType: 'sanity.action.release.schedule',
      releaseId,
      publishAt,
    }

    return _action(this.#client, this.#httpRequest, scheduleAction, options)
  }

  /**
   * @public
   *
   * An unschedule action stops a release from being published.
   * The documents in the release are considered unlocked and can be edited again.
   * This may fail if another release is scheduled to be published after this one and
   * has a reference to a document created by this one.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to unschedule.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  unschedule(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const unscheduleAction: UnscheduleReleaseAction = {
      actionType: 'sanity.action.release.unschedule',
      releaseId,
    }

    return _action(this.#client, this.#httpRequest, unscheduleAction, options)
  }

  /**
   * @public
   *
   * A delete action removes a published or archived release.
   * The backing system document will be removed from the dataset.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to delete.
   * @param options - Additional action options.
   * @returns An observable that resolves to the `transactionId`.
   */
  delete(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult> {
    const deleteAction: DeleteReleaseAction = {
      actionType: 'sanity.action.release.delete',
      releaseId,
    }

    return _action(this.#client, this.#httpRequest, deleteAction, options)
  }

  /**
   * @public
   *
   * Fetch the documents in a release by release id.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to fetch documents for.
   * @param options - Additional mutation options {@link BaseMutationOptions}.
   * @returns An observable that resolves to the documents in the release.
   */
  fetchDocuments(
    {releaseId}: {releaseId: string},
    options?: BaseMutationOptions,
  ): Observable<RawQueryResponse<SanityDocument[]>> {
    return _getReleaseDocuments(this.#client, this.#httpRequest, releaseId, options)
  }
}

/** @public */
export class ReleasesClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

  /**
   * @public
   *
   * Retrieve a release by id.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to retrieve.
   * @param options - Additional query options including abort signal and query tag.
   * @returns A promise that resolves to the release document {@link ReleaseDocument}.
   *
   * @example Retrieving a release by id
   * ```ts
   * const release = await client.releases.get({releaseId: 'my-release'})
   * console.log(release)
   * // {
   * //   _id: '_.releases.my-release',
   * //   name: 'my-release'
   * //   _type: 'system.release',
   * //   metadata: {releaseType: 'asap'},
   * //   _createdAt: '2021-01-01T00:00:00.000Z',
   * //   ...
   * // }
   * ```
   */
  get(
    {releaseId}: {releaseId: string},
    options?: {signal?: AbortSignal; tag?: string},
  ): Promise<ReleaseDocument | undefined> {
    return lastValueFrom(
      _getDocument<ReleaseDocument>(
        this.#client,
        this.#httpRequest,
        `_.releases.${releaseId}`,
        options,
      ),
    )
  }

  /**
   * @public
   *
   * Creates a new release under the given id, with metadata.
   *
   * @remarks
   * * If no releaseId is provided, a release id will be generated.
   * * If no metadata is provided, then an `undecided` releaseType will be used.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to create.
   *   - `metadata` - The metadata to associate with the release {@link ReleaseDocument}.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId` and the release id and metadata.
   *
   * @example Creating a release with a custom id and metadata
   * ```ts
   * const releaseId = 'my-release'
   * const releaseMetadata: ReleaseDocument['metadata'] = {
   *   releaseType: 'asap',
   * }
   *
   * const result =
   *   await client.releases.create({releaseId, metadata: releaseMetadata})
   * console.log(result)
   * // {
   * //   transactionId: 'transaction-id',
   * //   releaseId: 'my-release',
   * //   metadata: {releaseType: 'asap'},
   * // }
   * ```
   *
   * @example Creating a release with generated id and metadata
   * ```ts
   * const {metadata} = await client.releases.create()
   * console.log(metadata.releaseType) // 'undecided'
   * ```
   *
   * @example Creating a release with a custom transaction id
   * ```ts
   * const {transactionId, metadata} = await client.releases.create({transactionId: 'my-transaction-id'})
   * console.log(metadata.releaseType) // 'undecided'
   * console.log(transactionId) // 'my-transaction-id'
   * ```
   */
  async create(
    options: BaseActionOptions,
  ): Promise<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}>
  async create(
    release: {releaseId?: string; metadata?: Partial<ReleaseDocument['metadata']>},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}>
  async create(
    releaseOrOptions?:
      | {releaseId?: string; metadata?: Partial<ReleaseDocument['metadata']>}
      | BaseActionOptions,
    maybeOptions?: BaseActionOptions,
  ): Promise<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}> {
    const {action, options} = createRelease(releaseOrOptions, maybeOptions)
    const {releaseId, metadata} = action

    const actionResult = await lastValueFrom(
      _action(this.#client, this.#httpRequest, action, options),
    )

    return {...actionResult, releaseId, metadata}
  }

  /**
   * @public
   *
   * Edits an existing release, updating the metadata.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to edit.
   *   - `patch` - The patch operation to apply on the release metadata {@link PatchMutationOperation}.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  edit(
    {releaseId, patch}: {releaseId: string; patch: PatchOperations},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const editAction: EditReleaseAction = {
      actionType: 'sanity.action.release.edit',
      releaseId,
      patch,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, editAction, options))
  }

  /**
   * @public
   *
   * Publishes all documents in a release at once. For larger releases the effect of the publish
   * will be visible immediately when querying but the removal of the `versions.<releasesId>.*`
   * documents and creation of the corresponding published documents with the new content may
   * take some time.
   *
   * During this period both the source and target documents are locked and cannot be
   * modified through any other means.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to publish.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  publish(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const publishAction: PublishReleaseAction = {
      actionType: 'sanity.action.release.publish',
      releaseId,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, publishAction, options))
  }

  /**
   * @public
   *
   * An archive action removes an active release. The documents that comprise the release
   * are deleted and therefore no longer queryable.
   *
   * While the documents remain in retention the last version can still be accessed using document history endpoint.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to archive.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  archive(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const archiveAction: ArchiveReleaseAction = {
      actionType: 'sanity.action.release.archive',
      releaseId,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, archiveAction, options))
  }

  /**
   * @public
   *
   * An unarchive action restores an archived release and all documents
   * with the content they had just prior to archiving.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to unarchive.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  unarchive(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const unarchiveAction: UnarchiveReleaseAction = {
      actionType: 'sanity.action.release.unarchive',
      releaseId,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, unarchiveAction, options))
  }

  /**
   * @public
   *
   * A schedule action queues a release for publishing at the given future time.
   * The release is locked such that no documents in the release can be modified and
   * no documents that it references can be deleted as this would make the publish fail.
   * At the given time, the same logic as for the publish action is triggered.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to schedule.
   *   - `publishAt` - The serialised date and time to publish the release. If the `publishAt` is in the past, the release will be published immediately.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  schedule(
    {releaseId, publishAt}: {releaseId: string; publishAt: string},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const scheduleAction: ScheduleReleaseAction = {
      actionType: 'sanity.action.release.schedule',
      releaseId,
      publishAt,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, scheduleAction, options))
  }

  /**
   * @public
   *
   * An unschedule action stops a release from being published.
   * The documents in the release are considered unlocked and can be edited again.
   * This may fail if another release is scheduled to be published after this one and
   * has a reference to a document created by this one.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to unschedule.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  unschedule(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const unscheduleAction: UnscheduleReleaseAction = {
      actionType: 'sanity.action.release.unschedule',
      releaseId,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, unscheduleAction, options))
  }

  /**
   * @public
   *
   * A delete action removes a published or archived release.
   * The backing system document will be removed from the dataset.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to delete.
   * @param options - Additional action options.
   * @returns A promise that resolves to the `transactionId`.
   */
  delete(
    {releaseId}: {releaseId: string},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult> {
    const deleteAction: DeleteReleaseAction = {
      actionType: 'sanity.action.release.delete',
      releaseId,
    }

    return lastValueFrom(_action(this.#client, this.#httpRequest, deleteAction, options))
  }

  /**
   * @public
   *
   * Fetch the documents in a release by release id.
   *
   * @category Releases
   *
   * @param params - Release action parameters:
   *   - `releaseId` - The id of the release to fetch documents for.
   * @param options - Additional mutation options {@link BaseMutationOptions}.
   * @returns A promise that resolves to the documents in the release.
   */
  fetchDocuments(
    {releaseId}: {releaseId: string},
    options?: BaseMutationOptions,
  ): Promise<RawQueryResponse<SanityDocument[]>> {
    return lastValueFrom(_getReleaseDocuments(this.#client, this.#httpRequest, releaseId, options))
  }
}
