import {
  type ClientConfig,
  createClient,
  EXPERIMENTAL_API_WARNING,
  isContextApiError,
} from '@sanity/client'
import {firstValueFrom} from 'rxjs'
import {afterAll, beforeEach, describe, expect, test, vi} from 'vitest'

import {bodyBytes, getActiveMock, testResolveFetch} from './helpers/mockFetch'

const apiHost = 'https://api.sanity.url'
const kbId = 'kb3do82whm'
const kbPath = `/v2026-05-26/context/knowledge-bases/${kbId}`

const getMockClient = (config: Partial<ClientConfig> = {}) =>
  createClient({
    apiHost,
    apiVersion: '2026-05-26',
    useCdn: false,
    useProjectHostname: false,
    resolveFetch: testResolveFetch,
    ...config,
  })

const kbClient = () => getMockClient({resource: {type: 'knowledge-base', id: kbId}})

describe('context.request', () => {
  // Observes the designed-in warning channel, not a collaborator.
  const warn = vi.spyOn(console, 'warn')
  beforeEach(() => {
    warn.mockReset().mockImplementation(() => undefined)
  })
  afterAll(() => {
    warn.mockRestore()
  })

  test('sends the method, the encoded path parameters, the query and the JSON body', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('PATCH', `${kbPath}/sources/${encodeURIComponent('a/../b')}`, {body: {title: 'Docs'}})
      .respond({status: 200, body: {id: 'a/../b'}})
    getActiveMock()
      .scope(apiHost)
      .on('GET', `${kbPath}/documents`, {query: {limit: '10', state: 'missing'}})
      .respond({status: 200, body: {data: [], nextCursor: null}})

    const client = kbClient()
    const edited = await client.context.request(
      'PATCH /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}',
      {params: {sourceId: 'a/../b'}, body: {title: 'Docs'}},
    )
    const documents = await client.context.request(
      'GET /knowledge-bases/{knowledgeBaseId}/documents',
      {query: {limit: 10, state: 'missing', cursor: undefined}},
    )

    expect(edited).toEqual({id: 'a/../b'})
    expect(documents).toEqual({data: [], nextCursor: null})
  })

  test('sends the header parameters the spec declares', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sources`, {
        headers: {'idempotency-key': 'key-1'},
        body: {type: 'files', title: 'Handbook'},
      })
      .respond({status: 201, body: {id: 'src1'}})

    const created = await kbClient().context.request(
      'POST /knowledge-bases/{knowledgeBaseId}/sources',
      {headers: {'Idempotency-Key': 'key-1'}, body: {type: 'files', title: 'Handbook'}},
    )

    expect(created).toEqual({id: 'src1'})
  })

  test('takes the knowledge base from params over the configured resource', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-05-26/context/knowledge-bases/kbOther/build')
      .respond({status: 202, body: {jobId: 'job1'}})

    const accepted = await kbClient().context.request(
      'POST /knowledge-bases/{knowledgeBaseId}/build',
      {params: {knowledgeBaseId: 'kbOther'}},
    )

    expect(accepted).toEqual({jobId: 'job1'})
  })

  test('takes the organization from context.organizationId', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('DELETE', '/v2026-05-26/context/organizations/org1/mcp/support')
      .respond({status: 204})

    const deleted = await getMockClient({context: {organizationId: 'org1'}}).context.request(
      'DELETE /organizations/{organizationId}/mcp/{mcpEndpoint}',
      {params: {mcpEndpoint: 'support'}},
    )

    expect(deleted).toBeUndefined()
  })

  test('rejects, rather than throws, for a path parameter it cannot fill', async () => {
    const missingKnowledgeBase = getMockClient().context.request(
      'GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}',
      {params: {sourceId: 's1'}},
    )
    await expect(missingKnowledgeBase).rejects.toThrow(
      '`params.knowledgeBaseId` is required unless a `knowledge-base` resource is configured',
    )
    await expect(
      getMockClient().context.request('DELETE /organizations/{organizationId}/mcp/{mcpEndpoint}', {
        params: {mcpEndpoint: 'support'},
      }),
    ).rejects.toThrow(
      '`params.organizationId` is required unless `context.organizationId` is configured',
    )
    await expect(
      kbClient().context.requestBytes('GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
        params: {sourceId: ''},
      }),
    ).rejects.toThrow('`params.sourceId` must be a non-empty string')
  })

  test('the observable client fails on subscribe, not on call', async () => {
    const observable = getMockClient().observable.context.request(
      'GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}',
      {params: {sourceId: 's1'}},
    )
    await expect(firstValueFrom(observable)).rejects.toThrow('`params.knowledgeBaseId` is required')
  })

  test('surfaces the experimental API warning unless it is ignored', async () => {
    const warning = {'X-Sanity-Warning': EXPERIMENTAL_API_WARNING}
    getActiveMock()
      .scope(apiHost)
      .on('GET', kbPath)
      .respond({status: 200, body: {}, headers: warning})
      .respond({status: 200, body: {}, headers: warning})

    await kbClient().context.request('GET /knowledge-bases/{knowledgeBaseId}')
    expect(warn).toHaveBeenCalledWith(EXPERIMENTAL_API_WARNING)

    warn.mockClear()
    await getMockClient({
      resource: {type: 'knowledge-base', id: kbId},
      ignoreWarnings: EXPERIMENTAL_API_WARNING,
    }).context.request('GET /knowledge-bases/{knowledgeBaseId}')
    expect(warn).not.toHaveBeenCalled()
  })

  test('rejects with the API error', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', `${kbPath}/jobs/missing`)
      .respond({
        status: 404,
        body: {error: 'Not Found', message: 'Job not found', statusCode: 404, code: 'jobNotFound'},
        headers: {'content-type': 'application/json'},
      })

    const error = await kbClient()
      .context.request('GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}', {
        params: {jobId: 'missing'},
      })
      .catch((caught: unknown) => caught)

    expect(error).toMatchObject({statusCode: 404, response: {body: {code: 'jobNotFound'}}})
    expect(isContextApiError(error)).toBe(true)
  })

  test('isContextApiError rejects errors without a Context API error body', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', `${kbPath}/jobs/missing`)
      .respond({
        status: 401,
        body: {statusCode: 401, error: 'Unauthorized', message: 'Session not found'},
        headers: {'content-type': 'application/json'},
      })

    const error = await kbClient()
      .context.request('GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}', {
        params: {jobId: 'missing'},
      })
      .catch((caught: unknown) => caught)

    expect(error).toMatchObject({statusCode: 401})
    expect(isContextApiError(error)).toBe(false)
    expect(isContextApiError(new Error('jobNotFound'))).toBe(false)
  })

  test('requestBytes resolves with the bytes, unparsed even when they are JSON', async () => {
    const raw = '{"_id":"article-1","title":"Refunds é"}'
    getActiveMock()
      .scope(apiHost)
      .on('GET', `${kbPath}/documents/d1/content`, {query: {format: 'raw'}})
      .respond({status: 200, body: raw, headers: {'content-type': 'application/json'}})

    const content = await kbClient().context.requestBytes(
      'GET /knowledge-bases/{knowledgeBaseId}/documents/{documentId}/content',
      {params: {documentId: 'd1'}, query: {format: 'raw'}},
    )

    expect(content).toEqual(new TextEncoder().encode(raw))
  })

  test('the observable client sends the same request', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sync`)
      .respond({status: 202, body: {jobIds: []}})

    const accepted = await firstValueFrom(
      kbClient().observable.context.request('POST /knowledge-bases/{knowledgeBaseId}/sync'),
    )

    expect(accepted).toEqual({jobIds: []})
  })
})

