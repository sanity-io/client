import {type Observable} from 'rxjs'

import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {
  AllDocumentIdsMutationOptions,
  AllDocumentsMutationOptions,
  Any,
  AttributeSet,
  BaseMutationOptions,
  FirstDocumentIdMutationOptions,
  FirstDocumentMutationOptions,
  MultipleMutationResult,
  PatchMutationOperation,
  PatchOperations,
  PatchSelection,
  SanityDocument,
  SingleMutationResult,
} from '../types'
import {getSelection} from '../util/getSelection'
import {validateInsert, validateObject} from '../validators'

/** @internal */
export class BasePatch {
  protected selection: PatchSelection
  protected operations: PatchOperations
  constructor(selection: PatchSelection, operations: PatchOperations = {}) {
    this.selection = selection
    this.operations = operations
  }

  /**
   * Sets the given attributes to the document. Does NOT merge objects.
   * The operation is added to the current patch, ready to be commited by `commit()`
   *
   * @param attrs - Attributes to set. To set a deep attribute, use JSONMatch, eg: \{"nested.prop": "value"\}
   */
  set(attrs: AttributeSet): this {
    return this._assign('set', attrs)
  }

  /**
   * Sets the given attributes to the document if they are not currently set. Does NOT merge objects.
   * The operation is added to the current patch, ready to be commited by `commit()`
   *
   * @param attrs - Attributes to set. To set a deep attribute, use JSONMatch, eg: \{"nested.prop": "value"\}
   */
  setIfMissing(attrs: AttributeSet): this {
    return this._assign('setIfMissing', attrs)
  }

  /**
   * Performs a "diff-match-patch" operation on the string attributes provided.
   * The operation is added to the current patch, ready to be commited by `commit()`
   *
   * @param attrs - Attributes to perform operation on. To set a deep attribute, use JSONMatch, eg: \{"nested.prop": "dmp"\}
   */
  diffMatchPatch(attrs: AttributeSet): this {
    validateObject('diffMatchPatch', attrs)
    return this._assign('diffMatchPatch', attrs)
  }

  /**
   * Unsets the attribute paths provided.
   * The operation is added to the current patch, ready to be commited by `commit()`
   *
   * @param attrs - Attribute paths to unset.
   */
  unset(attrs: string[]): this {
    if (!Array.isArray(attrs)) {
      throw new Error('unset(attrs) takes an array of attributes to unset, non-array given')
    }

    this.operations = Object.assign({}, this.operations, {unset: attrs})
    return this
  }

  /**
   * Increment a numeric value. Each entry in the argument is either an attribute or a JSON path. The value may be a positive or negative integer or floating-point value. The operation will fail if target value is not a numeric value, or doesn't exist.
   *
   * @param attrs - Object of attribute paths to increment, values representing the number to increment by.
   */
  inc(attrs: {[key: string]: number}): this {
    return this._assign('inc', attrs)
  }

  /**
   * Decrement a numeric value. Each entry in the argument is either an attribute or a JSON path. The value may be a positive or negative integer or floating-point value. The operation will fail if target value is not a numeric value, or doesn't exist.
   *
   * @param attrs - Object of attribute paths to decrement, values representing the number to decrement by.
   */
  dec(attrs: {[key: string]: number}): this {
    return this._assign('dec', attrs)
  }

  /**
   * Provides methods for modifying arrays, by inserting, appending and replacing elements via a JSONPath expression.
   *
   * @param at - Location to insert at, relative to the given selector, or 'replace' the matched path
   * @param selector - JSONPath expression, eg `comments[-1]` or `blocks[_key=="abc123"]`
   * @param items - Array of items to insert/replace
   */
  insert(at: 'before' | 'after' | 'replace', selector: string, items: Any[]): this {
    validateInsert(at, selector, items)
    return this._assign('insert', {[at]: selector, items})
  }

  /**
   * Append the given items to the array at the given JSONPath
   *
   * @param selector - Attribute/path to append to, eg `comments` or `person.hobbies`
   * @param items - Array of items to append to the array
   */
  append(selector: string, items: Any[]): this {
    return this.insert('after', `${selector}[-1]`, items)
  }

  /**
   * Prepend the given items to the array at the given JSONPath
   *
   * @param selector - Attribute/path to prepend to, eg `comments` or `person.hobbies`
   * @param items - Array of items to prepend to the array
   */
  prepend(selector: string, items: Any[]): this {
    return this.insert('before', `${selector}[0]`, items)
  }

  /**
   * Change the contents of an array by removing existing elements and/or adding new elements.
   *
   * @param selector - Attribute or JSONPath expression for array
   * @param start - Index at which to start changing the array (with origin 0). If greater than the length of the array, actual starting index will be set to the length of the array. If negative, will begin that many elements from the end of the array (with origin -1) and will be set to 0 if absolute value is greater than the length of the array.x
   * @param deleteCount - An integer indicating the number of old array elements to remove.
   * @param items - The elements to add to the array, beginning at the start index. If you don't specify any elements, splice() will only remove elements from the array.
   */
  splice(selector: string, start: number, deleteCount?: number, items?: Any[]): this {
    // Negative indexes doesn't mean the same in Sanity as they do in JS;
    // -1 means "actually at the end of the array", which allows inserting
    // at the end of the array without knowing its length. We therefore have
    // to substract negative indexes by one to match JS. If you want Sanity-
    // behaviour, just use `insert('replace', selector, items)` directly
    const delAll = typeof deleteCount === 'undefined' || deleteCount === -1
    const startIndex = start < 0 ? start - 1 : start
    const delCount = delAll ? -1 : Math.max(0, start + deleteCount)
    const delRange = startIndex < 0 && delCount >= 0 ? '' : delCount
    const rangeSelector = `${selector}[${startIndex}:${delRange}]`
    return this.insert('replace', rangeSelector, items || [])
  }

