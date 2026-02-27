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

  // Parse body – wallet sends application/x-www-form-urlencoded with `response` field (direct_post.jwt)
  let body: Record<string, unknown>
  const contentType = c.req.header('content-type') ?? ''

  console.log(`[Callback] Content-Type: ${contentType}`)

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await c.req.formData()
    const raw = Object.fromEntries(formData.entries())
    console.log(`[Callback] Form fields: ${Object.keys(raw).join(', ')}`)

    if (raw.response) {
      // direct_post.jwt: `response` field contains a JWE wrapping { vp_token, presentation_submission }
      body = { _encryptedResponse: raw.response as string }
    } else {
      // Fallback: direct_post (unencrypted) sends vp_token directly
      body = raw
    }
  } else {
    body = await c.req.json<Record<string, unknown>>()
    console.log(`[Callback] JSON fields: ${Object.keys(body).join(', ')}`)
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