describe('context file uploads', () => {
  const storage = 'https://storage.example'

  test('uploadFile stages the upload, PUTs the bytes to the signed URL, and syncs with it', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sources/src1/uploads`, {
        body: {filename: 'hello.txt', contentType: 'text/plain'},
      })
      .respond({status: 201, body: {uploadId: 'up1', uploadUrl: `${storage}/signed`}})
    getActiveMock()
      .scope(storage)
      .on('PUT', '/signed', {
        body: bodyBytes(new TextEncoder().encode('hello')),
        headers: {'content-type': 'text/plain'},
      })
      .respond({status: 200})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sources/src1/syncs`, {body: {uploadId: 'up1'}})
      .respond({status: 202, body: {sourceId: 'src1', jobId: 'job1'}})

    const accepted = await kbClient().context.uploadFile({
      sourceId: 'src1',
      file: new Blob(['hello']),
      filename: 'hello.txt',
      contentType: 'text/plain',
    })

    expect(accepted).toEqual({sourceId: 'src1', jobId: 'job1'})
  })

  test('a failed signed-URL PUT rejects and never syncs', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sources/src1/uploads`, {body: {filename: 'x.txt'}})
      .respond({status: 201, body: {uploadId: 'up1', uploadUrl: `${storage}/signed`}})
    getActiveMock()
      .scope(storage)
      .on('PUT', '/signed')
      .respond({status: 403, statusText: 'Forbidden'})

    await expect(
      kbClient().context.uploadFile({sourceId: 'src1', file: new Blob(['x']), filename: 'x.txt'}),
    ).rejects.toThrow('File upload failed: 403')
  })

  test('a refused sync rejects with the staged upload id, so the sync can be retried', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sources/src1/uploads`, {body: {filename: 'x.txt'}})
      .respond({status: 201, body: {uploadId: 'up1', uploadUrl: `${storage}/signed`}})
    getActiveMock().scope(storage).on('PUT', '/signed').respond({status: 200})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/sources/src1/syncs`, {body: {uploadId: 'up1'}})
      .respond({status: 409, body: {message: 'The source is already syncing'}})

    await expect(
      kbClient().context.uploadFile({sourceId: 'src1', file: new Blob(['x']), filename: 'x.txt'}),
    ).rejects.toMatchObject({statusCode: 409, uploadId: 'up1'})
  })

  test('createFileSource adds the source without the file, uploads it, and returns both', async () => {
    const base = '/v2026-05-26/context/knowledge-bases/kbOther/sources'
    const created = {id: 'src1', type: 'files', latestSync: null}
    getActiveMock()
      .scope(apiHost)
      .on('POST', base, {body: {type: 'files', title: 'Handbook'}})
      .respond({status: 201, body: created})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${base}/src1/uploads`)
      .respond({status: 201, body: {uploadId: 'up1', uploadUrl: `${storage}/signed`}})
    getActiveMock().scope(storage).on('PUT', '/signed').respond({status: 200})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${base}/src1/syncs`)
      .respond({status: 202, body: {sourceId: 'src1', jobId: 'job1'}})

    const result = await getMockClient().context.createFileSource({
      knowledgeBaseId: 'kbOther',
      type: 'files',
      title: 'Handbook',
      file: new Blob(['hello']),
      filename: 'hello.txt',
    })

    expect(result).toEqual({source: created, sync: {sourceId: 'src1', jobId: 'job1'}})
  })
  test('createFileSource deletes the source again when the upload fails', async () => {
    const base = '/v2026-05-26/context/knowledge-bases/kbOther/sources'
    getActiveMock()
      .scope(apiHost)
      .on('POST', base, {body: {type: 'files', title: 'Handbook'}})
      .respond({status: 201, body: {id: 'src1', type: 'files', latestSync: null}})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${base}/src1/uploads`)
      .respond({status: 201, body: {uploadId: 'up1', uploadUrl: `${storage}/signed`}})
    getActiveMock()
      .scope(storage)
      .on('PUT', '/signed')
      .respond({status: 403, statusText: 'Forbidden'})
    // Every registered response must be consumed, so this asserts the delete
    getActiveMock().scope(apiHost).on('DELETE', `${base}/src1`).respond({status: 204})

    await expect(
      getMockClient().context.createFileSource({
        knowledgeBaseId: 'kbOther',
        type: 'files',
        title: 'Handbook',
        file: new Blob(['hello']),
        filename: 'hello.txt',
      }),
    ).rejects.toThrow('File upload failed: 403')
  })
})

