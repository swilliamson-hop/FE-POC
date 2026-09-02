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
  // Persistent, provider-unique person identifier (eIDAS2 PID Rulebook).
  // Optional in the credential; used for cross-application duplicate detection.
  // Never surfaced or stored in plaintext beyond this transient claims object.
  personal_administrative_number?: string
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
  // Optional per OpenID4VP DCQL: arrays of claim ids the wallet may satisfy,
  // in preference order. Lets us request an optional claim additively without
  // making the whole credential fail to match when that claim is absent.
  claim_sets?: string[][]
}

export interface DcqlClaim {
  id?: string
  path: (string | number)[]
}

// === OpenID4VCI Issuance Types ===

export type CredentialType = 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'

export interface IssuanceSessionState {
  credentialType: CredentialType
  preAuthorizedCode: string
  txCode: string                   // 4-digit PIN for wallet tx_code step
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
      tx_code?: {
        input_mode: 'numeric' | 'text'
        length: number
        description?: string
      }
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
