import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.exportLinks()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Backup export error:', error)
    return NextResponse.json({ error: error.message || 'Error exporting backup' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid format. Expected an array of links.' }, { status: 400 })
    }

    const result = await db.importLinks(body)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Internal error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
