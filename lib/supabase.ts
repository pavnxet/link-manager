import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let supabaseInstance: SupabaseClient | null = null

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.')
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey)
  return supabaseInstance
}
