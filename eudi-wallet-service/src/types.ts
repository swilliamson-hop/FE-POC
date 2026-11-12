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

// Tenant the portal user is logged in as (portal flow). In production this
// comes from the authenticated portal session and the landlord's master data,
// never from the browser – the POC frontend stands in for the portal backend.
export interface TenantAccount {
  givenName: string
  familyName: string
  birthdate: string                // ISO YYYY-MM-DD
}

// Per-field result of comparing the tenant account with the presented PID.
export interface TenantMatch {
  givenName: boolean
  familyName: boolean
  birthdate: boolean
  matched: boolean
}

export interface IssuanceSessionState {
  credentialType: CredentialType
  preAuthorizedCode: string
  txCode?: string                  // 4-digit PIN for wallet tx_code step; unset = no PIN
  tenant?: TenantAccount           // set in the portal flow: PID must match this account
  tenantMatch?: TenantMatch
  accessToken?: string
  dpopJkt?: string                 // set when the access token is DPoP-bound (RFC 9449)
  cNonce?: string
  cNonceExpiresAt?: number
  pidClaims?: PidClaims
  holderPublicKeyJwk?: JWK
  createdAt: number
  expiresAt: number
  status: 'pending_pid' | 'pid_verified' | 'pid_mismatch' | 'offer_created' | 'issued' | 'error'
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
  tenant?: TenantAccount           // portal flow: enables the PID <-> tenant match
  skipTxCode?: boolean             // same-device flow without wallet PIN
}

export interface IssuanceInitiateResponse {
  sessionId: string
  vpSessionId: string
  walletUrl: string
}

export interface IssuanceResultResponse {
  status: IssuanceSessionState['status']
  pidClaims?: PidClaims
  tenantMatch?: TenantMatch
  // What the credential will attest (portal flow) – single source of truth for the preview
  credentialClaims?: Record<string, string>
  errorMessage?: string
}
