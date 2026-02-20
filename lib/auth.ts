/**
 * Generates the expected auth token based on the ADMIN_PASSWORD environment variable.
 * Uses SHA-256 hashing for a more secure token than a static string.
 * This is compatible with both Node.js and Edge runtimes.
 */
export async function getExpectedToken() {
  const adminPassword = process.env.ADMIN_PASSWORD || ''
  if (!adminPassword) return 'never-match'

  const msgUint8 = new TextEncoder().encode(adminPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verifies if a given token value matches the expected token.
 */
export async function verifyToken(tokenValue: string | undefined) {
  if (!tokenValue) return false
  const expectedToken = await getExpectedToken()
  return tokenValue === expectedToken
}

/**
 * Verifies the current authentication state using cookies.
 * Suitable for use in Server Components and API Routes.
 */
export async function verifyAuth() {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')
    return verifyToken(token?.value)
  } catch (error) {
    console.error('Auth verification error:', error)
    return false
  }
}
