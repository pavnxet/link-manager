import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')

    let dbQuery = supabase
      .from('links')
      .select('*')
      .order('created_at', { ascending: false })

    if (query) {
      // Use 'or' filter for searching multiple columns
      dbQuery = dbQuery.or(`title.ilike.%${query}%,page_title.ilike.%${query}%,url.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error('Fetch error:', error)
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
    const { title, page_title, url, category } = body

    if (!url || !title) {
      return NextResponse.json({ error: 'URL and Title are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('links')
      .insert([
        {
          title,
          page_title: page_title || '',
          url,
          category: category || '🔗 #Link',
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Insert error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'URL already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Internal error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
