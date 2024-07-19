import type {Any, ListenParams, QueryParams} from '../types'

export const encodeQueryString = ({
  query,
  params = {},
  options = {},
}: {
  query: string
  params?: ListenParams | QueryParams
  options?: Any
}) => {
  const searchParams = new URLSearchParams()
  // We generally want tag at the start of the query string
  const {tag, includeMutations, returnQuery, ...opts} = options
  // We're using `append` instead of `set` to support React Native: https://github.com/facebook/react-native/blob/1982c4722fcc51aa87e34cf562672ee4aff540f1/packages/react-native/Libraries/Blob/URL.js#L86-L88
  if (tag) searchParams.append('tag', tag)
  searchParams.append('query', query)

  // Iterate params, the keys are prefixed with `$` and their values JSON stringified
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(`$${key}`, JSON.stringify(value))
  }
  // Options are passed as-is
  for (const [key, value] of Object.entries(opts)) {
    // Skip falsy values
    if (value) searchParams.append(key, `${value}`)
  }

  // `returnQuery` is default `true`, so needs an explicit `false` handling
  if (returnQuery === false) searchParams.append('returnQuery', 'false')

  // `includeMutations` is default `true`, so needs an explicit `false` handling
  if (includeMutations === false) searchParams.append('includeMutations', 'false')

  return `?${searchParams}`
}
