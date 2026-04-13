import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from 'jose'
import { randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import type { JWK } from 'jose'
import { findSessionByAccessToken, updateIssuanceSession } from '../../lib/issuance-session.js'
import { createCredential } from '../../lib/credential-builder.js'

// POST /issuer/credential
// Wallet sends proof-of-possession JWT, receives SD-JWT-VC credential.
export async function handleCredential(c: Context): Promise<Response> {
  const authHeader = c.req.header('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'invalid_token' }, 401)
  }
  const accessToken = authHeader.slice(7)

  const found = findSessionByAccessToken(accessToken)
  if (!found) {
    return c.json({ error: 'invalid_token' }, 401)
  }

  const [sessionId, session] = found

  if (!session.pidClaims) {
    return c.json({ error: 'invalid_request', error_description: 'PID not verified' }, 400)
  }

  const body = await c.req.json<{
    format?: string
    credential_identifier?: string
    proof?: { proof_type: string; jwt: string }
  }>()

  console.log(`[Issuer/Credential] Request for session ${sessionId}, format=${body.format}`)

  // Validate proof-of-possession (holder key binding)
  let holderPublicKeyJwk: JWK | undefined
  if (body.proof?.proof_type === 'jwt' && body.proof.jwt) {
    try {
      const proofHeader = decodeProtectedHeader(body.proof.jwt)
      const proofPayload = decodeJwt(body.proof.jwt) as Record<string, unknown>

      if (proofHeader.jwk) {
        holderPublicKeyJwk = proofHeader.jwk as JWK
        const holderKey = await importJWK(holderPublicKeyJwk, proofHeader.alg ?? 'ES256')
        await jwtVerify(body.proof.jwt, holderKey, { typ: 'openid4vci-proof+jwt' })
        console.log(`[Issuer/Credential] Proof verified, holder key alg=${proofHeader.alg}`)
      }

      if (session.cNonce && proofPayload.nonce !== session.cNonce) {
        console.warn(`[Issuer/Credential] c_nonce mismatch: expected=${session.cNonce} got=${proofPayload.nonce}`)
        // For POC: warn but continue
      }
    } catch (err) {
      console.warn('[Issuer/Credential] Proof validation failed:', (err as Error).message)
      // For POC: continue without holder binding
    }
  }

  try {
    const credential = await createCredential(
      session.credentialType,
      session.pidClaims,
      holderPublicKeyJwk,
    )

    updateIssuanceSession(sessionId, {
      status: 'issued',
      holderPublicKeyJwk,
    })

    console.log(`[Issuer] Credential issued: ${session.credentialType} for ${session.pidClaims.given_name} ${session.pidClaims.family_name}`)

    const newCNonce = randomBytes(16).toString('base64url')

    return c.json({
      credential,
      format: 'dc+sd-jwt',
      c_nonce: newCNonce,
      c_nonce_expires_in: 300,
    })
  } catch (err) {
    console.error('[Issuer/Credential] Creation failed:', err)
    updateIssuanceSession(sessionId, {
      status: 'error',
      errorMessage: (err as Error).message,
    })
    return c.json({ error: 'server_error', error_description: 'Credential creation failed' }, 500)
  }
}
