import type {Any, ErrorProps} from '../types'

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

function httpErrorMessage(res: Any) {
  const statusMessage = res.statusMessage ? ` ${res.statusMessage}` : ''
  return `${res.method}-request to ${res.url} resulted in HTTP ${res.statusCode}${statusMessage}`
}

function stringifyBody(body: Any, res: Any) {
  const contentType = (res.headers['content-type'] || '').toLowerCase()
  const isJson = contentType.indexOf('application/json') !== -1
  return isJson ? JSON.stringify(body, null, 2) : body
}
