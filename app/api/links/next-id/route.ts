import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Call the database function to get the maximum numeric ID directly.
    // This is significantly more efficient than fetching and processing all titles client-side.
    const { data: maxId, error } = await supabase.rpc('get_max_numeric_id')

    if (error) {
      console.error('Error fetching next ID via RPC:', error)
      return NextResponse.json({ nextId: 1 })
    }

    return NextResponse.json({ nextId: (maxId || 0) + 1 })
  } catch (error) {
    console.error('Next ID error:', error)
    return NextResponse.json({ nextId: 1 })
  }
}
