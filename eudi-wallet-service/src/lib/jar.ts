import { SignJWT, importPKCS8, exportJWK } from 'jose'
import type { JWK } from 'jose'
import type { DcqlQuery } from '../types.js'

const SERVICE_URL = process.env.SERVICE_URL!
const CLIENT_ID = process.env.CLIENT_ID!

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

// Load the Access Certificate private key from env
let _privateKey: CryptoKey | null = null
export async function getPrivateKey(): Promise<CryptoKey> {
  if (_privateKey) return _privateKey
  const pem = process.env.PRIVATE_KEY!.replace(/\\n/g, '\n')
  _privateKey = await importPKCS8(pem, 'ES256')
  return _privateKey
}

// Build the DCQL query for PID presentation
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
          { path: ['birth_date'] },
          { path: ['address', 'street_address'] },
          { path: ['address', 'postal_code'] },
          { path: ['address', 'locality'] },
        ],
      },
      {
        id: 'pid-mso-mdoc',
        format: 'mso_mdoc',
        meta: {
          doctype_value: 'eu.europa.ec.eudi.pid.1',
        },
        claims: [
          { path: ['eu.europa.ec.eudi.pid.1', 'given_name'] },
          { path: ['eu.europa.ec.eudi.pid.1', 'family_name'] },
          { path: ['eu.europa.ec.eudi.pid.1', 'birth_date'] },
          { path: ['eu.europa.ec.eudi.pid.1', 'resident_street'] },
          { path: ['eu.europa.ec.eudi.pid.1', 'resident_postal_code'] },
          { path: ['eu.europa.ec.eudi.pid.1', 'resident_city'] },
        ],
      },
    ],
    // credential_sets: wallet must present one of the two formats (not both)
    credential_sets: [
      {
        options: [['pid-sd-jwt'], ['pid-mso-mdoc']],
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

  const now = Math.floor(Date.now() / 1000)
  const responseUri = `${SERVICE_URL}/callback/${sessionId}`

  const payload = {
    iss: CLIENT_ID,
    aud: 'https://self-issued.me/v2',
    iat: now,
    exp: now + 600, // 10 minutes
    client_id: CLIENT_ID,
    client_id_scheme: 'x509_san_dns',
    response_type: 'vp_token',
    response_mode: 'direct_post',
    nonce,
    state: sessionId,
    response_uri: responseUri,
    dcql_query: buildDcqlQuery(),
    client_metadata: {
      jwks: {
        keys: [ephemeralPublicKeyJwk],
      },
      vp_formats: {
        'dc+sd-jwt': {
          'sd-jwt_alg_values': ['ES256', 'Ed25519'],
          'kb-jwt_alg_values': ['ES256', 'Ed25519'],
        },
        mso_mdoc: {
          alg: ['ES256', 'Ed25519'],
        },
      },
    },
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'oauth-authz-req+jwt', x5c })
    .sign(privateKey)
}
