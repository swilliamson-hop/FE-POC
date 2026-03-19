import type { Context } from 'hono'
import { getSessionById, deleteSession } from '../../lib/session.js'
import { getIssuanceSession, updateIssuanceSession } from '../../lib/issuance-session.js'

// POST /issuer/link-pid
// Called by frontend after PID verification completes.
// Transfers PID claims from the VP session to the issuance session.
export async function handleLinkPid(c: Context): Promise<Response> {
  const body = await c.req.json<{ issuanceSessionId: string; vpSessionId: string }>()
  const { issuanceSessionId, vpSessionId } = body

  const issuanceSession = getIssuanceSession(issuanceSessionId)
  if (!issuanceSession) {
    return c.json({ error: 'Issuance session not found' }, 404)
  }
  if (issuanceSession.status !== 'pending_pid') {
    return c.json({ error: `Invalid status: ${issuanceSession.status}` }, 400)
  }

  const vpSession = getSessionById(vpSessionId)
  if (!vpSession) {
    return c.json({ error: 'VP session not found' }, 404)
  }
  if (vpSession.status !== 'complete' || !vpSession.pidClaims) {
    return c.json({ error: 'PID not yet verified' }, 400)
  }

  updateIssuanceSession(issuanceSessionId, {
    pidClaims: vpSession.pidClaims,
    status: 'pid_verified',
  })

  // VP session is no longer needed
  deleteSession(vpSessionId)

  console.log(`[Issuer] PID linked: ${vpSession.pidClaims.given_name} ${vpSession.pidClaims.family_name} → issuance ${issuanceSessionId}`)

  return c.json({ status: 'pid_verified', pidClaims: vpSession.pidClaims })
}
