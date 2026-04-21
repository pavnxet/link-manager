import { describe, it } from 'node:test'
import assert from 'node:assert'
import worker from '../src/index'

function createKVStub() {
  const map = new Map<string, string>()
  return {
    async get(key: string) {
      return map.get(key) ?? null
    },
    async put(key: string, value: string) {
      map.set(key, value)
    },
  }
}

describe('worker fetch', () => {
  it('rejects webhook with wrong secret token', async () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'token',
      TELEGRAM_WEBHOOK_SECRET: 'secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      SESSION_TTL_SECONDS: '86400',
      RATE_LIMIT_PER_MINUTE: '30',
      SESSIONS: createKVStub(),
      RATE_LIMIT: createKVStub(),
    }

    const req = new Request('https://worker.example/webhook', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'wrong' },
    })

    const res = await worker.fetch(req, env as never)
    assert.strictEqual(res.status, 401)
  })

  it('returns health payload', async () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'token',
      TELEGRAM_WEBHOOK_SECRET: 'secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      SESSION_TTL_SECONDS: '86400',
      RATE_LIMIT_PER_MINUTE: '30',
      SESSIONS: createKVStub(),
      RATE_LIMIT: createKVStub(),
    }

    const req = new Request('https://worker.example/health')
    const res = await worker.fetch(req, env as never)
    assert.strictEqual(res.status, 200)
  })
})
