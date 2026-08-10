import type {CollaborationCommentCreate} from '@sanity/client'
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
