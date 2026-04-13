import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const nextId = await db.getNextId()
    return NextResponse.json({ nextId })
  } catch (error) {
    console.error('Next ID error:', error)
    return NextResponse.json({ nextId: 1 })
  }
}
