// `horsehead-nebula.jpg` (test/fixtures/), base64-encoded.
//
// Embedded rather than read from disk: this suite runs on workerd, Deno and
// Vercel Edge as well as Node, and `node:fs` is unavailable on those
// runtimes. `atob` plus `Uint8Array` decodes it without any runtime-specific
// API.
const fixtureBase64 =
  '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'

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Returns the horsehead-nebula.jpg fixture as bytes, with a random UUID baked
 * in as a JPEG `COM` (comment) segment right after the SOI marker.
 *
 * Media Library dedupes uploads by content hash, so re-uploading identical
 * bytes fails with "asset already exists". This suite's integration matrix
 * runs several runtimes, potentially concurrently, so a fixed fixture would
 * mean guaranteed collisions between runs. Making the bytes unique per call
 * avoids that without needing a whole new fixture file, and without touching
 * the pixel data (a degenerate/corrupt image is rejected by the API with a
 * 422, so the JPEG has to stay valid).
 */
export function uniqueJpegBytes(): Uint8Array<ArrayBuffer> {
  const bytes = decodeBase64(fixtureBase64)
  const payload = new TextEncoder().encode(crypto.randomUUID())
  const length = payload.length + 2 // length field covers itself + payload
  const segment = new Uint8Array([0xff, 0xfe, (length >> 8) & 0xff, length & 0xff, ...payload])

  const out = new Uint8Array(bytes.length + segment.length)
  out.set(bytes.subarray(0, 2), 0) // SOI marker (0xffd8)
  out.set(segment, 2)
  out.set(bytes.subarray(2), 2 + segment.length)
  return out
}
