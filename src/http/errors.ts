import type {ActionError, Any, ErrorProps, MutationError} from '../types'

const MAX_ITEMS_IN_ERROR_MESSAGE = 5

/** @public */
export class ClientError extends Error {
  response: ErrorProps['response']
  statusCode: ErrorProps['statusCode'] = 400
  responseBody: ErrorProps['responseBody']
  details: ErrorProps['details']

  constructor(res: Any) {
    const props = extractErrorProps(res)
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

function extractErrorProps(res: Any): ErrorProps {
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

  // Query/database errors ({error: {description, other, arb, props}})
  if (body.error && body.error.description) {
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

function httpErrorMessage(res: Any) {
  const statusMessage = res.statusMessage ? ` ${res.statusMessage}` : ''
  return `${res.method}-request to ${res.url} resulted in HTTP ${res.statusCode}${statusMessage}`
}

function stringifyBody(body: Any, res: Any) {
  const contentType = (res.headers['content-type'] || '').toLowerCase()
  const isJson = contentType.indexOf('application/json') !== -1
  return isJson ? JSON.stringify(body, null, 2) : body
}
