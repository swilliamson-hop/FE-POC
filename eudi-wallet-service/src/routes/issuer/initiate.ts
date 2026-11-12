import { generateKeyPair, exportJWK } from 'jose'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Context } from 'hono'
import { createIssuanceSession } from '../../lib/issuance-session.js'
import { createSession, setReturnUrl } from '../../lib/session.js'
import { createSignedJar, computeClientId } from '../../lib/jar.js'
import type { IssuanceInitiateRequest, CredentialType, TenantAccount } from '../../types.js'

export async function handleIssuanceInitiate(c: Context): Promise<Response> {
  const serviceUrl = process.env.SERVICE_URL!

  let credentialType: CredentialType = 'wohnungsgeberbestaetigung'
  let returnUrl: string | undefined
  let tenant: TenantAccount | undefined
  let skipTxCode = false

  try {
    const body = await c.req.json<IssuanceInitiateRequest>()
    if (body.credentialType) credentialType = body.credentialType
    if (body.returnUrl) returnUrl = body.returnUrl
    if (body.skipTxCode === true) skipTxCode = true
    if (body.tenant) {
      const { givenName, familyName, birthdate } = body.tenant
      if (
        typeof givenName !== 'string' || typeof familyName !== 'string' || typeof birthdate !== 'string' ||
        !givenName.trim() || !familyName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)
      ) {
        return c.json({ error: 'Invalid tenant' }, 400)
      }
      tenant = { givenName: givenName.trim(), familyName: familyName.trim(), birthdate }
    }
  } catch {
    // no body – use defaults
  }

  const validTypes: CredentialType[] = ['wohnungsgeberbestaetigung', 'genossenschaft-mitglied']
  if (!validTypes.includes(credentialType)) {
    return c.json({ error: 'Invalid credential type' }, 400)
  }

  // Create VP session for PID verification (reuses existing OpenID4VP flow)
  const vpSessionId = randomUUID()
  const nonce = randomBytes(32).toString('base64url')
  const { privateKey, publicKey } = await generateKeyPair('ECDH-ES', { extractable: true })
  const ephemeralPublicKeyJwk = await exportJWK(publicKey)
  ephemeralPublicKeyJwk.kid = randomUUID()
  ephemeralPublicKeyJwk.use = 'enc'
  ephemeralPublicKeyJwk.alg = 'ECDH-ES'

  const jar = await createSignedJar({
    sessionId: vpSessionId,
    nonce,
    ephemeralPublicKeyJwk,
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  })

  const now = Date.now()
  // Create issuance session first so we can link it to the VP session
  const issuanceSessionId = randomUUID()
  const preAuthorizedCode = randomBytes(32).toString('base64url')
  // Random 4-digit PIN as tx_code (optional – see skipTxCode)
  const txCode = skipTxCode ? undefined : Math.floor(1000 + Math.random() * 9000).toString()

  createIssuanceSession(issuanceSessionId, {
    credentialType,
    preAuthorizedCode,
    txCode,
    tenant,
    createdAt: now,
    expiresAt: now + 15 * 60 * 1000,
    status: 'pending_pid',
  })

  createSession(vpSessionId, {
    nonce,
    ephemeralPrivateKey: privateKey,
    ephemeralPublicKeyJwk,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000,
    status: 'pending',
    issuanceSessionId,
  })

  if (returnUrl) setReturnUrl(vpSessionId, returnUrl)

  console.log(`[Issuer] Initiate: issuance=${issuanceSessionId} vp=${vpSessionId} type=${credentialType} tenantMatch=${tenant ? 'on' : 'off'} pin=${txCode ? 'on' : 'off'}`)

  // Build openid4vp:// URL for PID verification
  const clientId = computeClientId()
  const requestUri = `${serviceUrl}/request/${vpSessionId}`
  const walletUrl = `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`

  return c.json({
    sessionId: issuanceSessionId,
    vpSessionId,
    walletUrl,
  })
}
