import { DatabaseAdapter } from './types'
import { SupabaseAdapter } from './supabase-adapter'
import { TursoAdapter } from './turso-adapter'

const dbType = process.env.DB_TYPE || 'supabase'

let db: DatabaseAdapter

if (dbType === 'turso') {
  db = new TursoAdapter()
} else {
  db = new SupabaseAdapter()
}

export { db }
export * from './types'
