import { describe, it } from 'node:test'
import assert from 'node:assert'
import { GET } from './route.ts'

process.env.DB_PROVIDER = 'turso'
// Point at a database file that was never created: every query fails, which is the condition that
// used to be reported to the client as { nextId: 1 }.
process.env.TURSO_DATABASE_URL = `file:/tmp/link-manager-missing-${process.pid}.db`
process.env.TURSO_AUTH_TOKEN = 'test-token'

describe('GET /api/links/next-id', () => {
  it('reports a failure instead of suggesting 1', async () => {
    const res = await GET()
    assert.strictEqual(res.status, 500)
    const body = await res.json()
    assert.strictEqual(body.nextId, undefined, 'a broken counter must not offer a number')
    assert.match(body.error, /next number/)
  })
})
