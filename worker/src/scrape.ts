export type ScrapeResult = {
  title: string
  category: string
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

export function categorize(url: string, title: string): string {
  const lowerUrl = url.toLowerCase()
  const lowerTitle = title.toLowerCase()

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return '📺 #Video'
  if (lowerUrl.includes('github.com') || lowerUrl.includes('gitlab.com')) return '💻 #Code'
  if (lowerUrl.includes('medium.com') || lowerUrl.includes('dev.to') || lowerUrl.includes('substack.com')) return '📖 #Article'
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerUrl.includes('linkedin.com') || lowerUrl.includes('facebook.com') || lowerUrl.includes('instagram.com')) return '🐦 #Social'
  if (lowerUrl.includes('reddit.com')) return '💬 #Discussion'
  if (lowerUrl.includes('stackoverflow.com')) return '❓ #Question'

  if (lowerTitle.includes('video')) return '📺 #Video'
  if (lowerTitle.includes('news')) return '📰 #News'
  if (lowerTitle.includes('course') || lowerTitle.includes('tutorial') || lowerTitle.includes('guide')) return '🎓 #Course'
  if (lowerTitle.includes('shop') || lowerTitle.includes('store') || lowerTitle.includes('amazon') || lowerTitle.includes('ebay')) return '🛒 #Shop'
  if (lowerTitle.includes('paper') || lowerTitle.includes('pdf')) return '📄 #Document'

  return '🔗 #Link'
}

export async function scrape(url: string): Promise<ScrapeResult> {
  let html = ''
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (LinkManagerBot/1.0)' } })
    if (res.ok) html = await res.text()
  } catch {
    return { title: 'No Title', category: categorize(url, 'No Title') }
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = decodeHtmlEntities((titleMatch?.[1] || '').trim()) || 'No Title'
  return { title, category: categorize(url, title) }
}