describe('context namespaces kept for Sanity CLI 8.27 and earlier', () => {
  const orgClient = () =>
    getMockClient({resource: {type: 'knowledge-base', id: kbId}, context: {organizationId: 'org1'}})

  test('knowledgeBases and mcpEndpoints call the routes the old methods called', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-05-26/context/knowledge-bases', {
        body: {organizationId: 'org1', title: 'Docs'},
      })
      .respond({status: 201, body: {publicId: 'kbNew'}})
    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-05-26/context/knowledge-bases', {query: {organizationId: 'org1'}})
      .respond({status: 200, body: {data: [], nextCursor: null}})
    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-05-26/context/knowledge-bases/kbOther')
      .respond({status: 200, body: {publicId: 'kbOther'}})
    getActiveMock()
      .scope(apiHost)
      .on('POST', '/v2026-05-26/context/organizations/org1/mcp', {
        body: {name: 'support', title: 'Support'},
      })
      .respond({status: 201, body: {name: 'support'}})
    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-05-26/context/organizations/org1/mcp/support/status')
      .respond({status: 200, body: {ok: true}})

    const context = orgClient().context
    await expect(
      context.knowledgeBases.create({organizationId: 'org1', title: 'Docs'} as never),
    ).resolves.toEqual({publicId: 'kbNew'})
    await expect(context.knowledgeBases.list({organizationId: 'org1'})).resolves.toEqual({
      data: [],
      nextCursor: null,
    })
    await expect(context.knowledgeBases.get('kbOther')).resolves.toEqual({publicId: 'kbOther'})
    await expect(
      context.mcpEndpoints.create({name: 'support', title: 'Support'} as never),
    ).resolves.toEqual({name: 'support'})
    await expect(context.mcpEndpoints.status({name: 'support'})).resolves.toEqual({ok: true})
  })

  test('mcpEndpoints.list reads the endpoint documents with GROQ, as before', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('GET', '/v2026-05-26/context/organizations/org1/query')
      .respond({status: 200, body: {result: [{name: 'support'}]}})

    await expect(orgClient().context.mcpEndpoints.list()).resolves.toEqual([{name: 'support'}])
  })

  test('build and jobs use the configured knowledge base', async () => {
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${kbPath}/build`)
      .respond({status: 202, body: {jobId: 'job1'}})
    getActiveMock()
      .scope(apiHost)
      .on('GET', `${kbPath}/jobs/job1`)
      .respond({status: 200, body: {id: 'job1', status: 'running'}})

    const context = orgClient().context
    await expect(context.build()).resolves.toEqual({jobId: 'job1'})
    await expect(context.jobs.get({jobId: 'job1'})).resolves.toEqual({
      id: 'job1',
      status: 'running',
    })
  })

  test('imports and refresh, whose routes are gone, say to upgrade instead of calling them', () => {
    const context = orgClient().context
    expect(() => context.imports.list()).toThrow(/Upgrade the Sanity CLI/)
    expect(() => context.refresh()).toThrow(/client\.context\.refresh\(\)/)
  })
})
