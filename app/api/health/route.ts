import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'link-manager',
    timestamp: new Date().toISOString(),
  })
}
