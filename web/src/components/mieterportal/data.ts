// Demo data for the tenant-portal issuance showcase (/mieterportal).
// Mirrors the demo contract of the real Mieter-App; the attested values must
// stay in sync with eudi-wallet-service/src/lib/credential-builder.ts.

export type CredentialType = 'wohnungsgeberbestaetigung' | 'genossenschaft-mitglied'

export const LANDLORD = 'Bauverein der Mionauten eG'

export const CONTRACT = {
  street: 'Zippelhaus 2',
  zipCity: '20457 Hamburg',
  number: 'sbx-flat1',
  since: '2023-01-01',
  costs: [
    { label: 'Kaltmiete', amount: 1510.11, color: '#d9822f' },
    { label: 'Heizkosten', amount: 150, color: '#7b8cd9' },
    { label: 'Betriebskosten', amount: 195, color: '#8a4f1d' },
    { label: 'Garage/Stellplatz', amount: 70, color: '#4a5bab' },
    { label: 'Sonstiges', amount: 50, color: '#14246e' },
  ],
}

export interface CredentialInfo {
  id: CredentialType
  title: string
  purpose: string
  // Shown after issuance: what the tenant can do with it
  useCase: string
  // Mock of what the service attests – only used by the offline simulation
  simulatedClaims: Record<string, string>
}

export const CREDENTIALS: Record<CredentialType, CredentialInfo> = {
  wohnungsgeberbestaetigung: {
    id: 'wohnungsgeberbestaetigung',
    title: 'Wohnungsgeberbestätigung',
    purpose: 'Für die Anmeldung beim Einwohnermeldeamt',
    useCase:
      'Bei der Anmeldung im Einwohnermeldeamt zeigen Sie den Nachweis direkt aus Ihrer Wallet vor. Die Behörde prüft die Echtheit selbst – ohne Papier und ohne Rückfrage beim Vermieter.',
    simulatedClaims: {
      street_address: 'Zippelhaus 2',
      postal_code: '20457',
      locality: 'Hamburg',
      move_in_date: '2023-01-01',
      landlord_name: LANDLORD,
    },
  },
  'genossenschaft-mitglied': {
    id: 'genossenschaft-mitglied',
    title: 'Mitgliedsbescheinigung',
    purpose: 'Nachweis Ihrer Mitgliedschaft in der Genossenschaft',
    useCase:
      'Wo immer Ihre Mitgliedschaft gefragt ist, zeigen Sie den Nachweis direkt aus Ihrer Wallet vor. Der Empfänger prüft die Echtheit selbst – ohne Rückfrage bei der Genossenschaft.',
    simulatedClaims: {
      cooperative_name: LANDLORD,
      membership_number: 'BVM-2023-04217',
      member_since: '2023-01-01',
    },
  },
}

export const CLAIM_LABELS: Record<string, string> = {
  given_name: 'Vorname',
  family_name: 'Nachname',
  birthdate: 'Geburtsdatum',
  street_address: 'Straße',
  postal_code: 'Postleitzahl',
  locality: 'Ort',
  move_in_date: 'Einzugsdatum',
  landlord_name: 'Wohnungsgeber',
  cooperative_name: 'Genossenschaft',
  membership_number: 'Mitgliedsnummer',
  member_since: 'Mitglied seit',
}

const DATE_CLAIMS = new Set(['birthdate', 'move_in_date', 'member_since'])

// "2023-01-01" -> "01.01.2023"
export function formatDate(iso: string | undefined): string {
  const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? '')
}

export function formatClaim(key: string, value: string): string {
  return DATE_CLAIMS.has(key) ? formatDate(value) : value
}

export function formatEuro(amount: number): string {
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
