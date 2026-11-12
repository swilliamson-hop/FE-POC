'use client'

import { useSyncExternalStore } from 'react'
import type { CredentialType } from './data'
import type { TenantAccount } from './issuance-api'

// Presenter-facing demo state, kept in localStorage so it survives the round
// trips to the wallet app (Safari may reload the tab on return).

export interface DemoSettings {
  // The tenant "logged in" to the portal. Must equal the PID in the presenter's
  // wallet for the match to succeed – default is the sandbox test identity.
  account: TenantAccount
  // Wallet asks for a PIN (tx_code) when receiving the credential
  pin: boolean
  // Offline click-through without wallet/service
  simulate: boolean
  // Credentials already issued in this demo: type -> ISO timestamp
  issued: Partial<Record<CredentialType, string>>
}

export const DEFAULT_SETTINGS: DemoSettings = {
  account: { givenName: 'Erika', familyName: 'Mustermann', birthdate: '1964-08-12' },
  pin: true,
  simulate: false,
  issued: {},
}

const KEY = 'mieterportal-demo-v1'
const listeners = new Set<() => void>()
let cache: { raw: string | null; value: DemoSettings } = { raw: null, value: DEFAULT_SETTINGS }

function read(): DemoSettings {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    // storage blocked (private mode) – fall back to in-memory cache
    return cache.value
  }
  if (raw === cache.raw) return cache.value
  let value = DEFAULT_SETTINGS
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      value = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        account: { ...DEFAULT_SETTINGS.account, ...parsed.account },
        issued: { ...parsed.issued },
      }
    } catch {
      // corrupt entry – ignore
    }
  }
  cache = { raw, value }
  return value
}

export function saveSettings(value: DemoSettings): void {
  const raw = JSON.stringify(value)
  cache = { raw, value }
  try {
    window.localStorage.setItem(KEY, raw)
  } catch {
    // keep in-memory copy only
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useDemoSettings(): DemoSettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS)
}
