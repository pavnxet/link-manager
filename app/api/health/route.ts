import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ status: 'ok', mode: 'telegram-bot-worker', timestamp: new Date().toISOString() })
}
