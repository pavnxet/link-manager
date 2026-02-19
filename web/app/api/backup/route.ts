import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Backup export error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Internal error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid format. Expected an array of links.' }, { status: 400 })
    }

    // Process and prepare data for bulk insert
    const linksToInsert = body.map((link: {
      title: string;
      page_title?: string;
      url: string;
      category?: string;
      created_at?: string;
    }) => ({
      title: link.title,
      page_title: link.page_title,
      url: link.url,
      category: link.category,
      // If created_at is present, keep it to maintain history
      created_at: link.created_at || new Date().toISOString(),
    }))

    // Use upsert with ignoreDuplicates: true to skip existing URLs
    const { error } = await supabase
      .from('links')
      .upsert(linksToInsert, { onConflict: 'url', ignoreDuplicates: true })

    if (error) {
      console.error('Backup import error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: linksToInsert.length })
  } catch (error) {
    console.error('Internal error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
