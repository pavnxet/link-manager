import { describe, it } from 'node:test'
import assert from 'node:assert'
import { MAX_ROWS, validateBackup } from './backup.ts'

const good = { title: '  42 ', page_title: ' Example ', url: 'https://example.com/x', category: '📖 #Article' }

describe('validateBackup', () => {
  it('accepts a valid backup and normalises the rows', () => {
    const result = validateBackup([good])
    assert.strictEqual(result.ok, true)
    if (!result.ok) return
    assert.strictEqual(result.rows[0].title, '42')
    assert.strictEqual(result.rows[0].page_title, 'Example')
    assert.strictEqual(result.rows[0].url, 'https://example.com/x')
  })

  it('drops an unparseable created_at instead of failing the import', () => {
    const result = validateBackup([{ ...good, created_at: 'not-a-date' }])
    assert.strictEqual(result.ok, true)
    if (!result.ok) return
    assert.strictEqual(result.rows[0].created_at, undefined)
  })

  it('keeps a valid created_at', () => {
    const result = validateBackup([{ ...good, created_at: '2026-01-02T03:04:05.000Z' }])
    assert.strictEqual(result.ok, true)
    if (!result.ok) return
    assert.strictEqual(result.rows[0].created_at, '2026-01-02T03:04:05.000Z')
  })

  it('rejects a non-array body', () => {
    const result = validateBackup({ links: [] })
    assert.strictEqual(result.ok, false)
  })

  it('rejects an empty backup', () => {
    assert.strictEqual(validateBackup([]).ok, false)
  })

  it('names the offending entry rather than failing the whole restore anonymously', () => {
    const result = validateBackup([good, { title: 'ok', url: 'javascript:alert(1)' }])
    assert.strictEqual(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /Entry 2/)
    assert.match(result.error, /valid http\(s\) url/)
  })

  it('rejects an entry with no title', () => {
    const result = validateBackup([good, { url: 'https://example.com/y' }])
    assert.strictEqual(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /Entry 2 has no title/)
  })

  it('rejects a non-object entry', () => {
    const result = validateBackup([good, 'nope'])
    assert.strictEqual(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /Entry 2 is not an object/)
  })

  it('caps the number of rows in one restore', () => {
    const huge = Array.from({ length: MAX_ROWS + 1 }, () => good)
    const result = validateBackup(huge)
    assert.strictEqual(result.ok, false)
    if (result.ok) return
    assert.match(result.error, /Too many links/)
  })
})
