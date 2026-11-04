import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { GET, POST } from './route.ts'

const DB_FILE = `/tmp/link-manager-links-test-${process.pid}.db`

process.env.DB_PROVIDER = 'turso'
process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`
process.env.TURSO_AUTH_TOKEN = 'test-token'

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/links', () => {
  before(async () => {
    const client = createClient({ url: `file:${DB_FILE}` })
    await client.executeMultiple(readFileSync('turso-schema.sql', 'utf8'))
    client.close()
  })

  it('requires a title', async () => {
    const res = await post({ url: 'https://example.com/a' })
    assert.strictEqual(res.status, 400)
    assert.match((await res.json()).error, /Title is required/)
  })

  it('rejects a javascript: url, which would execute when the table renders it', async () => {
    const res = await post({ title: '7', url: 'javascript:alert(1)' })
    assert.strictEqual(res.status, 400)
    assert.match((await res.json()).error, /valid http\(s\) address/)
  })

  it('rejects a missing body', async () => {
    const res = await POST(new Request('http://localhost/api/links', { method: 'POST', body: 'not json' }))
    assert.strictEqual(res.status, 400)
  })

  it('saves a valid link and trims its fields', async () => {
    const res = await post({ title: '  9  ', url: 'https://example.com/saved', page_title: ' Page ', category: '📖 #Article' })
    assert.strictEqual(res.status, 201)
    const link = await res.json()
    assert.strictEqual(link.title, '9')
    assert.strictEqual(link.page_title, 'Page')
    assert.strictEqual(link.url, 'https://example.com/saved')
  })

  it('returns 409 for a duplicate url', async () => {
    const res = await post({ title: '10', url: 'https://example.com/saved' })
    assert.strictEqual(res.status, 409)
    assert.match((await res.json()).error, /already exists/)
  })

  it('never leaks database details in an error', async () => {
    const res = await post({ title: 'x'.repeat(300), url: 'https://example.com/long' })
    const body = JSON.stringify(await res.json())
    assert.doesNotMatch(body, /SQLITE|constraint|SELECT|INSERT/i)
  })
})

describe('GET /api/links', () => {
  it('finds a link by its category', async () => {
    await post({ title: '11', url: 'https://example.com/cat', category: '🖼️ #Image' })
    const res = await GET(new Request('http://localhost/api/links?q=%23Image'))
    assert.strictEqual(res.status, 200)
    const rows = await res.json()
    assert.ok(rows.some((row: { url: string }) => row.url === 'https://example.com/cat'))
  })
})
