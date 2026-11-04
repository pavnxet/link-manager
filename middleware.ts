import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for these paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/login') ||
    pathname === '/login' ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    return NextResponse.next()
  }

  const isApi = pathname.startsWith('/api/')

  // An API caller that is logged out needs a 401 it can read, not a 307 to an HTML login page
  // (which fetch() follows happily, leaving the client to parse HTML as JSON).
  const unauthorized = () =>
    isApi
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))

  const token = request.cookies.get('auth-token')

  if (!token) return unauthorized()

  const payload = await verifyToken(token.value)
  if (!payload) return unauthorized()

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
