import type { Context } from 'hono'

const SERVICE_URL = process.env.SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`

// GET /.well-known/openid-credential-issuer
// Follows BMI EAA Developer Guide template exactly:
// https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/EAA_Issuance/
export function handleIssuerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    credential_issuer: SERVICE_URL,
    credential_endpoint: `${SERVICE_URL}/issuer/credential`,
    token_endpoint: `${SERVICE_URL}/issuer/token`,
    // HAIP-required: wallet fetches a fresh c_nonce here before building the proof JWT
    nonce_endpoint: `${SERVICE_URL}/issuer/nonce`,
    credential_configurations_supported: {
      wohnungsgeberbestaetigung: {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:wohnungsgeberbestaetigung:1',
        credential_signing_alg_values_supported: ['ES256'],
        // Mirror SPRIND community forum post structure (confirmed working
        // for credential receipt): display is inside credential_metadata wrapper,
        // NOT directly on the credential configuration. This is non-standard
        // per OpenID4VCI spec but matches what the SPRIND wallet expects.
        credential_metadata: {
          display: [
            {
              name: 'Wohnungsgeberbestätigung',
              locale: 'de-DE',
              description: 'Bestätigung des Vermieters über den Einzug in eine Wohnung',
              background_color: '#0066CC',
              text_color: '#FFFFFF',
            },
            {
              name: 'Landlord Confirmation',
              locale: 'en-US',
              description: 'Landlord confirmation of move-in to a residence',
              background_color: '#0066CC',
              text_color: '#FFFFFF',
            },
          ],
        },
      },
    },
    grant_types_supported: [
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    display: [
      {
        name: 'Immomio',
        locale: 'de-DE',
      },
      {
        name: 'Immomio',
        locale: 'en-US',
      },
    ],
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
