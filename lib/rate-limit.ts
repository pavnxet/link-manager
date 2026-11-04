/**
 * Fixed-window rate limiter for the single admin login.
 *
 * Deliberately in-memory: this is a single-user app and the goal is to stop a password guesser,
 * not to survive a botnet. On a serverless platform each instance keeps its own window, so the
 * effective limit is per instance — pair it with a strong password and Vercel's own protections.
 */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Seconds until the window frees up; 0 when the request is allowed. */
  retryAfterSeconds: number
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number

  constructor(limit = 5, windowMs = 15 * 60 * 1000, now: () => number = Date.now) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
  }

  check(key: string): RateLimitResult {
    const now = this.now()
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter(at => at > cutoff)

    if (recent.length >= this.limit) {
      const oldest = recent[0]
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
      this.hits.set(key, recent)
      return { allowed: false, remaining: 0, retryAfterSeconds }
    }

    recent.push(now)
    this.hits.set(key, recent)
    this.prune(cutoff)
    return { allowed: true, remaining: this.limit - recent.length, retryAfterSeconds: 0 }
  }

  reset(key?: string) {
    if (key === undefined) this.hits.clear()
    else this.hits.delete(key)
  }

  /** Drop keys whose window has fully expired, so the map cannot grow without bound. */
  private prune(cutoff: number) {
    if (this.hits.size < 500) return
    for (const [key, times] of this.hits) {
      if (times.every(at => at <= cutoff)) this.hits.delete(key)
    }
  }
}

/** Best-effort client identity for a login attempt. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
