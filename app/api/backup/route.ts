import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validateBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()
    const data = await db.getAllLinksForBackup()
    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('Failed to build backup:', err)
    return NextResponse.json({ error: 'Could not create the backup' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON array of links' }, { status: 400 })
  }

  const validation = validateBackup(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const db = await getDb()
    const result = await db.bulkInsertLinks(validation.rows)
    return NextResponse.json({ ...result, skipped: validation.rows.length - result.count })
  } catch (err: unknown) {
    console.error('Failed to restore backup:', err)
    return NextResponse.json({ error: 'Could not restore the backup' }, { status: 500 })
  }
}
