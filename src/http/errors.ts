import type {HttpContext} from 'get-it'

import type {ActionError, Any, ErrorProps, MutationError, QueryParseError} from '../types'
import {codeFrame} from '../util/codeFrame'
import {isRecord} from '../util/isRecord'

const MAX_ITEMS_IN_ERROR_MESSAGE = 5

/**
 * Shared properties for HTTP errors (eg both ClientError and ServerError)
 * Use `isHttpError` for type narrowing and accessing response properties.
 *
 * @public
 */
export interface HttpError {
  statusCode: number
  message: string
  response: {
    body: unknown
    url: string
    method: string
    headers: Record<string, string>
    statusCode: number
    statusMessage: string | null
  }
}

/**
 * Checks if the provided error is an HTTP error.
 *
 * @param error - The error to check.
 * @returns `true` if the error is an HTTP error, `false` otherwise.
 * @public
 */
export function isHttpError(error: unknown): error is HttpError {
  if (!isRecord(error)) {
    return false
  }

  const response = error.response
  if (
    typeof error.statusCode !== 'number' ||
    typeof error.message !== 'string' ||
    !isRecord(response)
  ) {
    return false
  }

  if (
    typeof response.body === 'undefined' ||
    typeof response.url !== 'string' ||
    typeof response.method !== 'string' ||
    typeof response.headers !== 'object' ||
    typeof response.statusCode !== 'number'
  ) {
    return false
  }

  return true
}

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

  // Fall back early if we didn't get a JSON object returned as expected
  if (!isRecord(body)) {
    props.message = httpErrorMessage(res, body)
    return props
  }

  const error = body.error

  // API/Boom style errors ({statusCode, error, message})
  if (typeof error === 'string' && typeof body.message === 'string') {
    props.message = `${error} - ${body.message}`
    return props
  }

  // Content Lake errors with a `error` prop being an object
  if (typeof error !== 'object' || error === null) {
    if (typeof error === 'string') {
      props.message = error
    } else if (typeof body.message === 'string') {
      props.message = body.message
    } else {
      props.message = httpErrorMessage(res, body)
    }
    return props
  }

  // Mutation errors (specifically)
  if (isMutationError(error) || isActionError(error)) {
    const allItems = error.items || []
    const items = allItems
      .slice(0, MAX_ITEMS_IN_ERROR_MESSAGE)
      .map((item) => item.error?.description)
      .filter(Boolean)
    let itemsStr = items.length ? `:\n- ${items.join('\n- ')}` : ''
    if (allItems.length > MAX_ITEMS_IN_ERROR_MESSAGE) {
      itemsStr += `\n...and ${allItems.length - MAX_ITEMS_IN_ERROR_MESSAGE} more`
    }
    props.message = `${error.description}${itemsStr}`
    props.details = body.error
    return props
  }

  // Query parse errors
  if (isQueryParseError(error)) {
    const tag = context?.options?.query?.tag
    props.message = formatQueryParseError(error, tag)
    props.details = body.error
    return props
  }

  if ('description' in error && typeof error.description === 'string') {
    // Query/database errors ({error: {description, other, arb, props}})
    props.message = error.description
    props.details = error
    return props
  }

  // Other, more arbitrary errors
  props.message = httpErrorMessage(res, body)
  return props
}

function isMutationError(error: object): error is MutationError {
  return (
    'type' in error &&
    error.type === 'mutationError' &&
    'description' in error &&
    typeof error.description === 'string'
  )
}

function isActionError(error: object): error is ActionError {
  return (
    'type' in error &&
    error.type === 'actionError' &&
    'description' in error &&
    typeof error.description === 'string'
  )
}

/** @internal */
export function isQueryParseError(error: object): error is QueryParseError {
  return (
    isRecord(error) &&
    error.type === 'queryParseError' &&
    typeof error.query === 'string' &&
    typeof error.start === 'number' &&
    typeof error.end === 'number'
  )
}

/**
 * Formats a GROQ query parse error into a human-readable string.
 *
 * @param error - The error object containing details about the parse error.
 * @param tag - An optional tag to include in the error message.
 * @returns A formatted error message string.
 * @public
 */
export function formatQueryParseError(error: QueryParseError, tag?: string | null) {
  const {query, start, end, description} = error

  if (!query || typeof start === 'undefined') {
    return `GROQ query parse error: ${description}`
  }

  const withTag = tag ? `\n\nTag: ${tag}` : ''
  const framed = codeFrame(query, {start, end}, description)

  return `GROQ query parse error:\n${framed}${withTag}`
}

function httpErrorMessage(res: Any, body: unknown) {
  const details = typeof body === 'string' ? ` (${sliceWithEllipsis(body, 100)})` : ''
  const statusMessage = res.statusMessage ? ` ${res.statusMessage}` : ''
  return `${res.method}-request to ${res.url} resulted in HTTP ${res.statusCode}${statusMessage}${details}`
}

function stringifyBody(body: Any, res: Any) {
  const contentType = (res.headers['content-type'] || '').toLowerCase()
  const isJson = contentType.indexOf('application/json') !== -1
  return isJson ? JSON.stringify(body, null, 2) : body
}

function sliceWithEllipsis(str: string, max: number) {
  return str.length > max ? `${str.slice(0, max)}…` : str
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
