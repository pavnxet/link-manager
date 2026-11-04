import { describe, it } from 'node:test'
import assert from 'node:assert'
import { UrlSafetyError, assertPublicUrl, isPrivateAddress, parseHttpUrl } from './url-safety.ts'

describe('parseHttpUrl', () => {
  it('accepts http and https', () => {
    assert.strictEqual(parseHttpUrl('https://example.com/a?b=1')?.hostname, 'example.com')
    assert.strictEqual(parseHttpUrl('http://example.com')?.protocol, 'http:')
    assert.strictEqual(parseHttpUrl('  https://example.com/x  ')?.pathname, '/x')
  })

  it('rejects non-http schemes, which is what stops a stored javascript: link', () => {
    for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,<script>', 'ftp://x.test']) {
      assert.strictEqual(parseHttpUrl(bad), null, bad)
    }
  })

  it('rejects empty and non-string input', () => {
    assert.strictEqual(parseHttpUrl(''), null)
    assert.strictEqual(parseHttpUrl('not a url'), null)
    assert.strictEqual(parseHttpUrl(undefined), null)
    assert.strictEqual(parseHttpUrl(42), null)
  })
})

describe('isPrivateAddress', () => {
  it('flags loopback, private, link-local and metadata ranges', () => {
    const blocked = [
      '127.0.0.1', '127.1.2.3', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.1',
      '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '192.0.0.1',
      '::1', '::', 'fc00::1', 'fd12::3', 'fe80::1', '::ffff:127.0.0.1',
      'localhost', 'app.localhost', 'printer.local', 'metadata.google.internal', 'db.internal',
    ]
    for (const host of blocked) assert.strictEqual(isPrivateAddress(host), true, host)
  })

  it('allows public addresses', () => {
    const allowed = ['8.8.8.8', '93.184.216.34', '172.32.0.1', '1.1.1.1', 'example.com', 'i.ibb.co', '2606:4700::1111']
    for (const host of allowed) assert.strictEqual(isPrivateAddress(host), false, host)
  })
})

describe('assertPublicUrl', () => {
  const publicResolver = async () => ['93.184.216.34']

  it('returns the URL when it is public', async () => {
    const url = await assertPublicUrl('https://example.com/x', publicResolver)
    assert.strictEqual(url.toString(), 'https://example.com/x')
  })

  it('refuses a literal internal address before any DNS lookup', async () => {
    let resolved = false
    const resolver = async () => {
      resolved = true
      return ['93.184.216.34']
    }
    await assert.rejects(
      () => assertPublicUrl('http://169.254.169.254/latest/meta-data/', resolver),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'PRIVATE' && err.status === 400,
    )
    assert.strictEqual(resolved, false, 'no lookup should happen for a blocked literal')
  })

  it('refuses a hostname that resolves to an internal address (DNS rebinding)', async () => {
    const resolver = async () => ['10.0.0.5']
    await assert.rejects(
      () => assertPublicUrl('https://looks-public.example', resolver),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'PRIVATE',
    )
  })

  it('refuses a hostname that mixes public and private answers', async () => {
    const resolver = async () => ['93.184.216.34', '127.0.0.1']
    await assert.rejects(
      () => assertPublicUrl('https://mixed.example', resolver),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'PRIVATE',
    )
  })

  it('reports a DNS failure as a 502', async () => {
    const resolver = async () => {
      throw new Error('ENOTFOUND')
    }
    await assert.rejects(
      () => assertPublicUrl('https://does-not-resolve.example', resolver),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'DNS' && err.status === 502,
    )
  })

  it('rejects a non-http scheme', async () => {
    await assert.rejects(
      () => assertPublicUrl('file:///etc/passwd', publicResolver),
      (err: unknown) => err instanceof UrlSafetyError && err.code === 'SCHEME',
    )
  })
})
