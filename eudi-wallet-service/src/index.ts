import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { randomUUID } from 'node:crypto'
import { handleInitiate } from './routes/initiate.js'
import { handleRequest } from './routes/request.js'
import { handleCallback } from './routes/callback.js'
import { handleResult } from './routes/result.js'
import { loadTrustLists } from './lib/trustlist.js'
import { getReturnUrl } from './lib/session.js'
import { handleIssuerMetadata, handleAuthServerMetadata } from './routes/issuer/metadata.js'
import { handleIssuanceInitiate } from './routes/issuer/initiate.js'
import { handleLinkPid } from './routes/issuer/pid-callback.js'
import { handleCreateOffer, handleGetOffer } from './routes/issuer/offer.js'
import { handleToken } from './routes/issuer/token.js'
import { handleCredential } from './routes/issuer/credential.js'
import { handleNonce } from './routes/issuer/nonce.js'
import { handleIssuanceResult } from './routes/issuer/result.js'

const app = new Hono()

// CORS – allow frontend origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())

app.use(
  '*',
  cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// === DEBUG: white-screen-on-first-scan investigation (added 2026-04-28) ===
// To roll back: remove this section and restore the simple logger above
// To disable individual delays: unset the ARTIFICIAL_DELAY_* env vars

// List of headers worth logging from wallet requests (empty values are skipped)
const RELEVANT_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'pragma',
  'if-none-match',
  'if-modified-since',
  'range',
  'content-type',
  'content-length',
  'origin',
  'referer',
] as const

function formatHeaders(c: Context): string {
  const parts: string[] = []
  for (const name of RELEVANT_HEADERS) {
    const value = c.req.header(name)
    if (value) parts.push(`${name}=${value}`)
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}

// Per-request ID + millisecond timing + full relevant headers
// Output format makes it easy to grep and to pair [REQ <id>] with [RES <id>]
app.use('*', async (c, next) => {
  const reqId = randomUUID().slice(0, 8)
  const start = Date.now()
  const ts = new Date(start).toISOString().slice(11, 23) // HH:mm:ss.SSS
  const ua = (c.req.header('user-agent') ?? '-').slice(0, 60)
  const headers = formatHeaders(c)

  console.log(`[REQ ${reqId}] ${ts} ${c.req.method} ${c.req.path} ua=${ua}${headers}`)

  await next()

  const duration = Date.now() - start
  console.log(`[RES ${reqId}] +${duration}ms ${c.req.method} ${c.req.path} -> ${c.res.status}`)
})

// Artificial delay middleware – probes wallet race conditions
// Set ARTIFICIAL_DELAY_OFFER_MS or ARTIFICIAL_DELAY_METADATA_MS to test
const offerDelayMs = Number(process.env.ARTIFICIAL_DELAY_OFFER_MS ?? 0)
const metadataDelayMs = Number(process.env.ARTIFICIAL_DELAY_METADATA_MS ?? 0)

if (offerDelayMs > 0 || metadataDelayMs > 0) {
  console.log(`[DELAY-CONFIG] offer=${offerDelayMs}ms metadata=${metadataDelayMs}ms`)
}

app.use('*', async (c, next) => {
  let delay = 0
  if (offerDelayMs > 0 && c.req.path.startsWith('/issuer/offer/')) delay = offerDelayMs
  else if (metadataDelayMs > 0 && c.req.path.startsWith('/.well-known/')) delay = metadataDelayMs

  if (delay > 0) {
    console.log(`[DELAY] ${c.req.path} sleeping ${delay}ms`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
  await next()
})

// === END DEBUG section ===

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// EUDI Wallet endpoints
app.post('/initiate', handleInitiate)
app.get('/request/:sessionId', handleRequest)
app.post('/callback/:sessionId', handleCallback)
app.get('/result/:sessionId', handleResult)

// OpenID4VCI Issuer – Well-known metadata
app.get('/.well-known/openid-credential-issuer', handleIssuerMetadata)
app.get('/.well-known/oauth-authorization-server', handleAuthServerMetadata)

// OpenID4VCI Issuer – Issuance flow
app.post('/issuer/initiate', handleIssuanceInitiate)
app.post('/issuer/link-pid', handleLinkPid)
app.post('/issuer/create-offer/:sessionId', handleCreateOffer)
app.get('/issuer/offer/:sessionId', handleGetOffer)
app.post('/issuer/token', handleToken)
app.post('/issuer/credential', handleCredential)
app.post('/issuer/nonce', handleNonce)
app.get('/issuer/result/:sessionId', handleIssuanceResult)

// Wallet redirect landing page – opened by wallet browser after presentation
// Same-device: closes this tab immediately so the original Bewerbung tab comes to front
// Cross-device: shows a static success message (phone user has nothing more to do)
app.get('/done/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const isSameDevice = !!getReturnUrl(sessionId)

  if (isSameDevice) {
    // Close this tab – the Bewerbung tab is still open in the background with the data filled in
    return c.html(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <script>window.close();</script>
</head>
<body></body>
</html>`)
  }

  // Cross-device: static success message for the phone
  return c.html(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentifizierung abgeschlossen</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0fdf4; }
    .card { background: white; border-radius: 16px; padding: 2rem; text-align: center; max-width: 360px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: #166534; font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: #4b5563; font-size: .9rem; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Authentifizierung abgeschlossen</h1>
    <p>Ihre Daten wurden erfolgreich übertragen.<br>Sie können dieses Fenster schließen.</p>
  </div>
</body>
</html>`)
})

// Catch-all: any unmatched request (the REQ/RES middleware above already logged it)
app.all('*', (c) => {
  console.log(`[404-MISS] ${c.req.method} ${c.req.path}`)
  return c.json({ error: 'Not found' }, 404)
})

const port = Number(process.env.PORT ?? 3001)

// Load trust lists on startup
loadTrustLists()
  .then(() => {
    serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
      console.log(`[EUDI Wallet Service] Running on port ${port}`)
      console.log(`[EUDI Wallet Service] Service URL: ${process.env.SERVICE_URL ?? `http://localhost:${port}`}`)
    })
  })
  .catch((err) => {
    console.error('Failed to start service:', err)
    process.exit(1)
  })
