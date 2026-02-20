import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calculateMaxId } from '@/lib/link-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch all link titles to find the global maximum numeric ID.
    // This is necessary because 'title' is a text field and can contain non-numeric values.
    // We select only the 'title' column to minimize data transfer.
    // While scanning the whole table is O(N), for a personal knowledge hub (even with 10k+ links),
    // retrieving just the titles is very fast.
    const { data, error } = await supabase
      .from('links')
      .select('title')

    if (error) {
      console.error('Error fetching links for next ID:', error)
      return NextResponse.json({ nextId: 1 })
    }

    const maxId = calculateMaxId(data)

    return NextResponse.json({ nextId: maxId + 1 })
  } catch (error) {
    console.error('Next ID error:', error)
    return NextResponse.json({ nextId: 1 })
  }
}
