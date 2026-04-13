import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')

    const data = await db.getLinks(query || undefined)

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

    try {
      const data = await db.createLink({
        title,
        page_title,
        url,
        category,
      })
      return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
      console.error('Insert error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'URL already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message || 'Error creating link' }, { status: 500 })
    }
  } catch (error) {
    console.error('Internal error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
