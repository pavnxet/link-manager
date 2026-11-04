import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const DEV_SECRET = 'default-secret-key-for-development'
export const MIN_SECRET_LENGTH = 16

let cachedKey: Uint8Array | null = null

/**
 * The signing key, resolved lazily so a missing secret fails a request instead of the build.
 *
 * Previously an unset JWT_SECRET silently fell back to a constant that is published in this repo,
 * which meant anyone could mint a valid `auth-token` cookie and read the whole vault. In production
 * that fallback is now refused outright.
 */
function getKey(): Uint8Array {
  if (cachedKey) return cachedKey

  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set: refusing to sign auth tokens with the public development secret')
    }
    cachedKey = new TextEncoder().encode(DEV_SECRET)
    return cachedKey
  }
  if (process.env.NODE_ENV === 'production' && secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production`)
  }
  cachedKey = new TextEncoder().encode(secret)
  return cachedKey
}

/** Test hook: forget the cached key after changing JWT_SECRET. */
export function resetKeyCache() {
  cachedKey = null
}

export async function signToken(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getKey())
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ['HS256'],
    })
    return payload
  } catch {
    return null
  }
}
