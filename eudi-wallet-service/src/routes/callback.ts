import type { Context } from 'hono'
import { getSessionById, updateSession, isSessionExpired } from '../lib/session.js'
import { validateVpToken, ValidationError } from '../lib/validator.js'

export async function handleCallback(c: Context): Promise<Response> {
  const sessionId = c.req.param('sessionId')
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

  const session = getSessionById(sessionId)

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  if (isSessionExpired(session)) {
    return c.json({ error: 'Session expired' }, 410)
  }

  // Parse body – wallet sends application/x-www-form-urlencoded or application/json
  let body: Record<string, unknown>
  const contentType = c.req.header('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await c.req.formData()
    body = Object.fromEntries(formData.entries())
  } else if (contentType.includes('application/jwt')) {
    // direct_post.jwt mode: body is a JWT
    const rawJwt = await c.req.text()
    body = { vp_token: rawJwt }
  } else {
    body = await c.req.json<Record<string, unknown>>()
  }

  try {
    const pidClaims = await validateVpToken(body, session)

    updateSession(sessionId, {
      status: 'complete',
      pidClaims,
    })

    console.log(`[Callback] Session ${sessionId} complete – PID received for ${pidClaims.given_name} ${pidClaims.family_name}`)

    // For same-device flow: redirect wallet back to frontend
    const redirectUri = `${frontendUrl}/bewerbung?wallet_session=${sessionId}`
    return c.json({ redirect_uri: redirectUri }, 200)
  } catch (err) {
    const message = err instanceof ValidationError ? err.message : 'VP token validation failed'
    console.error(`[Callback] Validation error for session ${sessionId}:`, message)

    updateSession(sessionId, {
      status: 'error',
      errorMessage: message,
    })

    return c.json({ error: message }, 400)
  }
}
