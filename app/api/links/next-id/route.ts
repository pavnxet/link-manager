import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

    let maxId = 0
    if (data && data.length > 0) {
      for (const link of data) {
        // Check if title is a pure number (no decimals, no spaces)
        if (/^\d+$/.test(link.title)) {
          const num = parseInt(link.title, 10)
          if (!isNaN(num) && num > maxId) {
            maxId = num
          }
        }
      }
    }

    return NextResponse.json({ nextId: maxId + 1 })
  } catch (error) {
    console.error('Next ID error:', error)
    return NextResponse.json({ nextId: 1 })
  }
}
