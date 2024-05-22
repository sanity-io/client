import {
  Action,
  Any,
  CreateAction,
  DeleteAction,
  DiscardAction,
  EditAction,
  IdentifiedSanityDocumentStub,
  PatchOperations,
  PublishAction,
  ReplaceDraftAction,
  UnpublishAction,
} from '../types'
import * as validators from '../validators'

/** @internal */
export class BaseAction {
  protected operations: Action[]
  protected trxId?: string

  constructor(operations: Action[] = [], transactionId?: string) {
    this.operations = operations
    this.trxId = transactionId
  }

  /**
   * Creates a new draft document. The published version of the document must not already exist.
   * If the draft version of the document already exists the action will fail by default, but
   * this can be adjusted to either leave the existing document in place or overwrite it.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param doc - Document to create. Requires a `_type` property.
   * @param publishedId - ID of the published document to create a draft for.
   */
  create<R extends Record<string, Any> = Record<string, Any>>(
    doc: IdentifiedSanityDocumentStub<R>,
    publishedId: string,
  ): this {
    const actionType = 'sanity.action.document.create'
    validators.validateObject(actionType, doc)
    validators.requireDocumentId(actionType, doc)
    validators.validateDocumentId(actionType, publishedId)

    const action: CreateAction = {
      actionType: actionType,
      publishedId,
      attributes: doc,
      ifExists: 'fail',
    }
    return this._add(action)
  }

  /**
   * Replaces an existing draft document.
   * At least one of the draft or published versions of the document must exist.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param draftId - Draft document ID to replace, if it exists.
   * @param publishedId - Published document ID to create draft from, if draft does not exist
   * @param doc - Document to create if it does not already exist. Requires `_id` and `_type` properties.
   */
  replaceDraft(draftId: string, publishedId: string, doc: IdentifiedSanityDocumentStub): this {
    const actionType = 'sanity.action.document.replaceDraft'
    validators.validateDocumentId(actionType, draftId)
    validators.validateDocumentId(actionType, publishedId)

    const action: ReplaceDraftAction = {
      actionType,
      draftId,
      publishedId,
      attributes: doc,
    }
    return this._add(action)
  }

  /**
   * Modifies an existing draft document.
   * It applies the given patch to the document referenced by draftId.
   * If there is no such document then one is created using the current state of the published version and then that is updated accordingly.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param draftId - Draft document ID to edit
   * @param publishedId - Published document ID to create draft from, if draft does not exist
   * @param patch - Patch operations to apply
   */
  edit(draftId: string, publishedId: string, patch: PatchOperations): this {
    const actionType = 'sanity.action.document.edit'
    validators.validateDocumentId(actionType, draftId)
    validators.validateDocumentId(actionType, publishedId)

    const action: EditAction = {
      actionType,
      draftId,
      publishedId,
      patch,
    }
    return this._add(action)
  }

  /**
   * Deletes the published version of a document and optionally some (likely all known) draft versions.
   * If any draft version exists that is not specified for deletion this is an error.
   * If the purge flag is set then the document history is also deleted.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param publishedId - Published document ID to delete
   * @param includeDrafts - Draft document ID to delete
   * @param [purge=false] - Delete document history
   */
  delete(publishedId: string, includeDrafts: string[], purge: boolean): this {
    const actionType = 'sanity.action.document.delete'
    validators.validateDocumentId(actionType, publishedId)
    includeDrafts.forEach((draftId) => validators.validateDocumentId(actionType, draftId))

    const action: DeleteAction = {
      actionType,
      publishedId,
      includeDrafts,
      purge,
    }
    return this._add(action)
  }

  /**
   * Delete the draft version of a document.
   * It is an error if it does not exist. If the purge flag is set, the document history is also deleted.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param draftId - Draft document ID to delete
   * @param [purge=false] - Delete document history
   */
  discard(draftId: string, purge: boolean): this {
    const actionType = 'sanity.action.document.discard'
    validators.validateDocumentId(actionType, draftId)

    const action: DiscardAction = {
      actionType,
      draftId,
      purge,
    }
    return this._add(action)
  }

  /**
   * Publishes a draft document.
   * If a published version of the document already exists this is replaced by the current draft document.
   * In either case the draft document is deleted.
   * The optional revision id parameters can be used for optimistic locking to ensure
   * that the draft and/or published versions of the document have not been changed by another client.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param draftId - Draft document ID to publish
   * @param ifDraftRevisionId - Draft revision ID to match
   * @param publishedId - Published document ID to replace
   * @param [ifPublishedRevisionId] - Published revision ID to match
   */
  publish(
    draftId: string,
    ifDraftRevisionId: string,
    publishedId: string,
    ifPublishedRevisionId: string,
  ): this {
    const actionType = 'sanity.action.document.publish'
    validators.validateDocumentId(actionType, draftId)
    validators.validateDocumentId(actionType, publishedId)

    const action: PublishAction = {
      actionType,
      draftId,
      ifDraftRevisionId,
      publishedId,
      ifPublishedRevisionId,
    }
    return this._add(action)
  }

  /**
   * Retract a published document.
   * If there is no draft version then this is created from the published version.
   * In either case the published version is deleted.
   *
   * The operation is added to the current transaction, ready to be commited by `commit()`
   *
   * @param draftId - Draft document ID to replace the published document with
   * @param publishedId - Published document ID to delete
   */
  unpublish(draftId: string, publishedId: string): this {
    const actionType = 'sanity.action.document.unpublish'
    validators.validateDocumentId(actionType, draftId)
    validators.validateDocumentId(actionType, publishedId)

    const action: UnpublishAction = {
      actionType,
      draftId,
      publishedId,
    }
    return this._add(action)
  }

  transactionId(): string | undefined
  transactionId(id: string): this
  transactionId(id?: string): this | string | undefined {
    if (!id) {
      return this.trxId
    }

    this.trxId = id
    return this
  }

  serialize(): Action[] {
    return [...this.operations]
  }

  toJSON(): Action[] {
    return this.serialize()
  }

  reset(): this {
    this.operations = []
    return this
  }

  protected _add(action: Action): this {
    this.operations.push(action)
    return this
  }
}
