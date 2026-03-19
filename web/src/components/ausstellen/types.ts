export type CredentialType = 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'

export interface CredentialTypeConfig {
  id: CredentialType
  title: string
  description: string
  mockClaims: Record<string, string>
  mockClaimLabels: Record<string, string>
}

export const CREDENTIAL_CONFIGS: Record<CredentialType, CredentialTypeConfig> = {
  wohnungsgeberbestaetigung: {
    id: 'wohnungsgeberbestaetigung',
    title: 'Wohnungsgeberbestätigung',
    description: 'Bestätigung des Wohnungsgebers für neue Bewohner (Anmeldung)',
    mockClaims: {
      street_address: 'Musterstraße 42',
      postal_code: '10115',
      locality: 'Berlin',
      move_in_date: '2026-04-01',
      landlord_name: 'Immobilien GmbH',
    },
    mockClaimLabels: {
      street_address: 'Straße',
      postal_code: 'Postleitzahl',
      locality: 'Ort',
      move_in_date: 'Einzugsdatum',
      landlord_name: 'Vermieter',
    },
  },
  'genossenschaft-mitglied': {
    id: 'genossenschaft-mitglied',
    title: 'Genossenschafts-Mitgliedsbescheinigung',
    description: 'Nachweis der Mitgliedschaft in einer Wohnungsbaugenossenschaft',
    mockClaims: {
      cooperative_name: 'Berliner Wohnungsbaugenossenschaft eG',
      membership_number: 'BWG-2026-04217',
      member_since: '2026-03-15',
    },
    mockClaimLabels: {
      cooperative_name: 'Genossenschaft',
      membership_number: 'Mitgliedsnummer',
      member_since: 'Mitglied seit',
    },
  },
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
