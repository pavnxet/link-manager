import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { TursoDbClient } from './turso.ts'

const DB_FILE = `/tmp/link-manager-turso-test-${process.pid}.db`

process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`
process.env.TURSO_AUTH_TOKEN = 'test-token'

const db = new TursoDbClient()

before(async () => {
  const client = createClient({ url: `file:${DB_FILE}` })
  await client.executeMultiple(readFileSync('turso-schema.sql', 'utf8'))
  client.close()
})

describe('TursoDbClient.getLinks', () => {
  it('finds links by category, which the search box promises', async () => {
    await db.addLink({ title: '1', url: 'https://i.ibb.co/a/one.png', category: '🖼️ #Image' })
    await db.addLink({ title: '2', url: 'https://example.com/two', category: '📖 #Article' })

    const images = await db.getLinks('#Image')
    assert.strictEqual(images.length, 1)
    assert.strictEqual(images[0].url, 'https://i.ibb.co/a/one.png')
  })

  it('treats LIKE wildcards as literal text', async () => {
    const all = await db.getLinks('%')
    assert.strictEqual(all.length, 0, 'a lone % must not match every row')
  })
})

describe('TursoDbClient.getNextNumericId', () => {
  it('counts padded and spaced numeric titles', async () => {
    const fresh = new TursoDbClient()
    await fresh.addLink({ title: '007', url: 'https://example.com/007' })
    await fresh.addLink({ title: ' 42 ', url: 'https://example.com/42' })
    await fresh.addLink({ title: 'abc', url: 'https://example.com/abc' })

    assert.strictEqual(await fresh.getNextNumericId(), 43, 'the old query skipped these and returned 1')
  })
})

describe('TursoDbClient.bulkInsertLinks', () => {
  it('reports how many rows were actually inserted, not how many were sent', async () => {
    const rows = [
      { title: '100', url: 'https://example.com/dup' },
      { title: '101', url: 'https://example.com/dup' },
      { title: '102', url: 'https://example.com/new' },
    ]
    const result = await db.bulkInsertLinks(rows)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.count, 2, 'the duplicate url is skipped by ON CONFLICT DO NOTHING')
  })
})

describe('TursoDbClient.updateLink', () => {
  it('maps a duplicate url onto the 23505 code the routes turn into a 409', async () => {
    const a = await db.addLink({ title: '200', url: 'https://example.com/update-a' })
    await db.addLink({ title: '201', url: 'https://example.com/update-b' })

    await assert.rejects(
      () => db.updateLink(a.id, { url: 'https://example.com/update-b' }),
      (err: unknown) => (err as { code?: string }).code === '23505',
    )
  })
})

describe('Turso configuration', () => {
  it('refuses to start without credentials instead of falling back to a local file', async () => {
    const savedUrl = process.env.TURSO_DATABASE_URL
    const savedToken = process.env.TURSO_AUTH_TOKEN
    delete process.env.TURSO_DATABASE_URL
    delete process.env.TURSO_AUTH_TOKEN

    try {
      const { createRequire } = await import('node:module')
      const require = createRequire(import.meta.url)
      // Fresh module instance, so the cached client from this file does not mask the check.
      delete require.cache?.[require.resolve('./turso.ts')]
      const fresh = await import(`./turso.ts?fresh=${Date.now()}`)
      await assert.rejects(
        () => new fresh.TursoDbClient().getLinks(),
        /Turso is not configured/,
      )
    } finally {
      process.env.TURSO_DATABASE_URL = savedUrl
      process.env.TURSO_AUTH_TOKEN = savedToken
    }
  })
})
