import { describe, it } from 'node:test'
import assert from 'node:assert'
import { MIN_SECRET_LENGTH, resetKeyCache, signToken, verifyToken } from './auth.ts'

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

describe('JWT secret handling', () => {
  const saved = { nodeEnv: process.env.NODE_ENV, secret: process.env.JWT_SECRET }

  // @types/node marks NODE_ENV readonly (Next augments it), so write through a mutable view.
  const setNodeEnv = (value: string | undefined) => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = value
  }

  const restore = () => {
    setNodeEnv(saved.nodeEnv)
    if (saved.secret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = saved.secret
    resetKeyCache()
  }

  it('refuses to sign in production when JWT_SECRET is missing', async () => {
    setNodeEnv('production')
    delete process.env.JWT_SECRET
    resetKeyCache()
    try {
      await assert.rejects(() => signToken({ role: 'admin' }), /JWT_SECRET is not set/)
    } finally {
      restore()
    }
  })

  it('refuses a secret shorter than the minimum in production', async () => {
    setNodeEnv('production')
    process.env.JWT_SECRET = 'too-short'
    resetKeyCache()
    try {
      await assert.rejects(() => signToken({ role: 'admin' }), /at least 16 characters/)
    } finally {
      restore()
    }
  })

  it('treats every token as invalid (not a crash) when the secret is missing', async () => {
    setNodeEnv('production')
    delete process.env.JWT_SECRET
    resetKeyCache()
    try {
      // Verification fails closed: middleware sends the visitor to /login instead of 500-ing
      // every route while the deployment is misconfigured.
      assert.strictEqual(await verifyToken('anything.token.here'), null)
    } finally {
      restore()
    }
  })

  it('signs with a real secret in production', async () => {
    setNodeEnv('production')
    process.env.JWT_SECRET = 'x'.repeat(MIN_SECRET_LENGTH + 8)
    resetKeyCache()
    try {
      const token = await signToken({ role: 'admin' })
      const decoded = await verifyToken(token)
      assert.strictEqual(decoded?.role, 'admin')
    } finally {
      restore()
    }
  })

  it('a token signed with one secret does not verify with another', async () => {
    process.env.JWT_SECRET = 'first-secret-value-123456'
    resetKeyCache()
    const token = await signToken({ role: 'admin' })

    process.env.JWT_SECRET = 'second-secret-value-123456'
    resetKeyCache()
    try {
      assert.strictEqual(await verifyToken(token), null)
    } finally {
      restore()
    }
  })
})
