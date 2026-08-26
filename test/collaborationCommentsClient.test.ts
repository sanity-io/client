import {type ClientConfig, type CollaborationCommentDocument, createClient} from '@sanity/client'
import {encode} from 'eventsource-encoder'
import {firstValueFrom, lastValueFrom, take, toArray} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, streamBody, streamStall, testResolveFetch} from './helpers/mockFetch'

const apiHost = 'https://api.sanity.url'
const projectHost = (projectId: string) => {
  const url = new URL(apiHost)
  return `${url.protocol}//${projectId}.${url.host}`
}
const organizationId = 'org-123'
const resource = {type: 'canvas' as const, id: 'canvas-123'}

const message = [
  {
    _type: 'block',
    children: [{_type: 'span', text: 'Hello'}],
  },
]

const commentDocument: CollaborationCommentDocument = {
  _id: 'comment-1',
  _type: 'sanity.comment',
  _createdAt: '2026-07-22T09:58:00.000Z',
  _updatedAt: '2026-07-22T09:58:00.000Z',
  _rev: 'rev-1',
  message,
  reactions: [],
  status: 'open',
  target: {
    document: {
      _ref: 'canvas:canvas-123:doc-1',
      _type: 'globalDocumentReference',
      _weak: true,
    },
    documentType: 'article',
    sourceDocumentId: 'doc-1',
  },
}

const replyDocument: CollaborationCommentDocument = {
  ...commentDocument,
  _id: 'reply-1',
  parentCommentId: 'comment-1',
}

/**
 * An inline comment, as the API stores it: the `path` and `range` sent on
 * create come back as `target.path.field` and `target.path.selection`, with the
 * selected text wrapped in marker characters, plus a snapshot of the content
 * the comment was anchored to.
 */
const inlineCommentDocument: CollaborationCommentDocument = {
  ...commentDocument,
  _id: 'comment-2',
  target: {
    ...commentDocument.target,
    documentRevisionId: 'rev-1',
    path: {
      field: 'body',
      selection: {
        type: 'text',
        value: [{_key: 'block-1', text: 'Hello \uF000World\uF001 again'}],
      },
    },
  },
  contentSnapshot: [
    {
      _type: 'block',
      _key: 'block-1',
      children: [{_type: 'span', _key: 'block-1', text: 'World'}],
    },
  ],
}

/** The write endpoints pass the org-store mutate envelope through as-is. */
const mutationResponse = (
  results: {
    id: string
    operation: 'create' | 'update' | 'delete'
    document?: CollaborationCommentDocument
  }[],
) => ({transactionId: 'txn-1', results})

const baseConfig = {
  apiHost,
  apiVersion: '2026-07-18',
  collaboration: {
    organizationId,
  },
  resource,
  useCdn: false,
  useProjectHostname: false,
}

/**
 * Client whose requests - including the EventSource connection `listen()`
 * opens - go to the per-test `get-it/mock` transport.
 */
const getMockClient = (config: Partial<ClientConfig> = {}) =>
  createClient({...baseConfig, resolveFetch: testResolveFetch, ...config})

