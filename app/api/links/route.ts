import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')

    const db = await getDb()
    const data = await db.getLinks(query)

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('Internal error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, page_title, url, category } = body

    if (!url || !title) {
      return NextResponse.json({ error: 'URL and Title are required' }, { status: 400 })
    }

    const db = await getDb()
    const data = await db.addLink({ title, page_title, url, category })

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    console.error('Internal error:', err)
    if (((err as unknown) as { code: string }).code === '23505') {
      return NextResponse.json({ error: 'URL already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 })
  }
}
