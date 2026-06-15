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

  console.log(`[PID-DIAG] Total credential parts: ${parts.length}, disclosure parts: ${disclosureParts.length}`)

  const disclosed: Record<string, unknown> = {}

  for (let i = 0; i < disclosureParts.length; i++) {
    const disclosure = disclosureParts[i]
    try {
      const json = Buffer.from(disclosure, 'base64url').toString('utf-8')
      console.log(`[PID-DIAG] Disclosure #${i}: ${disclosure.slice(0, 24)}... → ${json}`)
      const [, claimName, claimValue] = decodeDisclosure(disclosure)
      if (claimName) {
        disclosed[claimName] = claimValue
      }
    } catch (err) {
      console.log(`[PID-DIAG] Disclosure #${i} FAILED to decode:`, err)
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

  console.log('[PID-DIAG] Issuer JWT payload keys:', Object.keys(issuerPayload))
  console.log('[PID-DIAG] Issuer JWT full payload:', JSON.stringify(issuerPayload, null, 2))

  // Get selectively disclosed claims
  const disclosed = extractDisclosedClaims(credential)

  console.log('[PID] Disclosed claim names:', Object.keys(disclosed))
  console.log('[PID] Disclosed claims:', JSON.stringify(disclosed, null, 2))

  // Merge: disclosed claims take precedence over issuer payload claims
  const claims = { ...issuerPayload, ...disclosed }

  // Extract address sub-fields.
  // With recursive SD-JWT disclosure, the `address` object may contain `_sd` hashes
  // while the actual sub-fields (street_address, locality, postal_code) appear as
  // separate top-level disclosures. Check both locations.
  let address: Record<string, unknown> = {}
  if (claims.address && typeof claims.address === 'object') {
    console.log('[PID] address object:', JSON.stringify(claims.address, null, 2))
    address = claims.address as Record<string, unknown>
  } else {
    console.log('[PID] No address object found. claims.address =', claims.address)
  }

  const streetAddress = address.street_address ?? claims.street_address
  const postalCode = address.postal_code ?? claims.postal_code
  const locality = address.locality ?? claims.locality
  const country = address.country ?? claims.country

  console.log('[PID] Extracted address fields:', { streetAddress, postalCode, locality, country })

  // Build PidClaims
  const pidClaims: PidClaims = {
    given_name: String(claims.given_name ?? ''),
    family_name: String(claims.family_name ?? ''),
    birthdate: String(claims.birthdate ?? ''),
    street_address: streetAddress ? String(streetAddress) : undefined,
    postal_code: postalCode ? String(postalCode) : undefined,
    locality: locality ? String(locality) : undefined,
    country: country ? String(country) : undefined,
  }

  return pidClaims
}
