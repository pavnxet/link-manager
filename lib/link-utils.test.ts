import { describe, it } from 'node:test'
import assert from 'node:assert'
import { calculateMaxId } from './link-utils.ts'

describe('calculateMaxId', () => {
  it('should return 0 for null data', () => {
    assert.strictEqual(calculateMaxId(null), 0)
  })

  it('should return 0 for empty data', () => {
    assert.strictEqual(calculateMaxId([]), 0)
  })

  it('should find the maximum numeric ID among pure numeric titles', () => {
    const data = [
      { title: '1' },
      { title: '10' },
      { title: '5' }
    ]
    assert.strictEqual(calculateMaxId(data), 10)
  })

  it('should ignore non-numeric titles', () => {
    const data = [
      { title: '1' },
      { title: 'abc' },
      { title: '10' }
    ]
    assert.strictEqual(calculateMaxId(data), 10)
  })

  it('should ignore titles with decimals', () => {
    const data = [
      { title: '1' },
      { title: '2.5' }
    ]
    assert.strictEqual(calculateMaxId(data), 1)
  })

  it('should ignore titles with spaces', () => {
    const data = [
      { title: '1' },
      { title: ' 2 ' }
    ]
    assert.strictEqual(calculateMaxId(data), 1)
  })

  it('should return 0 if all titles are non-numeric', () => {
    const data = [
      { title: 'abc' },
      { title: 'foo' }
    ]
    assert.strictEqual(calculateMaxId(data), 0)
  })

  it('should handle large numeric titles', () => {
    const data = [
      { title: '999' },
      { title: '1000' }
    ]
    assert.strictEqual(calculateMaxId(data), 1000)
  })
})
