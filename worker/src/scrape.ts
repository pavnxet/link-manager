export type ScrapeResult = {
  title: string
  category: string
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}

function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function hostMatches(hostname: string, ...domains: string[]): boolean {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
}

export function categorize(url: string, title: string): string {
  const hostname = getHostname(url)
  const lowerTitle = title.toLowerCase()

  if (hostMatches(hostname, 'youtube.com', 'youtu.be')) return '📺 #Video'
  if (hostMatches(hostname, 'github.com', 'gitlab.com')) return '💻 #Code'
  if (hostMatches(hostname, 'medium.com', 'dev.to', 'substack.com')) return '📖 #Article'
  if (hostMatches(hostname, 'twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com')) return '🐦 #Social'
  if (hostMatches(hostname, 'reddit.com')) return '💬 #Discussion'
  if (hostMatches(hostname, 'stackoverflow.com')) return '❓ #Question'

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
