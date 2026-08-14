import type {AddressInfo} from 'node:net'

import {type ClientConfig, type CollaborationCommentDocument, createClient} from '@sanity/client'
import {firstValueFrom, lastValueFrom, take, toArray} from 'rxjs'
import {describe, expect, test} from 'vitest'

import {getActiveMock, testResolveFetch} from './helpers/mockFetch'
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

const baseConfig = {
  apiHost,
  apiVersion: '2026-07-18',
  organizationId,
  resource,
  useCdn: false,
  useProjectHostname: false,
}

/**
 * Client whose requests go to the real network. Only useful for the listener
 * tests, which point `apiHost` at a local SSE server.
 */
const getClient = (config: Partial<ClientConfig> = {}) => createClient({...baseConfig, ...config})

/** Client whose requests go to the per-test `get-it/mock` transport. */
const getMockClient = (config: Partial<ClientConfig> = {}) =>
  getClient({resolveFetch: testResolveFetch, ...config})

describe('collaboration.comments', () => {
  const isEdge = typeof EdgeRuntime === 'string'

  const commonQuery = {
    organizationId,
    resourceId: resource.id,
    resourceType: resource.type,
  }

  test.skipIf(isEdge)(
    'creates comments with resource query parameters and write options',
    async () => {
      getActiveMock()
        .scope(apiHost)
        .on('POST', '/v2026-07-18/collaboration/comments', {
          query: {...commonQuery, tag: 'comments.create', transactionId: 'txn-123'},
          body: {target: {documentId: 'doc-1', documentType: 'article'}, message},
        })
        .respond({
          status: 200,
          body: mutationResponse([
            {id: 'comment-1', operation: 'create', document: commentDocument},
          ]),
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
    },
  )

  test.skipIf(isEdge)('creates replies with parentCommentId', async () => {
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

  test.skipIf(isEdge)('creates comments with an explicit id, threadId and context', async () => {
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

  test.skipIf(isEdge)('uses resource query parameters', async () => {
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

  test.skipIf(isEdge)('maps update, delete, and reaction requests', async () => {
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

  test.skipIf(isEdge)('forwards the transaction id on every write', async () => {
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
  })

  test.skipIf(isEdge)('returns the comment when a status change cascades to replies', async () => {
    const resolved: CollaborationCommentDocument = {...commentDocument, status: 'resolved'}
    const resolvedReply: CollaborationCommentDocument = {...replyDocument, status: 'resolved'}

    getActiveMock()
      .scope(apiHost)
      .on('PATCH', '/v2026-07-18/collaboration/comments/comment-1', {
        query: commonQuery,
        body: {status: 'resolved'},
      })
      .respond({
        status: 200,
        body: mutationResponse([
          {id: 'comment-1', operation: 'update', document: resolved},
          {id: 'reply-1', operation: 'update', document: resolvedReply},
        ]),
      })

    await expect(
      getMockClient().collaboration.comments.update('comment-1', {status: 'resolved'}),
    ).resolves.toEqual(resolved)
  })

  test.skipIf(isEdge)('returns the deleted comment and reply ids', async () => {
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

  test.skipIf(isEdge)('resolves delete with no document ids when nothing matched', async () => {
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

  test.skipIf(isEdge)('rejects when a write response carries no comment document', async () => {
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

  test.skipIf(isEdge)('rejects when a write does not match a comment', async () => {
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

  test.skipIf(isEdge)('fetches comment documents with a GROQ query and params', async () => {
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

  test.skipIf(isEdge)('fetches comments with a projection', async () => {
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

  test.skipIf(isEdge)('forwards token and header request options', async () => {
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

  test.skipIf(isEdge)('honors the timeout request option', async () => {
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

  test.skipIf(isEdge || typeof globalThis.AbortController === 'undefined')(
    'cancels a fetch with an abort controller signal',
    async () => {
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
    },
  )

  test('throws when organizationId or resource is missing', () => {
    const query = '*[_type == "sanity.comment"]'
    const withoutOrg = getMockClient({organizationId: undefined})
    const withoutResource = getMockClient({resource: undefined})
    const orgError = '`organizationId` must be configured to use collaboration comments'
    const resourceError = '`resource` must be configured to use collaboration comments'

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

  test('builds target document references without an organizationId', () => {
    const {comments} = getMockClient({organizationId: undefined}).collaboration

    expect(comments.getTargetDocumentRef('doc-1')).toBe('canvas:canvas-123:doc-1')
  })

  test('throws when building a target document reference without a resource or id', () => {
    expect(() =>
      getMockClient({resource: undefined}).collaboration.comments.getTargetDocumentRef('doc-1'),
    ).toThrow('`resource` must be configured to use collaboration comments')
    expect(() => getMockClient().collaboration.comments.getTargetDocumentRef('')).toThrow(
      'Document ID must be provided',
    )
  })

  test('builds target document references from the observable namespace', () => {
    const {comments} = getMockClient().observable.collaboration

    expect(comments.getTargetDocumentRef('drafts.doc-1')).toBe('canvas:canvas-123:doc-1')
  })

  test('rejects queries that exceed the max URL length', async () => {
    const query = `*[_type == "sanity.comment" && title == "${'x'.repeat(20000)}"]`

    await expect(getMockClient().collaboration.comments.fetch(query)).rejects.toThrow(
      'Query too large for request URL',
    )

    await expect(
      firstValueFrom(getMockClient().collaboration.comments.listen(query)),
    ).rejects.toThrow('Query too large for listener')
  })

  test.skipIf(isEdge)('supports the observable comments namespace', async () => {
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

    test('forwards configured headers to the listen endpoint', async () => {
      expect.assertions(2)

      const server = await createSseServer(({request, channel}) => {
        expect(request.headers.authorization).toBe('Bearer token-123')
        expect(request.headers['x-custom']).toBe('yes')

        channel!.send({event: 'mutation', data: {documentId: 'comment-1'}})
        process.nextTick(() => channel!.close())
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        headers: {'x-custom': 'yes'},
        token: 'token-123',
      })

      await firstValueFrom(client.collaboration.comments.listen('*[_type == "sanity.comment"]'))

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
      expect.assertions(3)

      const server = await createSseServer(({request, channel}) => {
        const search = new URLSearchParams(request.url!.split('?')[1] ?? '')

        expect(search.get('effectFormat')).toBe('mendoza')
        expect(search.get('visibility')).toBe('query')
        expect(search.get('enableResume')).toBe('true')

        channel!.send({event: 'welcome'})
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      })

      await firstValueFrom(
        client.collaboration.comments.listen('*[_type == "sanity.comment"]', undefined, {
          effectFormat: 'mendoza',
          enableResume: true,
          events: ['welcome'],
          visibility: 'query',
        }),
        {defaultValue: null},
      )

      server.close()
    })

    test('emits resumable listener events', async () => {
      expect.assertions(1)

      const server = await createSseServer(({channel}) => {
        channel!.send({event: 'welcome', data: {listenerName: 'listener-1'}})
        channel!.send({event: 'mutation', data: {documentId: 'comment-1'}})
        process.nextTick(() => channel!.close())
      })

      const client = getClient({
        apiHost: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      })

      const events = await lastValueFrom(
        client.collaboration.comments
          .listen('*[_type == "sanity.comment"]', undefined, {
            enableResume: true,
            events: ['welcome', 'mutation'],
          })
          .pipe(take(2), toArray()),
      )

      expect(events).toEqual([
        {type: 'welcome', listenerName: 'listener-1'},
        {type: 'mutation', documentId: 'comment-1'},
      ])

      server.close()
    })
  },
)
