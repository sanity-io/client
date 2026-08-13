import type {AddressInfo} from 'node:net'

import {type ClientConfig, type CollaborationCommentDocument, createClient} from '@sanity/client'
import {firstValueFrom, lastValueFrom, take, toArray} from 'rxjs'
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

  test.skipIf(isEdge)('rejects when a write response carries no comment document', async () => {
    nock(apiHost)
      .patch('/v2026-07-18/collaboration/comments/comment-1')
      .query(commonQuery)
      .reply(200, mutationResponse([]))
    nock(apiHost)
      .post('/v2026-07-18/collaboration/comments/comment-1/reactions')
      .query(commonQuery)
      .reply(200, mutationResponse([{id: 'comment-1', operation: 'update'}]))

    const client = getClient()

    await expect(
      client.collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).rejects.toThrow('Comment write did not return a comment document')
    await expect(client.collaboration.comments.addReaction('comment-1', ':heart:')).rejects.toThrow(
      'Comment write did not return a comment document',
    )
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

  test.skipIf(isEdge)('fetches comment documents with a GROQ query and params', async () => {
    const comments: CollaborationCommentDocument[] = [commentDocument]
    const query =
      '*[_type == "sanity.comment" && target.document._ref == $ref] | order(_createdAt desc)[0...50]'

    nock(apiHost)
      .get('/v2026-07-18/collaboration/comments/query')
      .query({
        $ref: JSON.stringify('canvas:canvas-123:doc-1'),
        organizationId,
        query,
        resourceId: resource.id,
        resourceType: resource.type,
      })
      .reply(200, {result: comments})

    await expect(
      getClient().collaboration.comments.fetch<CollaborationCommentDocument[]>(query, {
        ref: 'canvas:canvas-123:doc-1',
      }),
    ).resolves.toEqual(comments)
  })

  test.skipIf(isEdge)('fetches comments with a projection', async () => {
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

  test.skipIf(isEdge)('forwards token and header request options', async () => {
    const query = '*[_type == "sanity.comment"]'

    nock(apiHost)
      .matchHeader('authorization', 'Bearer request-token')
      .matchHeader('x-custom', 'yes')
      .get('/v2026-07-18/collaboration/comments/query')
      .query({...commonQuery, query})
      .reply(200, {result: []})
    nock(apiHost)
      .matchHeader('authorization', 'Bearer request-token')
      .matchHeader('x-custom', 'yes')
      .post('/v2026-07-18/collaboration/comments')
      .query(commonQuery)
      .reply(
        200,
        mutationResponse([{id: 'comment-1', operation: 'create', document: commentDocument}]),
      )

    const client = getClient({token: 'config-token'})
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

  test.skipIf(isEdge || typeof globalThis.AbortController === 'undefined')(
    'cancels a fetch with an abort controller signal',
    async () => {
      expect.assertions(2)

      const query = '*[_type == "sanity.comment"]'

      nock(apiHost)
        .get('/v2026-07-18/collaboration/comments/query')
        .query({...commonQuery, query})
        .delay(100)
        .reply(200, {result: []})

      const abortController = new AbortController()
      const promise = getClient().collaboration.comments.fetch(query, undefined, {
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
    },
  )

  test('throws when organizationId or resource is missing', () => {
    const query = '*[_type == "sanity.comment"]'

    expect(() =>
      getClient({organizationId: undefined}).collaboration.comments.fetch(query),
    ).toThrow('`organizationId` must be configured to use collaboration comments')
    expect(() => getClient({resource: undefined}).collaboration.comments.fetch(query)).toThrow(
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

  test('builds target document references from the configured resource', () => {
    const {comments} = getClient().collaboration

    expect(comments.getTargetDocumentRef('doc-1')).toBe('canvas:canvas-123:doc-1')
    expect(
      getClient({
        resource: {type: 'dataset', id: 'project-123.production'},
      }).collaboration.comments.getTargetDocumentRef('doc-1'),
    ).toBe('dataset:project-123.production:doc-1')
  })

  test('normalizes draft and version ids in target document references', () => {
    const {comments} = getClient().collaboration

    expect(comments.getTargetDocumentRef('drafts.doc-1')).toBe('canvas:canvas-123:doc-1')
    expect(comments.getTargetDocumentRef('versions.summer-drop.doc-1')).toBe(
      'canvas:canvas-123:doc-1',
    )
  })

  test('throws when building a target document reference without a resource or id', () => {
    expect(() =>
      getClient({resource: undefined}).collaboration.comments.getTargetDocumentRef('doc-1'),
    ).toThrow('`resource` must be configured to use collaboration comments')
    expect(() => getClient().collaboration.comments.getTargetDocumentRef('')).toThrow(
      'Document ID must be provided',
    )
  })

  test('builds target document references from the observable namespace', () => {
    const {comments} = getClient().observable.collaboration

    expect(comments.getTargetDocumentRef('drafts.doc-1')).toBe('canvas:canvas-123:doc-1')
  })

  test('rejects queries that exceed the max URL length', async () => {
    const query = `*[_type == "sanity.comment" && title == "${'x'.repeat(20000)}"]`

    await expect(getClient().collaboration.comments.fetch(query)).rejects.toThrow(
      'Query too large for request URL',
    )

    await expect(firstValueFrom(getClient().collaboration.comments.listen(query))).rejects.toThrow(
      'Query too large for listener',
    )
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
          query: '*[_type == "sanity.comment" && target.document._ref == $ref]',
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
          '*[_type == "sanity.comment" && target.document._ref == $ref]',
          {ref: 'canvas:canvas-123:doc-1'},
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

    test('listens without listener options', async () => {
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

    test('emits the events opted into, and filters out the rest', async () => {
      expect.assertions(2)

      const server = await createSseServer(({channel}) => {
        channel!.send({event: 'welcome', data: {listenerName: 'listener-1'}})
        channel!.send({event: 'mutation', data: {documentId: 'comment-1'}})
        process.nextTick(() => channel!.close())
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      })
      const query = '*[_type == "sanity.comment"]'

      const optedIn = await lastValueFrom(
        client.collaboration.comments
          .listen(query, undefined, {events: ['welcome', 'mutation']})
          .pipe(take(2), toArray()),
      )
      expect(optedIn).toEqual([
        {type: 'welcome', listenerName: 'listener-1'},
        {type: 'mutation', documentId: 'comment-1'},
      ])

      // The welcome event is still sent, but only mutations are emitted by default
      await expect(firstValueFrom(client.collaboration.comments.listen(query))).resolves.toEqual({
        type: 'mutation',
        documentId: 'comment-1',
      })

      server.close()
    })

    test('forwards listener options to the listen endpoint', async () => {
      expect.assertions(2)

      const server = await createSseServer(({request, channel}) => {
        const search = new URLSearchParams(request.url!.split('?')[1] ?? '')

        expect(search.get('effectFormat')).toBe('mendoza')
        expect(search.get('visibility')).toBe('query')

        channel!.send({event: 'welcome'})
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      })

      await firstValueFrom(
        client.collaboration.comments.listen('*[_type == "sanity.comment"]', undefined, {
          effectFormat: 'mendoza',
          events: ['welcome'],
          visibility: 'query',
        }),
        {defaultValue: null},
      )

      server.close()
    })
  },
)
