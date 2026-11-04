/**
 * Page scraping for the "paste a URL" form.
 *
 * Kept out of the route so it can be tested with an injected DNS resolver and fetch: the SSRF guard
 * is the interesting part, and it is impossible to exercise through a real network in CI.
 */
import * as cheerio from 'cheerio'
import { type HostResolver, UrlSafetyError, assertPublicUrl } from './url-safety'

export const FETCH_TIMEOUT_MS = 5000
export const MAX_HTML_BYTES = 512 * 1024
export const MAX_REDIRECTS = 3

export interface ScrapeDeps {
  resolve?: HostResolver
  fetchImpl?: typeof fetch
}

export interface ScrapeResult {
  title: string
  category: string
  url: string
}

/** Read at most `MAX_HTML_BYTES` so a huge or endless response cannot exhaust memory. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  try {
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return text
}

/**
 * Fetch a page, applying the SSRF guard to every hop.
 *
 * Redirects are followed manually: with `redirect: 'follow'` a public URL could bounce the server to
 * an internal address, and the request would already have been made by the time we could check it.
 */
async function fetchHtml(start: URL, deps: ScrapeDeps): Promise<{ html: string; finalUrl: URL }> {
  const doFetch = deps.fetchImpl ?? fetch
  let url = start

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await doFetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkVault/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return { html: '', finalUrl: url }
      url = await assertPublicUrl(new URL(location, url).toString(), deps.resolve)
      continue
    }

    if (!res.ok || !res.body) return { html: '', finalUrl: url }
    return { html: await readCapped(res), finalUrl: url }
  }
  return { html: '', finalUrl: url }
}

/** Best-guess category from the URL and page title. */
export function categorise(url: string, title: string): string {
  const lowerUrl = url.toLowerCase()
  const lowerTitle = title.toLowerCase()

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return '📺 #Video'
  if (lowerUrl.includes('github.com') || lowerUrl.includes('gitlab.com')) return '💻 #Code'
  if (lowerUrl.includes('medium.com') || lowerUrl.includes('dev.to') || lowerUrl.includes('substack.com')) {
    return '📖 #Article'
  }
  if (
    lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com') || lowerUrl.includes('linkedin.com') ||
    lowerUrl.includes('facebook.com') || lowerUrl.includes('instagram.com')
  ) {
    return '🐦 #Social'
  }
  if (lowerUrl.includes('reddit.com')) return '💬 #Discussion'
  if (lowerUrl.includes('stackoverflow.com')) return '❓ #Question'
  if (lowerUrl.includes('i.ibb.co') || lowerUrl.includes('ibb.co') || lowerUrl.includes('imgbb.com')) {
    return '🖼️ #Image'
  }
  if (lowerTitle.includes('video')) return '📺 #Video'
  if (lowerTitle.includes('news')) return '📰 #News'
  if (lowerTitle.includes('course') || lowerTitle.includes('tutorial') || lowerTitle.includes('guide')) {
    return '🎓 #Course'
  }
  if (
    lowerTitle.includes('shop') || lowerTitle.includes('store') ||
    lowerTitle.includes('amazon') || lowerTitle.includes('ebay')
  ) {
    return '🛒 #Shop'
  }
  if (lowerTitle.includes('paper') || lowerTitle.includes('pdf')) return '📄 #Document'
  return '🔗 #Link'
}

/** Scrape a URL. Throws `UrlSafetyError` for anything the server must not fetch. */
export async function scrapePage(rawUrl: unknown, deps: ScrapeDeps = {}): Promise<ScrapeResult> {
  const safeUrl = await assertPublicUrl(rawUrl, deps.resolve)

  let html = ''
  let finalUrl = safeUrl
  try {
    const result = await fetchHtml(safeUrl, deps)
    html = result.html
    finalUrl = result.finalUrl
  } catch (error) {
    if (error instanceof UrlSafetyError) throw error
    // A failed fetch is not fatal: the caller still gets a usable default title and category.
    console.error('Scrape fetch failed:', error)
  }

  const $ = cheerio.load(html)
  const title = $('title').text().trim() || 'No Title'
  return { title, category: categorise(finalUrl.toString(), title), url: finalUrl.toString() }
}
