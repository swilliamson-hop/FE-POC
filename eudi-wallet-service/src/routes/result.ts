import type { Context } from 'hono'
import { getSessionById, deleteSession, isSessionExpired } from '../lib/session.js'
import type { ResultResponse } from '../types.js'

export async function handleResult(c: Context): Promise<Response> {
  const sessionId = c.req.param('sessionId')
  const session = getSessionById(sessionId)

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  if (isSessionExpired(session)) {
    return c.json({ error: 'Session expired' }, 410)
  }

  if (session.status === 'pending') {
    return c.json<ResultResponse>({ status: 'pending' }, 202)
  }

  if (session.status === 'error') {
    deleteSession(sessionId)
    return c.json<ResultResponse>(
      { status: 'error', errorMessage: session.errorMessage },
      400
    )
  }

  // Complete – return claims and clean up session
  const response: ResultResponse = {
    status: 'complete',
    pidClaims: session.pidClaims,
  }

  deleteSession(sessionId)
  return c.json(response, 200)
}
