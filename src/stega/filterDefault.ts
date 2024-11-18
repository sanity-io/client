import type {ContentSourceMapParsedPath, FilterDefault} from './types'

export const filterDefault: FilterDefault = ({sourcePath, resultPath, value}) => {
  // Skips encoding on URL or Date strings, similar to the `skip: 'auto'` parameter in vercelStegaCombine()
  if (isValidDate(value) || isValidURL(value)) {
    return false
  }

  const endPath = sourcePath.at(-1)
  // Never encode slugs
  if (sourcePath.at(-2) === 'slug' && endPath === 'current') {
    return false
  }

  // Skip underscored keys, and strings that end with `Id`, needs better heuristics but it works for now
  if (typeof endPath === 'string' && (endPath.startsWith('_') || endPath.endsWith('Id'))) {
    return false
  }

  // Don't encode into anything that is suggested it'll render for SEO in meta tags
  if (
    sourcePath.some(
      (path) => path === 'meta' || path === 'metadata' || path === 'openGraph' || path === 'seo',
    )
  ) {
    return false
  }

  // If the sourcePath or resultPath contains something that sounds like a type, like iconType, we skip encoding, as it's most
  // of the time used for logic that breaks if it contains stega characters
  if (hasTypeLike(sourcePath) || hasTypeLike(resultPath)) {
    return false
  }

  // Finally, we ignore a bunch of paths that are typically used for page building
  if (typeof endPath === 'string' && denylist.has(endPath)) {
    return false
  }

  return true
}

const denylist = new Set([
  'color',
  'colour',
  'currency',
  'email',
  'format',
  'gid',
  'hex',
  'href',
  'hsl',
  'hsla',
  'icon',
  'id',
  'index',
  'key',
  'language',
  'layout',
  'link',
  'linkAction',
  'locale',
  'lqip',
  'page',
  'path',
  'ref',
  'rgb',
  'rgba',
  'route',
  'secret',
  'slug',
  'status',
  'tag',
  'template',
  'theme',
  'type',
  'textTheme',
  'unit',
  'url',
  'username',
  'variant',
  'website',
])

function isValidDate(dateString: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(dateString) ? Boolean(Date.parse(dateString)) : false
}

function isValidURL(url: string) {
  try {
    new URL(url, url.startsWith('/') ? 'https://acme.com' : undefined)
  } catch {
    return false
  }
  return true
}

function hasTypeLike(path: ContentSourceMapParsedPath): boolean {
  return path.some((segment) => typeof segment === 'string' && segment.match(/type/i) !== null)
}
