import type { IssuanceSessionState } from '../types.js'

// In-memory issuance session store (sufficient for POC)
const issuanceSessions = new Map<string, IssuanceSessionState>()

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of issuanceSessions.entries()) {
    if (now > session.expiresAt) {
      issuanceSessions.delete(id)
    }
  }
}, 5 * 60 * 1000)

export function createIssuanceSession(sessionId: string, state: IssuanceSessionState): void {
  issuanceSessions.set(sessionId, state)
}

export function getIssuanceSession(sessionId: string): IssuanceSessionState | undefined {
  return issuanceSessions.get(sessionId)
}

export function updateIssuanceSession(sessionId: string, update: Partial<IssuanceSessionState>): boolean {
  const session = issuanceSessions.get(sessionId)
  if (!session) return false
  issuanceSessions.set(sessionId, { ...session, ...update })
  return true
}

export function deleteIssuanceSession(sessionId: string): void {
  issuanceSessions.delete(sessionId)
}

// Lookup by pre-authorized code (wallet sends this to /issuer/token)
export function findSessionByPreAuthCode(code: string): [string, IssuanceSessionState] | undefined {
  for (const [id, session] of issuanceSessions.entries()) {
    if (session.preAuthorizedCode === code) return [id, session]
  }
  return undefined
}

// Lookup by access token (wallet sends this to /issuer/credential)
export function findSessionByAccessToken(token: string): [string, IssuanceSessionState] | undefined {
  for (const [id, session] of issuanceSessions.entries()) {
    if (session.accessToken === token) return [id, session]
  }
  return undefined
}
