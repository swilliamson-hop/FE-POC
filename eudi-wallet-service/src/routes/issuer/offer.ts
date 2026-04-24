import type { Context } from 'hono'
import { getIssuanceSession, updateIssuanceSession } from '../../lib/issuance-session.js'
import type { CredentialOfferObject } from '../../types.js'

const SERVICE_URL = process.env.SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`

// POST /issuer/create-offer/:sessionId
// Called by frontend after PID verified, triggers credential offer generation.
export async function handleCreateOffer(c: Context): Promise<Response> {
  const sessionId = c.req.param('sessionId')
  const session = getIssuanceSession(sessionId)

  if (!session) return c.json({ error: 'Session not found' }, 404)
  if (session.status !== 'pid_verified') {
    return c.json({ error: `Invalid session status: ${session.status}` }, 400)
  }

  updateIssuanceSession(sessionId, { status: 'offer_created' })

  const credentialOfferUri = `${SERVICE_URL}/issuer/offer/${sessionId}`
  const walletUrl = `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(credentialOfferUri)}`

  console.log(`[Issuer] Offer created for session ${sessionId}: ${walletUrl} (txCode=${session.txCode})`)

  return c.json({ sessionId, credentialOfferUri, walletUrl, txCode: session.txCode })
}

// GET /issuer/offer/:sessionId
// Wallet fetches this to get the credential offer JSON.
export function handleGetOffer(c: Context): Response {
  const sessionId = c.req.param('sessionId')
  const session = getIssuanceSession(sessionId)

  if (!session) return c.json({ error: 'Session not found' }, 404)
  if (session.status !== 'offer_created' && session.status !== 'pid_verified') {
    return c.json({ error: `Invalid session status: ${session.status}` }, 400)
  }

  const offer = {
    credential_issuer: SERVICE_URL,
    credential_configuration_ids: [session.credentialType],
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': session.preAuthorizedCode,
        // BMI EAA Developer Guide uses user_pin_required only (no tx_code object)
        user_pin_required: true,
      },
    },
  }

  console.log(`[Issuer] Offer fetched by wallet for session ${sessionId}`)

  return c.json(offer)
}
