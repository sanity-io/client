import type {Middleware, RequestOptions} from 'get-it'

const DEFAULT_NUM_SHARD_BUCKETS = 9
const UNSHARDED_URL_RE = /^https:\/\/([a-z0-9]+)\.api\.(sanity\..*)/
const SHARDED_URL_RE = /^https:\/\/[a-z0-9]+\.api\.r(\d+)\.sanity\.(.*)/

/**
 * Get a default sharding implementation where buckets are reused across instances.
 * Helps prevent the case when multiple clients are instantiated, each having their
 * own state of which buckets are least used.
 */
export const domainSharder = getDomainSharder()

/**
 * @internal
 */
export function getDomainSharder(initialBuckets?: number[]) {
  const buckets: number[] = initialBuckets || new Array(DEFAULT_NUM_SHARD_BUCKETS).fill(0, 0)

  function incrementBucketForUrl(url: string) {
    const shard = getShardFromUrl(url)
    if (shard !== null) {
      buckets[shard]++
    }
  }

  function decrementBucketForUrl(url: string) {
    const shard = getShardFromUrl(url)
    if (shard !== null) {
      buckets[shard]--
    }
  }

  function getShardedUrl(url: string): string {
    const [isMatch, projectId, rest] = url.match(UNSHARDED_URL_RE) || []
    if (!isMatch) {
      return url
    }

    // Find index of bucket with fewest requests
    const bucket = buckets.reduce(
      (smallest, count, index) => (count < buckets[smallest] ? index : smallest),
      0,
    )

    // We start buckets at 1, not zero - so add 1 to the bucket index
    return `https://${projectId}.api.r${bucket + 1}.${rest}`
  }

  function getShardFromUrl(url: string): number | null {
    const [isMatch, shard] = url.match(SHARDED_URL_RE) || []

    // We start buckets at 1, not zero, but buckets are zero-indexed.
    // Substract one from the shard number in the URL to get the correct bucket index
    return isMatch ? parseInt(shard, 10) - 1 : null
  }

  const middleware = {
    processOptions: (options: {useDomainSharding?: boolean; url: string}) => {
      if (!useDomainSharding(options)) {
        return options
      }

      const url = getShardedUrl(options.url)
      options.url = url

      return options
    },

    onRequest(req: {
      options: Partial<RequestOptions> & {useDomainSharding?: boolean; url: string}
    }) {
      if (useDomainSharding(req.options)) {
        incrementBucketForUrl(req.options.url)
      }
      return req
    },

    onResponse(
      res,
      context: {options: Partial<RequestOptions> & {useDomainSharding?: boolean; url: string}},
    ) {
      if (useDomainSharding(context.options)) {
        decrementBucketForUrl(context.options.url)
      }
      return res
    },
  } satisfies Middleware

  return {
    middleware,
    incrementBucketForUrl,
    decrementBucketForUrl,
    getShardedUrl,
  }
}

function useDomainSharding(options: RequestOptions | {useDomainSharding?: boolean}): boolean {
  return 'useDomainSharding' in options && options.useDomainSharding === true
}