import { generateKeyPair, exportJWK } from 'jose'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Context } from 'hono'
import { createSession } from '../lib/session.js'
import { createSignedJar, computeClientId } from '../lib/jar.js'
import type { InitiateResponse } from '../types.js'

export async function handleInitiate(c: Context): Promise<Response> {
  const serviceUrl = process.env.SERVICE_URL!
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

  // Generate session ID and nonce
  const sessionId = randomUUID()
  const nonce = randomBytes(32).toString('base64url')

  // Generate ephemeral P-256 key pair for JWE response encryption
  const { privateKey, publicKey } = await generateKeyPair('ECDH-ES', {
    extractable: true,
  })
  const ephemeralPublicKeyJwk = await exportJWK(publicKey)
  // Add key use and algorithm hint
  ephemeralPublicKeyJwk.use = 'enc'
  ephemeralPublicKeyJwk.alg = 'ECDH-ES'

  // Create signed JAR
  const jar = await createSignedJar({
    sessionId,
    nonce,
    ephemeralPublicKeyJwk,
    frontendUrl,
  })

  // Store session (keyed by sessionId for lookup)
  const now = Date.now()
  createSession(sessionId, {
    nonce,
    ephemeralPrivateKey: privateKey,
    ephemeralPublicKeyJwk,
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes
    status: 'pending',
  })

  // Build the openid4vp:// URL
  // client_id uses x509_hash scheme: "x509_hash:<sha256-thumbprint-of-cert>"
  const certChainPem = (process.env.CERT_CHAIN ?? '').replace(/\\n/g, '\n')
  const clientId = computeClientId(certChainPem)
  const requestUri = `${serviceUrl}/request/${sessionId}`
  const walletUrl = `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`

  const response: InitiateResponse = {
    sessionId,
    walletUrl,
  }

  return c.json(response, 200)
}
