import type { Context } from 'hono'
import { getSessionById, deleteSession } from '../../lib/session.js'
import { getIssuanceSession, updateIssuanceSession } from '../../lib/issuance-session.js'
import { matchTenant } from '../../lib/tenant-match.js'

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

  // Same entitlement check as the auto-link in /callback
  const tenantMatch = issuanceSession.tenant
    ? matchTenant(issuanceSession.tenant, vpSession.pidClaims)
    : undefined
  if (tenantMatch && !tenantMatch.matched) {
    updateIssuanceSession(issuanceSessionId, { tenantMatch, status: 'pid_mismatch' })
    deleteSession(vpSessionId)
    return c.json({ status: 'pid_mismatch', tenantMatch })
  }

  updateIssuanceSession(issuanceSessionId, {
    pidClaims: vpSession.pidClaims,
    tenantMatch,
    status: 'pid_verified',
  })

  // VP session is no longer needed
  deleteSession(vpSessionId)

  console.log(`[Issuer] PID linked: ${vpSession.pidClaims.given_name} ${vpSession.pidClaims.family_name} → issuance ${issuanceSessionId}`)

  return c.json({ status: 'pid_verified', pidClaims: vpSession.pidClaims })
}
