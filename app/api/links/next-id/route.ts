import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch the last 50 links created to determine the next sequence number.
    // This assumes the user adds links somewhat sequentially and the max number isn't too far back in history.
    // Ideally, we'd use a SQL function or a separate counter, but this approach works without extra DB setup.
    const { data, error } = await supabase
      .from('links')
      .select('title')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching links for next ID:', error)
      return NextResponse.json({ nextId: 1 })
    }

    let maxId = 0
    if (data && data.length > 0) {
      for (const link of data) {
        // Check if title is a pure number
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
