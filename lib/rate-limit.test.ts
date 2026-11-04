import { describe, it } from 'node:test'
import assert from 'node:assert'
import { RateLimiter, clientKey } from './rate-limit.ts'

describe('RateLimiter', () => {
  it('allows up to the limit and then blocks', () => {
    const limiter = new RateLimiter(3, 60_000, () => 1_000)
    assert.strictEqual(limiter.check('ip').allowed, true)
    assert.strictEqual(limiter.check('ip').allowed, true)
    assert.strictEqual(limiter.check('ip').remaining, 0)
    const blocked = limiter.check('ip')
    assert.strictEqual(blocked.allowed, false)
    assert.ok(blocked.retryAfterSeconds > 0)
  })

  it('counts each key separately', () => {
    const limiter = new RateLimiter(1, 60_000, () => 1_000)
    assert.strictEqual(limiter.check('a').allowed, true)
    assert.strictEqual(limiter.check('a').allowed, false)
    assert.strictEqual(limiter.check('b').allowed, true)
  })

  it('frees up once the window has passed', () => {
    let now = 0
    const limiter = new RateLimiter(2, 1_000, () => now)
    assert.strictEqual(limiter.check('ip').allowed, true)
    assert.strictEqual(limiter.check('ip').allowed, true)
    assert.strictEqual(limiter.check('ip').allowed, false)
    now = 1_500
    assert.strictEqual(limiter.check('ip').allowed, true)
  })

  it('can be reset', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0)
    limiter.check('ip')
    assert.strictEqual(limiter.check('ip').allowed, false)
    limiter.reset('ip')
    assert.strictEqual(limiter.check('ip').allowed, true)
  })
})

describe('clientKey', () => {
  it('prefers the first x-forwarded-for hop', () => {
    const req = new Request('http://localhost/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    })
    assert.strictEqual(clientKey(req), '203.0.113.9')
  })

  it('falls back to x-real-ip, then to a constant', () => {
    const real = new Request('http://localhost/x', { headers: { 'x-real-ip': '198.51.100.4' } })
    assert.strictEqual(clientKey(real), '198.51.100.4')
    assert.strictEqual(clientKey(new Request('http://localhost/x')), 'unknown')
  })
})
