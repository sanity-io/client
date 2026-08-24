import {createClient} from '@sanity/client'
import {beforeEach, describe, expect, test, vi} from 'vitest'

import {ContextClient} from '../src/context/ContextClient'
import type {SanityClient} from '../src/SanityClient'

const TEST_ORG_ID = 'orgAbc123'
const TEST_KB_ID = 'kb3do82whm'
const TEST_KB = {
  id: 'c0ffee00-0000-4000-8000-000000000000',
  publicId: TEST_KB_ID,
  slug: 'support-docs',
  organizationId: TEST_ORG_ID,
  name: 'Support docs',
  sanityProjectId: 'proj123',
  sanityDatasetId: 'production',
}

const httpRequest = vi.fn()

describe('ContextClient', () => {
  let client: SanityClient
  let context: ContextClient

  beforeEach(() => {
    client = createClient({
      projectId: 'proj123',
      dataset: 'production',
      apiVersion: '2026-05-26',
      useCdn: false,
    })
    httpRequest.mockReset()
    context = new ContextClient(client, httpRequest)
  })

  test('knowledgeBases.create posts to the org-scoped collection', async () => {
    httpRequest.mockResolvedValueOnce(TEST_KB)

    const created = await context.knowledgeBases.create({
      organizationId: TEST_ORG_ID,
      name: 'Support docs',
      description: 'Docs and guides',
      sanityProjectId: 'proj123',
      sanityDatasetId: 'production',
    })

    expect(httpRequest).toHaveBeenCalledTimes(1)
    const req = httpRequest.mock.calls[0][0]
    expect(req.url).toContain(`/context/organizations/${TEST_ORG_ID}/knowledge-bases`)
    expect(req.method).toBe('POST')
    // organizationId addresses the request, it is not part of the body
    expect(req.body.organizationId).toBeUndefined()
    expect(req.body.name).toBe('Support docs')
    expect(created.publicId).toBe(TEST_KB_ID)
  })

  test('knowledgeBases.list forwards pagination as query params', async () => {
    httpRequest.mockResolvedValueOnce({data: [], nextCursor: null})

    await context.knowledgeBases.list({
      organizationId: TEST_ORG_ID,
      limit: 5,
      cursor: 'abc',
    })

    const req = httpRequest.mock.calls[0][0]
    expect(req.url).toContain(`/context/organizations/${TEST_ORG_ID}/knowledge-bases`)
    expect(req.query).toMatchObject({limit: '5', cursor: 'abc'})
  })

  test('handle resolves the org/slug address once and reuses it', async () => {
    httpRequest
      .mockResolvedValueOnce(TEST_KB) // by-id resolution
      .mockResolvedValueOnce({data: [], nextCursor: null}) // issues.list
      .mockResolvedValueOnce({data: [], nextCursor: null}) // entries.list

    const kb = context.knowledgeBase(TEST_KB_ID)
    await kb.issues.list()
    await kb.entries.list()

    expect(httpRequest).toHaveBeenCalledTimes(3)
    expect(httpRequest.mock.calls[0][0].url).toContain(`/context/knowledge-bases/${TEST_KB_ID}`)
    expect(httpRequest.mock.calls[1][0].url).toContain(
      `/context/organizations/${TEST_ORG_ID}/knowledge-bases/${TEST_KB.slug}/issues`,
    )
    expect(httpRequest.mock.calls[2][0].url).toContain(
      `/context/organizations/${TEST_ORG_ID}/knowledge-bases/${TEST_KB.slug}/entries`,
    )
  })

  test('get() seeds the address cache for follow-up scoped calls', async () => {
    httpRequest
      .mockResolvedValueOnce(TEST_KB) // get() by-id fetch
      .mockResolvedValueOnce({data: [], nextCursor: null}) // issues.list

    const kb = context.knowledgeBase(TEST_KB_ID)
    await kb.get()
    await kb.issues.list()

    // No second by-id resolve: get() already carried the org and slug.
    expect(httpRequest).toHaveBeenCalledTimes(2)
    expect(httpRequest.mock.calls[1][0].url).toContain(
      `/context/organizations/${TEST_ORG_ID}/knowledge-bases/${TEST_KB.slug}/issues`,
    )
  })

  test('address resolution never carries a caller abort signal', async () => {
    httpRequest.mockResolvedValueOnce(TEST_KB).mockResolvedValueOnce({jobId: 'job1'})

    const controller = new AbortController()
    const kb = context.knowledgeBase(TEST_KB_ID)
    await kb.build({signal: controller.signal})

    // The by-id resolution is shared by every method on the handle; a
    // caller's signal on it would abort concurrent callers too.
    expect(httpRequest.mock.calls[0][0].signal).toBeUndefined()
    expect(httpRequest.mock.calls[1][0].signal).toBe(controller.signal)
  })

  test('a failed resolution does not poison the handle', async () => {
    httpRequest
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(TEST_KB)
      .mockResolvedValueOnce({jobId: 'job1'})

    const kb = context.knowledgeBase(TEST_KB_ID)
    await expect(kb.build()).rejects.toThrow('network down')
    await expect(kb.build()).resolves.toEqual({jobId: 'job1'})
  })

  test('issues.resolve posts the resolution with the issueId in the path', async () => {
    httpRequest.mockResolvedValueOnce(TEST_KB).mockResolvedValueOnce({
      issue: {status: 'accepted'},
      entry: null,
      jobId: null,
    })

    const kb = context.knowledgeBase(TEST_KB_ID)
    const result = await kb.issues.resolve({
      issueId: 'issue.abc',
      resolution: 'keep_existing',
    })

    const req = httpRequest.mock.calls[1][0]
    expect(req.url).toContain('/issues/issue.abc/resolve')
    expect(req.body).toEqual({resolution: 'keep_existing'})
    expect(result.issue.status).toBe('accepted')
  })

  test('imports.create with type file stages, PUTs to the signed URL, and confirms', async () => {
    httpRequest
      .mockResolvedValueOnce(TEST_KB) // address resolution
      .mockResolvedValueOnce({
        importId: 'imp1',
        uploadUrl: 'https://storage.example/signed',
      })
      .mockResolvedValueOnce({jobId: 'job9'}) // complete
    // The PUT rides the client's fetch resolution (so proxy config applies),
    // injected the same way the transport tests inject theirs.
    const uploadFetch = vi.fn().mockResolvedValueOnce(new Response(null, {status: 200}))
    const uploadClient = client.withConfig({resolveFetch: () => uploadFetch})
    const uploadContext = new ContextClient(uploadClient, httpRequest)

    const kb = uploadContext.knowledgeBase(TEST_KB_ID)
    const result = await kb.imports.create({
      type: 'file',
      file: new Blob(['hello']),
      filename: 'hello.txt',
      contentType: 'text/plain',
    })

    expect(httpRequest.mock.calls[1][0].url).toContain('/imports/uploads')
    expect(httpRequest.mock.calls[1][0].body).toEqual({
      filename: 'hello.txt',
      contentType: 'text/plain',
    })
    expect(uploadFetch).toHaveBeenCalledWith(
      'https://storage.example/signed',
      expect.objectContaining({method: 'PUT'}),
    )
    expect(httpRequest.mock.calls[2][0].url).toContain('/imports/uploads/imp1/complete')
    expect(result).toEqual({jobId: 'job9'})
  })

  test('a failed signed-URL PUT surfaces as an error and never confirms', async () => {
    httpRequest.mockResolvedValueOnce(TEST_KB).mockResolvedValueOnce({
      importId: 'imp1',
      uploadUrl: 'https://storage.example/signed',
    })
    const uploadFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, {status: 403, statusText: 'Forbidden'}))
    const uploadClient = client.withConfig({resolveFetch: () => uploadFetch})
    const uploadContext = new ContextClient(uploadClient, httpRequest)

    const kb = uploadContext.knowledgeBase(TEST_KB_ID)
    await expect(
      kb.imports.create({
        type: 'file',
        file: new Blob(['x']),
        filename: 'x.txt',
      }),
    ).rejects.toThrow('File upload failed: 403')
    // stage + resolution only; the confirm call must not have fired
    expect(httpRequest).toHaveBeenCalledTimes(2)
  })

  test('entry paths are encoded and read endpoints hit their routes', async () => {
    httpRequest
      .mockResolvedValueOnce(TEST_KB)
      .mockResolvedValueOnce({id: 'e1'}) // entries.get
      .mockResolvedValueOnce({entries: [], stats: {}}) // outline
      .mockResolvedValueOnce({
        content: '',
        slice: null,
        sourceId: 's1',
        totalLines: 1,
      }) // sources.content

    const kb = context.knowledgeBase(TEST_KB_ID)
    await kb.entries.get({path: 'billing/refunds', format: 'markdown'})
    await kb.outline()
    await kb.sources.content({sourceId: 's1', startLine: 4, endLine: 10})

    expect(httpRequest.mock.calls[1][0].url).toContain('/entries/billing%2Frefunds')
    expect(httpRequest.mock.calls[1][0].query).toMatchObject({
      format: 'markdown',
    })
    expect(httpRequest.mock.calls[2][0].url).toContain('/outline')
    expect(httpRequest.mock.calls[3][0].query).toMatchObject({
      startLine: '4',
      endLine: '10',
    })
  })

  test('sources.delete issues a DELETE and resolves to nothing', async () => {
    httpRequest.mockResolvedValueOnce(TEST_KB).mockResolvedValueOnce(undefined)

    const result = await context.knowledgeBase(TEST_KB_ID).sources.delete({sourceId: 'source1'})

    expect(httpRequest.mock.calls[1][0]).toMatchObject({
      method: 'DELETE',
      url: expect.stringContaining('/sources/source1'),
    })
    expect(result).toBeUndefined()
  })
})
