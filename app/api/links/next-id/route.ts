import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()
    const nextId = await db.getNextNumericId()

    return NextResponse.json({ nextId })
  } catch (error) {
    // Answering with 1 here put "1" in the form and the next save duplicated it.
    console.error('Next ID error:', error)
    return NextResponse.json({ error: 'Could not read the next number' }, { status: 500 })
  }
}
