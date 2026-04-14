import type { Context } from 'hono'

const SERVICE_URL = process.env.SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`

// GET /.well-known/openid-credential-issuer
export function handleIssuerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    credential_issuer: SERVICE_URL,
    authorization_servers: [SERVICE_URL],
    credential_endpoint: `${SERVICE_URL}/issuer/credential`,
    nonce_endpoint: `${SERVICE_URL}/issuer/nonce`,
    batch_credential_issuance: { batch_size: 1 },
    display: [
      {
        name: 'Immomio EUDI Demo',
        locale: 'de-DE',
      },
      {
        name: 'Immomio EUDI Demo',
        locale: 'en-US',
      },
    ],
    credential_configurations_supported: {
      wohnungsgeberbestaetigung: {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:wohnungsgeberbestaetigung:1',
        cryptographic_binding_methods_supported: ['jwk'],
        credential_signing_alg_values_supported: ['ES256'],
        proof_types_supported: {
          jwt: { proof_signing_alg_values_supported: ['ES256'] },
        },
        display: [
          {
            name: 'Wohnungsgeberbestätigung',
            locale: 'de-DE',
            description: 'Bestätigung des Wohnungsgebers für neue Bewohner',
          },
        ],
        claims: [
          { path: ['given_name'], display: [{ name: 'Vorname', locale: 'de-DE' }] },
          { path: ['family_name'], display: [{ name: 'Nachname', locale: 'de-DE' }] },
          { path: ['birthdate'], display: [{ name: 'Geburtsdatum', locale: 'de-DE' }] },
          { path: ['street_address'], display: [{ name: 'Straße', locale: 'de-DE' }] },
          { path: ['postal_code'], display: [{ name: 'Postleitzahl', locale: 'de-DE' }] },
          { path: ['locality'], display: [{ name: 'Ort', locale: 'de-DE' }] },
          { path: ['move_in_date'], display: [{ name: 'Einzugsdatum', locale: 'de-DE' }] },
          { path: ['landlord_name'], display: [{ name: 'Vermieter', locale: 'de-DE' }] },
        ],
      },
      'genossenschaft-mitglied': {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:genossenschaft-mitglied:1',
        cryptographic_binding_methods_supported: ['jwk'],
        credential_signing_alg_values_supported: ['ES256'],
        proof_types_supported: {
          jwt: { proof_signing_alg_values_supported: ['ES256'] },
        },
        display: [
          {
            name: 'Genossenschafts-Mitgliedsbescheinigung',
            locale: 'de-DE',
            description: 'Nachweis der Mitgliedschaft in einer Wohnungsbaugenossenschaft',
          },
        ],
        claims: [
          { path: ['given_name'], display: [{ name: 'Vorname', locale: 'de-DE' }] },
          { path: ['family_name'], display: [{ name: 'Nachname', locale: 'de-DE' }] },
          { path: ['birthdate'], display: [{ name: 'Geburtsdatum', locale: 'de-DE' }] },
          { path: ['cooperative_name'], display: [{ name: 'Genossenschaft', locale: 'de-DE' }] },
          { path: ['membership_number'], display: [{ name: 'Mitgliedsnummer', locale: 'de-DE' }] },
          { path: ['member_since'], display: [{ name: 'Mitglied seit', locale: 'de-DE' }] },
        ],
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
    dpop_signing_alg_values_supported: ['ES256'],
  })
}
