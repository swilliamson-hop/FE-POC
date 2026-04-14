import { randomBytes } from 'node:crypto'
import type { Context } from 'hono'
import { findSessionByPreAuthCode, updateIssuanceSession } from '../../lib/issuance-session.js'

// POST /issuer/token
// Wallet exchanges pre-authorized code for access token + c_nonce.
export async function handleToken(c: Context): Promise<Response> {
  let grantType: string | undefined
  let preAuthorizedCode: string | undefined
  let txCode: string | undefined

  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await c.req.formData()
    grantType = formData.get('grant_type') as string
    preAuthorizedCode = formData.get('pre-authorized_code') as string
    // Accept both tx_code (new draft) and user_pin (old draft)
    txCode = (formData.get('tx_code') ?? formData.get('user_pin')) as string | undefined
  } else {
    const body = await c.req.json<Record<string, string>>()
    grantType = body.grant_type
    preAuthorizedCode = body['pre-authorized_code']
    txCode = body.tx_code ?? body.user_pin
  }

  console.log(`[Issuer/Token] grant_type=${grantType} pin=${txCode ? '***' : 'missing'}`)

  if (grantType !== 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
    return c.json({ error: 'unsupported_grant_type' }, 400)
  }

  if (!preAuthorizedCode) {
    return c.json({ error: 'invalid_request', error_description: 'Missing pre-authorized_code' }, 400)
  }

  const found = findSessionByPreAuthCode(preAuthorizedCode)
  if (!found) {
    return c.json({ error: 'invalid_grant', error_description: 'Invalid pre-authorized code' }, 400)
  }

  const [sessionId, session] = found

  if (!txCode || txCode !== session.txCode) {
    console.log(`[Issuer/Token] tx_code mismatch: got=${txCode} expected=${session.txCode}`)
    return c.json({ error: 'invalid_grant', error_description: 'Invalid tx_code' }, 400)
  }

  const accessToken = randomBytes(32).toString('base64url')
  const cNonce = randomBytes(16).toString('base64url')
  const cNonceExpiresIn = 300

  updateIssuanceSession(sessionId, {
    accessToken,
    cNonce,
    cNonceExpiresAt: Date.now() + cNonceExpiresIn * 1000,
  })

  console.log(`[Issuer/Token] Token issued for session ${sessionId}`)

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 600,
    c_nonce: cNonce,
    c_nonce_expires_in: cNonceExpiresIn,
  })
}