  /**
   * Adds a revision clause, preventing the document from being patched if the `_rev` property does not match the given value
   *
   * @param rev - Revision to lock the patch to
   */
  ifRevisionId(rev: string): this {
    this.operations.ifRevisionID = rev
    return this
  }

  /**
   * Return a plain JSON representation of the patch
   */
  serialize(): PatchMutationOperation {
    return {...getSelection(this.selection), ...this.operations}
  }

  /**
   * Return a plain JSON representation of the patch
   */
  toJSON(): PatchMutationOperation {
    return this.serialize()
  }

  /**
   * Clears the patch of all operations
   */
  reset(): this {
    this.operations = {}
    return this
  }

  protected _assign(op: keyof PatchOperations, props: Any, merge = true): this {
    validateObject(op, props)
    this.operations = Object.assign({}, this.operations, {
      [op]: Object.assign({}, (merge && this.operations[op]) || {}, props),
    })
    return this
  }

  protected _set(op: keyof PatchOperations, props: Any): this {
    return this._assign(op, props, false)
  }
}

/** @public */
export class ObservablePatch extends BasePatch {
  #client?: ObservableSanityClient

  constructor(
    selection: PatchSelection,
    operations?: PatchOperations,
    client?: ObservableSanityClient,
  ) {
    super(selection, operations)
    this.#client = client
  }

  /**
   * Clones the patch
   */
  clone(): ObservablePatch {
    return new ObservablePatch(this.selection, {...this.operations}, this.#client)
  }

  /**
   * Commit the patch, returning an observable that produces the first patched document
   *
   * @param options - Options for the mutation operation
   */
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options: FirstDocumentMutationOptions,
  ): Observable<SanityDocument<R>>
  /**
   * Commit the patch, returning an observable that produces an array of the mutated documents
   *
   * @param options - Options for the mutation operation
   */
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options: AllDocumentsMutationOptions,
  ): Observable<SanityDocument<R>[]>
  /**
   * Commit the patch, returning an observable that produces a mutation result object
   *
   * @param options - Options for the mutation operation
   */
  commit(options: FirstDocumentIdMutationOptions): Observable<SingleMutationResult>
  /**
   * Commit the patch, returning an observable that produces a mutation result object
   *
   * @param options - Options for the mutation operation
   */
  commit(options: AllDocumentIdsMutationOptions): Observable<MultipleMutationResult>
  /**
   * Commit the patch, returning an observable that produces the first patched document
   *
   * @param options - Options for the mutation operation
   */
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options?: BaseMutationOptions,
  ): Observable<SanityDocument<R>>
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options?:
      | FirstDocumentMutationOptions
      | AllDocumentsMutationOptions
      | FirstDocumentIdMutationOptions
      | AllDocumentIdsMutationOptions
      | BaseMutationOptions,
  ): Observable<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    if (!this.#client) {
      throw new Error(
        'No `client` passed to patch, either provide one or pass the ' +
          'patch to a clients `mutate()` method',
      )
    }

    const returnFirst = typeof this.selection === 'string'
    const opts = Object.assign({returnFirst, returnDocuments: true}, options)
    return this.#client.mutate<R>({patch: this.serialize()} as Any, opts)
  }
}

/** @public */
export class Patch extends BasePatch {
  #client?: SanityClient
  constructor(selection: PatchSelection, operations?: PatchOperations, client?: SanityClient) {
    super(selection, operations)
    this.#client = client
  }

  /**
   * Clones the patch
   */
  clone(): Patch {
    return new Patch(this.selection, {...this.operations}, this.#client)
  }

  /**
   * Commit the patch, returning a promise that resolves to the first patched document
   *
   * @param options - Options for the mutation operation
   */
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options: FirstDocumentMutationOptions,
  ): Promise<SanityDocument<R>>
  /**
   * Commit the patch, returning a promise that resolves to an array of the mutated documents
   *
   * @param options - Options for the mutation operation
   */
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options: AllDocumentsMutationOptions,
  ): Promise<SanityDocument<R>[]>
  /**
   * Commit the patch, returning a promise that resolves to a mutation result object
   *
   * @param options - Options for the mutation operation
   */
  commit(options: FirstDocumentIdMutationOptions): Promise<SingleMutationResult>
  /**
   * Commit the patch, returning a promise that resolves to a mutation result object
   *
   * @param options - Options for the mutation operation
   */
  commit(options: AllDocumentIdsMutationOptions): Promise<MultipleMutationResult>
  /**
   * Commit the patch, returning a promise that resolves to the first patched document
   *
   * @param options - Options for the mutation operation
   */
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options?: BaseMutationOptions,
  ): Promise<SanityDocument<R>>
  commit<R extends Record<string, Any> = Record<string, Any>>(
    options?:
      | FirstDocumentMutationOptions
      | AllDocumentsMutationOptions
      | FirstDocumentIdMutationOptions
      | AllDocumentIdsMutationOptions
      | BaseMutationOptions,
  ): Promise<
    SanityDocument<R> | SanityDocument<R>[] | SingleMutationResult | MultipleMutationResult
  > {
    if (!this.#client) {
      throw new Error(
        'No `client` passed to patch, either provide one or pass the ' +
          'patch to a clients `mutate()` method',
      )
    }

    const returnFirst = typeof this.selection === 'string'
    const opts = Object.assign({returnFirst, returnDocuments: true}, options)
    return this.#client.mutate<R>({patch: this.serialize()} as Any, opts)
  }
}
