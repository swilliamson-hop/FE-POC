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
        // Tells the wallet which algorithms to use when signing the proof JWT
        // for holder binding. Without this, the wallet logs:
        // "No valid signing algorithms found in credential metadata: []"
        // and shows misleading "invalid transaction code" to the user.
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['ES256'],
          },
        },
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
              background_color: '#0B1B4D',
              text_color: '#FFFFFF',
              background_image: { uri: `${SERVICE_URL}/mionauten-bg.png` },
            },
            {
              name: 'Landlord Confirmation',
              locale: 'en-US',
              description: 'Landlord confirmation of move-in to a residence',
              background_color: '#0B1B4D',
              text_color: '#FFFFFF',
              background_image: { uri: `${SERVICE_URL}/mionauten-bg.png` },
            },
          ],
          // Per-claim display labels. OID4VCI Draft 15 places `claims` directly
          // under the credential configuration, but we mirror the SPRIND `display`
          // quirk and nest it inside `credential_metadata` for consistency.
          claims: [
            { path: ['given_name'],     display: [{ name: 'Vorname',       locale: 'de-DE' }, { name: 'Given name',    locale: 'en-US' }] },
            { path: ['family_name'],    display: [{ name: 'Nachname',      locale: 'de-DE' }, { name: 'Family name',   locale: 'en-US' }] },
            { path: ['birthdate'],      display: [{ name: 'Geburtsdatum',  locale: 'de-DE' }, { name: 'Date of birth', locale: 'en-US' }] },
            { path: ['street_address'], display: [{ name: 'Straße',        locale: 'de-DE' }, { name: 'Street',        locale: 'en-US' }] },
            { path: ['postal_code'],    display: [{ name: 'Postleitzahl',  locale: 'de-DE' }, { name: 'Postal code',   locale: 'en-US' }] },
            { path: ['locality'],       display: [{ name: 'Ort',           locale: 'de-DE' }, { name: 'City',          locale: 'en-US' }] },
            { path: ['move_in_date'],   display: [{ name: 'Einzugsdatum',  locale: 'de-DE' }, { name: 'Move-in date',  locale: 'en-US' }] },
            { path: ['landlord_name'],  display: [{ name: 'Vermieter',     locale: 'de-DE' }, { name: 'Landlord',      locale: 'en-US' }] },
            { path: ['iat'],            display: [{ name: 'Ausgestellt am', locale: 'de-DE' }, { name: 'Issued at',    locale: 'en-US' }] },
            { path: ['exp'],            display: [{ name: 'Gültig bis',    locale: 'de-DE' }, { name: 'Valid until',   locale: 'en-US' }] },
          ],
        },
      },
      'genossenschaft-mitglied': {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:genossenschaft-mitglied:1',
        credential_signing_alg_values_supported: ['ES256'],
        proof_types_supported: {
          jwt: {
            proof_signing_alg_values_supported: ['ES256'],
          },
        },
        credential_metadata: {
          display: [
            {
              name: 'Mitgliedsbescheinigung - Genossenschaft',
              locale: 'de-DE',
              description: 'Bescheinigung über die Mitgliedschaft in einer Wohnungsbaugenossenschaft',
              background_color: '#0B1B4D',
              text_color: '#FFFFFF',
              background_image: { uri: `${SERVICE_URL}/mionauten-bg.png` },
            },
            {
              name: 'Cooperative Membership Certificate',
              locale: 'en-US',
              description: 'Certificate of membership in a housing cooperative',
              background_color: '#0B1B4D',
              text_color: '#FFFFFF',
              background_image: { uri: `${SERVICE_URL}/mionauten-bg.png` },
            },
          ],
          claims: [
            { path: ['given_name'],        display: [{ name: 'Vorname',         locale: 'de-DE' }, { name: 'Given name',        locale: 'en-US' }] },
            { path: ['family_name'],       display: [{ name: 'Nachname',        locale: 'de-DE' }, { name: 'Family name',       locale: 'en-US' }] },
            { path: ['birthdate'],         display: [{ name: 'Geburtsdatum',    locale: 'de-DE' }, { name: 'Date of birth',     locale: 'en-US' }] },
            { path: ['cooperative_name'],  display: [{ name: 'Genossenschaft',  locale: 'de-DE' }, { name: 'Cooperative',       locale: 'en-US' }] },
            { path: ['membership_number'], display: [{ name: 'Mitgliedsnummer', locale: 'de-DE' }, { name: 'Membership number', locale: 'en-US' }] },
            { path: ['member_since'],      display: [{ name: 'Mitglied seit',   locale: 'de-DE' }, { name: 'Member since',      locale: 'en-US' }] },
            { path: ['iat'],               display: [{ name: 'Ausgestellt am',  locale: 'de-DE' }, { name: 'Issued at',         locale: 'en-US' }] },
            { path: ['exp'],               display: [{ name: 'Gültig bis',      locale: 'de-DE' }, { name: 'Valid until',       locale: 'en-US' }] },
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
    // SPRIND wallet validates authorization_endpoint per RFC 8414 even for
    // pre-authorized code flow (where it is never actually called). Without
    // this field the wallet shows "ValidationError: Invalid authorization endpoint"
    // when the user taps "Weiter zur Eingabe" on the consent screen.
    authorization_endpoint: `${SERVICE_URL}/issuer/authorize`,
    token_endpoint: `${SERVICE_URL}/issuer/token`,
    response_types_supported: ['code'],
    grant_types_supported: [
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    pre_authorized_grant_anonymous_access_supported: true,
  })
}
