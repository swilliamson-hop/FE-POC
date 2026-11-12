import type { Context } from 'hono'
import { getIssuanceSession, deleteIssuanceSession } from '../../lib/issuance-session.js'
import { previewCredentialClaims } from '../../lib/credential-builder.js'
import type { IssuanceResultResponse } from '../../types.js'

// GET /issuer/result/:sessionId
// Frontend polls this to check issuance completion status.
export function handleIssuanceResult(c: Context): Response {
  const sessionId = c.req.param('sessionId')
  const session = getIssuanceSession(sessionId)

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  if (Date.now() > session.expiresAt) {
    deleteIssuanceSession(sessionId)
    return c.json({ error: 'Session expired' }, 410)
  }

  // Still in progress
  if (session.status === 'pending_pid' || session.status === 'offer_created') {
    return c.json<IssuanceResultResponse>({ status: session.status }, 202)
  }

  // PID verified – return claims so frontend can show preview
  if (session.status === 'pid_verified') {
    return c.json<IssuanceResultResponse>({
      status: session.status,
      pidClaims: session.pidClaims,
      tenantMatch: session.tenantMatch,
      credentialClaims:
        session.tenant && session.pidClaims
          ? previewCredentialClaims(session.credentialType, session.pidClaims)
          : undefined,
    })
  }

  // Wallet holder is not the logged-in tenant – final. Only the per-field
  // flags go back, never the stranger's PID data.
  if (session.status === 'pid_mismatch') {
    deleteIssuanceSession(sessionId)
    return c.json<IssuanceResultResponse>({
      status: session.status,
      tenantMatch: session.tenantMatch,
    })
  }

  if (session.status === 'error') {
    deleteIssuanceSession(sessionId)
    return c.json<IssuanceResultResponse>(
      { status: 'error', errorMessage: session.errorMessage },
      400,
    )
  }

  // 'issued' — success, clean up
  deleteIssuanceSession(sessionId)
  return c.json<IssuanceResultResponse>({ status: 'issued' })
}
