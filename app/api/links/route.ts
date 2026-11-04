import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseHttpUrl } from '@/lib/url-safety'
import { MAX_TITLE, cleanText } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')

    const db = await getDb()
    const data = await db.getLinks(query)

    return NextResponse.json(data)
  } catch (err: unknown) {
    // Details stay in the server log: SQL text and constraint names are not the client's business.
    console.error('Failed to list links:', err)
    return NextResponse.json({ error: 'Could not load links' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  const title = cleanText(body?.title, MAX_TITLE)
  const pageTitle = cleanText(body?.page_title)
  const category = cleanText(body?.category)
  const url = parseHttpUrl(body?.url)

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!url) {
    return NextResponse.json({ error: 'URL must be a valid http(s) address' }, { status: 400 })
  }

  try {
    const db = await getDb()
    const data = await db.addLink({
      title,
      page_title: pageTitle,
      url: url.toString(),
      category,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'URL already exists' }, { status: 409 })
    }
    console.error('Failed to add link:', err)
    return NextResponse.json({ error: 'Could not save the link' }, { status: 500 })
  }
}
