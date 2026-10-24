import {createClient} from '@sanity/client'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import {ContextClient} from '../src/context/ContextClient'
import type {SanityClient} from '../src/SanityClient'
import {getActiveMock, testResolveFetch} from './helpers/mockFetch'

const TEST_ORG_ID = 'orgAbc123'
const TEST_KB_ID = 'kb3do82whm'
const TEST_KB = {
  id: 'c0ffee00-0000-4000-8000-000000000000',
  publicId: TEST_KB_ID,
  organizationId: TEST_ORG_ID,
  title: 'Support docs',
}

const httpRequest = vi.fn()

/** A client configured the way scoped context methods require: with the knowledge base as its resource. */
function createKbClient(): SanityClient {
  return createClient({
    apiVersion: '2026-05-26',
    useCdn: false,
    resource: {type: 'knowledge-base', id: TEST_KB_ID},
  })
}

describe('ContextClient', () => {
  let kbContext: ContextClient

  beforeEach(() => {
    httpRequest.mockReset()
    kbContext = new ContextClient(createKbClient(), httpRequest)
  })

  test('knowledgeBases.create posts to the collection with the organization in the body', async () => {
    httpRequest.mockResolvedValueOnce(TEST_KB)
    const client = createClient({
      projectId: 'proj123',
      dataset: 'production',
      apiVersion: '2026-05-26',
      useCdn: false,
    })
    const context = new ContextClient(client, httpRequest)

    const created = await context.knowledgeBases.create({
      organizationId: TEST_ORG_ID,
      title: 'Support docs',
      description: 'Docs and guides',
    })

    expect(httpRequest).toHaveBeenCalledTimes(1)
    const req = httpRequest.mock.calls[0][0]
    expect(req.url).toContain('/context/knowledge-bases')
    expect(req.method).toBe('POST')
    expect(req.body.organizationId).toBe(TEST_ORG_ID)
    expect(req.body.title).toBe('Support docs')
    expect(created.publicId).toBe(TEST_KB_ID)
  })

  test('knowledgeBases management addresses per call: list, get, edit, delete', async () => {
    httpRequest
      .mockResolvedValueOnce({data: [], nextCursor: null}) // list
      .mockResolvedValueOnce(TEST_KB) // get
      .mockResolvedValueOnce(TEST_KB) // edit
      .mockResolvedValueOnce(undefined) // delete
    const client = createClient({
      projectId: 'proj123',
      dataset: 'production',
      apiVersion: '2026-05-26',
      useCdn: false,
    })
    const context = new ContextClient(client, httpRequest)

    await context.knowledgeBases.list({
      organizationId: TEST_ORG_ID,
      limit: 5,
      cursor: 'abc',
    })
    await context.knowledgeBases.get(TEST_KB_ID)
    await context.knowledgeBases.edit(TEST_KB_ID, {
      title: 'Support docs (EU)',
    })
    const deleted = await context.knowledgeBases.delete(TEST_KB_ID)

    expect(httpRequest.mock.calls[0][0].query).toMatchObject({
      organizationId: TEST_ORG_ID,
      limit: '5',
      cursor: 'abc',
    })
    expect(httpRequest.mock.calls[1][0].url).toContain(`/context/knowledge-bases/${TEST_KB_ID}`)
    expect(httpRequest.mock.calls[2][0]).toMatchObject({
      method: 'PATCH',
      body: {title: 'Support docs (EU)'},
    })
    expect(httpRequest.mock.calls[3][0].method).toBe('DELETE')
    expect(deleted).toBeUndefined()
  })

  test('scoped methods address the configured knowledge-base resource', async () => {
    httpRequest
      .mockResolvedValueOnce({data: [], nextCursor: null}) // sources.list
      .mockResolvedValueOnce({jobId: 'job1', status: 'running'}) // jobs.get

    await kbContext.sources.list()
    await kbContext.jobs.get({jobId: 'job1'})

    expect(httpRequest.mock.calls[0][0].url).toContain(
      `/context/knowledge-bases/${TEST_KB_ID}/sources`,
    )
    expect(httpRequest.mock.calls[1][0].url).toContain(
      `/context/knowledge-bases/${TEST_KB_ID}/jobs/job1`,
    )
  })

  test('scoped methods require a knowledge-base resource in the client configuration', () => {
    const resourceError =
      '`resource` of type `knowledge-base` must be configured to use knowledge-base methods'

    const noResource = new ContextClient(
      createClient({
        projectId: 'proj123',
        dataset: 'production',
        apiVersion: '2026-05-26',
        useCdn: false,
      }),
      httpRequest,
    )
    expect(() => noResource.build()).toThrow(resourceError)

    const wrongResource = new ContextClient(
      createClient({
        apiVersion: '2026-05-26',
        useCdn: false,
        resource: {type: 'media-library', id: 'ml123'},
      }),
      httpRequest,
    )
    expect(() => wrongResource.sources.list()).toThrow(resourceError)
    expect(httpRequest).not.toHaveBeenCalled()
  })

  test('data URLs on a knowledge-base resource follow the platform resource grammar', () => {
    // Pins the query surface's address shape ahead of it going live, the
    // same way media libraries resolve to /media-libraries/{id}/query.
    expect(createKbClient().getDataUrl('query')).toBe(`/knowledge-bases/${TEST_KB_ID}/query`)
  })

  test('a caller abort signal rides the request', async () => {
    httpRequest.mockResolvedValueOnce({jobId: 'job1'})

    const controller = new AbortController()
    await kbContext.build({signal: controller.signal})

    expect(httpRequest.mock.calls[0][0].signal).toBe(controller.signal)
  })

  test('issues.resolve posts the resolution with the issueId in the path', async () => {
    httpRequest.mockResolvedValueOnce({
      issue: {status: 'accepted'},
      entry: null,
      jobId: null,
    })

    const result = await kbContext.issues.resolve({
      issueId: 'issue.abc',
      resolution: 0,
    })

    const req = httpRequest.mock.calls[0][0]
    expect(req.url).toContain('/issues/issue.abc/resolve')
    expect(req.body).toEqual({resolution: 0})
    expect(result.issue.status).toBe('accepted')
  })

  test('sources.create posts each wire variant as the body, and preview a dry run', async () => {
    httpRequest
      .mockResolvedValueOnce({totalPages: 3, truncated: false, groups: [], otherCount: 0})
      .mockResolvedValueOnce({id: 'src1', type: 'sanity-dataset'})
      .mockResolvedValueOnce({id: 'src2', type: 'files'})

    const preview = await kbContext.sources.preview({
      url: 'https://example.com/docs',
      crawlOptions: {maxDepth: 2},
    })
    await kbContext.sources.create({
      type: 'sanity-dataset',
      sanityProjectId: 'proj1',
      sanityDatasetId: 'production',
      query: '*[_type == "article"]',
    })
    await kbContext.sources.create({
      type: 'files',
      title: 'Refund policy',
      content: '# Refunds',
      contentType: 'text/markdown',
    })

    expect(preview.totalPages).toBe(3)
    for (const [call] of httpRequest.mock.calls) {
      expect(call.method).toBe('POST')
      expect(call.url).toMatch(new RegExp(`/context/knowledge-bases/${TEST_KB_ID}/sources$`))
    }
    expect(httpRequest.mock.calls[0][0].body).toEqual({
      type: 'web',
      url: 'https://example.com/docs',
      crawlOptions: {maxDepth: 2},
      dryRun: true,
    })
    expect(httpRequest.mock.calls[1][0].body).toEqual({
      type: 'sanity-dataset',
      sanityProjectId: 'proj1',
      sanityDatasetId: 'production',
      query: '*[_type == "article"]',
    })
    expect(httpRequest.mock.calls[2][0].body).toEqual({
      type: 'files',
      title: 'Refund policy',
      content: '# Refunds',
      contentType: 'text/markdown',
    })
  })

  test('sources.create with a file adds the source, stages, PUTs to the signed URL, syncs, and reads it again', async () => {
    const synced = {id: 'src1', type: 'files', latestSync: {id: 'sync1', status: 'running'}}
    httpRequest
      .mockResolvedValueOnce({id: 'src1', type: 'files', latestSync: null}) // create
      .mockResolvedValueOnce({uploadId: 'up1', uploadUrl: 'https://storage.example/signed'})
      .mockResolvedValueOnce({sourceId: 'src1', jobId: 'job9'}) // sync
      .mockResolvedValueOnce(synced) // get
    // The PUT rides the client's fetch resolution (so proxy config applies),
    // injected the same way the transport tests inject theirs.
    const uploadFetch = vi.fn().mockResolvedValueOnce(new Response(null, {status: 200}))
    const uploadClient = createKbClient().withConfig({
      resolveFetch: () => uploadFetch,
    })
    const uploadContext = new ContextClient(uploadClient, httpRequest)

    const result = await uploadContext.sources.create({
      type: 'files',
      title: 'Handbook',
      file: new Blob(['hello']),
      filename: 'hello.txt',
      contentType: 'text/plain',
    })

    expect(httpRequest.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: expect.stringMatching(/\/sources$/),
      body: {type: 'files', title: 'Handbook'},
    })
    expect(httpRequest.mock.calls[0][0].body).not.toHaveProperty('file')
    expect(httpRequest.mock.calls[1][0]).toMatchObject({
      method: 'POST',
      url: expect.stringContaining('/sources/src1/uploads'),
      body: {filename: 'hello.txt', contentType: 'text/plain'},
    })
    expect(uploadFetch).toHaveBeenCalledWith(
      'https://storage.example/signed',
      expect.objectContaining({method: 'PUT', headers: {'content-type': 'text/plain'}}),
    )
    expect(httpRequest.mock.calls[2][0]).toMatchObject({
      method: 'POST',
      url: expect.stringContaining('/sources/src1/syncs'),
      body: {uploadId: 'up1'},
    })
    expect(httpRequest.mock.calls[3][0].url).toMatch(/\/sources\/src1$/)
    expect(result).toEqual(synced)
  })

  test('a failed signed-URL PUT surfaces as an error and never syncs', async () => {
    httpRequest.mockResolvedValueOnce({
      uploadId: 'up1',
      uploadUrl: 'https://storage.example/signed',
    })
    const uploadFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, {status: 403, statusText: 'Forbidden'}))
    const uploadClient = createKbClient().withConfig({
      resolveFetch: () => uploadFetch,
    })
    const uploadContext = new ContextClient(uploadClient, httpRequest)

    await expect(
      uploadContext.sources.upload({
        sourceId: 'src1',
        file: new Blob(['x']),
        filename: 'x.txt',
      }),
    ).rejects.toThrow('File upload failed: 403')
    // stage only; the sync must not have started
    expect(httpRequest).toHaveBeenCalledTimes(1)
    expect(httpRequest.mock.calls[0][0].body).toEqual({filename: 'x.txt'})
  })

  test('path parameters are encoded on their way into the URL', async () => {
    httpRequest.mockResolvedValueOnce({id: 'src1'})

    await kbContext.sources.get({sourceId: 'sources/../sneaky'})

    expect(httpRequest.mock.calls[0][0].url).toContain('/sources/sources%2F..%2Fsneaky')
  })

  test('sources list, get, edit and delete address the source', async () => {
    httpRequest
      .mockResolvedValueOnce({data: [], nextCursor: null})
      .mockResolvedValueOnce({id: 'src1'})
      .mockResolvedValueOnce({id: 'src1'})
      .mockResolvedValueOnce(undefined)

    await kbContext.sources.list({limit: 10, cursor: 'c1'})
    await kbContext.sources.get({sourceId: 'src1'})
    await kbContext.sources.edit({
      sourceId: 'src1',
      crawlOptions: {excludePaths: ['^/blog/']},
      syncFrequency: 'weekly',
      confirmDeletions: true,
    })
    const deleted = await kbContext.sources.delete({sourceId: 'src1'})

    expect(httpRequest.mock.calls[0][0].query).toEqual({limit: '10', cursor: 'c1'})
    expect(httpRequest.mock.calls[1][0].url).toMatch(/\/sources\/src1$/)
    expect(httpRequest.mock.calls[2][0]).toMatchObject({
      method: 'PATCH',
      url: expect.stringMatching(/\/sources\/src1$/),
      body: {
        crawlOptions: {excludePaths: ['^/blog/']},
        syncFrequency: 'weekly',
        confirmDeletions: true,
      },
    })
    expect(httpRequest.mock.calls[3][0]).toMatchObject({
      method: 'DELETE',
      url: expect.stringMatching(/\/sources\/src1$/),
    })
    expect(deleted).toBeUndefined()
  })

  test('sources.uploads.create stages an upload without sending bytes', async () => {
    httpRequest.mockResolvedValueOnce({uploadId: 'up1', uploadUrl: 'https://storage.example/u'})

    const staged = await kbContext.sources.uploads.create({
      sourceId: 'src1',
      filename: 'docs.zip',
      contentType: 'application/zip',
    })

    expect(httpRequest.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: expect.stringContaining('/sources/src1/uploads'),
      body: {filename: 'docs.zip', contentType: 'application/zip'},
    })
    expect(staged.uploadId).toBe('up1')
  })

  test('sources.syncs create, list, get, confirm and discard address the sync', async () => {
    httpRequest
      .mockResolvedValueOnce({sourceId: 'src1', jobId: null})
      .mockResolvedValueOnce({sourceId: 'src1', jobId: 'job1'})
      .mockResolvedValueOnce({data: [], nextCursor: null})
      .mockResolvedValueOnce({id: 'sync1', status: 'held'})
      .mockResolvedValueOnce({id: 'sync1', status: 'completed'})
      .mockResolvedValueOnce({id: 'sync1', status: 'completed'})

    await kbContext.sources.syncs.create({sourceId: 'src1'})
    await kbContext.sources.syncs.create({sourceId: 'src1', uploadId: 'up1'})
    await kbContext.sources.syncs.list({sourceId: 'src1', limit: 5})
    await kbContext.sources.syncs.get({sourceId: 'src1', syncId: 'sync1'})
    await kbContext.sources.syncs.confirm({sourceId: 'src1', syncId: 'sync1'})
    await kbContext.sources.syncs.discard({sourceId: 'src1', syncId: 'sync1'})

    const calls = httpRequest.mock.calls.map(([call]) => call)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: expect.stringMatching(/\/sources\/src1\/syncs$/),
      body: {},
    })
    expect(calls[1].body).toEqual({uploadId: 'up1'})
    expect(calls[2].url).toMatch(/\/sources\/src1\/syncs$/)
    expect(calls[2].query).toEqual({limit: '5'})
    expect(calls[3].url).toMatch(/\/sources\/src1\/syncs\/sync1$/)
    expect(calls[3].method).toBeUndefined()
    expect(calls[4]).toMatchObject({
      method: 'POST',
      url: expect.stringMatching(/\/sources\/src1\/syncs\/sync1\/confirm$/),
    })
    expect(calls[5]).toMatchObject({
      method: 'POST',
      url: expect.stringMatching(/\/sources\/src1\/syncs\/sync1\/discard$/),
    })
  })

  test('sync queues every source with a POST to /sync', async () => {
    httpRequest.mockResolvedValueOnce({sourceIds: ['src1']})

    const result = await kbContext.sync()

    expect(httpRequest.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: expect.stringMatching(new RegExp(`/knowledge-bases/${TEST_KB_ID}/sync$`)),
    })
    expect(result).toEqual({sourceIds: ['src1']})
  })

  test('documents.list forwards the source, state, and ids filters', async () => {
    httpRequest.mockResolvedValueOnce({data: [], nextCursor: null})

    await kbContext.documents.list({
      source: 'src1',
      state: 'missing',
      ids: ['d1', 'd2'],
      limit: 50,
    })

    expect(httpRequest.mock.calls[0][0].url).toMatch(/\/documents$/)
    expect(httpRequest.mock.calls[0][0].query).toEqual({
      source: 'src1',
      state: 'missing',
      ids: 'd1,d2',
      limit: '50',
    })
  })

  test('documents get, edit and delete address the document', async () => {
    httpRequest
      .mockResolvedValueOnce({id: 'd1', chunks: []})
      .mockResolvedValueOnce({id: 'd1', state: 'active'})
      .mockResolvedValueOnce(undefined)

    await kbContext.documents.get({documentId: 'd1'})
    await kbContext.documents.edit({documentId: 'd1', state: 'active'})
    const deleted = await kbContext.documents.delete({documentId: 'd1'})

    expect(httpRequest.mock.calls[0][0].url).toMatch(/\/documents\/d1$/)
    expect(httpRequest.mock.calls[1][0]).toMatchObject({
      method: 'PATCH',
      url: expect.stringMatching(/\/documents\/d1$/),
      body: {state: 'active'},
    })
    expect(httpRequest.mock.calls[2][0]).toMatchObject({
      method: 'DELETE',
      url: expect.stringMatching(/\/documents\/d1$/),
    })
    expect(deleted).toBeUndefined()
  })

  test('documents.content passes format, chunk and lines as query params', async () => {
    httpRequest.mockResolvedValueOnce('# Refunds')

    await kbContext.documents.content({
      documentId: 'd/1',
      format: 'markdown',
      chunk: 'c1',
      lines: '10-20',
    })

    expect(httpRequest.mock.calls[0][0].url).toContain('/documents/d%2F1/content')
    expect(httpRequest.mock.calls[0][0].query).toEqual({
      format: 'markdown',
      chunk: 'c1',
      lines: '10-20',
    })
  })

  test('instructions.delete passes rebuild as a query param and returns the rebuild job', async () => {
    httpRequest
      .mockResolvedValueOnce({rebuildJobId: 'ctx-rebuild-1'})
      .mockResolvedValueOnce({rebuildJobId: null})

    const rebuilt = await kbContext.instructions.delete({instructionId: 'ins1', rebuild: true})
    const plain = await kbContext.instructions.delete({instructionId: 'ins1'})

    expect(httpRequest.mock.calls[0][0]).toMatchObject({
      method: 'DELETE',
      url: expect.stringContaining('/instructions/ins1'),
      query: {rebuild: 'true'},
    })
    expect(httpRequest.mock.calls[1][0].query).toEqual({})
    expect(rebuilt).toEqual({rebuildJobId: 'ctx-rebuild-1'})
    expect(plain).toEqual({rebuildJobId: null})
  })
})

describe('documents.content with format raw', () => {
  const apiHost = 'https://api.sanity.url'

  test('resolves with the bytes the source gave, not parsed even when they are JSON', async () => {
    // A dataset document's raw form is its JSON; `raw` must still hand back bytes.
    const raw = '{"_id":"article-1","title":"Refunds é"}'
    getActiveMock()
      .scope(apiHost)
      .on('GET', `/v2026-05-26/context/knowledge-bases/${TEST_KB_ID}/documents/d1/content`, {
        query: {format: 'raw'},
      })
      .respond({status: 200, body: raw, headers: {'content-type': 'application/json'}})
    const client = createClient({
      apiHost,
      apiVersion: '2026-05-26',
      useCdn: false,
      useProjectHostname: false,
      resource: {type: 'knowledge-base', id: TEST_KB_ID},
      resolveFetch: testResolveFetch,
    })

    const content = await client.context.documents.content({documentId: 'd1', format: 'raw'})

    expect(content).toBeInstanceOf(Uint8Array)
    expect(content).toEqual(new TextEncoder().encode(raw))
  })
})