describe('collaboration.comments', () => {
  const commonQuery = {
    organizationId,
    resourceId: resource.id,
    resourceType: resource.type,
  }

  test('creates comments with resource query parameters and write options', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments', {
        query: {...commonQuery, tag: 'comments.create', transactionId: 'txn-123'},
        body: {target: {documentId: 'doc-1', documentType: 'article'}, message},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
      })

    const client = getMockClient({requestTagPrefix: 'comments'})

    const created = await client.collaboration.comments.create(
      {
        target: {
          documentId: 'doc-1',
          documentType: 'article',
        },
        message,
      },
      {tag: 'create', transactionId: 'txn-123'},
    )

    expect(created).toEqual(commentDocument)
  })

  test('creates replies with parentCommentId', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments', {
        query: commonQuery,
        body: {parentCommentId: 'comment-1', message},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'reply-1', operation: 'create', document: replyDocument}]),
      })

    const reply = await getMockClient().collaboration.comments.create({
      parentCommentId: 'comment-1',
      message,
    })

    expect(reply).toEqual(replyDocument)
  })

  test('creates comments with an explicit id, threadId and context', async () => {
    const body = {
      _id: 'comment-1',
      message,
      context: {source: 'studio'},
      target: {documentId: 'doc-1', documentType: 'article'},
      threadId: 'thread-1',
    }

    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments', {query: commonQuery, body})
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
      })

    await expect(getMockClient().collaboration.comments.create(body)).resolves.toEqual(
      commentDocument,
    )
  })

  test('creates field and inline selection comments', async () => {
    const fieldComment = {
      message,
      target: {documentId: 'doc-1', documentType: 'article', path: 'title'},
    }
    const inlineComment = {
      message,
      target: {
        documentId: 'doc-1',
        documentType: 'article',
        path: 'body',
        range: {
          start: {_key: 'block-1', offset: 6},
          end: {_key: 'block-1', offset: 11},
        },
      },
    }
    const inlineWithFieldValue = {
      message,
      target: {
        documentId: 'doc-1',
        documentType: 'article',
        path: 'body',
        range: {
          start: {_key: 'block-1', offset: 6},
          end: {_key: 'block-1', offset: 11},
        },
        fieldValue: [
          {
            _type: 'block',
            _key: 'block-1',
            children: [{_type: 'span', text: 'Hello World again'}],
          },
        ],
      },
    }

    // The stored target is shaped differently from the created one: `path`
    // becomes `target.path.field`, and `range` is resolved into a selection.
    const fieldCommentDocument: CollaborationCommentDocument = {
      ...commentDocument,
      target: {...commentDocument.target, path: {field: 'title'}},
    }

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('POST', '/v2026-07-18/collaboration/comments', {query: commonQuery, body: fieldComment})
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-1', operation: 'create', document: fieldCommentDocument},
        ]),
      })
    scope
      .on('POST', '/v2026-07-18/collaboration/comments', {query: commonQuery, body: inlineComment})
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-2', operation: 'create', document: inlineCommentDocument},
        ]),
      })
    scope
      .on('POST', '/v2026-07-18/collaboration/comments', {
        query: commonQuery,
        body: inlineWithFieldValue,
      })
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-3', operation: 'create', document: inlineCommentDocument},
        ]),
      })

    const {comments} = getMockClient().collaboration
    const field = await comments.create(fieldComment)
    const inline = await comments.create(inlineComment)
    const inlineFieldValue = await comments.create(inlineWithFieldValue)

    expect(field.target.path, 'a field comment stores the path, and no selection').toEqual({
      field: 'title',
    })
    expect(inline.target.path, 'an inline comment stores a marker-wrapped selection').toEqual({
      field: 'body',
      selection: {type: 'text', value: [{_key: 'block-1', text: 'Hello \uF000World\uF001 again'}]},
    })
    expect(inline.contentSnapshot, 'the snapshot holds the selected fragment').toEqual([
      {
        _type: 'block',
        _key: 'block-1',
        children: [{_type: 'span', _key: 'block-1', text: 'World'}],
      },
    ])
    expect(inlineFieldValue.target.path).toEqual(inline.target.path)
  })

  test('updates the message of an existing comment', async () => {
    const edited = [{_type: 'block', children: [{_type: 'span', text: 'Edited'}]}]
    const editedDocument: CollaborationCommentDocument = {
      ...commentDocument,
      message: edited,
      lastEditedAt: '2026-07-22T10:15:00.000Z',
    }

    getActiveMock()
      .scope(apiHost)
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
        query: commonQuery,
        body: {message: edited},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: editedDocument}]),
      })

    await expect(
      getMockClient().collaboration.comments.update('comment-1', {message: edited}),
    ).resolves.toEqual(editedDocument)
  })

  test('updates and clears the range of an existing comment', async () => {
    const range = {
      start: {_key: 'block-1', offset: 0},
      end: {_key: 'block-1', offset: 12},
    }
    const fieldValue = [
      {
        _type: 'block',
        _key: 'block-1',
        children: [{_type: 'span', text: 'Hello World again'}],
      },
    ]

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
        query: commonQuery,
        body: {range},
      })
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-1', operation: 'update', document: inlineCommentDocument},
        ]),
      })
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
        query: commonQuery,
        body: {range, fieldValue},
      })
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-1', operation: 'update', document: inlineCommentDocument},
        ]),
      })
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
        query: commonQuery,
        body: {range: null},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })

    const client = getMockClient()
    await expect(client.collaboration.comments.update('comment-1', {range})).resolves.toEqual(
      inlineCommentDocument,
    )
    await expect(
      client.collaboration.comments.update('comment-1', {range, fieldValue}),
    ).resolves.toEqual(inlineCommentDocument)
    await expect(client.collaboration.comments.update('comment-1', {range: null})).resolves.toEqual(
      commentDocument,
    )
  })

  test('uses resource query parameters', async () => {
    const resources = [
      {type: 'canvas' as const, id: 'canvas-123'},
      {type: 'dataset' as const, id: 'project-123.production'},
    ]

    for (const currentResource of resources) {
      getActiveMock()
        .scope(apiHost)
        .on('POST', '/v2026-07-18/collaboration/comments', {
          query: {
            organizationId,
            resourceId: currentResource.id,
            resourceType: currentResource.type,
          },
        })
        .respond({
          status: 200,
          body: mutationResponse([
            {id: 'comment-1', operation: 'create', document: commentDocument},
          ]),
        })

      await getMockClient({resource: currentResource}).collaboration.comments.create({
        target: {
          documentId: 'doc-1',
          documentType: 'article',
        },
        message,
      })
    }

    expect(
      getActiveMock()
        .getRequests()
        .map((request) => request.query.resourceId),
    ).toEqual(['canvas-123', 'project-123.production'])
  })

  test('maps update, delete, and reaction requests', async () => {
    const client = getMockClient()
    const resolved: CollaborationCommentDocument = {...commentDocument, status: 'resolved'}
    const reacted: CollaborationCommentDocument = {
      ...commentDocument,
      reactions: [
        {
          _key: 'key-1',
          shortName: ':heart:',
          userId: 'user-1',
          addedAt: '2026-07-22T09:58:00.000Z',
        },
      ],
    }

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment%2F1', {
        query: commonQuery,
        body: {status: 'resolved'},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment/1', operation: 'update', document: resolved}]),
      })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment%2F1', {query: commonQuery})
      .respond({status: 200, body: mutationResponse([{id: 'comment/1', operation: 'delete'}])})
    scope
      .on('POST', '/v2026-07-18/collaboration/comments/comment%2F1/reactions', {
        query: commonQuery,
        body: {shortName: ':heart:'},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment/1', operation: 'update', document: reacted}]),
      })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment%2F1/reactions/%3Aheart%3A', {
        query: commonQuery,
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment/1', operation: 'update', document: commentDocument}]),
      })

    await expect(
      client.collaboration.comments.update('comment/1', {status: 'resolved'}),
    ).resolves.toEqual(resolved)
    await expect(client.collaboration.comments.delete('comment/1')).resolves.toEqual({
      transactionId: 'txn-1',
      documentIds: ['comment/1'],
      results: [{id: 'comment/1', operation: 'delete'}],
    })
    await expect(
      client.collaboration.comments.addReaction('comment/1', ':heart:'),
    ).resolves.toEqual(reacted)
    await expect(
      client.collaboration.comments.removeReaction('comment/1', ':heart:'),
    ).resolves.toEqual(commentDocument)
  })

  test('forwards the transaction id on every write', async () => {
    const client = getMockClient()
    const query = {...commonQuery, transactionId: 'txn-123'}
    const options = {transactionId: 'txn-123'}

    const scope = getActiveMock().scope(apiHost)
    scope.on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {query}).respond({
      status: 200,
      body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
    })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1', {query})
      .respond({status: 200, body: mutationResponse([{id: 'comment-1', operation: 'delete'}])})
    scope.on('POST', '/v2026-07-18/collaboration/comments/comment-1/reactions', {query}).respond({
      status: 200,
      body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
    })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1/reactions/%3Aheart%3A', {query})
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })

    await client.collaboration.comments.update('comment-1', {status: 'resolved'}, options)
    await client.collaboration.comments.delete('comment-1', options)
    await client.collaboration.comments.addReaction('comment-1', ':heart:', options)
    await client.collaboration.comments.removeReaction('comment-1', ':heart:', options)

    expect(
      getActiveMock()
        .getRequests()
        .map((request) => request.query.transactionId),
    ).toEqual(['txn-123', 'txn-123', 'txn-123', 'txn-123'])
  })

  test('applies the request tag prefix on every write and on fetch', async () => {
    const client = getMockClient({requestTagPrefix: 'comments'})
    const groq = '*[_type == "sanity.comment"]'

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
        query: {...commonQuery, tag: 'comments.update'},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1', {
        query: {...commonQuery, tag: 'comments.delete'},
      })
      .respond({status: 200, body: mutationResponse([{id: 'comment-1', operation: 'delete'}])})
    scope
      .on('POST', '/v2026-07-18/collaboration/comments/comment-1/reactions', {
        query: {...commonQuery, tag: 'comments.react'},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1/reactions/%3Aheart%3A', {
        query: {...commonQuery, tag: 'comments.unreact'},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })
    scope
      .on('GET', '/v2026-07-18/collaboration/comments/query', {
        query: {...commonQuery, query: groq, tag: 'comments.fetch'},
      })
      .respond({status: 200, body: {result: []}})

    const {comments} = client.collaboration
    await comments.update('comment-1', {status: 'resolved'}, {tag: 'update'})
    await comments.delete('comment-1', {tag: 'delete'})
    await comments.addReaction('comment-1', ':heart:', {tag: 'react'})
    await comments.removeReaction('comment-1', ':heart:', {tag: 'unreact'})
    await comments.fetch(groq, undefined, {tag: 'fetch'})

    expect(
      getActiveMock()
        .getRequests()
        .map((request) => request.query.tag),
    ).toEqual([
      'comments.update',
      'comments.delete',
      'comments.react',
      'comments.unreact',
      'comments.fetch',
    ])
  })

  // A status change is a patch on the comment plus a query-based patch on its
  // replies, and the API does not order the results of the two, so the comment
  // has to be picked out by id rather than taken from the front.
  test.each([
    ['comment first', ['comment-1', 'reply-1']],
    ['reply first', ['reply-1', 'comment-1']],
  ])(
    'returns the comment when a status change cascades to replies (%s)',
    async (_, [firstId, secondId]) => {
      const resolved: CollaborationCommentDocument = {...commentDocument, status: 'resolved'}
      const resolvedReply: CollaborationCommentDocument = {...replyDocument, status: 'resolved'}
      const documents: Record<string, CollaborationCommentDocument> = {
        'comment-1': resolved,
        'reply-1': resolvedReply,
      }

      getActiveMock()
        .scope(apiHost)
        .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
          query: commonQuery,
          body: {status: 'resolved'},
        })
        .respond({
          status: 200,
          body: mutationResponse(
            [firstId, secondId].map((id) => ({
              id,
              operation: 'update' as const,
              document: documents[id],
            })),
          ),
        })

      await expect(
        getMockClient().collaboration.comments.update('comment-1', {status: 'resolved'}),
      ).resolves.toEqual(resolved)
    },
  )

  test('rejects when a write response carries only replies', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond({
        status: 200,
        body: mutationResponse([{id: 'reply-1', operation: 'update', document: replyDocument}]),
      })

    await expect(
      getMockClient().collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).rejects.toThrow('Comment write did not return a comment document')
  })

  test('returns the deleted comment and reply ids', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-1', operation: 'delete'},
          {id: 'reply-1', operation: 'delete'},
        ]),
      })

    await expect(getMockClient().collaboration.comments.delete('comment-1')).resolves.toEqual({
      transactionId: 'txn-1',
      documentIds: ['comment-1', 'reply-1'],
      results: [
        {id: 'comment-1', operation: 'delete'},
        {id: 'reply-1', operation: 'delete'},
      ],
    })
  })

  test('resolves delete with no document ids when nothing matched', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond({status: 200, body: mutationResponse([])})

    await expect(getMockClient().collaboration.comments.delete('comment-1')).resolves.toEqual({
      transactionId: 'txn-1',
      documentIds: [],
      results: [],
    })
  })

  test('rejects when a write response carries no comment document', async () => {
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond({status: 200, body: mutationResponse([])})
    scope
      .on('POST', '/v2026-07-18/collaboration/comments/comment-1/reactions', {query: commonQuery})
      .respond({status: 200, body: mutationResponse([{id: 'comment-1', operation: 'update'}])})

    const client = getMockClient()

    await expect(
      client.collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).rejects.toThrow('Comment write did not return a comment document')
    await expect(client.collaboration.comments.addReaction('comment-1', ':heart:')).rejects.toThrow(
      'Comment write did not return a comment document',
    )
  })

  test('rejects when a write does not match a comment', async () => {
    const notFound = {
      status: 404,
      body: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Comment comment-1 not found',
      },
    }

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond(notFound)
    scope
      .on('POST', '/v2026-07-18/collaboration/comments/comment-1/reactions', {query: commonQuery})
      .respond(notFound)
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1/reactions/%3Aheart%3A', {
        query: commonQuery,
      })
      .respond(notFound)

    const client = getMockClient()

    await expect(
      client.collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).rejects.toThrow('Comment comment-1 not found')
    await expect(client.collaboration.comments.addReaction('comment-1', ':heart:')).rejects.toThrow(
      'Comment comment-1 not found',
    )
    await expect(
      client.collaboration.comments.removeReaction('comment-1', ':heart:'),
    ).rejects.toThrow('Comment comment-1 not found')
  })

  test('fetches comment documents with a GROQ query and params', async () => {
    const comments: CollaborationCommentDocument[] = [commentDocument]
    const query =
      '*[_type == "sanity.comment" && target.document._ref == $ref] | order(_createdAt desc)[0...50]'

    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-07-18/collaboration/comments/query', {
        query: {
          ...commonQuery,
          $ref: JSON.stringify('canvas:canvas-123:doc-1'),
          query,
        },
      })
      .respond({status: 200, body: {result: comments}})

    await expect(
      getMockClient().collaboration.comments.fetch<CollaborationCommentDocument[]>(query, {
        ref: 'canvas:canvas-123:doc-1',
      }),
    ).resolves.toEqual(comments)
  })

  test('fetches comments with a projection', async () => {
    const query =
      '{"open": *[_type == "sanity.comment" && status == "open" && target.document._ref == $ref]}'

    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-07-18/collaboration/comments/query', {
        query: {
          ...commonQuery,
          $ref: JSON.stringify('canvas:canvas-123:doc-1'),
          query,
        },
      })
      .respond({status: 200, body: {result: {open: []}}})

    await expect(
      getMockClient().collaboration.comments.fetch<{open: CollaborationCommentDocument[]}>(query, {
        ref: 'canvas:canvas-123:doc-1',
      }),
    ).resolves.toEqual({open: []})
  })

  test('forwards token and header request options', async () => {
    const query = '*[_type == "sanity.comment"]'
    const headers = {Authorization: 'Bearer request-token', 'x-custom': 'yes'}

    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', '/v2026-07-18/collaboration/comments/query', {
        query: {...commonQuery, query},
        headers,
      })
      .respond({status: 200, body: {result: []}})
    scope.on('POST', '/v2026-07-18/collaboration/comments', {query: commonQuery, headers}).respond({
      status: 200,
      body: mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
    })

    const client = getMockClient({token: 'config-token'})
    const options = {token: 'request-token', headers: {'x-custom': 'yes'}}

    await expect(client.collaboration.comments.fetch(query, undefined, options)).resolves.toEqual(
      [],
    )
    await expect(
      client.collaboration.comments.create(
        {target: {documentId: 'doc-1', documentType: 'article'}, message},
        options,
      ),
    ).resolves.toEqual(commentDocument)
  })

  test('honors the timeout request option', async () => {
    const query = '*[_type == "sanity.comment"]'

    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-07-18/collaboration/comments/query', {query: {...commonQuery, query}})
      .respond({status: 200, body: {result: []}, delay: 250})

    const error = await getMockClient()
      .collaboration.comments.fetch(query, undefined, {timeout: 25})
      .then(
        () => null,
        (err) => err,
      )

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TimeoutError')
  })

  test('cancels a fetch with an abort controller signal', async () => {
    expect.assertions(2)

    const query = '*[_type == "sanity.comment"]'

    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-07-18/collaboration/comments/query', {query: {...commonQuery, query}})
      .respond({status: 200, body: {result: []}, delay: 100})

    const abortController = new AbortController()
    const promise = getMockClient().collaboration.comments.fetch(query, undefined, {
      signal: abortController.signal,
    })
    await new Promise((resolve) => setTimeout(resolve, 10))

    try {
      abortController.abort()
      await promise
    } catch (err: any) {
      if (err.name === 'AssertionError') throw err
      expect(err).toBeInstanceOf(Error)
      expect(err.name, 'should throw AbortError').toBe('AbortError')
    }
  })

  test('cancels a write with an abort controller signal', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments', {query: commonQuery})
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
        delay: 100,
      })

    const abortController = new AbortController()
    const promise = getMockClient().collaboration.comments.create(
      {target: {documentId: 'doc-1', documentType: 'article'}, message},
      {signal: abortController.signal},
    )
    await new Promise((resolve) => setTimeout(resolve, 10))

    try {
      abortController.abort()
      await promise
    } catch (err: any) {
      if (err.name === 'AssertionError') throw err
      expect(err).toBeInstanceOf(Error)
      expect(err.name, 'should throw AbortError').toBe('AbortError')
    }
  })

  test('throws when collaboration.organizationId or resource/project config is missing', () => {
    const query = '*[_type == "sanity.comment"]'
    const withoutOrg = getMockClient({collaboration: {organizationId: undefined}})
    const withoutResource = getMockClient({resource: undefined})
    const orgError =
      '`collaboration.organizationId` must be configured to use collaboration comments'
    const resourceError =
      '`resource` or `projectId` and `dataset` must be configured to use collaboration comments'

    expect(() => withoutOrg.collaboration.comments.fetch(query)).toThrow(orgError)
    expect(() => withoutOrg.collaboration.comments.listen(query)).toThrow(orgError)
    expect(() =>
      withoutOrg.collaboration.comments.create({
        target: {documentId: 'doc-1', documentType: 'article'},
        message,
      }),
    ).toThrow(orgError)
    expect(() =>
      withoutOrg.collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).toThrow(orgError)
    expect(() => withoutOrg.collaboration.comments.delete('comment-1')).toThrow(orgError)
    expect(() => withoutOrg.collaboration.comments.addReaction('comment-1', ':heart:')).toThrow(
      orgError,
    )
    expect(() => withoutOrg.collaboration.comments.removeReaction('comment-1', ':heart:')).toThrow(
      orgError,
    )

    expect(() => withoutResource.collaboration.comments.fetch(query)).toThrow(resourceError)
    expect(() => withoutResource.collaboration.comments.listen(query)).toThrow(resourceError)
    expect(() =>
      withoutResource.collaboration.comments.create({
        target: {documentId: 'doc-1', documentType: 'article'},
        message,
      }),
    ).toThrow(resourceError)
  })

  test('derives dataset resource and uses the project API domain without an explicit resource', async () => {
    const projectId = 'project-123'
    const dataset = 'production'
    const projectQuery = {
      organizationId,
      resourceId: `${projectId}.${dataset}`,
      resourceType: 'dataset',
    }
    const datasetComment: CollaborationCommentDocument = {
      ...commentDocument,
      target: {
        ...commentDocument.target,
        document: {
          ...commentDocument.target.document,
          _ref: `dataset:${projectId}.${dataset}:doc-1`,
        },
      },
    }

    getActiveMock()
      .scope(projectHost(projectId))
      .on('POST', '/v2026-07-18/collaboration/comments', {
        query: projectQuery,
        body: {target: {documentId: 'doc-1', documentType: 'article'}, message},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'create', document: datasetComment}]),
      })

    const client = getMockClient({
      projectId,
      dataset,
      resource: undefined,
      useProjectHostname: true,
    })

    await expect(
      client.collaboration.comments.create({
        target: {documentId: 'doc-1', documentType: 'article'},
        message,
      }),
    ).resolves.toEqual(datasetComment)

    expect(client.collaboration.comments.getTargetDocumentRef('drafts.doc-1')).toBe(
      `dataset:${projectId}.${dataset}:doc-1`,
    )
  })

  test('uses an explicit resource over projectId/dataset and stays on the global API host', async () => {
    const projectId = 'project-123'
    const dataset = 'production'

    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments', {
        query: commonQuery,
        body: {target: {documentId: 'doc-1', documentType: 'article'}, message},
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
      })

    const client = getMockClient({
      projectId,
      dataset,
      resource,
      useProjectHostname: true,
    })

    await expect(
      client.collaboration.comments.create({
        target: {documentId: 'doc-1', documentType: 'article'},
        message,
      }),
    ).resolves.toEqual(commentDocument)

    expect(client.collaboration.comments.getTargetDocumentRef('doc-1')).toBe(
      'canvas:canvas-123:doc-1',
    )
  })

  test('throws when the comment ID is empty', () => {
    const client = getMockClient()

    expect(() => client.collaboration.comments.update('', {status: 'resolved'})).toThrow(
      'Comment ID must be provided',
    )
    expect(() => client.collaboration.comments.delete('')).toThrow('Comment ID must be provided')
    expect(() => client.collaboration.comments.addReaction('', ':heart:')).toThrow(
      'Comment ID must be provided',
    )
    expect(() => client.collaboration.comments.removeReaction('', ':heart:')).toThrow(
      'Comment ID must be provided',
    )
  })

  test('builds target document references from the configured resource', () => {
    const {comments} = getMockClient().collaboration

    expect(comments.getTargetDocumentRef('doc-1')).toBe('canvas:canvas-123:doc-1')
    expect(
      getMockClient({
        resource: {type: 'dataset', id: 'project-123.production'},
      }).collaboration.comments.getTargetDocumentRef('doc-1'),
    ).toBe('dataset:project-123.production:doc-1')
  })

  test('normalizes draft and version ids in target document references', () => {
    const {comments} = getMockClient().collaboration

    expect(comments.getTargetDocumentRef('drafts.doc-1')).toBe('canvas:canvas-123:doc-1')
    expect(comments.getTargetDocumentRef('versions.summer-drop.doc-1')).toBe(
      'canvas:canvas-123:doc-1',
    )
  })

  test('keeps dots in the published part of a target document reference', () => {
    const {comments} = getMockClient().collaboration

    expect(comments.getTargetDocumentRef('foo.doc-1')).toBe('canvas:canvas-123:foo.doc-1')
    expect(comments.getTargetDocumentRef('drafts.foo.doc-1')).toBe('canvas:canvas-123:foo.doc-1')
    expect(comments.getTargetDocumentRef('versions.summer-drop.foo.doc-1')).toBe(
      'canvas:canvas-123:foo.doc-1',
    )
  })

  test('builds target document references without a collaboration.organizationId', () => {
    const {comments} = getMockClient({collaboration: {organizationId: undefined}}).collaboration

    expect(comments.getTargetDocumentRef('doc-1')).toBe('canvas:canvas-123:doc-1')
  })

  test('throws when building a target document reference without a resource or id', () => {
    expect(() =>
      getMockClient({resource: undefined}).collaboration.comments.getTargetDocumentRef('doc-1'),
    ).toThrow(
      '`resource` or `projectId` and `dataset` must be configured to use collaboration comments',
    )
    expect(() => getMockClient().collaboration.comments.getTargetDocumentRef('')).toThrow(
      'Document ID must be provided',
    )
  })

  test('builds target document references from projectId and dataset', () => {
    const comments = getMockClient({
      projectId: 'project-123',
      dataset: 'production',
      resource: undefined,
      useProjectHostname: true,
    }).collaboration.comments

    expect(comments.getTargetDocumentRef('doc-1')).toBe('dataset:project-123.production:doc-1')
    expect(comments.getTargetDocumentRef('drafts.doc-1')).toBe(
      'dataset:project-123.production:doc-1',
    )
  })

  test('builds target document references from the observable namespace', () => {
    const {comments} = getMockClient().observable.collaboration

    expect(comments.getTargetDocumentRef('drafts.doc-1')).toBe('canvas:canvas-123:doc-1')
  })

  test('rejects listener queries that exceed the max URL length', async () => {
    const query = `*[_type == "sanity.comment" && title == "${'x'.repeat(20000)}"]`

    await expect(
      firstValueFrom(getMockClient().collaboration.comments.listen(query)),
    ).rejects.toThrow('Query too large for listener')
  })

  /**
   * Builds a query whose encoded query string is exactly `target` characters,
   * to pin the tests either side of the GET/POST switchover. `x` survives
   * form-encoding unchanged, so each padding character adds exactly one.
   */
  const queryOfEncodedLength = (target: number) => {
    const build = (padding: number) =>
      `*[_type == "sanity.comment" && title == "${'x'.repeat(padding)}"]`
    return build(target - `?${new URLSearchParams({query: build(0)})}`.length)
  }

  test('sends a query that still fits in the URL as a GET', async () => {
    const query = queryOfEncodedLength(11263)

    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-07-18/collaboration/comments/query', {query: {...commonQuery, query}})
      .respond({status: 200, body: {result: []}})

    await expect(getMockClient().collaboration.comments.fetch(query)).resolves.toEqual([])
  })

  test('falls back to a POST for a query too large for the URL', async () => {
    const query = queryOfEncodedLength(11264)

    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments/query', {
        query: commonQuery,
        body: {query, params: {}},
      })
      .respond({status: 200, body: {result: []}})

    await expect(getMockClient().collaboration.comments.fetch(query)).resolves.toEqual([])
  })

  test('moves params into the body when falling back to a POST', async () => {
    const query = `*[_type == "sanity.comment" && target.document._ref == $ref && title == "${'x'.repeat(20000)}"]`
    const params = {ref: 'canvas:canvas-123:doc-1'}

    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-07-18/collaboration/comments/query', {
        query: commonQuery,
        body: {query, params},
      })
      .respond({status: 200, body: {result: [commentDocument]}})

    await expect(getMockClient().collaboration.comments.fetch(query, params)).resolves.toEqual([
      commentDocument,
    ])
  })

  test('supports the observable comments namespace', async () => {
    const scope = getActiveMock().scope(apiHost)
    scope
      .on('GET', '/v2026-07-18/collaboration/comments/query', {
        query: {...commonQuery, query: '*[_type == "sanity.comment"]'},
      })
      .respond({status: 200, body: {result: []}})
    scope.on('POST', '/v2026-07-18/collaboration/comments', {query: commonQuery}).respond({
      status: 200,
      body: mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
    })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond({status: 200, body: mutationResponse([{id: 'comment-1', operation: 'delete'}])})
    scope
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {query: commonQuery})
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })
    scope
      .on('POST', '/v2026-07-18/collaboration/comments/comment-1/reactions', {query: commonQuery})
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })
    scope
      .on('DELETE', '/v2026-07-18/collaboration/comments/comment-1/reactions/%3Aheart%3A', {
        query: commonQuery,
      })
      .respond({
        status: 200,
        body: mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      })

    const {comments} = getMockClient().observable.collaboration

    await expect(firstValueFrom(comments.fetch('*[_type == "sanity.comment"]'))).resolves.toEqual(
      [],
    )
    await expect(
      firstValueFrom(
        comments.create({
          target: {documentId: 'doc-1', documentType: 'article'},
          message,
        }),
      ),
    ).resolves.toEqual(commentDocument)
    await expect(firstValueFrom(comments.delete('comment-1'))).resolves.toEqual({
      transactionId: 'txn-1',
      documentIds: ['comment-1'],
      results: [{id: 'comment-1', operation: 'delete'}],
    })
    await expect(
      firstValueFrom(comments.update('comment-1', {status: 'resolved'})),
    ).resolves.toEqual(commentDocument)
    await expect(firstValueFrom(comments.addReaction('comment-1', ':heart:'))).resolves.toEqual(
      commentDocument,
    )
    await expect(firstValueFrom(comments.removeReaction('comment-1', ':heart:'))).resolves.toEqual(
      commentDocument,
    )
  })
})
describe('collaboration.comments.listen', () => {
  const listenPath = '/v2026-07-18/collaboration/comments/listen'
  const query = '*[_type == "sanity.comment" && target.document._ref == $ref]'
  const params = {ref: 'canvas:canvas-123:doc-1'}

  const frame = (event: string, data: unknown = {}) => encode({event, data: JSON.stringify(data)})

  /** A listener connection that stays open, like a real one, until the client closes it. */
  const connection = (...frames: string[]) => ({
    status: 200,
    body: streamBody(...frames, streamStall()),
    headers: {'content-type': 'text/event-stream; charset=utf-8'},
  })

  test('opens an EventSource with resource query parameters', async () => {
    expect.assertions(3)

    const mutation = {
      documentId: 'comment-1',
      eventId: 'event-1',
      identity: 'user-1',
      mutations: [],
      timestamp: '2026-07-22T09:58:00.000Z',
      transactionCurrentEvent: 0,
      transactionId: 'txn-1',
      transactionTotalEvents: 1,
      transition: 'appear',
      visibility: 'query',
    }

    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(connection(frame('mutation', mutation)))

    const client = getMockClient({requestTagPrefix: 'comments', token: 'token-123'})

    const event = await firstValueFrom(
      client.collaboration.comments.listen(query, params, {includeResult: true, tag: 'listen'}),
    )

    expect(event).toEqual({type: 'mutation', ...mutation})

    const [request] = getActiveMock().getRequests()
    expect(request.query).toEqual({
      $ref: JSON.stringify(params.ref),
      includeResult: 'true',
      organizationId,
      query,
      resourceId: resource.id,
      resourceType: resource.type,
      tag: 'comments.listen',
    })
    expect(request).toHaveHeader('authorization', 'Bearer token-123')
  })

  test('forwards configured headers to the listen endpoint', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(connection(frame('mutation', {documentId: 'comment-1'})))

    const client = getMockClient({headers: {'x-custom': 'yes'}, token: 'token-123'})

    await firstValueFrom(client.collaboration.comments.listen('*[_type == "sanity.comment"]'))

    const [request] = getActiveMock().getRequests()
    expect(request).toHaveHeader('authorization', 'Bearer token-123')
    expect(request).toHaveHeader('x-custom', 'yes')
  })

  test('listens without listener options', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(connection(frame('mutation', {documentId: 'comment-1'})))

    await firstValueFrom(getMockClient().collaboration.comments.listen(query, params))

    const [request] = getActiveMock().getRequests()
    expect(request.query).toEqual({
      $ref: JSON.stringify(params.ref),
      includeResult: 'true',
      organizationId,
      query,
      resourceId: resource.id,
      resourceType: resource.type,
    })
  })

  test('emits the events opted into, and filters out the rest', async () => {
    expect.assertions(2)

    // Two successive connections: the handlers are one-shot and served in
    // registration order, so the second listen() call gets the same frames.
    const frames = [
      frame('welcome', {listenerName: 'listener-1'}),
      frame('mutation', {documentId: 'comment-1'}),
    ]
    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(connection(...frames))
      .respond(connection(...frames))

    const client = getMockClient()
    const commentQuery = '*[_type == "sanity.comment"]'

    const optedIn = await lastValueFrom(
      client.collaboration.comments
        .listen(commentQuery, undefined, {events: ['welcome', 'mutation']})
        .pipe(take(2), toArray()),
    )
    expect(optedIn).toEqual([
      {type: 'welcome', listenerName: 'listener-1'},
      {type: 'mutation', documentId: 'comment-1'},
    ])

    // The welcome event is still sent, but only mutations are emitted by default
    await expect(
      firstValueFrom(client.collaboration.comments.listen(commentQuery)),
    ).resolves.toEqual({
      type: 'mutation',
      documentId: 'comment-1',
    })
  })

  test('forwards listener options to the listen endpoint', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(connection(frame('welcome', {listenerName: 'listener-1'})))

    await firstValueFrom(
      getMockClient().collaboration.comments.listen('*[_type == "sanity.comment"]', undefined, {
        effectFormat: 'mendoza',
        enableResume: true,
        events: ['welcome'],
        visibility: 'query',
      }),
    )

    const [request] = getActiveMock().getRequests()
    expect(request.query).toMatchObject({
      effectFormat: 'mendoza',
      enableResume: 'true',
      visibility: 'query',
    })
  })

  test('emits resumable listener events', async () => {
    expect.assertions(1)

    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(
        connection(
          frame('welcome', {listenerName: 'listener-1'}),
          frame('mutation', {documentId: 'comment-1'}),
        ),
      )

    const events = await lastValueFrom(
      getMockClient()
        .collaboration.comments.listen('*[_type == "sanity.comment"]', undefined, {
          enableResume: true,
          events: ['welcome', 'mutation'],
        })
        .pipe(take(2), toArray()),
    )

    expect(events).toEqual([
      {type: 'welcome', listenerName: 'listener-1'},
      {type: 'mutation', documentId: 'comment-1'},
    ])
  })

  test('listens from the observable namespace', async () => {
    expect.assertions(2)

    getActiveMock()
      .scope(apiHost)
      .on('GET', listenPath)
      .respond(connection(frame('mutation', {documentId: 'comment-1'})))

    await expect(
      firstValueFrom(
        getMockClient().observable.collaboration.comments.listen('*[_type == "sanity.comment"]'),
      ),
    ).resolves.toEqual({type: 'mutation', documentId: 'comment-1'})

    expect(getActiveMock()).toHaveReceivedRequest('GET', listenPath)
  })
})
