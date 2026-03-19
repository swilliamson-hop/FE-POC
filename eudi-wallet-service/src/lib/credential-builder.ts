import { SDJwtInstance } from '@sd-jwt/core'
import { createHash, randomBytes } from 'node:crypto'
import { getPrivateKey, parseCertChain } from './jar.js'
import type { PidClaims, CredentialType } from '../types.js'
import type { JWK } from 'jose'
import type { Signer, Hasher, SaltGenerator, DisclosureFrame } from '@sd-jwt/types'

const SERVICE_URL = process.env.SERVICE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`

// Bridge jose CryptoKey → @sd-jwt/core Signer
// Signer takes "base64url(header).base64url(payload)" and returns base64url(signature)
async function createES256Signer(): Promise<Signer> {
  const privateKey = await getPrivateKey()
  return async (data: string): Promise<string> => {
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(data),
    )
    return Buffer.from(signature).toString('base64url')
  }
}

const hasher: Hasher = async (data: string | ArrayBuffer): Promise<Uint8Array> => {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data)
  return new Uint8Array(createHash('sha256').update(input).digest())
}

const saltGenerator: SaltGenerator = (): string => {
  return randomBytes(16).toString('base64url')
}

function getX5cCerts(): string[] {
  const certChainPem = process.env.CERT_CHAIN!.replace(/\\n/g, '\n')
  return parseCertChain(certChainPem)
}

// Mock data for Wohnungsgeberbestätigung
function buildWohnungsgeberPayload(pid: PidClaims, holderJwk?: JWK) {
  const now = Math.floor(Date.now() / 1000)
  return {
    vct: 'urn:credential:wohnungsgeberbestaetigung:1',
    iss: SERVICE_URL,
    iat: now,
    exp: now + 365 * 24 * 3600,
    ...(holderJwk ? { cnf: { jwk: holderJwk } } : {}),
    given_name: pid.given_name,
    family_name: pid.family_name,
    birthdate: pid.birthdate,
    street_address: 'Musterstraße 42',
    postal_code: '10115',
    locality: 'Berlin',
    move_in_date: '2026-04-01',
    landlord_name: 'Immobilien GmbH',
  }
}

// Mock data for Genossenschafts-Mitgliedsbescheinigung
function buildGenossenschaftPayload(pid: PidClaims, holderJwk?: JWK) {
  const now = Math.floor(Date.now() / 1000)
  return {
    vct: 'urn:credential:genossenschaft-mitglied:1',
    iss: SERVICE_URL,
    iat: now,
    exp: now + 365 * 24 * 3600,
    ...(holderJwk ? { cnf: { jwk: holderJwk } } : {}),
    given_name: pid.given_name,
    family_name: pid.family_name,
    birthdate: pid.birthdate,
    cooperative_name: 'Berliner Wohnungsbaugenossenschaft eG',
    membership_number: 'BWG-2026-04217',
    member_since: '2026-03-15',
  }
}

export async function createCredential(
  credentialType: CredentialType,
  pidClaims: PidClaims,
  holderPublicKeyJwk?: JWK,
): Promise<string> {
  const signer = await createES256Signer()
  const x5c = getX5cCerts()

  const sdJwt = new SDJwtInstance({
    signer,
    signAlg: 'ES256',
    hasher,
    hashAlg: 'sha-256',
    saltGenerator,
  })

  const header = { typ: 'vc+sd-jwt', x5c }

  if (credentialType === 'wohnungsgeberbestaetigung') {
    const payload = buildWohnungsgeberPayload(pidClaims, holderPublicKeyJwk)
    const frame: DisclosureFrame<typeof payload> = {
      _sd: [
        'given_name', 'family_name', 'birthdate',
        'street_address', 'postal_code', 'locality',
        'move_in_date', 'landlord_name',
      ],
    }
    return sdJwt.issue(payload, frame, { header })
  }

  const payload = buildGenossenschaftPayload(pidClaims, holderPublicKeyJwk)
  const frame: DisclosureFrame<typeof payload> = {
    _sd: [
      'given_name', 'family_name', 'birthdate',
      'cooperative_name', 'membership_number', 'member_since',
    ],
  }
  return sdJwt.issue(payload, frame, { header })
}
