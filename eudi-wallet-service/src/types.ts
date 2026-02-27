import type { JWK } from 'jose'

export interface SessionState {
  nonce: string
  ephemeralPrivateKey: CryptoKey   // for decrypting wallet response
  ephemeralPublicKeyJwk: JWK       // sent to wallet in JAR
  createdAt: number
  expiresAt: number
  status: 'pending' | 'complete' | 'error'
  pidClaims?: PidClaims
  errorMessage?: string
}

export interface PidClaims {
  given_name: string
  family_name: string
  birth_date: string
  street_address?: string
  postal_code?: string
  locality?: string
}

export interface InitiateResponse {
  sessionId: string
  // The openid4vp:// URI – used directly as deep link on mobile
  // and encoded into a QR code for desktop
  walletUrl: string
}

export interface ResultResponse {
  status: 'pending' | 'complete' | 'error'
  pidClaims?: PidClaims
  errorMessage?: string
}

// DCQL query types (subset used for PID)
export interface DcqlQuery {
  credentials: DcqlCredential[]
  credential_sets?: DcqlCredentialSet[]
}

export interface DcqlCredentialSet {
  options: string[][]
  required?: boolean
}

export interface DcqlCredential {
  id: string
  format: 'dc+sd-jwt' | 'mso_mdoc'
  meta?: {
    vct_values?: string[]
    doctype_value?: string
  }
  claims: DcqlClaim[]
}

export interface DcqlClaim {
  path: (string | number)[]
}
