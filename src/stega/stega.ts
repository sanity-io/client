/* eslint-disable @typescript-eslint/no-explicit-any */
// ---------- CONSTANTS ----------
const ZERO_WIDTHS = [
  8203, // U+200B ZERO WIDTH SPACE
  8204, // U+200C ZERO WIDTH NON-JOINER
  8205, // U+200D ZERO WIDTH JOINER
  65279, // U+FEFF ZERO WIDTH NO-BREAK SPACE
]

const ZERO_WIDTHS_CHAR_CODES = ZERO_WIDTHS.map((x) => String.fromCharCode(x))

const LEGACY_WIDTHS = [
  8203, 8204, 8205, 8290, 8291, 8288, 65279, 8289, 119155, 119156, 119157, 119158, 119159, 119160,
  119161, 119162,
]

const ZERO_WIDTH_MAP = Object.fromEntries(ZERO_WIDTHS.map((cp, i) => [cp, i]))
const LEGACY_WIDTH_MAP = Object.fromEntries(LEGACY_WIDTHS.map((cp, i) => [cp, i.toString(16)]))

// Base prefix for new encoding — compression flag appended as 5th char
const PREFIX = String.fromCodePoint(ZERO_WIDTHS[0]).repeat(4)

const ALL_WIDTHS = [...ZERO_WIDTHS, ...LEGACY_WIDTHS]
const WIDTH_HEXES = ALL_WIDTHS.map((cp) => `\\u{${cp.toString(16)}}`).join('')

export const STEGA_REGEX = new RegExp(`[${WIDTH_HEXES}]{4,}`, 'gu')

// ---------- ENCODE ----------
export function stegaEncode(data: any) {
  if (data === undefined) return ''

  const json = typeof data === 'string' ? data : JSON.stringify(data)
  // On nodejs we could use Buffer instead (it is faster) but we need to identify if we are running on node
  const bytes = new TextEncoder().encode(json)
  // Using a string and concatenating the result as we are looping is faster
  // than creating an array and merging at the end
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    out +=
      ZERO_WIDTHS_CHAR_CODES[(b >> 6) & 3] +
      ZERO_WIDTHS_CHAR_CODES[(b >> 4) & 3] +
      ZERO_WIDTHS_CHAR_CODES[(b >> 2) & 3] +
      ZERO_WIDTHS_CHAR_CODES[b & 3]
  }

  return PREFIX + out
}

// ---------- DECODE ----------
export function stegaDecode(str: string) {
  if (!str) return undefined
  const match = str.match(STEGA_REGEX)
  if (!match) return undefined

  const encoded = match[0]
  if (encoded.length % 2 === 0) {
    if (encoded.length % 4 || !encoded.startsWith(PREFIX)) {
      // Legacy hex-based encoding
      return decodeLegacy(encoded)
    }
  } else throw new Error('Encoded data has invalid length')
  const payload = encoded.slice(4)
  const chars = Array.from(payload)
  const bytes = new Uint8Array(chars.length / 4)

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] =
      (ZERO_WIDTH_MAP[chars[i * 4].codePointAt(0) ?? 0] << 6) |
      (ZERO_WIDTH_MAP[chars[i * 4 + 1].codePointAt(0) ?? 0] << 4) |
      (ZERO_WIDTH_MAP[chars[i * 4 + 2].codePointAt(0) ?? 0] << 2) |
      ZERO_WIDTH_MAP[chars[i * 4 + 3].codePointAt(0) ?? 0]
  }

  try {
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

// ---------- LEGACY DECODER ----------
function decodeLegacy(chars: string, single = false) {
  const bytes = []

  for (let i = chars.length / 2; i-- > 0; ) {
    const hexPair = `${LEGACY_WIDTH_MAP[chars[i * 2].codePointAt(0) ?? 0]}${LEGACY_WIDTH_MAP[chars[i * 2 + 1].codePointAt(0) ?? 0]}`
    bytes.unshift(String.fromCharCode(parseInt(hexPair, 16)))
  }

  const decoded = []
  const queue = [bytes.join('')]
  let attempts = 10

  while (queue.length) {
    const chunk = queue.shift() ?? ''
    try {
      const parsed = JSON.parse(chunk)
      decoded.push(parsed)
      if (single) return decoded
    } catch (err: any) {
      if (!attempts--) throw err
      const pos = err.message.match(/\sposition\s(\d+)$/)?.[1]
      if (!pos) throw err
      queue.unshift(chunk.substring(0, +pos), chunk.substring(+pos))
    }
  }

  return decoded
}

// ---------- UTILITIES ----------
export function stegaCombine(visible: any, metadata: any, skip: 'auto' | boolean = 'auto') {
  if (skip === true || (skip === 'auto' && !isDateLike(visible) && !isUrlLike(visible))) {
    return `${visible}${stegaEncode(metadata)}`
  }
  return visible
}

export function stegaClean(input: string) {
  if (input == null) return input
  const cleaned = JSON.stringify(input).replace(STEGA_REGEX, '')
  return JSON.parse(cleaned)
}

export function stegaSplit(str: string) {
  const match = str.match(STEGA_REGEX)
  return {
    cleaned: str.replace(STEGA_REGEX, ''),
    encoded: match ? match[0] : '',
  }
}

// ---------- HELPERS ----------
function isUrlLike(t: any) {
  try {
    new URL(t, t.startsWith('/') ? 'https://example.com' : undefined)
    return true
  } catch {
    return false
  }
}

function isDateLike(t: any) {
  if (!t || typeof t !== 'string') return false
  return Boolean(Date.parse(t))
}

export function stegaDecodeAll(data: string): string[] {
  const e = data.match(STEGA_REGEX)
  if (e) return e.map((r) => stegaDecode(r)).flat()
  return []
}

export default {
  stegaEncode,
  stegaDecode,
  stegaCombine,
  stegaClean,
  stegaSplit,
  stegaDecodeAll,
}
