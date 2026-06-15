import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from 'jose'
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
    credential_configuration_id?: string
    proof?: { proof_type: string; jwt: string }
    proofs?: { jwt?: string[] }
  }>()

  console.log(`[Issuer/Credential] Request for session ${sessionId}, format=${body.format}`)

  // Extract the proof JWT. OID4VCI Draft 13 used `proof: { proof_type, jwt }`
  // (singular); Draft 14+ moved to `proofs: { jwt: [<jwt>, ...] }` (plural,
  // supports batch). IDGo/59 sends the plural form – without parsing it we
  // miss the holder key and issue a credential with no `cnf`, which the
  // wallet then rejects with a generic "credential offer unresolvable" error.
  const proofJwt =
    body.proofs?.jwt?.[0] ?? (body.proof?.proof_type === 'jwt' ? body.proof.jwt : undefined)

  // Validate proof-of-possession (holder key binding)
  let holderPublicKeyJwk: JWK | undefined
  if (proofJwt) {
    try {
      const proofHeader = decodeProtectedHeader(proofJwt)
      const proofPayload = decodeJwt(proofJwt) as Record<string, unknown>

      if (proofHeader.jwk) {
        holderPublicKeyJwk = proofHeader.jwk as JWK
        const holderKey = await importJWK(holderPublicKeyJwk, proofHeader.alg ?? 'ES256')
        await jwtVerify(proofJwt, holderKey, { typ: 'openid4vci-proof+jwt' })
        console.log(`[Issuer/Credential] Proof verified, holder key alg=${proofHeader.alg}`)
      } else {
        console.warn(`[Issuer/Credential] Proof JWT has no jwk in header (keys=${Object.keys(proofHeader).join(',')}) — credential will lack cnf binding`)
      }

      if (session.cNonce && proofPayload.nonce !== session.cNonce) {
        console.warn(`[Issuer/Credential] c_nonce mismatch: expected=${session.cNonce} got=${proofPayload.nonce}`)
        // For POC: warn but continue
      }
    } catch (err) {
      console.warn('[Issuer/Credential] Proof validation failed:', (err as Error).message)
      // For POC: continue without holder binding
    }
  } else {
    console.warn('[Issuer/Credential] No proof JWT in request body (neither `proof` nor `proofs.jwt[]`)')
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

    // OID4VCI Draft 15+ response shape: { credentials: [{ credential }] }.
    // Older drafts used { credential, format, c_nonce, c_nonce_expires_in };
    // c_nonce has moved to /issuer/nonce, format is implied by the request's
    // credential_configuration_id.
    return c.json({
      credentials: [{ credential }],
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
