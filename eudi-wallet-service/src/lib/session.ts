import type { SessionState } from '../types.js'

// In-memory session store (sufficient for POC)
// In production: use Redis or similar
const sessions = new Map<string, SessionState>()

// Separate store for returnUrls – outlives the session so /done/ can still redirect
// even after /result/ has already deleted the session
const returnUrls = new Map<string, string>()

export function setReturnUrl(sessionId: string, url: string): void {
  returnUrls.set(sessionId, url)
  // Clean up after 15 minutes regardless
  setTimeout(() => returnUrls.delete(sessionId), 15 * 60 * 1000)
}

export function getReturnUrl(sessionId: string): string | undefined {
  return returnUrls.get(sessionId)
}

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id)
    }
  }
}, 5 * 60 * 1000)

export function createSession(sessionId: string, state: SessionState): void {
  sessions.set(sessionId, state)
}

export function getSessionById(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId)
}

export function updateSession(sessionId: string, update: Partial<SessionState>): boolean {
  const session = sessions.get(sessionId)
  if (!session) return false
  sessions.set(sessionId, { ...session, ...update })
  return true
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function isSessionExpired(session: SessionState): boolean {
  return Date.now() > session.expiresAt
}
