import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const secretKey = process.env.JWT_SECRET || 'default-secret-key-for-development'
const key = new TextEncoder().encode(secretKey)

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: JWT_SECRET is not set in production environment!')
}

export async function signToken(payload: JWTPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    })
    return payload
  } catch {
    return null
  }
}
