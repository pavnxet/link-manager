import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Clears the session cookie. Without this the only way to sign out was to wipe browser data,
 * which left a valid token alive for its full 7-day lifetime.
 */
export async function POST() {
  const cookieStore = await cookies()
  cookieStore.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
    sameSite: 'strict',
  })
  return NextResponse.json({ success: true })
}
