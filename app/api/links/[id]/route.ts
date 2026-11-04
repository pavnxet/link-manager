import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseHttpUrl } from '@/lib/url-safety'
import { MAX_TITLE, cleanText } from '@/lib/validate'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  try {
    const db = await getDb()
    const existing = await db.getLinkById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    const updates: { title?: string; page_title?: string; category?: string; url?: string } = {}

    if (body.title !== undefined) {
      const title = cleanText(body.title, MAX_TITLE)
      if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      updates.title = title
    }
    if (body.page_title !== undefined) updates.page_title = cleanText(body.page_title)
    if (body.category !== undefined) updates.category = cleanText(body.category)
    if (body.url !== undefined) {
      const url = parseHttpUrl(body.url)
      if (!url) return NextResponse.json({ error: 'URL must be a valid http(s) address' }, { status: 400 })
      updates.url = url.toString()
    }

    const link = await db.updateLink(id, updates)
    return NextResponse.json(link ?? existing)
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'Another link already uses that URL' }, { status: 409 })
    }
    console.error('Failed to update link:', err)
    return NextResponse.json({ error: 'Could not update the link' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const db = await getDb()
    const existing = await db.getLinkById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    await db.deleteLink(id)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Failed to delete link:', err)
    return NextResponse.json({ error: 'Could not delete the link' }, { status: 500 })
  }
}
