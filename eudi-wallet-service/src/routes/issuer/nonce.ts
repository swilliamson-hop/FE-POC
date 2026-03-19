import { randomBytes } from 'node:crypto'
import type { Context } from 'hono'

// POST /issuer/nonce
// Provides a fresh c_nonce for proof-of-possession JWTs.
export async function handleNonce(c: Context): Promise<Response> {
  const cNonce = randomBytes(16).toString('base64url')
  return c.json({ c_nonce: cNonce, c_nonce_expires_in: 300 })
}
