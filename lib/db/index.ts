import { DatabaseAdapter } from './types'
import { SupabaseAdapter } from './supabase-adapter'
import { TursoAdapter } from './turso-adapter'

const dbType = process.env.DB_TYPE?.toLowerCase() || 'supabase'

let db: DatabaseAdapter

if (dbType === 'turso') {
  db = new TursoAdapter()
} else {
  // Default to Supabase but now safer due to lib/supabase.ts fallbacks
  db = new SupabaseAdapter()
}

export { db }
export * from './types'
