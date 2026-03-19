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
  issuanceSessionId?: string       // set when VP session is part of issuance flow
}

export interface PidClaims {
  given_name: string
  family_name: string
  birthdate: string
  street_address?: string
  postal_code?: string
  locality?: string
  country?: string
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

// === OpenID4VCI Issuance Types ===

export type CredentialType = 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'

export interface IssuanceSessionState {
  credentialType: CredentialType
  preAuthorizedCode: string
  accessToken?: string
  cNonce?: string
  cNonceExpiresAt?: number
  pidClaims?: PidClaims
  holderPublicKeyJwk?: JWK
  createdAt: number
  expiresAt: number
  status: 'pending_pid' | 'pid_verified' | 'offer_created' | 'issued' | 'error'
  errorMessage?: string
}

export interface CredentialOfferObject {
  credential_issuer: string
  credential_configuration_ids: string[]
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': string
    }
  }
}

export interface IssuanceInitiateRequest {
  credentialType: CredentialType
  returnUrl?: string
}

export interface IssuanceInitiateResponse {
  sessionId: string
  vpSessionId: string
  walletUrl: string
}

export interface IssuanceResultResponse {
  status: IssuanceSessionState['status']
  pidClaims?: PidClaims
  errorMessage?: string
}
