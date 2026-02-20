import { describe, it } from 'node:test'
import assert from 'node:assert'
import { signToken, verifyToken } from './auth.ts'

describe('Auth Library', () => {
  it('should sign and verify a token correctly', async () => {
    const payload = { role: 'admin' }
    const token = await signToken(payload)
    assert.ok(token, 'Token should be generated')

    const decoded = await verifyToken(token)
    assert.ok(decoded, 'Decoded payload should not be null')
    assert.strictEqual(decoded.role, 'admin', 'Decoded payload should match')
  })

  it('should return null for invalid token', async () => {
    const invalidToken = 'invalid.token.here'
    const result = await verifyToken(invalidToken)
    assert.strictEqual(result, null, 'Result should be null for invalid token')
  })

  it('should return null for modified token', async () => {
    const payload = { role: 'admin' }
    const token = await signToken(payload)
    // Modify the signature part
    const parts = token.split('.')
    // JWT format: header.payload.signature
    if (parts.length === 3) {
      parts[2] = 'modifiedSignature'
      const modifiedToken = parts.join('.')
      const result = await verifyToken(modifiedToken)
      assert.strictEqual(result, null, 'Result should be null for modified token')
    } else {
        assert.fail('Token format unexpected')
    }
  })
})
