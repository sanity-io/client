import {lastValueFrom, map, Observable} from 'rxjs'

import {_action, _getDocument, _getReleaseDocuments} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  ArchiveReleaseAction,
  BaseActionOptions,
  BaseMutationOptions,
  CreateReleaseAction,
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
import {generateReleaseId} from '../util/createVersionId'

/** @internal */
export class ObservableReleasesClient {
  #client: ObservableSanityClient
  #httpRequest: HttpRequest
  constructor(client: ObservableSanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

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
   * Creates a new release under the given id, with metadata.
   *
   * @param releaseId - The id of the release to create (with no prefix)
   * @param metadata - The metadata to associate with the release {@link ReleaseDocument}
   * Must include a `releaseType` {@link ReleaseType}
   */
  create(
    {
      releaseId,
      metadata = {},
    }: {releaseId?: string; metadata?: Partial<ReleaseDocument['metadata']>},
    options?: BaseActionOptions,
  ): Observable<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}> {
    const finalReleaseId = releaseId || generateReleaseId()
    const finalMetadata: ReleaseDocument['metadata'] = {
      ...metadata,
      releaseType: metadata.releaseType || 'undecided',
    }

    const createAction: CreateReleaseAction = {
      actionType: 'sanity.action.release.create',
      releaseId: finalReleaseId,
      metadata: finalMetadata,
    }

    return _action(this.#client, this.#httpRequest, createAction, options).pipe(
      map((actionResult) => ({
        ...actionResult,
        metadata: finalMetadata,
        releaseId: finalReleaseId,
      })),
    )
  }

  /**
   * Edits an existing release, updating the metadata.
   *
   * @param releaseId - The id of the release to edit (with no prefix)
   * @param patch - The patch operation to apply on the release metadata {@link PatchMutationOperation}
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
   * Publishes all documents in a release at once. For larger releases the effect of the publish
   * will be visible immediately when querying but the removal of the `versions.<releasesId>.*`
   * documents and creation of the corresponding published documents with the new content may
   * take some time.
   *
   * During this period both the source and target documents are locked and cannot be
   * modified through any other means.
   *
   * @param releaseId - The id of the release to publish (with no prefix)
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
   * An archive action is used to remove an active release. The documents that comprise the release
   * are deleted and therefore no longer queryable.
   *
   * While the documents remain in retention the last version can still be accessed using document history endpoint.
   *
   * @param releaseId - The id of the release to archive (with no prefix)
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
   * An unarchive action is used to restore an archived release and all documents
   * with the content they had just prior to archiving.
   *
   * @param releaseId - The id of the release to unarchive (with no prefix)
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
   * A schedule action queues a release for publishing at the given future time.
   * The release is locked such that no documents in the release can be modified and
   * no documents that it references can be deleted as this would make the publish fail.
   * At the given time, the same logic as for the publish action is triggered.
   *
   * @param releaseId - The id of the release to schedule (with no prefix)
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
   * An unschedule action is used to stop a release from being published.
   * The documents in the release are considered unlocked and can be edited again.
   * This may fail if another release is scheduled to be published after this one and
   * has a reference to a document created by this one.
   *
   * @param releaseId - The id of the release to unschedule (with no prefix)
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
   * A delete action is used to delete a published or archived release.
   * The backing system document will be removed from the dataset.
   *
   * @param releaseId - The id of the release to delete (with no prefix)
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

  getDocuments(
    {releaseId}: {releaseId: string},
    options?: BaseMutationOptions,
  ): Observable<RawQueryResponse<SanityDocument[]>> {
    return _getReleaseDocuments(this.#client, this.#httpRequest, releaseId, options)
  }
}

/** @internal */
export class ReleasesClient {
  #client: SanityClient
  #httpRequest: HttpRequest
  constructor(client: SanityClient, httpRequest: HttpRequest) {
    this.#client = client
    this.#httpRequest = httpRequest
  }

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
   * Creates a new release under the given id, with metadata.
   *
   * @param releaseId - The id of the release to create
   * @param metadata - The metadata to associate with the release {@link ReleaseDocument}.
   * Must include a `releaseType` {@link ReleaseType}
   */
  async create(
    {
      releaseId,
      metadata = {},
    }: {releaseId?: string; metadata?: Partial<ReleaseDocument['metadata']>},
    options?: BaseActionOptions,
  ): Promise<SingleActionResult & {releaseId: string; metadata: ReleaseDocument['metadata']}> {
    const finalReleaseId = releaseId || generateReleaseId()
    const finalMetadata: ReleaseDocument['metadata'] = {
      ...metadata,
      releaseType: metadata.releaseType || 'undecided',
    }

    const createAction: CreateReleaseAction = {
      actionType: 'sanity.action.release.create',
      releaseId: finalReleaseId,
      metadata: finalMetadata,
    }

    const actionResult = await lastValueFrom(
      _action(this.#client, this.#httpRequest, createAction, options),
    )

    return {...actionResult, releaseId: finalReleaseId, metadata: finalMetadata}
  }

  /**
   * Edits an existing release, updating the metadata.
   *
   * @param releaseId - The id of the release to edit
   * @param patch - The patch operation to apply on the release metadata {@link PatchMutationOperation}
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
   * Publishes all documents in a release at once. For larger releases the effect of the publish
   * will be visible immediately when querying but the removal of the `versions.<releasesId>.*`
   * documents and creation of the corresponding published documents with the new content may
   * take some time.
   *
   * During this period both the source and target documents are locked and cannot be
   * modified through any other means.
   *
   * @param releaseId - The id of the release to publish
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
   * An archive action is used to remove an active release. The documents that comprise the release
   * are deleted and therefore no longer queryable.
   *
   * While the documents remain in retention the last version can still be accessed using document history endpoint.
   *
   * @param releaseId - The id of the release to archive
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
   * An unarchive action is used to restore an archived release and all documents
   * with the content they had just prior to archiving.
   *
   * @param releaseId - The id of the release to unarchive
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
   * A schedule action queues a release for publishing at the given future time.
   * The release is locked such that no documents in the release can be modified and
   * no documents that it references can be deleted as this would make the publish fail.
   * At the given time, the same logic as for the publish action is triggered.
   *
   * @param releaseId - The id of the release to schedule
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
   * An unschedule action is used to stop a release from being published.
   * The documents in the release are considered unlocked and can be edited again.
   * This may fail if another release is scheduled to be published after this one and
   * has a reference to a document created by this one.
   *
   * @param releaseId - The id of the release to unschedule
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
   * A delete action is used to delete a published or archived release.
   * The backing system document will be removed from the dataset.
   *
   * @param params - Object containing:
   * - `releaseId` - The id of the release to delete
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

  getDocuments(
    {releaseId}: {releaseId: string},
    options?: BaseMutationOptions,
  ): Promise<RawQueryResponse<SanityDocument[]>> {
    return lastValueFrom(_getReleaseDocuments(this.#client, this.#httpRequest, releaseId, options))
  }
}
