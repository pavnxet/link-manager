/**
 * Server-side ImgBB upload client.
 *
 * The API key is read from `process.env.IMGBB_API_KEY` and only ever used
 * inside this module, which is imported exclusively by the /api/upload route.
 * Never import this file from a `'use client'` component — that would ship the
 * key to the browser.
 */

export const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'

/** ImgBB rejects anything above 32 MB. */
export const IMGBB_MAX_BYTES = 32 * 1024 * 1024

export type ImgbbErrorCode =
  | 'MISSING_API_KEY'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_TYPE'
  | 'UPLOAD_FAILED'
  | 'BAD_RESPONSE'

export class ImgbbError extends Error {
  readonly code: ImgbbErrorCode
  readonly status: number

  constructor(message: string, status: number, code: ImgbbErrorCode) {
    super(message)
    this.name = 'ImgbbError'
    this.status = status
    this.code = code
  }
}

export interface ImgbbImage {
  id: string | null
  title: string | null
  /** Direct image URL, e.g. https://i.ibb.co/xxxx/pic.png */
  url: string
  /** Viewer page, e.g. https://ibb.co/xxxx */
  displayUrl: string | null
  thumbUrl: string | null
  /** One-time deletion URL returned by ImgBB. */
  deleteUrl: string | null
  width: number | null
  height: number | null
  size: number | null
}

export interface ImgbbUploadInput {
  bytes: Uint8Array
  filename?: string
  /** Optional lifetime in seconds (60–15552000). */
  expiration?: number
}

export interface ImgbbUploadOptions {
  apiKey?: string
  /** Override for tests. */
  fetchImpl?: typeof fetch
  baseUrl?: string
}

function toInt(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Detect an image type from the leading bytes of a file. Trusting the
 * browser-supplied MIME type alone lets a renamed .exe through, so the upload
 * route sniffs the bytes instead.
 */
export function detectImageType(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'image/png'
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg'
  }
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) {
    return 'image/gif'
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) {
    return 'image/bmp'
  }
  if (
    b.length >= 4 &&
    ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a))
  ) {
    return 'image/tiff'
  }
  if (
    b.length >= 12 &&
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
    b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && (b[11] === 0x66 || b[11] === 0x73)
  ) {
    return 'image/avif'
  }
  // SVG is text, so look for a markup signature in the first kilobyte.
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(b.subarray(0, 1024))
    .trimStart()
    .toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml'
  }
  return null
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
  }
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fileNameWithoutExtension(filename: string | undefined): string | undefined {
  if (!filename) return undefined
  const base = filename.split(/[\\/]/).pop() || ''
  const dot = base.lastIndexOf('.')
  const name = (dot > 0 ? base.slice(0, dot) : base).trim().slice(0, 100)
  return name.length > 0 ? name : undefined
}

/**
 * Upload an image to ImgBB and return a normalised result.
 * Throws `ImgbbError` with a safe message on every failure path — the API key
 * is never echoed back in an error.
 */
export async function uploadImageToImgbb(
  input: ImgbbUploadInput,
  options: ImgbbUploadOptions = {},
): Promise<ImgbbImage> {
  const apiKey = options.apiKey ?? process.env.IMGBB_API_KEY
  if (!apiKey) {
    throw new ImgbbError(
      'Image uploads are not configured: IMGBB_API_KEY is missing on the server',
      500,
      'MISSING_API_KEY',
    )
  }

  const { bytes } = input
  if (!bytes || bytes.byteLength === 0) {
    throw new ImgbbError('The uploaded file is empty', 400, 'EMPTY_FILE')
  }
  if (bytes.byteLength > IMGBB_MAX_BYTES) {
    throw new ImgbbError('Image is larger than the 32 MB ImgBB limit', 413, 'FILE_TOO_LARGE')
  }

  const form = new FormData()
  form.append('image', toBase64(bytes))
  const name = fileNameWithoutExtension(input.filename)
  if (name) form.append('name', name)

  const baseUrl = options.baseUrl ?? IMGBB_UPLOAD_URL
  const endpoint = input.expiration
    ? `${baseUrl}?key=${encodeURIComponent(apiKey)}&expiration=${input.expiration}`
    : `${baseUrl}?key=${encodeURIComponent(apiKey)}`

  const doFetch = options.fetchImpl ?? fetch

  let res: Response
  try {
    res = await doFetch(endpoint, { method: 'POST', body: form })
  } catch {
    throw new ImgbbError('Could not reach ImgBB. Try again in a moment.', 502, 'UPLOAD_FAILED')
  }

  const raw = await res.text()
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ImgbbError('ImgBB returned an unexpected response', 502, 'BAD_RESPONSE')
  }

  const payload = json as {
    success?: boolean
    status?: number
    data?: Record<string, unknown> & {
      url?: string
      display_url?: string
      url_viewer?: string
      delete_url?: string
      thumb?: { url?: string }
      image?: { url?: string }
    }
    error?: { message?: string; code?: number }
  }

  const data = payload?.data
  if (!res.ok || payload?.success === false || !data?.url) {
    const reason = payload?.error?.message?.trim()
    throw new ImgbbError(
      reason ? `ImgBB rejected the upload: ${reason}` : `ImgBB upload failed (HTTP ${res.status})`,
      502,
      'UPLOAD_FAILED',
    )
  }

  return {
    id: str(data.id),
    title: str(data.title),
    url: data.url,
    displayUrl: str(data.display_url) ?? str(data.url_viewer),
    thumbUrl: str(data.thumb?.url) ?? str(data.image?.url),
    deleteUrl: str(data.delete_url),
    width: toInt(data.width),
    height: toInt(data.height),
    size: toInt(data.size),
  }
}
