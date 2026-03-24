import { decodeJwt } from 'jose'
import { createHash } from 'node:crypto'

const TRUST_LIST_URL = process.env.TRUST_LIST_URL ?? 'https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists'

interface TrustListCache {
  pidProviderKeys: string[]   // trusted PID issuer certificate thumbprints (SHA-256, base64url)
  walletProviderKeys: string[] // trusted wallet provider certificate thumbprints (SHA-256, base64url)
  fetchedAt: number
}

let cache: TrustListCache | null = null
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

async function fetchTrustListJwt(name: string): Promise<string> {
  const url = `${TRUST_LIST_URL}/${name}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch trust list ${name}: ${resp.status}`)
  return resp.text()
}

// ETSI TS 119 602 LoTE (List of Trusted Entities) types
interface LoTECertificate { val: string }
interface LoTEServiceInfo {
  ServiceInformation: {
    ServiceDigitalIdentity?: {
      X509Certificates?: LoTECertificate[]
    }
  }
}
interface LoTEEntity {
  TrustedEntityServices?: LoTEServiceInfo[]
}
interface LoTEPayload {
  LoTE?: {
    TrustedEntitiesList?: LoTEEntity[]
  }
  // Legacy format fallback
  entries?: Array<{ 'x5t#S256'?: string }>
  keys?: Array<{ 'x5t#S256'?: string }>
}

// Extract certificate thumbprints from LoTE trust list JWT.
// New format (March 2026): ETSI TS 119 602 with LoTE.TrustedEntitiesList[].TrustedEntityServices[]
// containing X509Certificates[].val (base64 DER). We compute SHA-256 thumbprints ourselves.
// Legacy format: entries[].x5t#S256 or keys[].x5t#S256 (direct thumbprints).
function extractThumbprints(payload: LoTEPayload): string[] {
  // New LoTE format
  const entities = payload.LoTE?.TrustedEntitiesList
  if (entities && entities.length > 0) {
    const thumbprints: string[] = []
    for (const entity of entities) {
      for (const service of entity.TrustedEntityServices ?? []) {
        const certs = service.ServiceInformation?.ServiceDigitalIdentity?.X509Certificates ?? []
        for (const cert of certs) {
          if (cert.val) {
            const der = Buffer.from(cert.val, 'base64')
            const thumbprint = createHash('sha256').update(der).digest('base64url')
            thumbprints.push(thumbprint)
          }
        }
      }
    }
    return thumbprints
  }

  // Legacy format fallback
  const entries = (payload.entries ?? payload.keys ?? []) as Array<Record<string, string>>
  return entries
    .map((e) => e['x5t#S256'] ?? null)
    .filter((t): t is string => t !== null)
}

export async function loadTrustLists(): Promise<void> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return

  try {
    const [pidJwt, walletJwt] = await Promise.all([
      fetchTrustListJwt('pid-provider.jwt'),
      fetchTrustListJwt('wallet-provider.jwt'),
    ])

    const pidPayload = decodeJwt(pidJwt) as unknown as LoTEPayload
    const walletPayload = decodeJwt(walletJwt) as unknown as LoTEPayload

    cache = {
      pidProviderKeys: extractThumbprints(pidPayload),
      walletProviderKeys: extractThumbprints(walletPayload),
      fetchedAt: Date.now(),
    }

    console.log(
      `[TrustList] Loaded: ${cache.pidProviderKeys.length} PID providers, ${cache.walletProviderKeys.length} wallet providers`
    )
  } catch (err) {
    console.error('[TrustList] Failed to load trust lists:', err)
    // Use empty lists on failure (validation will reject unknown issuers)
    cache = { pidProviderKeys: [], walletProviderKeys: [], fetchedAt: Date.now() }
  }
}

export function getTrustLists(): TrustListCache {
  if (!cache) throw new Error('Trust lists not loaded. Call loadTrustLists() first.')
  return cache
}
