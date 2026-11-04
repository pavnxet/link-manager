import { NextResponse } from 'next/server'
import { UrlSafetyError } from '@/lib/url-safety'
import { scrapePage } from '@/lib/scrape'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a "url" field' }, { status: 400 })
  }

  if (!body?.url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await scrapePage(body.url))
  } catch (err) {
    if (err instanceof UrlSafetyError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Scrape failed:', err)
    return NextResponse.json({ title: 'No Title', category: '🔗 #Link' })
  }
}
