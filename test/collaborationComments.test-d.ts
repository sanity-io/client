import {
  type CollaborationCommentCreate,
  type CollaborationCommentDocument,
  type CollaborationCommentSelection,
  createClient,
  type ListenEvent,
  type MultipleMutationResult,
  type MutationEvent,
  type OpenEvent,
  type ReconnectEvent,
  type ResetEvent,
  type WelcomeBackEvent,
  type WelcomeEvent,
} from '@sanity/client'
import type {Observable} from 'rxjs'
import {describe, expectTypeOf, test} from 'vitest'

const message = [
  {
    _type: 'block',
    children: [{_type: 'span', text: 'Hello'}],
  },
]

describe('CollaborationCommentCreate', () => {
  test('allows document, field, and inline comments', () => {
    expectTypeOf({
      message,
      target: {documentId: 'doc-1', documentType: 'article'},
    }).toMatchTypeOf<CollaborationCommentCreate>()

    expectTypeOf({
      message,
      target: {
        documentId: 'doc-1',
        documentType: 'article',
        path: 'title',
      },
    }).toMatchTypeOf<CollaborationCommentCreate>()

    expectTypeOf({
      message,
      target: {
        documentId: 'doc-1',
        documentType: 'article',
        path: 'body',
        range: {
          start: {_key: 'key-1', offset: 0},
          end: {_key: 'key-2', offset: 10},
        },
      },
    }).toMatchTypeOf<CollaborationCommentCreate>()
  })

  test('requires path when range is provided', () => {
    const comment: CollaborationCommentCreate = {
      message,
      // @ts-expect-error - range requires path
      target: {
        documentId: 'doc-1',
        documentType: 'article',
        range: {
          start: {_key: 'key-1', offset: 0},
          end: {_key: 'key-2', offset: 10},
        },
      },
    }

    expectTypeOf(comment).toEqualTypeOf<CollaborationCommentCreate>()
  })

  test('allows replies without target or threadId', () => {
    expectTypeOf({
      message,
      parentCommentId: 'comment-1',
    }).toMatchTypeOf<CollaborationCommentCreate>()
  })

  test('rejects target and threadId on replies', () => {
    // @ts-expect-error - replies cannot set target
    const replyWithTarget: CollaborationCommentCreate = {
      message,
      parentCommentId: 'comment-1',
      target: {documentId: 'doc-1', documentType: 'article'},
    }

    // @ts-expect-error - replies cannot set threadId
    const replyWithThreadId: CollaborationCommentCreate = {
      message,
      parentCommentId: 'comment-1',
      threadId: 'thread-1',
    }

    expectTypeOf(replyWithTarget).toEqualTypeOf<CollaborationCommentCreate>()
    expectTypeOf(replyWithThreadId).toEqualTypeOf<CollaborationCommentCreate>()
  })
})

describe('CollaborationCommentDocument', () => {
  type StoredPath = CollaborationCommentDocument['target']['path']

  test('the stored target is shaped differently from the created one', () => {
    // Create takes `path: 'body'`, while the stored document nests it under
    // `field`, so a query filters on `target.path.field`.
    expectTypeOf<StoredPath>().toEqualTypeOf<
      {field: string; selection?: CollaborationCommentSelection} | undefined
    >()

    // `range` is resolved into the selection at create time, and never stored
    expectTypeOf<NonNullable<NonNullable<StoredPath>['selection']>['value']>().toEqualTypeOf<
      {_key: string; text: string}[]
    >()
  })
})

describe('collaboration.comments write results', () => {
  const {comments} = createClient({}).collaboration
  const observableComments = createClient({}).observable.collaboration.comments
  const body: CollaborationCommentCreate = {
    message,
    target: {documentId: 'doc-1', documentType: 'article'},
  }

  test('resolves to the comment document', () => {
    expectTypeOf(comments.create(body)).toEqualTypeOf<Promise<CollaborationCommentDocument>>()
    expectTypeOf(comments.update('comment-1', {status: 'resolved'})).toEqualTypeOf<
      Promise<CollaborationCommentDocument>
    >()
    expectTypeOf(
      comments.update('comment-1', {
        range: {start: {_key: 'block-1', offset: 0}, end: {_key: 'block-1', offset: 12}},
      }),
    ).toEqualTypeOf<Promise<CollaborationCommentDocument>>()
    expectTypeOf(comments.update('comment-1', {range: null})).toEqualTypeOf<
      Promise<CollaborationCommentDocument>
    >()
    expectTypeOf(comments.addReaction('comment-1', ':heart:')).toEqualTypeOf<
      Promise<CollaborationCommentDocument>
    >()
    expectTypeOf(comments.removeReaction('comment-1', ':heart:')).toEqualTypeOf<
      Promise<CollaborationCommentDocument>
    >()

    expectTypeOf(observableComments.create(body)).toEqualTypeOf<
      Observable<CollaborationCommentDocument>
    >()
    expectTypeOf(observableComments.update('comment-1', {status: 'resolved'})).toEqualTypeOf<
      Observable<CollaborationCommentDocument>
    >()
    expectTypeOf(observableComments.addReaction('comment-1', ':heart:')).toEqualTypeOf<
      Observable<CollaborationCommentDocument>
    >()
    expectTypeOf(observableComments.removeReaction('comment-1', ':heart:')).toEqualTypeOf<
      Observable<CollaborationCommentDocument>
    >()
  })

  test('delete resolves to a mutation result, since it also removes replies', () => {
    expectTypeOf(comments.delete('comment-1')).toEqualTypeOf<Promise<MultipleMutationResult>>()
    expectTypeOf(observableComments.delete('comment-1')).toEqualTypeOf<
      Observable<MultipleMutationResult>
    >()
  })

  test('getTargetDocumentRef returns a global document reference', () => {
    expectTypeOf(comments.getTargetDocumentRef('doc-1')).toEqualTypeOf<
      CollaborationCommentDocument['target']['document']['_ref']
    >()
    expectTypeOf(observableComments.getTargetDocumentRef('doc-1')).toEqualTypeOf<
      CollaborationCommentDocument['target']['document']['_ref']
    >()
  })

  test('writes are not void', () => {
    // @ts-expect-error - create resolves to the created comment
    expectTypeOf(comments.create(body)).toEqualTypeOf<Promise<void>>()

    // @ts-expect-error - delete resolves to a mutation result
    expectTypeOf(comments.delete('comment-1')).toEqualTypeOf<Promise<void>>()
  })
})

