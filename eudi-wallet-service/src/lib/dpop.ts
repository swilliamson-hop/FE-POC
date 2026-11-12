import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify } from 'jose'
import { createHash } from 'node:crypto'
import type { JWK } from 'jose'

// DPoP (RFC 9449) proof validation for the issuer's token + credential endpoints.
// The SPRIND wallet (eudi-lib-ios-openid4vci-swift, requireDpop=true) refuses to
// talk to an authorization server that does not advertise
// dpop_signing_alg_values_supported ("dpopRequired") and rejects non-DPoP tokens
// ("dpopRequiredButNotIssued").

export const DPOP_ALGS = ['ES256']
const MAX_AGE_SECONDS = 300

// Replay protection: remember jti values for the proof lifetime (in-memory, like sessions).
const seenJtis = new Map<string, number>()
function rememberJti(jti: string): boolean {
  const now = Date.now()
  for (const [k, exp] of seenJtis) if (exp < now) seenJtis.delete(k)
  if (seenJtis.has(jti)) return false
  seenJtis.set(jti, now + 2 * MAX_AGE_SECONDS * 1000)
  return true
}

export class DpopError extends Error {}

export interface DpopCheck {
  proof: string
  htm: string
  // Public URL of the endpoint (SERVICE_URL-based — the request URL behind
  // Railway's proxy is not reliable).
  htu: string
  // Required on resource requests: proof must carry ath = b64url(sha256(token)).
  accessToken?: string
}

// Verifies a DPoP proof and returns the JWK thumbprint (jkt) of its key.
export async function verifyDpopProof({ proof, htm, htu, accessToken }: DpopCheck): Promise<string> {
  let header
  try {
    header = decodeProtectedHeader(proof)
  } catch {
    throw new DpopError('DPoP proof is not a JWS')
  }
  if (header.typ !== 'dpop+jwt') throw new DpopError(`invalid typ ${header.typ}`)
  if (!header.alg || !DPOP_ALGS.includes(header.alg)) throw new DpopError(`unsupported alg ${header.alg}`)
  const jwk = header.jwk as JWK | undefined
  if (!jwk || 'd' in jwk) throw new DpopError('missing or private jwk in header')

  const key = await importJWK(jwk, header.alg)
  const { payload } = await jwtVerify(proof, key, { typ: 'dpop+jwt', maxTokenAge: MAX_AGE_SECONDS, clockTolerance: 60 })
    .catch((e: Error) => { throw new DpopError(`signature/claims invalid: ${e.message}`) })

  if (payload.htm !== htm) throw new DpopError(`htm mismatch: ${payload.htm} != ${htm}`)
  if (stripQuery(String(payload.htu)) !== stripQuery(htu)) throw new DpopError(`htu mismatch: ${payload.htu} != ${htu}`)
  if (typeof payload.jti !== 'string' || !rememberJti(payload.jti)) throw new DpopError('missing or replayed jti')
  if (accessToken !== undefined) {
    const ath = createHash('sha256').update(accessToken).digest('base64url')
    if (payload.ath !== ath) throw new DpopError('ath does not match access token')
  }
  return calculateJwkThumbprint(jwk, 'sha256')
}

function stripQuery(u: string): string {
  return u.split(/[?#]/)[0]
}
