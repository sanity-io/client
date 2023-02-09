import type {Any, QueryParams} from '../types'

export const encodeQueryString = ({
  query,
  params = {},
  options = {},
}: {
  query: string
  params?: QueryParams
  options?: Any
}) => {
  const searchParams = new URLSearchParams()
  // We generally want tag at the start of the query string
  const {tag, ...opts} = options
  if (tag) searchParams.set('tag', tag)
  searchParams.set('query', query)

  // Iterate params, the keys are prefixed with `$` and their values JSON stringified
  for (const [key, value] of Object.entries(params)) {
    searchParams.set(`$${key}`, JSON.stringify(value))
  }
  // Options are passed as-is
  for (const [key, value] of Object.entries(opts)) {
    // Skip falsy values
    if (value) searchParams.set(key, `${value}`)
  }

  return `?${searchParams}`
}
