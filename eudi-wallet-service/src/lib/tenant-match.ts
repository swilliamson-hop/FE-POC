import type { PidClaims, TenantAccount, TenantMatch } from '../types.js'

// Compares the tenant account the portal user is logged in with against the
// PID presented by the wallet. This is the entitlement check of the issuance
// flow: the PID proves *who holds the wallet*, the tenant record (landlord's
// data) decides *whether that person may receive the credential*.

// "Müller-Lüdenscheidt " / "MÜLLER-LÜDENSCHEIDT" -> "MULLER-LUDENSCHEIDT".
// PIDs come in ALLCAPS and may transliterate umlauts, tenant master data is
// typed by hand – so compare case-, accent- and whitespace-insensitively.
function normalize(s: string | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// PIDs list all given names ("ERIKA MARIA"), tenant records usually only the
// one in everyday use ("Erika"). Accept when either side's names are a subset
// of the other's.
function givenNamesMatch(account: string, pid: string): boolean {
  const a = normalize(account).split(/[ ]/).filter(Boolean)
  const p = normalize(pid).split(/[ ]/).filter(Boolean)
  if (a.length === 0 || p.length === 0) return false
  return a.every((n) => p.includes(n)) || p.every((n) => a.includes(n))
}

export function matchTenant(tenant: TenantAccount, pid: PidClaims): TenantMatch {
  const givenName = givenNamesMatch(tenant.givenName, pid.given_name)
  const familyName = normalize(tenant.familyName) !== '' && normalize(tenant.familyName) === normalize(pid.family_name)
  // Both sides are ISO dates (YYYY-MM-DD); tolerate a time suffix on the PID.
  const birthdate = tenant.birthdate !== '' && tenant.birthdate === (pid.birthdate ?? '').slice(0, 10)
  return { givenName, familyName, birthdate, matched: givenName && familyName && birthdate }
}
