import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Service role only. Falling back to the anon key (a NEXT_PUBLIC_ value, i.e. published to the
// browser) combined with RLS being disabled meant the whole table was readable by anyone.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabaseInstance: SupabaseClient | null = null

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY ' +
        '(the anon key is not accepted — it is public and cannot bypass RLS)',
    )
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey)
  return supabaseInstance
}
