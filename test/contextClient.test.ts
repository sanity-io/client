import {createClient} from '@sanity/client'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import {ContextClient} from '../src/context/ContextClient'
import type {SanityClient} from '../src/SanityClient'

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

    await context.knowledgeBases.list({organizationId: TEST_ORG_ID, limit: 5, cursor: 'abc'})
    await context.knowledgeBases.get(TEST_KB_ID)
    await context.knowledgeBases.edit(TEST_KB_ID, {title: 'Support docs (EU)'})
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
      .mockResolvedValueOnce({data: [], nextCursor: null}) // issues.list
      .mockResolvedValueOnce({data: [], nextCursor: null}) // entries.list

    await kbContext.issues.list()
    await kbContext.entries.list()

    expect(httpRequest.mock.calls[0][0].url).toContain(
      `/context/knowledge-bases/${TEST_KB_ID}/issues`,
    )
    expect(httpRequest.mock.calls[1][0].url).toContain(
      `/context/knowledge-bases/${TEST_KB_ID}/entries`,
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
    expect(() => wrongResource.issues.list()).toThrow(resourceError)
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
      resolution: 'keep_existing',
    })

    const req = httpRequest.mock.calls[0][0]
    expect(req.url).toContain('/issues/issue.abc/resolve')
    expect(req.body).toEqual({resolution: 'keep_existing'})
    expect(result.issue.status).toBe('accepted')
  })

  test('imports.create with type file stages, PUTs to the signed URL, and confirms', async () => {
    httpRequest
      .mockResolvedValueOnce({
        importId: 'imp1',
        uploadUrl: 'https://storage.example/signed',
      })
      .mockResolvedValueOnce({jobId: 'job9'}) // complete
    // The PUT rides the client's fetch resolution (so proxy config applies),
    // injected the same way the transport tests inject theirs.
    const uploadFetch = vi.fn().mockResolvedValueOnce(new Response(null, {status: 200}))
    const uploadClient = createKbClient().withConfig({resolveFetch: () => uploadFetch})
    const uploadContext = new ContextClient(uploadClient, httpRequest)

    const result = await uploadContext.imports.create({
      type: 'file',
      file: new Blob(['hello']),
      filename: 'hello.txt',
      contentType: 'text/plain',
    })

    expect(httpRequest.mock.calls[0][0].url).toContain('/imports/uploads')
    expect(httpRequest.mock.calls[0][0].body).toEqual({
      filename: 'hello.txt',
      contentType: 'text/plain',
    })
    expect(uploadFetch).toHaveBeenCalledWith(
      'https://storage.example/signed',
      expect.objectContaining({method: 'PUT'}),
    )
    expect(httpRequest.mock.calls[1][0].url).toContain('/imports/uploads/imp1/complete')
    expect(result).toEqual({jobId: 'job9'})
  })

  test('a failed signed-URL PUT surfaces as an error and never confirms', async () => {
    httpRequest.mockResolvedValueOnce({
      importId: 'imp1',
      uploadUrl: 'https://storage.example/signed',
    })
    const uploadFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, {status: 403, statusText: 'Forbidden'}))
    const uploadClient = createKbClient().withConfig({resolveFetch: () => uploadFetch})
    const uploadContext = new ContextClient(uploadClient, httpRequest)

    await expect(
      uploadContext.imports.create({
        type: 'file',
        file: new Blob(['x']),
        filename: 'x.txt',
      }),
    ).rejects.toThrow('File upload failed: 403')
    // stage only; the confirm call must not have fired
    expect(httpRequest).toHaveBeenCalledTimes(1)
  })

  test('entry paths are encoded and read endpoints hit their routes', async () => {
    httpRequest
      .mockResolvedValueOnce({id: 'e1'}) // entries.get
      .mockResolvedValueOnce({entries: [], stats: {}}) // outline
      .mockResolvedValueOnce({
        content: '',
        slice: null,
        sourceId: 's1',
        totalLines: 1,
      }) // sources.content

    await kbContext.entries.get({path: 'billing/refunds', format: 'markdown'})
    await kbContext.outline()
    await kbContext.sources.content({sourceId: 's1', startLine: 4, endLine: 10})

    expect(httpRequest.mock.calls[0][0].url).toContain('/entries/billing%2Frefunds')
    expect(httpRequest.mock.calls[0][0].query).toMatchObject({
      format: 'markdown',
    })
    expect(httpRequest.mock.calls[1][0].url).toContain('/outline')
    expect(httpRequest.mock.calls[2][0].query).toMatchObject({
      startLine: '4',
      endLine: '10',
    })
  })

  test('sources.delete issues a DELETE and resolves to nothing', async () => {
    httpRequest.mockResolvedValueOnce(undefined)

    const result = await kbContext.sources.delete({sourceId: 'source1'})

    expect(httpRequest.mock.calls[0][0]).toMatchObject({
      method: 'DELETE',
      url: expect.stringContaining('/sources/source1'),
    })
    expect(result).toBeUndefined()
  })
})
