import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Attempt to fetch the URL
    let html = ''
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      })
      if (res.ok) {
        html = await res.text()
      }
    } catch (fetchError) {
      console.error(`Failed to fetch ${url}`, fetchError)
      // Continue without HTML (will result in default title/category)
    }

    const $ = cheerio.load(html)
    const title = $('title').text().trim() || 'No Title'

    // Categorization Logic
    let category = '🔗 #Link'
    const lowerUrl = url.toLowerCase()
    const lowerTitle = title.toLowerCase()

    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      category = '📺 #Video'
    } else if (lowerUrl.includes('github.com') || lowerUrl.includes('gitlab.com')) {
      category = '💻 #Code'
    } else if (lowerUrl.includes('medium.com') || lowerUrl.includes('dev.to') || lowerUrl.includes('substack.com')) {
      category = '📖 #Article'
    } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerUrl.includes('linkedin.com') || lowerUrl.includes('facebook.com') || lowerUrl.includes('instagram.com')) {
      category = '🐦 #Social'
    } else if (lowerUrl.includes('reddit.com')) {
       category = '💬 #Discussion'
    } else if (lowerUrl.includes('stackoverflow.com')) {
       category = '❓ #Question'
    } else {
      // Keyword matching in title
      if (lowerTitle.includes('video')) category = '📺 #Video'
      else if (lowerTitle.includes('news')) category = '📰 #News'
      else if (lowerTitle.includes('course') || lowerTitle.includes('tutorial') || lowerTitle.includes('guide')) category = '🎓 #Course'
      else if (lowerTitle.includes('shop') || lowerTitle.includes('store') || lowerTitle.includes('amazon') || lowerTitle.includes('ebay')) category = '🛒 #Shop'
      else if (lowerTitle.includes('paper') || lowerTitle.includes('pdf')) category = '📄 #Document'
    }

    return NextResponse.json({ title, category })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json({ title: 'No Title', category: '🔗 #Link' })
  }
}
