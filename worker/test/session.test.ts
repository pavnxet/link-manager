import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createSession, isSessionValid, refreshSession } from '../src/session.ts'

describe('session helpers', () => {
  it('creates valid sessions', () => {
    const session = createSession(123, 1, 3600)
    assert.strictEqual(session.authenticated, true)
    assert.strictEqual(isSessionValid(session), true)
  })

  it('refreshes session expiry', async () => {
    const session = createSession(123, 1, 3600)
    const expiresAt = session.expiresAt
    const refreshed = refreshSession(session, 3600)
    assert.ok(refreshed.expiresAt >= expiresAt)
  })

  it('fails expired sessions', () => {
    const session = createSession(123, 1, 3600)
    session.expiresAt = Date.now() - 1
    assert.strictEqual(isSessionValid(session), false)
  })
})
