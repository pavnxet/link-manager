import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()
    const data = await db.getAllLinksForBackup()

    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('Internal error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid format. Expected an array of links.' }, { status: 400 })
    }

    const db = await getDb()
    const result = await db.bulkInsertLinks(body)

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Internal error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Internal Server Error' }, { status: 500 })
  }
}
