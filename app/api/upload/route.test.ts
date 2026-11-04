import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'
import { createClient } from '@libsql/client'
import { POST } from './route.ts'

const DB_FILE = `/tmp/link-manager-upload-test-${process.pid}.db`
const IMGBB_URL = 'https://i.ibb.co/abc123/screenshot.png'

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

const IMGBB_SUCCESS = {
  data: {
    id: 'abc123',
    title: 'screenshot',
    url_viewer: 'https://ibb.co/abc123',
    url: IMGBB_URL,
    display_url: 'https://i.ibb.co/xyz/screenshot.png',
    width: '1280',
    height: '720',
    size: '48213',
    delete_url: 'https://ibb.co/abc123/delete',
    image: { url: IMGBB_URL },
    thumb: { url: 'https://i.ibb.co/abc123/thumb.png' },
  },
  success: true,
  status: 200,
}

// Configure the environment before the route (and the DB client) are exercised.
process.env.DB_PROVIDER = 'turso'
process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`
process.env.TURSO_AUTH_TOKEN = 'test-token'
process.env.IMGBB_API_KEY = 'test-api-key'

const realFetch = globalThis.fetch
let imgbbCalls = 0
const imgbbUrls: string[] = []
let imgbbResponse: () => Response = () => json(IMGBB_SUCCESS)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function uploadRequest(file?: File | Blob, field = 'image') {
  const form = new FormData()
  if (file) form.append(field, file)
  return new Request('http://localhost/api/upload', { method: 'POST', body: form })
}

function pngFile(name = 'screenshot.png', bytes: Uint8Array = PNG_BYTES) {
  return new File([bytes as BlobPart], name, { type: 'image/png' })
}

describe('POST /api/upload', () => {
  before(async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      imgbbCalls += 1
      imgbbUrls.push(`${init?.method ?? 'GET'} ${String(input)}`)
      return imgbbResponse()
    }) as unknown as typeof fetch

    const client = createClient({ url: `file:${DB_FILE}` })
    await client.execute(`CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      page_title TEXT,
      url TEXT UNIQUE NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)
    client.close()
  })

  after(() => {
    globalThis.fetch = realFetch
  })

  it('rejects a body that is not multipart/form-data', async () => {
    const res = await POST(
      new Request('http://localhost/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: 'nope' }),
      }),
    )
    assert.strictEqual(res.status, 400)
  })

  it('rejects a request with no image field', async () => {
    const res = await POST(uploadRequest())
    assert.strictEqual(res.status, 400)
    const data = await res.json()
    assert.match(data.error, /No image file/i)
  })

  it('rejects a non-image file (magic-byte check, not the declared type)', async () => {
    const fake = new File([new TextEncoder().encode('MZ this is not an image')], 'evil.png', {
      type: 'image/png',
    })
    const res = await POST(uploadRequest(fake))
    assert.strictEqual(res.status, 415)
    assert.strictEqual(imgbbCalls, 0, 'ImgBB must not be called for a non-image')
  })

  it('rejects files over the 32 MB ImgBB limit', async () => {
    const big = new File([new Uint8Array(32 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })
    const res = await POST(uploadRequest(big))
    assert.strictEqual(res.status, 413)
    assert.strictEqual(imgbbCalls, 0)
  })

  it('returns 500 when IMGBB_API_KEY is missing', async () => {
    const key = process.env.IMGBB_API_KEY
    delete process.env.IMGBB_API_KEY
    try {
      const res = await POST(uploadRequest(pngFile()))
      assert.strictEqual(res.status, 500)
      const data = await res.json()
      assert.match(data.error, /IMGBB_API_KEY/)
    } finally {
      process.env.IMGBB_API_KEY = key
    }
  })

  it('returns 502 when ImgBB rejects the upload', async () => {
    imgbbResponse = () =>
      json({ success: false, status: 400, error: { message: 'Invalid API key', code: 100 } }, 400)
    try {
      const res = await POST(uploadRequest(pngFile()))
      assert.strictEqual(res.status, 502)
      const data = await res.json()
      assert.match(data.error, /Invalid API key/)
      assert.doesNotMatch(JSON.stringify(data), /test-api-key/, 'the API key must never leak')
    } finally {
      imgbbResponse = () => json(IMGBB_SUCCESS)
    }
  })

  it('uploads the image and saves it as a vault link', async () => {
    const res = await POST(uploadRequest(pngFile('holiday.png')))
    assert.strictEqual(res.status, 201)

    const data = await res.json()
    assert.strictEqual(data.image.url, IMGBB_URL)
    assert.match(imgbbUrls.at(-1) ?? '', /^POST https:\/\/api\.imgbb\.com\/1\/upload\?key=/)
    assert.strictEqual(data.link.url, IMGBB_URL)
    assert.strictEqual(data.link.page_title, 'holiday.png')
    assert.strictEqual(data.link.category, '🖼️ #Image')
    assert.match(String(data.link.title), /^\d+$/, 'the title follows the numeric vault convention')

    const client = createClient({ url: `file:${DB_FILE}` })
    const { rows } = await client.execute({
      sql: 'SELECT * FROM links WHERE url = ?',
      args: [IMGBB_URL],
    })
    client.close()
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].category, '🖼️ #Image')
  })

  it('still returns the hosted URL when the link cannot be saved', async () => {
    // Pre-insert the same URL so the vault's UNIQUE constraint fires.
    const client = createClient({ url: `file:${DB_FILE}` })
    await client.execute({
      sql: `INSERT OR IGNORE INTO links (id, title, page_title, url, category, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['dupe', '999', 'existing', IMGBB_URL, '🖼️ #Image', new Date().toISOString()],
    })
    client.close()

    const res = await POST(uploadRequest(pngFile('dupe.png')))
    assert.strictEqual(res.status, 201)

    const data = await res.json()
    assert.strictEqual(data.link, null)
    assert.strictEqual(data.image.url, IMGBB_URL)
    assert.match(data.warning, /could not be saved/i)
  })
})
