export interface PidClaims {
  given_name: string
  family_name: string
  birthdate: string
  street_address?: string
  postal_code?: string
  locality?: string
  // Persistent, provider-unique person identifier (eIDAS2 PID Rulebook).
  // Optional in the credential; surfaced read-only for anti-fraud/dedup.
  personal_administrative_number?: string
}
