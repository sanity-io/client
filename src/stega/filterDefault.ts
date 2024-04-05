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

  // Skip underscored keys, needs better heuristics but it works for now
  if (typeof endPath === 'string' && endPath.startsWith('_')) {
    return false
  }

  /**
   * Best effort infer Portable Text paths that should not be encoded.
   * Nothing is for certain, and the below implementation may cause paths that aren't Portable Text and otherwise be safe to encode to be skipped.
   * However, that's ok as userland can always opt-in with the `encodeSourceMapAtPath` option and mark known safe paths as such, which will override this heuristic.
   */
  // If the path ends in marks[number] it's likely a PortableTextSpan: https://github.com/portabletext/types/blob/e54eb24f136d8efd51a46c6a190e7c46e79b5380/src/portableText.ts#LL154C16-L154C16
  if (typeof endPath === 'number' && sourcePath.at(-2) === 'marks') {
    return false
  }
  // Or if it's [number].markDefs[number].href it's likely a PortableTextLink: https://github.com/portabletext/types/blob/e54eb24f136d8efd51a46c6a190e7c46e79b5380/src/portableText.ts#L163
  if (
    endPath === 'href' &&
    typeof sourcePath.at(-2) === 'number' &&
    sourcePath.at(-3) === 'markDefs'
  ) {
    return false
  }
  // Otherwise we have to deal with special properties of PortableTextBlock, and we can't confidently know if it's actually a `_type: 'block'` array item or not.
  // All we know is that if it is indeed a block, and we encode the strings on these keys it'll for sure break the PortableText rendering and thus we skip encoding.
  // https://github.com/portabletext/types/blob/e54eb24f136d8efd51a46c6a190e7c46e79b5380/src/portableText.ts#L48-L58
  if (endPath === 'style' || endPath === 'listItem') {
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
