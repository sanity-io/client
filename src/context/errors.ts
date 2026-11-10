import {type HttpError, isHttpError} from '../http/errors'
import {isRecord} from '../util/isRecord'
import type {ApiErrorBody} from './types'

/**
 * An HTTP error whose body is a Context API error. Narrow to it with
 * {@link isContextApiError}.
 *
 * @beta
 */
export type ContextApiError = HttpError & {
  response: HttpError['response'] & {body: ApiErrorBody}
}

/**
 * Whether `error` is an error response from the Context API, with a `code` to
 * branch on.
 *
 * @example
 * ```ts
 * try {
 *   await client.context.request('POST /knowledge-bases/{knowledgeBaseId}/build')
 * } catch (error) {
 *   if (isContextApiError(error) && error.response.body.code === 'buildInFlight') {
 *     // a build is already running
 *   }
 * }
 * ```
 *
 * @beta
 */
export function isContextApiError(error: unknown): error is ContextApiError {
  if (!isHttpError(error)) return false
  const body = error.response.body
  return (
    isRecord(body) &&
    typeof body.code === 'string' &&
    typeof body.message === 'string' &&
    typeof body.error === 'string' &&
    typeof body.statusCode === 'number'
  )
}
