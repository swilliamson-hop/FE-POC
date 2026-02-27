import { decodeJwt } from 'jose'
import type { PidClaims } from '../types.js'

// Decode a base64url-encoded SD-JWT disclosure
function decodeDisclosure(disclosure: string): [string | null, string, unknown] {
  const json = Buffer.from(disclosure, 'base64url').toString('utf-8')
  const parsed = JSON.parse(json) as [string, string, unknown] | [string, unknown]
  if (parsed.length === 3) {
    return [parsed[0] as string, parsed[1] as string, parsed[2]]
  }
  // Array disclosure (no claim name)
  return [null, '', parsed[1]]
}

// Extract disclosed claims from an SD-JWT credential
// SD-JWT format: <issuer-jwt>~<disclosure1>~<disclosure2>~...~<kb-jwt>
function extractDisclosedClaims(credential: string): Record<string, unknown> {
  const parts = credential.split('~').filter(Boolean)

  // First part is the issuer JWT, last is KB-JWT, middle parts are disclosures
  const disclosureParts = parts.slice(1, -1)

  const disclosed: Record<string, unknown> = {}

  for (const disclosure of disclosureParts) {
    try {
      const [, claimName, claimValue] = decodeDisclosure(disclosure)
      if (claimName) {
        disclosed[claimName] = claimValue
      }
    } catch {
      // Skip malformed disclosures
    }
  }

  return disclosed
}

// Extract PID claims from an SD-JWT credential
export function extractPidClaims(credential: string): PidClaims {
  // Get the issuer JWT payload (may contain non-selectively-disclosed claims)
  const issuerJwt = credential.split('~')[0]
  let issuerPayload: Record<string, unknown> = {}

  try {
    issuerPayload = decodeJwt(issuerJwt) as Record<string, unknown>
  } catch {
    throw new Error('Failed to decode issuer JWT from credential')
  }

  // Get selectively disclosed claims
  const disclosed = extractDisclosedClaims(credential)

  // Merge: disclosed claims take precedence over issuer payload claims
  const claims = { ...issuerPayload, ...disclosed }

  // Extract address (may itself be a disclosed object)
  let address: Record<string, string> = {}
  if (claims.address && typeof claims.address === 'object') {
    address = claims.address as Record<string, string>
  }

  // Build PidClaims
  const pidClaims: PidClaims = {
    given_name: String(claims.given_name ?? ''),
    family_name: String(claims.family_name ?? ''),
    birth_date: String(claims.birth_date ?? ''),
    street_address: address.street_address ? String(address.street_address) : undefined,
    postal_code: address.postal_code ? String(address.postal_code) : undefined,
    locality: address.locality ? String(address.locality) : undefined,
  }

  return pidClaims
}
