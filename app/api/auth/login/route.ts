import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { signToken } from '@/lib/auth'
import { RateLimiter, clientKey } from '@/lib/rate-limit'

// 5 failed attempts per 15 minutes per client. Module scope, so it survives between requests
// within one server instance.
const loginLimiter = new RateLimiter(5, 15 * 60 * 1000)

export async function POST(req: Request) {
  try {
    const key = clientKey(req)
    const limit = loginLimiter.check(key)
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).` },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const { username, password } = await req.json()

    // Retrieve environment variables
    const adminUsername = process.env.ADMIN_USERNAME
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminUsername || !adminPassword) {
      return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 })
    }

    if (username === adminUsername && password === adminPassword) {
      const token = await signToken({ role: 'admin' })
      const cookieStore = await cookies()

      // Set cookie
      cookieStore.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: 'strict',
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
