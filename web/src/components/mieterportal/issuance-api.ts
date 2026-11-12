import { CREDENTIALS, type CredentialType } from './data'

const EUDI_SERVICE_URL = process.env.NEXT_PUBLIC_EUDI_SERVICE_URL ?? 'http://localhost:3001'

export interface TenantAccount {
  givenName: string
  familyName: string
  birthdate: string // ISO YYYY-MM-DD
}

export interface TenantMatch {
  givenName: boolean
  familyName: boolean
  birthdate: boolean
  matched: boolean
}

export interface WalletIdentity {
  given_name: string
  family_name: string
  birthdate: string
}

export type PollResult =
  | { state: 'pending' }
  | {
      state: 'pid_verified'
      identity: WalletIdentity
      tenantMatch: TenantMatch
      credentialClaims: Record<string, string>
    }
  | { state: 'pid_mismatch'; tenantMatch: TenantMatch }
  | { state: 'issued' }
  | { state: 'error'; message: string }

export interface IssuanceApi {
  initiate(opts: {
    credentialType: CredentialType
    tenant: TenantAccount
    skipTxCode: boolean
    returnUrl?: string
  }): Promise<{ sessionId: string; walletUrl: string }>
  poll(sessionId: string): Promise<PollResult>
  createOffer(sessionId: string): Promise<{ walletUrl: string; txCode?: string }>
}

// --- Real service -----------------------------------------------------------

export const realApi: IssuanceApi = {
  async initiate(opts) {
    const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
    if (!resp.ok) throw new Error('initiate failed')
    const data = await resp.json()
    return { sessionId: data.sessionId, walletUrl: data.walletUrl }
  },

  async poll(sessionId) {
    const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/result/${sessionId}`)
    if (resp.status === 202) return { state: 'pending' }
    if (resp.status === 404 || resp.status === 410) {
      return { state: 'error', message: 'Die Sitzung ist abgelaufen. Bitte starten Sie erneut.' }
    }
    const data = await resp.json()
    if (resp.ok && data.status === 'pid_verified' && data.pidClaims && data.tenantMatch) {
      return {
        state: 'pid_verified',
        identity: {
          given_name: data.pidClaims.given_name,
          family_name: data.pidClaims.family_name,
          birthdate: data.pidClaims.birthdate,
        },
        tenantMatch: data.tenantMatch,
        credentialClaims: data.credentialClaims ?? {},
      }
    }
    // A service build from before the tenant match ignores `tenant` and would
    // issue to anyone – refuse rather than skip the check.
    if (resp.ok && data.status === 'pid_verified') {
      return {
        state: 'error',
        message: 'Der Wallet-Service läuft noch in einer älteren Version ohne Mieter-Abgleich. Bitte den Service neu deployen.',
      }
    }
    if (resp.ok && data.status === 'pid_mismatch' && data.tenantMatch) {
      return { state: 'pid_mismatch', tenantMatch: data.tenantMatch }
    }
    if (resp.ok && data.status === 'issued') return { state: 'issued' }
    return { state: 'error', message: data.errorMessage ?? 'Der Vorgang ist fehlgeschlagen.' }
  },

  async createOffer(sessionId) {
    const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/create-offer/${sessionId}`, { method: 'POST' })
    if (!resp.ok) throw new Error('create-offer failed')
    const data = await resp.json()
    return { walletUrl: data.walletUrl, txCode: data.txCode ?? undefined }
  },
}

// --- Offline simulation -----------------------------------------------------
// Click-through fallback without wallet or service. The simulated wallet
// always belongs to the sandbox test identity, so changing the demo account
// to someone else shows the refusal path.

const SIMULATED_WALLET: WalletIdentity = {
  given_name: 'ERIKA',
  family_name: 'MUSTERMANN',
  birthdate: '1964-08-12',
}

interface SimSession {
  createdAt: number
  credentialType: CredentialType
  tenant: TenantAccount
  pin: boolean
  offerCreated: boolean
  issuePollStart?: number
}

const simSessions = new Map<string, SimSession>()

const same = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

export const simulatedApi: IssuanceApi = {
  async initiate(opts) {
    const sessionId = `sim-${Date.now()}`
    simSessions.set(sessionId, {
      createdAt: Date.now(),
      credentialType: opts.credentialType,
      tenant: opts.tenant,
      pin: !opts.skipTxCode,
      offerCreated: false,
    })
    return { sessionId, walletUrl: '' }
  },

  async poll(sessionId) {
    const s = simSessions.get(sessionId)
    if (!s) return { state: 'error', message: 'Die Sitzung ist abgelaufen. Bitte starten Sie erneut.' }

    if (s.offerCreated) {
      s.issuePollStart ??= Date.now()
      if (Date.now() - s.issuePollStart < 3000) return { state: 'pending' }
      simSessions.delete(sessionId)
      return { state: 'issued' }
    }

    if (Date.now() - s.createdAt < 2500) return { state: 'pending' }

    const givenName = same(s.tenant.givenName, SIMULATED_WALLET.given_name)
    const familyName = same(s.tenant.familyName, SIMULATED_WALLET.family_name)
    const birthdate = s.tenant.birthdate === SIMULATED_WALLET.birthdate
    const tenantMatch = { givenName, familyName, birthdate, matched: givenName && familyName && birthdate }
    if (!tenantMatch.matched) {
      simSessions.delete(sessionId)
      return { state: 'pid_mismatch', tenantMatch }
    }
    return {
      state: 'pid_verified',
      identity: SIMULATED_WALLET,
      tenantMatch,
      credentialClaims: { ...SIMULATED_WALLET, ...CREDENTIALS[s.credentialType].simulatedClaims },
    }
  },

  async createOffer(sessionId) {
    const s = simSessions.get(sessionId)
    if (!s) throw new Error('create-offer failed')
    s.offerCreated = true
    return { walletUrl: '', txCode: s.pin ? '4711' : undefined }
  },
}
