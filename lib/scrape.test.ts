import { describe, it } from 'node:test'
import assert from 'node:assert'
import { categorise, scrapePage } from './scrape.ts'
import { UrlSafetyError } from './url-safety.ts'

const publicResolver = async () => ['93.184.216.34']

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } })
}

describe('scrapePage', () => {
  it('refuses an internal address without fetching it', async () => {
    let fetched = false
    const fetchImpl = (async () => {
      fetched = true
      return htmlResponse('<title>nope</title>')
    }) as unknown as typeof fetch

    await assert.rejects(
      () => scrapePage('http://127.0.0.1:3000/api/backup', { resolve: publicResolver, fetchImpl }),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'PRIVATE',
    )
    assert.strictEqual(fetched, false, 'the server must not even attempt the request')
  })

  it('refuses a non-http scheme', async () => {
    await assert.rejects(
      () => scrapePage('file:///etc/passwd', { resolve: publicResolver }),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'SCHEME',
    )
  })

  it('reads the title from the page', async () => {
    const fetchImpl = (async () => htmlResponse('<html><head><title>Hello World</title></head></html>')) as unknown as typeof fetch
    const result = await scrapePage('https://example.com/a', { resolve: publicResolver, fetchImpl })
    assert.strictEqual(result.title, 'Hello World')
    assert.strictEqual(result.category, '🔗 #Link')
  })

  it('follows a redirect only after re-checking the target', async () => {
    const calls: string[] = []
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input))
      if (calls.length === 1) {
        return new Response(null, { status: 302, headers: { location: 'https://example.com/final' } })
      }
      return htmlResponse('<title>Final</title>')
    }) as unknown as typeof fetch

    const result = await scrapePage('https://example.com/start', { resolve: publicResolver, fetchImpl })
    assert.strictEqual(result.title, 'Final')
    assert.strictEqual(calls.length, 2)
    assert.strictEqual(result.url, 'https://example.com/final')
  })

  it('refuses a redirect that points at an internal address', async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/' } })) as unknown as typeof fetch

    await assert.rejects(
      () => scrapePage('https://example.com/start', { resolve: publicResolver, fetchImpl }),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'PRIVATE',
    )
  })

  it('stops following after the redirect budget', async () => {
    const fetchImpl = (async () =>
      new Response(null, { status: 302, headers: { location: 'https://example.com/loop' } })) as unknown as typeof fetch

    const result = await scrapePage('https://example.com/loop', { resolve: publicResolver, fetchImpl })
    assert.strictEqual(result.title, 'No Title')
  })

  it('still answers when the fetch itself fails', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('network down')
    }) as unknown as typeof fetch

    const result = await scrapePage('https://example.com', { resolve: publicResolver, fetchImpl })
    assert.strictEqual(result.title, 'No Title')
    assert.strictEqual(result.category, '🔗 #Link')
  })
})

describe('categorise', () => {
  it('maps well-known hosts', () => {
    assert.strictEqual(categorise('https://youtube.com/watch?v=1', 'x'), '📺 #Video')
    assert.strictEqual(categorise('https://github.com/a/b', 'x'), '💻 #Code')
    assert.strictEqual(categorise('https://i.ibb.co/abc/x.png', 'x'), '🖼️ #Image')
    assert.strictEqual(categorise('https://stackoverflow.com/q/1', 'x'), '❓ #Question')
  })

  it('falls back to title keywords, then to a plain link', () => {
    assert.strictEqual(categorise('https://example.com', 'A great tutorial'), '🎓 #Course')
    assert.strictEqual(categorise('https://example.com', 'Something else'), '🔗 #Link')
  })
})
