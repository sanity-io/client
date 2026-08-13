import {
  type CollaborationCommentCreate,
  type CollaborationCommentDocument,
  createClient,
  type MultipleMutationResult,
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

  test('writes are not void', () => {
    // @ts-expect-error - create resolves to the created comment
    expectTypeOf(comments.create(body)).toEqualTypeOf<Promise<void>>()

    // @ts-expect-error - delete resolves to a mutation result
    expectTypeOf(comments.delete('comment-1')).toEqualTypeOf<Promise<void>>()
  })
})
