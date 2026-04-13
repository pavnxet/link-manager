import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDb()
    const nextId = await db.getNextNumericId()

    return NextResponse.json({ nextId })
  } catch (error) {
    console.error('Next ID error:', error)
    return NextResponse.json({ nextId: 1 })
  }
}
