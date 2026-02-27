import { SignJWT, importPKCS8 } from 'jose'
import { createHash } from 'node:crypto'
import type { JWK } from 'jose'
import type { DcqlQuery } from '../types.js'

const SERVICE_URL = process.env.SERVICE_URL!

// Parse PEM certificate chain into array of base64 DER strings (for x5c header)
function parseCertChain(certChainPem: string): string[] {
  const certs: string[] = []
  const regex = /-----BEGIN CERTIFICATE-----\r?\n([\s\S]+?)\r?\n-----END CERTIFICATE-----/g
  let match
  while ((match = regex.exec(certChainPem)) !== null) {
    // Remove newlines from base64 content
    certs.push(match[1].replace(/\r?\n/g, ''))
  }
  return certs
}

// Compute client_id using x509_hash scheme (required by HAIP / SPRIND wallet):
// client_id = "x509_hash:<base64url(sha256(leaf_cert_DER))>"
export function computeClientId(): string {
  const certChainPem = process.env.CERT_CHAIN!.replace(/\\n/g, '\n')
  const certs = parseCertChain(certChainPem)
  if (certs.length === 0) throw new Error('No certificates found in CERT_CHAIN')
  const leafDer = Buffer.from(certs[0], 'base64')
  const thumbprint = createHash('sha256').update(leafDer).digest('base64url')
  return `x509_hash:${thumbprint}`
}

// Load the Access Certificate private key from env
let _privateKey: CryptoKey | null = null
export async function getPrivateKey(): Promise<CryptoKey> {
  if (_privateKey) return _privateKey
  const pem = process.env.PRIVATE_KEY!.replace(/\\n/g, '\n')
  _privateKey = await importPKCS8(pem, 'ES256')
  return _privateKey
}

// Build the DCQL query for PID presentation
// Only request dc+sd-jwt (not mso_mdoc) to avoid ISO 18013-5 reader auth,
// which requires the German Registrar root CA to be in the iOS system trust store.
export function buildDcqlQuery(): DcqlQuery {
  return {
    credentials: [
      {
        id: 'pid-sd-jwt',
        format: 'dc+sd-jwt',
        meta: {
          vct_values: ['urn:eudi:pid:de:1'],
        },
        claims: [
          { path: ['given_name'] },
          { path: ['family_name'] },
          { path: ['birthdate'] },
          { path: ['address', 'street_address'] },
          { path: ['address', 'postal_code'] },
          { path: ['address', 'locality'] },
        ],
      },
    ],
    credential_sets: [
      {
        options: [['pid-sd-jwt']],
        required: true,
      },
    ],
  }
}

export interface JarParams {
  sessionId: string
  nonce: string
  ephemeralPublicKeyJwk: JWK
  frontendUrl: string
}

// Create and sign the JWT Authorization Request (JAR)
export async function createSignedJar(params: JarParams): Promise<string> {
  const { sessionId, nonce, ephemeralPublicKeyJwk } = params
  const privateKey = await getPrivateKey()
  const certChainPem = process.env.CERT_CHAIN!.replace(/\\n/g, '\n')
  const x5c = parseCertChain(certChainPem)
  const clientId = computeClientId()

  const now = Math.floor(Date.now() / 1000)
  const responseUri = `${SERVICE_URL}/callback/${sessionId}`

  const payload = {
    aud: 'https://self-issued.me/v2',
    iat: now,
    client_id: clientId,
    response_type: 'vp_token',
    response_mode: 'direct_post.jwt',
    nonce,
    state: sessionId,
    response_uri: responseUri,
    dcql_query: buildDcqlQuery(),
    client_metadata: {
      jwks: {
        keys: [ephemeralPublicKeyJwk],
      },
      // Wallet reads "vp_formats_supported" (ClientMetaData.swift CodingKeys)
      vp_formats_supported: {
        'dc+sd-jwt': {
          'sd-jwt_alg_values': ['ES256'],
          'kb-jwt_alg_values': ['ES256'],
        },
      },
      // Wallet reads "encrypted_response_enc_values_supported" to build ResponseEncryptionSpecification
      // (authorization_encrypted_response_alg/enc are NOT read by the wallet library)
      encrypted_response_enc_values_supported: ['A128GCM', 'A256GCM'],
    },
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'oauth-authz-req+jwt', x5c })
    .sign(privateKey)
}
