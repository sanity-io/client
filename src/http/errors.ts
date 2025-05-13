import type {HttpContext} from 'get-it'

import type {ActionError, Any, ErrorProps, MutationError, QueryParseError} from '../types'

const MAX_ITEMS_IN_ERROR_MESSAGE = 5

/** @public */
export class ClientError extends Error {
  response: ErrorProps['response']
  statusCode: ErrorProps['statusCode'] = 400
  responseBody: ErrorProps['responseBody']
  details: ErrorProps['details']

  constructor(res: Any, context?: HttpContext) {
    const props = extractErrorProps(res, context)
    super(props.message)
    Object.assign(this, props)
  }
}

/** @public */
export class ServerError extends Error {
  response: ErrorProps['response']
  statusCode: ErrorProps['statusCode'] = 500
  responseBody: ErrorProps['responseBody']
  details: ErrorProps['details']

  constructor(res: Any) {
    const props = extractErrorProps(res)
    super(props.message)
    Object.assign(this, props)
  }
}

function extractErrorProps(res: Any, context?: HttpContext): ErrorProps {
  const body = res.body
  const props = {
    response: res,
    statusCode: res.statusCode,
    responseBody: stringifyBody(body, res),
    message: '',
    details: undefined as Any,
  }

  // API/Boom style errors ({statusCode, error, message})
  if (body.error && body.message) {
    props.message = `${body.error} - ${body.message}`
    return props
  }

  // Mutation errors (specifically)
  if (isMutationError(body) || isActionError(body)) {
    const allItems = body.error.items || []
    const items = allItems
      .slice(0, MAX_ITEMS_IN_ERROR_MESSAGE)
      .map((item) => item.error?.description)
      .filter(Boolean)
    let itemsStr = items.length ? `:\n- ${items.join('\n- ')}` : ''
    if (allItems.length > MAX_ITEMS_IN_ERROR_MESSAGE) {
      itemsStr += `\n...and ${allItems.length - MAX_ITEMS_IN_ERROR_MESSAGE} more`
    }
    props.message = `${body.error.description}${itemsStr}`
    props.details = body.error
    return props
  }

  // Query parse errors
  if (isQueryParseError(body)) {
    const tag = context?.options?.query?.tag
    props.message = groqParseMessage(body, tag)
    props.details = body.error
    return props
  }

  if (body.error && body.error.description) {
    // Query/database errors ({error: {description, other, arb, props}})
    props.message = body.error.description
    props.details = body.error
    return props
  }

  // Other, more arbitrary errors
  props.message = body.error || body.message || httpErrorMessage(res)
  return props
}

function isMutationError(body: Any): body is MutationError {
  return (
    isPlainObject(body) &&
    isPlainObject(body.error) &&
    body.error.type === 'mutationError' &&
    typeof body.error.description === 'string'
  )
}

export function isQueryParseError(body: Any): body is QueryParseError {
  return (
    isPlainObject(body) &&
    isPlainObject(body.error) &&
    body.error.type === 'queryParseError' &&
    typeof body.error.query === 'string' &&
    typeof body.error.start === 'number' &&
    typeof body.error.end === 'number'
  )
}

function isActionError(body: Any): body is ActionError {
  return (
    isPlainObject(body) &&
    isPlainObject(body.error) &&
    body.error.type === 'actionError' &&
    typeof body.error.description === 'string'
  )
}

function isPlainObject(obj: Any): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj)
}

export function groqParseMessage(res: QueryParseError, tag?: string | null) {
  const {query, start, end, description} = res.error
  const lineStart = query.slice(0, start).lastIndexOf('\n') + 1
  const lineNumber = (query.slice(0, lineStart).match(/\n/g) || []).length + 1
  const line = query.slice(lineStart, query.indexOf('\n', lineStart))
  const column = start - lineStart
  const columnEnd = typeof end === 'number' ? end - lineStart : undefined

  const pointer = dashLine(column, columnEnd)
  const withTag = tag ? `\nTag: ${tag}` : ''
  return `GROQ query parse error: ${description}.\n\n${line}\n${pointer}\n\nLine: ${lineNumber}\nColumn: ${column}${withTag}`
}

function dashLine(column: number, columnEnd: number | undefined): string {
  const line = '-'.repeat(column)
  const hats = `^`.repeat(columnEnd ? columnEnd - column : 1)
  return `${line}${hats}`
}

function httpErrorMessage(res: Any) {
  const statusMessage = res.statusMessage ? ` ${res.statusMessage}` : ''
  return `${res.method}-request to ${res.url} resulted in HTTP ${res.statusCode}${statusMessage}`
}

function stringifyBody(body: Any, res: Any) {
  const contentType = (res.headers['content-type'] || '').toLowerCase()
  const isJson = contentType.indexOf('application/json') !== -1
  return isJson ? JSON.stringify(body, null, 2) : body
}

/** @public */
export class CorsOriginError extends Error {
  projectId: string
  addOriginUrl?: URL

  constructor({projectId}: {projectId: string}) {
    super('CorsOriginError')
    this.name = 'CorsOriginError'
    this.projectId = projectId

    const url = new URL(`https://sanity.io/manage/project/${projectId}/api`)
    if (typeof location !== 'undefined') {
      const {origin} = location
      url.searchParams.set('cors', 'add')
      url.searchParams.set('origin', origin)
      this.addOriginUrl = url
      this.message = `The current origin is not allowed to connect to the Live Content API. Add it here: ${url}`
    } else {
      this.message = `The current origin is not allowed to connect to the Live Content API. Change your configuration here: ${url}`
    }
  }
}