describe('collaboration.comments.fetch', () => {
  const {comments} = createClient({}).collaboration
  const observableComments = createClient({}).observable.collaboration.comments
  const query = '*[_type == "sanity.comment"]'

  test('the result type defaults to unknown, since the query decides the shape', () => {
    expectTypeOf(comments.fetch(query)).toEqualTypeOf<Promise<unknown>>()
    expectTypeOf(observableComments.fetch(query)).toEqualTypeOf<Observable<unknown>>()
  })

  test('an explicit result type is passed through', () => {
    expectTypeOf(comments.fetch<CollaborationCommentDocument[]>(query)).toEqualTypeOf<
      Promise<CollaborationCommentDocument[]>
    >()
    expectTypeOf(observableComments.fetch<CollaborationCommentDocument[]>(query)).toEqualTypeOf<
      Observable<CollaborationCommentDocument[]>
    >()

    expectTypeOf(
      comments.fetch<{open: CollaborationCommentDocument[]}>(
        '{"open": *[_type == "sanity.comment" && status == "open"]}',
      ),
    ).toEqualTypeOf<Promise<{open: CollaborationCommentDocument[]}>>()
  })
})

describe('collaboration.comments.listen', () => {
  const {comments} = createClient({}).collaboration
  const observableComments = createClient({}).observable.collaboration.comments
  const query = '*[_type == "sanity.comment"]'

  test('event types', () => {
    // mutation event is the default, and it carries the comment document
    expectTypeOf(comments.listen(query)).toEqualTypeOf<
      Observable<MutationEvent<CollaborationCommentDocument>>
    >()

    // @ts-expect-error - WelcomeEvent should not be emitted
    expectTypeOf(comments.listen(query)).toEqualTypeOf<Observable<WelcomeEvent>>()

    expectTypeOf(comments.listen(query, undefined, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()

    expectTypeOf(comments.listen(query, undefined, {events: ['welcome']})).toEqualTypeOf<
      // @ts-expect-error - only WelcomeEvents should be emitted
      Observable<MutationEvent<CollaborationCommentDocument>>
    >()

    expectTypeOf(comments.listen(query, undefined, {events: []})).toEqualTypeOf<Observable<never>>()

    expectTypeOf(
      comments.listen(query, undefined, {events: ['welcome', 'mutation', 'open', 'reconnect']}),
    ).toEqualTypeOf<
      Observable<
        WelcomeEvent | MutationEvent<CollaborationCommentDocument> | ReconnectEvent | OpenEvent
      >
    >()
  })

  test('welcomeback and reset require enableResume', () => {
    // Without `enableResume` the event names are rejected, and the literal
    // names can no longer be inferred, so the return type falls back to the
    // full `ListenEvent` union.
    expectTypeOf(
      // @ts-expect-error - welcomeback and reset require `enableResume`
      comments.listen(query, undefined, {events: ['welcomeback', 'reset']}),
    ).toEqualTypeOf<Observable<ListenEvent<CollaborationCommentDocument>>>()

    expectTypeOf(
      comments.listen(query, undefined, {enableResume: true, events: ['welcomeback', 'reset']}),
    ).toEqualTypeOf<Observable<WelcomeBackEvent | ResetEvent>>()

    expectTypeOf(
      comments.listen(query, undefined, {enableResume: true, events: ['welcome', 'mutation']}),
    ).toEqualTypeOf<Observable<WelcomeEvent | MutationEvent<CollaborationCommentDocument>>>()
  })

  test('the observable namespace narrows identically', () => {
    expectTypeOf(observableComments.listen(query)).toEqualTypeOf<
      Observable<MutationEvent<CollaborationCommentDocument>>
    >()

    expectTypeOf(observableComments.listen(query, undefined, {events: ['welcome']})).toEqualTypeOf<
      Observable<WelcomeEvent>
    >()

    expectTypeOf(
      observableComments.listen(query, undefined, {
        enableResume: true,
        events: ['welcome', 'mutation'],
      }),
    ).toEqualTypeOf<Observable<WelcomeEvent | MutationEvent<CollaborationCommentDocument>>>()
  })
})
