import {createClient} from '@sanity/client'
import {describe, expect, test} from 'vitest'

import {
  ClientError,
  formatQueryParseError,
  type HttpError,
  isHttpError,
  ServerError,
} from '../src/http/errors'

const apiHost = 'api.sanity.url'

const singleLineQuery = `*[_type == "event]`
const multiLineQuery = `*[
  _type == "event" &&
  defined(startDate) &&
  eventDate > now())
] {
  "title": eventTitle,
  "coverPhoto": photo.asset->url
}`

describe('groq errors', () => {
  test('formats single-line errors correctly', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: singleLineQuery,
        description: 'unexpected token "\\"event]", expected expression',
        start: 11,
        end: 18,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[_type == "event]
          |           ^^^^^^^ unexpected token "\\"event]", expected expression"
    `)
  })

  test('formats unknown function errors correctly', () => {
    expect(
      formatQueryParseError({
        description: 'unknown function "eventDate"',
        type: 'queryParseError',
      }),
    ).toMatchInlineSnapshot(`"GROQ query parse error: unknown function "eventDate""`)
  })

  test('formats multi-line errors correctly', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: multiLineQuery,
        description: "expected ']' following expression",
        start: 1,
        end: 69,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[
          | ^^
      > 2 |   _type == "event" &&
          | ^^^^^^^^^^^^^^^^^^^^^
      > 3 |   defined(startDate) &&
          | ^^^^^^^^^^^^^^^^^^^^^
      > 4 |   eventDate > now())
          | ^^^^^^^^^^^^^^^^^^^^ expected ']' following expression
        5 | ] {
        6 |   "title": eventTitle,
        7 |   "coverPhoto": photo.asset->url"
    `)
  })

  test('out of bounds column error (start)', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: singleLineQuery,
        description: 'unexpected token "\\"event]", expected expression',
        start: 3000,
        end: 3000 + singleLineQuery.length,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[_type == "event]
          |                  ^ unexpected token "\\"event]", expected expression"
    `)
  })

  test('out of bounds column error (end)', () => {
    expect(
      formatQueryParseError({
        type: 'queryParseError',
        query: singleLineQuery,
        description: 'unexpected token "\\"event]", expected expression',
        start: 5,
        end: 3000,
      }),
    ).toMatchInlineSnapshot(`
      "GROQ query parse error:
      > 1 | *[_type == "event]
          |     ^^^^^^^^^^^^^ unexpected token "\\"event]", expected expression"
    `)
  })
})

describe('http errors', async () => {
  const isEdge = typeof EdgeRuntime === 'string'
  let nock: typeof import('nock') = (() => {
    throw new Error('Not supported in EdgeRuntime')
  }) as any
  if (!isEdge) {
    const _nock = await import('nock')
    nock = _nock.default
  }

  test.skipIf(isEdge)('yields ServerError on 503 (non-sanity api response)', async () => {
    nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(503, 'Service Unavailable')
    const client = createClient({
      useCdn: true,
      apiVersion: '1',
      useProjectHostname: false,
      apiHost: `https://${apiHost}`,
      maxRetries: 0,
    })

    const err = await client.projects.getById('n1f7y').catch((error) => error)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ServerError)
    expect(err.constructor.name).toBe('ServerError')
    expect(err.message).toContain('503 (Service Unavailable)')
    expect(err).toHaveProperty('statusCode', 503)

    expect(isHttpError(err)).toBe(true)
  })

  test.skipIf(isEdge)('yields ServerError on 503 (sanity api response)', async () => {
    nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(503, {
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Some internal error occurred',
    })
    const client = createClient({
      useCdn: true,
      apiVersion: '1',
      useProjectHostname: false,
      apiHost: `https://${apiHost}`,
      maxRetries: 0,
    })

    const err = await client.projects.getById('n1f7y').catch((error) => error)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ServerError)
    expect(err.constructor.name).toBe('ServerError')
    expect(err.message).toContain('Service Unavailable - Some internal error occurred')
    expect(err).toHaveProperty('statusCode', 503)

    expect(isHttpError(err)).toBe(true)
  })

  test.skipIf(isEdge)('yields ClientError on 400 (non-sanity api response)', async () => {
    nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(400, 'Bad Request')

    const client = createClient({
      useCdn: true,
      apiVersion: '1',
      useProjectHostname: false,
      apiHost: `https://${apiHost}`,
      maxRetries: 0,
    })

    const err = await client.projects.getById('n1f7y').catch((error) => error)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ClientError)
    expect(err.constructor.name).toBe('ClientError')
    expect(err.message).toContain('400 (Bad Request)')
    expect(err).toHaveProperty('statusCode', 400)

    expect(isHttpError(err)).toBe(true)
  })

  test.skipIf(isEdge)('yields ClientError on 400 (sanity api response)', async () => {
    nock(`https://${apiHost}`).get('/v1/projects/n1f7y').reply(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid request parameters',
    })

    const client = createClient({
      useCdn: true,
      apiVersion: '1',
      useProjectHostname: false,
      apiHost: `https://${apiHost}`,
      maxRetries: 0,
    })

    const err = await client.projects.getById('n1f7y').catch((error) => error)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ClientError)
    expect(err.constructor.name).toBe('ClientError')
    expect(err.message).toContain('Bad Request - Invalid request parameters')
    expect(err).toHaveProperty('statusCode', 400)

    expect(isHttpError(err)).toBe(true)
  })
})

