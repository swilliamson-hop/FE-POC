import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { handleInitiate } from './routes/initiate.js'
import { handleRequest } from './routes/request.js'
import { handleCallback } from './routes/callback.js'
import { handleResult } from './routes/result.js'
import { loadTrustLists } from './lib/trustlist.js'

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
