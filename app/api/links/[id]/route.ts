import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, page_title, url, category } = body

    await db.updateLink(id, { title, page_title, url, category })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update error:', error)
    return NextResponse.json({ error: error.message || 'Error updating link' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await db.deleteLink(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: error.message || 'Error deleting link' }, { status: 500 })
  }
}
