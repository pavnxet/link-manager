/**
 * URL safety helpers.
 *
 * `assertPublicUrl` is the SSRF guard for /api/scrape: it refuses anything that is not http(s) and
 * anything that resolves to a private, loopback, link-local or metadata address, so the server
 * cannot be talked into fetching its own internals.
 *
 * `parseHttpUrl` is the much smaller check used when storing a link: only the scheme matters there,
 * because a stored `javascript:` URL would execute when the table renders it as an href.
 */

export class UrlSafetyError extends Error {
  readonly code: 'INVALID' | 'SCHEME' | 'PRIVATE' | 'DNS'
  readonly status: number

  constructor(message: string, code: UrlSafetyError['code'], status = 400) {
    super(message)
    this.name = 'UrlSafetyError'
    this.code = code
    this.status = status
  }
}

/** Parse a URL and require an http(s) scheme. Returns null when it is not a usable link. */
export function parseHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  return url
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    const n = Number(part)
    if (!/^\d{1,3}$/.test(part) || n > 255) return null
    value = value * 256 + n
  }
  return value
}

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

/** True for any address the server must never be made to fetch. */
export function isPrivateAddress(host: string): boolean {
  const hostname = host.replace(/^\[|\]$/g, '').toLowerCase()

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true
  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true
  if (hostname === 'metadata.google.internal') return true

  const v4 = ipv4ToInt(hostname)
  if (v4 !== null) {
    return PRIVATE_V4.some(([base, bits]) => {
      const baseInt = ipv4ToInt(base) as number
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      return (v4 & mask) === (baseInt & mask)
    })
  }

  // IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10),
  // and IPv4-mapped forms of the ranges above.
  if (hostname.includes(':')) {
    if (hostname === '::' || hostname === '::1') return true
    if (/^f[cd][0-9a-f]{2}:/.test(hostname)) return true
    if (/^fe[89ab][0-9a-f]:/.test(hostname)) return true
    const mapped = hostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }

  return false
}

export type HostResolver = (hostname: string) => Promise<string[]>

const defaultResolver: HostResolver = async hostname => {
  const dns = await import('node:dns/promises')
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  return records.map(record => record.address)
}

/**
 * Validate a URL for server-side fetching. Throws `UrlSafetyError` with a message that is safe to
 * show a user.
 */
export async function assertPublicUrl(
  raw: unknown,
  resolve: HostResolver = defaultResolver,
): Promise<URL> {
  const url = parseHttpUrl(raw)
  if (!url) throw new UrlSafetyError('Only http and https URLs can be fetched', 'SCHEME')

  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (isPrivateAddress(hostname)) {
    throw new UrlSafetyError('Refusing to fetch a private or internal address', 'PRIVATE')
  }

  // A hostname can resolve to an internal address even when the name looks public (DNS rebinding).
  let addresses: string[]
  try {
    addresses = await resolve(hostname)
  } catch {
    throw new UrlSafetyError('Could not resolve that hostname', 'DNS', 502)
  }
  if (addresses.some(address => isPrivateAddress(address))) {
    throw new UrlSafetyError('Refusing to fetch a host that resolves to a private address', 'PRIVATE')
  }

  return url
}
