export type PendingConfirm = {
  action: 'delete'
  token: string
  targetId: string
  expiresAt: number
}

export type Session = {
  chatId: number
  userId?: number
  authenticated: boolean
  expiresAt: number
  pendingConfirm?: PendingConfirm
  waitingForRestoreFile?: boolean
}

export function createSession(chatId: number, userId: number | undefined, ttlSeconds: number): Session {
  return {
    chatId,
    userId,
    authenticated: true,
    expiresAt: Date.now() + ttlSeconds * 1000,
  }
}

export function isSessionValid(session: Session | null): boolean {
  return !!session && session.authenticated && session.expiresAt > Date.now()
}

export function refreshSession(session: Session, ttlSeconds: number): Session {
  return {
    ...session,
    expiresAt: Date.now() + ttlSeconds * 1000,
  }
}
