import {type ClientConfig, createClient, EXPERIMENTAL_API_WARNING} from '@sanity/client'
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

  test('refuses a path parameter it cannot fill', () => {
    expect(() =>
      getMockClient().context.request('GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
        params: {sourceId: 's1'},
      }),
    ).toThrow(
      '`params.knowledgeBaseId` is required unless a `knowledge-base` resource is configured',
    )
    expect(() =>
      getMockClient().context.request('DELETE /organizations/{organizationId}/mcp/{mcpEndpoint}', {
        params: {mcpEndpoint: 'support'},
      }),
    ).toThrow('`params.organizationId` is required unless `context.organizationId` is configured')
    expect(() =>
      kbClient().context.request('GET /knowledge-bases/{knowledgeBaseId}/sources/{sourceId}', {
        params: {sourceId: ''},
      }),
    ).toThrow('`params.sourceId` must be a non-empty string')
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

    await expect(
      kbClient().context.request('GET /knowledge-bases/{knowledgeBaseId}/jobs/{jobId}', {
        params: {jobId: 'missing'},
      }),
    ).rejects.toMatchObject({statusCode: 404, response: {body: {code: 'jobNotFound'}}})
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
      .respond({status: 202, body: {sourceId: 'src1', syncId: 'sync1', jobId: 'job1'}})

    const accepted = await kbClient().context.uploadFile({
      sourceId: 'src1',
      file: new Blob(['hello']),
      filename: 'hello.txt',
      contentType: 'text/plain',
    })

    expect(accepted).toEqual({sourceId: 'src1', syncId: 'sync1', jobId: 'job1'})
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

  test('createFileSource adds the source without the file, uploads it, and reads the source again', async () => {
    const base = '/v2026-05-26/context/knowledge-bases/kbOther/sources'
    const synced = {id: 'src1', type: 'files', latestSync: {id: 'sync1', status: 'running'}}
    getActiveMock()
      .scope(apiHost)
      .on('POST', base, {body: {type: 'files', title: 'Handbook'}})
      .respond({status: 201, body: {id: 'src1', type: 'files', latestSync: null}})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${base}/src1/uploads`)
      .respond({status: 201, body: {uploadId: 'up1', uploadUrl: `${storage}/signed`}})
    getActiveMock().scope(storage).on('PUT', '/signed').respond({status: 200})
    getActiveMock()
      .scope(apiHost)
      .on('POST', `${base}/src1/syncs`)
      .respond({status: 202, body: {sourceId: 'src1', syncId: 'sync1', jobId: 'job1'}})
    getActiveMock().scope(apiHost).on('GET', `${base}/src1`).respond({status: 200, body: synced})

    const source = await getMockClient().context.createFileSource({
      knowledgeBaseId: 'kbOther',
      type: 'files',
      title: 'Handbook',
      file: new Blob(['hello']),
      filename: 'hello.txt',
    })

    expect(source).toEqual(synced)
  })
})
