import { describe, it } from 'node:test'
import assert from 'node:assert'
import { nextNumericIdFromTitles } from './db.ts'

describe('nextNumericIdFromTitles', () => {
  it('returns max + 1 for plain numeric titles', () => {
    assert.strictEqual(nextNumericIdFromTitles(['1', '2', '365']), 366)
  })

  it('starts at 1 for an empty vault', () => {
    assert.strictEqual(nextNumericIdFromTitles([]), 1)
  })

  it('ignores non-numeric titles', () => {
    assert.strictEqual(nextNumericIdFromTitles(['abc', '365', '', '  ', '3 6 5']), 366)
  })

  it('counts padded, spaced and NBSP-padded numbers', () => {
    assert.strictEqual(nextNumericIdFromTitles(['007', ' 42 ', '\u00a0365']), 366)
  })

  it('accepts numbers as well as strings', () => {
    assert.strictEqual(nextNumericIdFromTitles([1, 42, '365']), 366)
  })

  it('accepts Buffer values, which a restored backup can produce', () => {
    assert.strictEqual(nextNumericIdFromTitles([Buffer.from('365'), '1']), 366)
  })

  it('ignores null and undefined entries', () => {
    assert.strictEqual(nextNumericIdFromTitles([null, undefined, '7']), 8)
  })

  it('ignores values that are not safe integers', () => {
    assert.strictEqual(nextNumericIdFromTitles(['99999999999999999999', '9']), 10)
  })

  it('never returns 1 when the vault already has links (the reported bug)', () => {
    const vault = Array.from({ length: 365 }, (_, i) => String(i + 1))
    assert.strictEqual(nextNumericIdFromTitles(vault), 366)
  })
})
