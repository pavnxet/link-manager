import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, page_title, url, category } = body

    const db = await getDb()
    await db.updateLink(id, { title, page_title, url, category })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Update error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const db = await getDb()
    await db.deleteLink(id)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Delete error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 })
  }
}
