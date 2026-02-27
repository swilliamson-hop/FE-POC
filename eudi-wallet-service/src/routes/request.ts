import type { Context } from 'hono'
import { getSessionById, isSessionExpired } from '../lib/session.js'
import { createSignedJar } from '../lib/jar.js'

export async function handleRequest(c: Context): Promise<Response> {
  const sessionId = c.req.param('sessionId')
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

  const session = getSessionById(sessionId)

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  if (isSessionExpired(session)) {
    return c.json({ error: 'Session expired' }, 410)
  }

  // Create the signed JAR on demand (wallet fetches this)
  const jar = await createSignedJar({
    sessionId,
    nonce: session.nonce,
    ephemeralPublicKeyJwk: session.ephemeralPublicKeyJwk,
    frontendUrl,
  })

  return new Response(jar, {
    status: 200,
    headers: {
      'Content-Type': 'application/oauth-authz-req+jwt',
      'Cache-Control': 'no-store',
    },
  })
}
