import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
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