describe('traceId', () => {
  const baseRes = {
    statusCode: 400,
    body: 'Bad Request',
    url: 'https://api.sanity.io/v1/data/query',
    method: 'GET',
  }

  test('extracts traceId from traceparent header', () => {
    const err = new ClientError({
      ...baseRes,
      headers: {traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'},
    })
    expect(err).toHaveProperty('traceId', '0af7651916cd43dd8448eb211c80319c')
  })

  test('traceId is undefined when traceparent header is missing', () => {
    const err = new ClientError({
      ...baseRes,
      headers: {},
    })
    expect(err).toHaveProperty('traceId', undefined)
  })

  test('traceId is undefined when no headers are set', () => {
    const err = new ClientError({
      ...baseRes,
      headers: {'content-type': 'text/plain'},
    })
    expect(err).toHaveProperty('traceId', undefined)
  })

  test('extracts traceId on ServerError', () => {
    const err = new ServerError({
      ...baseRes,
      statusCode: 500,
      headers: {traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'},
    })
    expect(err).toHaveProperty('traceId', '4bf92f3577b34da6a3ce929d0e0e4736')
  })
})

describe('traceId in error messages', () => {
  const traceId = '0af7651916cd43dd8448eb211c80319c'
  const headers = {traceparent: `00-${traceId}-b7ad6b7169203331-01`}
  const headersNoTrace = {}

  test('includes traceId in non-JSON body errors', () => {
    const err = new ClientError({
      statusCode: 400,
      body: 'Bad Request',
      url: 'https://api.sanity.io/v1/data/query',
      method: 'GET',
      headers,
    })
    expect(err.message).toContain(`(traceId: ${traceId})`)
  })

  test('includes traceId in API/Boom style errors', () => {
    const err = new ClientError({
      statusCode: 400,
      body: {statusCode: 400, error: 'Bad Request', message: 'Invalid parameters'},
      url: 'https://api.sanity.io/v1/data/query',
      method: 'GET',
      headers: {...headers, 'content-type': 'application/json'},
    })
    expect(err.message).toBe(`Bad Request - Invalid parameters (traceId: ${traceId})`)
  })

  test('includes traceId in mutation errors', () => {
    const err = new ClientError({
      statusCode: 400,
      body: {
        error: {
          type: 'mutationError',
          description: 'Mutation failed',
          items: [{error: {description: 'Document not found'}}],
        },
      },
      url: 'https://api.sanity.io/v1/data/mutate',
      method: 'POST',
      headers: {...headers, 'content-type': 'application/json'},
    })
    expect(err.message).toBe(`Mutation failed (traceId: ${traceId}):\n- Document not found`)
  })

  test('includes traceId in query parse errors', () => {
    const err = new ClientError({
      statusCode: 400,
      body: {
        error: {
          type: 'queryParseError',
          query: '*[_type == "event]',
          description: 'unexpected token',
          start: 11,
          end: 18,
        },
      },
      url: 'https://api.sanity.io/v1/data/query',
      method: 'GET',
      headers: {...headers, 'content-type': 'application/json'},
    })
    expect(err.message).toContain('GROQ query parse error:')
    expect(err.message).toContain(`TraceId: ${traceId}`)
  })

  test('includes traceId in generic description errors', () => {
    const err = new ClientError({
      statusCode: 400,
      body: {
        error: {description: 'Something went wrong'},
      },
      url: 'https://api.sanity.io/v1/data/query',
      method: 'GET',
      headers: {...headers, 'content-type': 'application/json'},
    })
    expect(err.message).toBe(`Something went wrong (traceId: ${traceId})`)
  })

  test('includes traceId in fallback errors', () => {
    const err = new ClientError({
      statusCode: 400,
      body: {error: {unexpected: 'shape'}},
      url: 'https://api.sanity.io/v1/data/query',
      method: 'GET',
      headers: {...headers, 'content-type': 'application/json'},
    })
    expect(err.message).toContain(`(traceId: ${traceId})`)
  })

  test('omits traceId from message when traceparent header is missing', () => {
    const err = new ClientError({
      statusCode: 400,
      body: {statusCode: 400, error: 'Bad Request', message: 'Invalid parameters'},
      url: 'https://api.sanity.io/v1/data/query',
      method: 'GET',
      headers: {...headersNoTrace, 'content-type': 'application/json'},
    })
    expect(err.message).toBe('Bad Request - Invalid parameters')
  })
})

describe('isHttpError', () => {
  const res = {headers: {}, body: '', url: 'https://api.sanity.io/v1/data/query', method: 'GET'}
  const clientErr = new ClientError({statusCode: 400, ...res}) satisfies HttpError
  const serverErr = new ServerError({statusCode: 500, ...res}) satisfies HttpError

  test('returns true for ClientError instance', () => {
    expect(isHttpError(clientErr)).toBe(true)
  })

  test('returns true for ServerError instance', () => {
    expect(isHttpError(serverErr)).toBe(true)
  })

  test('returns false for non-object errors', () => {
    expect(isHttpError('not an object')).toBe(false)
    expect(isHttpError(123)).toBe(false)
    expect(isHttpError(null)).toBe(false)
    expect(isHttpError(undefined)).toBe(false)
  })

  test('returns false for objects without response', () => {
    expect(isHttpError({statusCode: 400, message: 'Bad Request'})).toBe(false)
  })

  test('returns true for valid HttpError objects', () => {
    const error = {
      statusCode: 400,
      message: 'Bad Request',
      response: {
        body: {},
        url: 'https://api.sanity.io/v1/data/query',
        method: 'GET',
        headers: {},
        statusCode: 400,
      },
    }
    expect(isHttpError(error)).toBe(true)
  })

  test('returns false for HttpError objects with missing properties', () => {
    const error = {
      statusCode: 400,
      message: 'Bad Request',
      response: {
        body: {},
        url: 'https://api.sanity.io/v1/data/query',
        method: 'GET',
        headers: {},
      },
    }
    expect(isHttpError(error)).toBe(false)
  })
  test('returns false for HttpError objects with invalid response structure', () => {
    const error = {
      statusCode: 400,
      message: 'Bad Request',
      response: {
        body: {},
        url: 'https://api.sanity.io/v1/data/query',
        method: 'GET',
        headers: {},
        statusCode: '400', // Invalid type
      },
    }
    expect(isHttpError(error)).toBe(false)
  })
})
