import { importJWK, jwtVerify, decodeJwt } from 'jose'

const TRUST_LIST_URL = process.env.TRUST_LIST_URL ?? 'https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists'

interface TrustListCache {
  pidProviderKeys: string[]   // trusted PID issuer certificate thumbprints
  walletProviderKeys: string[] // trusted wallet provider certificate thumbprints
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

// Extract certificate thumbprints from a JAdES trust list JWT
function extractThumbprints(payload: Record<string, unknown>): string[] {
  const entries = (payload['entries'] ?? payload['keys'] ?? []) as unknown[]
  return entries
    .map((e: unknown) => {
      if (typeof e === 'object' && e !== null && 'x5t#S256' in e) {
        return (e as Record<string, string>)['x5t#S256']
      }
      return null
    })
    .filter((t): t is string => t !== null)
}

export async function loadTrustLists(): Promise<void> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return

  try {
    const [pidJwt, walletJwt] = await Promise.all([
      fetchTrustListJwt('pid-provider.jwt'),
      fetchTrustListJwt('wallet-provider.jwt'),
    ])

    const pidPayload = decodeJwt(pidJwt) as Record<string, unknown>
    const walletPayload = decodeJwt(walletJwt) as Record<string, unknown>

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
