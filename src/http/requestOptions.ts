import type {RequestOptions} from 'get-it'

import type {Any} from '../types'

const projectHeader = 'X-Sanity-Project-ID'

export function requestOptions(config: Any, overrides: Any = {}): Omit<RequestOptions, 'url'> {
  const headers: Any = {}

  if (config.headers) {
    Object.assign(headers, config.headers)
  }

  const token = overrides.token || config.token
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (!overrides.useGlobalApi && !config.useProjectHostname && config.projectId) {
    headers[projectHeader] = config.projectId
  }

  const withCredentials = Boolean(
    typeof overrides.withCredentials === 'undefined'
      ? config.withCredentials
      : overrides.withCredentials,
  )

  const timeout = typeof overrides.timeout === 'undefined' ? config.timeout : overrides.timeout
  return Object.assign({}, overrides, {
    headers: Object.assign({}, headers, overrides.headers || {}),
    timeout: typeof timeout === 'undefined' ? 5 * 60 * 1000 : timeout,
    proxy: overrides.proxy || config.proxy,
    json: true,
    withCredentials,
    fetch:
      typeof overrides.fetch === 'object' && typeof config.fetch === 'object'
        ? {...config.fetch, ...overrides.fetch}
        : overrides.fetch || config.fetch,
  })
}
