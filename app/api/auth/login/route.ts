import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
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
