import type {AddressInfo} from 'node:net'

import {type ClientConfig, type CollaborationCommentDocument, createClient} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {createSseServer} from './helpers/sseServer'

const apiHost = 'https://api.sanity.url'
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

/** The write endpoints pass the org-store mutate envelope through as-is. */
const mutationResponse = (
  results: {
    id: string
    operation: 'create' | 'update' | 'delete'
    document?: CollaborationCommentDocument
  }[],
) => ({transactionId: 'txn-1', results})

const getClient = (config: Partial<ClientConfig> = {}) =>
  createClient({
    apiHost,
    apiVersion: '2026-07-18',
    organizationId,
    resource,
    useCdn: false,
    useProjectHostname: false,
    ...config,
  })

describe('collaboration.comments', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  test.skipIf(isEdge)(
    'creates comments with resource query parameters and write options',
    async () => {
      let capturedBody: unknown

      nock(apiHost)
        .post('/v2026-07-18/collaboration/comments', (body) => {
          capturedBody = body
          return true
        })
        .query({
          organizationId,
          resourceId: resource.id,
          resourceType: resource.type,
          tag: 'comments.create',
          transactionId: 'txn-123',
        })
        .reply(
          200,
          mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
        )

      const client = getClient({requestTagPrefix: 'comments'})

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

      expect(capturedBody).toEqual({
        target: {
          documentId: 'doc-1',
          documentType: 'article',
        },
        message,
      })
      expect(created).toEqual(commentDocument)
    },
  )

  test.skipIf(isEdge)('creates replies with parentCommentId', async () => {
    let capturedBody: unknown

    nock(apiHost)
      .post('/v2026-07-18/collaboration/comments', (body) => {
        capturedBody = body
        return true
      })
      .query({
        organizationId,
        resourceId: resource.id,
        resourceType: resource.type,
      })
      .reply(200, mutationResponse([{id: 'reply-1', operation: 'create', document: replyDocument}]))

    const reply = await getClient().collaboration.comments.create({
      parentCommentId: 'comment-1',
      message,
    })

    expect(capturedBody).toEqual({
      parentCommentId: 'comment-1',
      message,
    })
    expect(reply).toEqual(replyDocument)
  })

  test.skipIf(isEdge)('uses resource query parameters', async () => {
    const resources = [
      {type: 'canvas' as const, id: 'canvas-123'},
      {type: 'dataset' as const, id: 'project-123.production'},
    ]

    for (const currentResource of resources) {
      nock(apiHost)
        .post('/v2026-07-18/collaboration/comments')
        .query({
          organizationId,
          resourceId: currentResource.id,
          resourceType: currentResource.type,
        })
        .reply(
          200,
          mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
        )

      await getClient({resource: currentResource}).collaboration.comments.create({
        target: {
          documentId: 'doc-1',
          documentType: 'article',
        },
        message,
      })
    }
  })

  const commonQuery = {
    organizationId,
    resourceId: resource.id,
    resourceType: resource.type,
  }

  test.skipIf(isEdge)('maps update, delete, and reaction requests', async () => {
    const client = getClient()
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

    nock(apiHost)
      .patch('/v2026-07-18/collaboration/comments/comment%2F1', {status: 'resolved'})
      .query(commonQuery)
      .reply(200, mutationResponse([{id: 'comment/1', operation: 'update', document: resolved}]))
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment%2F1')
      .query(commonQuery)
      .reply(200, mutationResponse([{id: 'comment/1', operation: 'delete'}]))
    nock(apiHost)
      .post('/v2026-07-18/collaboration/comments/comment%2F1/reactions', {shortName: ':heart:'})
      .query(commonQuery)
      .reply(200, mutationResponse([{id: 'comment/1', operation: 'update', document: reacted}]))
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment%2F1/reactions/%3Aheart%3A')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([{id: 'comment/1', operation: 'update', document: commentDocument}]),
      )

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

  test.skipIf(isEdge)('returns the comment when a status change cascades to replies', async () => {
    const resolved: CollaborationCommentDocument = {...commentDocument, status: 'resolved'}
    const resolvedReply: CollaborationCommentDocument = {...replyDocument, status: 'resolved'}

    nock(apiHost)
      .patch('/v2026-07-18/collaboration/comments/comment-1', {status: 'resolved'})
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([
          {id: 'comment-1', operation: 'update', document: resolved},
          {id: 'reply-1', operation: 'update', document: resolvedReply},
        ]),
      )

    await expect(
      getClient().collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).resolves.toEqual(resolved)
  })

  test.skipIf(isEdge)('returns the deleted comment and reply ids', async () => {
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment-1')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([
          {id: 'comment-1', operation: 'delete'},
          {id: 'reply-1', operation: 'delete'},
        ]),
      )

    await expect(getClient().collaboration.comments.delete('comment-1')).resolves.toEqual({
      transactionId: 'txn-1',
      documentIds: ['comment-1', 'reply-1'],
      results: [
        {id: 'comment-1', operation: 'delete'},
        {id: 'reply-1', operation: 'delete'},
      ],
    })
  })

  test.skipIf(isEdge)('resolves delete with no document ids when nothing matched', async () => {
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment-1')
      .query(commonQuery)
      .reply(200, mutationResponse([]))

    await expect(getClient().collaboration.comments.delete('comment-1')).resolves.toEqual({
      transactionId: 'txn-1',
      documentIds: [],
      results: [],
    })
  })

  test.skipIf(isEdge)('rejects when a write does not match a comment', async () => {
    const notFound = {
      statusCode: 404,
      error: 'Not Found',
      message: 'Comment comment-1 not found',
    }

    nock(apiHost)
      .patch('/v2026-07-18/collaboration/comments/comment-1')
      .query(commonQuery)
      .reply(404, notFound)
    nock(apiHost)
      .post('/v2026-07-18/collaboration/comments/comment-1/reactions')
      .query(commonQuery)
      .reply(404, notFound)
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment-1/reactions/%3Aheart%3A')
      .query(commonQuery)
      .reply(404, notFound)

    const client = getClient()

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

  test.skipIf(isEdge)('fetches comments with structured query options', async () => {
    const comments: CollaborationCommentDocument[] = [
      {
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
      },
    ]

    nock(apiHost)
      .get('/v2026-07-18/collaboration/comments/query')
      .query({
        $ref: JSON.stringify('canvas:canvas-123:doc-1'),
        organizationId,
        query:
          '*[_type == "sanity.comment" && (target.document._ref == $ref)] | order(_createdAt desc)[0...50]',
        resourceId: resource.id,
        resourceType: resource.type,
      })
      .reply(200, {result: comments})

    await expect(
      getClient().collaboration.comments.fetch({
        filter: 'target.document._ref == $ref',
        orderings: [{field: '_createdAt', direction: 'desc'}],
        params: {ref: 'canvas:canvas-123:doc-1'},
        slice: [0, 50],
      }),
    ).resolves.toEqual(comments)
  })

  test.skipIf(isEdge)('fetches comments with raw GROQ', async () => {
    nock(apiHost)
      .get('/v2026-07-18/collaboration/comments/query')
      .query({
        $ref: JSON.stringify('canvas:canvas-123:doc-1'),
        organizationId,
        query:
          '{"open": *[_type == "sanity.comment" && status == "open" && target.document._ref == $ref]}',
        resourceId: resource.id,
        resourceType: resource.type,
      })
      .reply(200, {result: {open: []}})

    await expect(
      getClient().collaboration.comments.fetch<{open: CollaborationCommentDocument[]}>(
        '{"open": *[_type == "sanity.comment" && status == "open" && target.document._ref == $ref]}',
        {ref: 'canvas:canvas-123:doc-1'},
      ),
    ).resolves.toEqual({open: []})
  })

  test.skipIf(isEdge)('builds the document ref from targetDocumentId', async () => {
    nock(apiHost)
      .get('/v2026-07-18/collaboration/comments/query')
      .query({
        organizationId,
        query:
          '*[_type == "sanity.comment" && target.document._ref == "canvas:canvas-123:doc-1" && (status == "open")]',
        resourceId: resource.id,
        resourceType: resource.type,
      })
      .reply(200, {result: []})

    await expect(
      getClient().collaboration.comments.fetch({
        targetDocumentId: 'drafts.doc-1',
        filter: 'status == "open"',
      }),
    ).resolves.toEqual([])
  })

  test('throws when organizationId or resource is missing', () => {
    expect(() => getClient({organizationId: undefined}).collaboration.comments.fetch()).toThrow(
      '`organizationId` must be configured to use collaboration comments',
    )
    expect(() => getClient({resource: undefined}).collaboration.comments.fetch()).toThrow(
      '`resource` must be configured to use collaboration comments',
    )
  })

  test('throws when the comment ID is empty', () => {
    const client = getClient()

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

  test('rejects queries that exceed the max URL length', async () => {
    await expect(
      getClient().collaboration.comments.fetch({filter: `title == "${'x'.repeat(20000)}"`}),
    ).rejects.toThrow('Query too large for request URL')

    await expect(
      firstValueFrom(
        getClient().collaboration.comments.listen({filter: `title == "${'x'.repeat(20000)}"`}),
      ),
    ).rejects.toThrow('Query too large for listener')
  })

  test.skipIf(isEdge)('supports the observable comments namespace', async () => {
    nock(apiHost)
      .get('/v2026-07-18/collaboration/comments/query')
      .query({
        organizationId,
        query: '*[_type == "sanity.comment"]',
        resourceId: resource.id,
        resourceType: resource.type,
      })
      .reply(200, {result: []})
    nock(apiHost)
      .post('/v2026-07-18/collaboration/comments')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
      )
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment-1')
      .query(commonQuery)
      .reply(200, mutationResponse([{id: 'comment-1', operation: 'delete'}]))
    nock(apiHost)
      .patch('/v2026-07-18/collaboration/comments/comment-1')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      )
    nock(apiHost)
      .post('/v2026-07-18/collaboration/comments/comment-1/reactions')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      )
    nock(apiHost)
      .delete('/v2026-07-18/collaboration/comments/comment-1/reactions/%3Aheart%3A')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([{id: 'comment-1', operation: 'update', document: commentDocument}]),
      )

    const {comments} = getClient().observable.collaboration

    await expect(firstValueFrom(comments.fetch())).resolves.toEqual([])
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

describe.skipIf(typeof EdgeRuntime === 'string' || typeof document !== 'undefined')(
  'collaboration.comments.listen',
  () => {
    test('opens an EventSource with resource query parameters', async () => {
      expect.assertions(4)

      const server = await createSseServer(({request, channel}) => {
        const [pathname, rawSearch = ''] = request.url!.split('?')
        const search = new URLSearchParams(rawSearch)

        expect(pathname).toBe('/v2026-07-18/collaboration/comments/listen')
        expect(Object.fromEntries(search)).toEqual({
          $ref: JSON.stringify('canvas:canvas-123:doc-1'),
          includeResult: 'true',
          organizationId,
          query: '*[_type == "sanity.comment" && (target.document._ref == $ref)]',
          resourceId: resource.id,
          resourceType: resource.type,
          tag: 'comments.listen',
        })
        expect(request.headers.authorization).toBe('Bearer token-123')

        channel!.send({
          event: 'mutation',
          data: {
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
          },
        })
        process.nextTick(() => channel!.close())
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        requestTagPrefix: 'comments',
        token: 'token-123',
      })

      const event = await firstValueFrom(
        client.collaboration.comments.listen(
          {
            filter: 'target.document._ref == $ref',
            params: {ref: 'canvas:canvas-123:doc-1'},
          },
          {
            includeResult: true,
            tag: 'listen',
          },
        ),
      )

      expect(event).toEqual({
        type: 'mutation',
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
      })
      server.close()
    })

    test('listens with a raw GROQ query and params', async () => {
      expect.assertions(2)

      const server = await createSseServer(({request, channel}) => {
        const [pathname, rawSearch = ''] = request.url!.split('?')
        const search = new URLSearchParams(rawSearch)

        expect(pathname).toBe('/v2026-07-18/collaboration/comments/listen')
        expect(Object.fromEntries(search)).toEqual({
          $ref: JSON.stringify('canvas:canvas-123:doc-1'),
          includeResult: 'true',
          organizationId,
          query: '*[_type == "sanity.comment" && target.document._ref == $ref]',
          resourceId: resource.id,
          resourceType: resource.type,
        })

        channel!.send({
          event: 'mutation',
          data: {documentId: 'comment-1'},
        })
        process.nextTick(() => channel!.close())
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      })

      await firstValueFrom(
        client.collaboration.comments.listen(
          '*[_type == "sanity.comment" && target.document._ref == $ref]',
          {ref: 'canvas:canvas-123:doc-1'},
        ),
      )

      server.close()
    })
  },
)
