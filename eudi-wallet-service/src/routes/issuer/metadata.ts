import type { Context } from 'hono'

const SERVICE_URL = process.env.SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`

// GET /.well-known/openid-credential-issuer
// Minimal metadata following BMI EAA Developer Guide template
export function handleIssuerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    credential_issuer: SERVICE_URL,
    credential_endpoint: `${SERVICE_URL}/issuer/credential`,
    nonce_endpoint: `${SERVICE_URL}/issuer/nonce`,
    credential_configurations_supported: {
      wohnungsgeberbestaetigung: {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:wohnungsgeberbestaetigung:1',
        credential_signing_alg_values_supported: ['ES256'],
      },
    },
  })
}

// GET /.well-known/oauth-authorization-server
export function handleAuthServerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    issuer: SERVICE_URL,
    token_endpoint: `${SERVICE_URL}/issuer/token`,
    grant_types_supported: [
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    pre_authorized_grant_anonymous_access_supported: true,
  })
}
