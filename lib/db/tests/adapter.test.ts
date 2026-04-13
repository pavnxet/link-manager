import assert from 'node:assert'
import { test, describe } from 'node:test'
import { SupabaseAdapter } from '../supabase-adapter.ts'
import { TursoAdapter } from '../turso-adapter.ts'

describe('Database Adapters', () => {
  test('SupabaseAdapter can be instantiated', () => {
    const adapter = new SupabaseAdapter()
    assert.ok(adapter)
  })

  test('TursoAdapter can be instantiated', () => {
    const adapter = new TursoAdapter()
    assert.ok(adapter)
  })
})
