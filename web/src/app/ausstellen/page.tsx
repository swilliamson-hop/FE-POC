'use client'

import Link from 'next/link'
import { CREDENTIAL_CONFIGS } from '@/components/ausstellen/types'

export default function AusstellenPage() {
  const types = Object.values(CREDENTIAL_CONFIGS)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Credential ausstellen
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Wählen Sie den Nachweis, der in Ihre EUDI Wallet ausgestellt werden soll.
            Ihre Identität wird zuerst über Ihr PID verifiziert.
          </p>
        </div>

        <div className="space-y-4">
          {types.map((config) => (
            <Link key={config.id} href={`/ausstellen/${config.id}`}>
              <div className="rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer mb-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <CredentialIcon type={config.id} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{config.title}</h2>
                    <p className="mt-1 text-sm text-gray-600">{config.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(config.mockClaims).slice(0, 3).map(([key, val]) => (
                        <span key={key} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {config.mockClaimLabels[key]}: {val}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>POC-Hinweis:</strong> Die Bescheinigungsdaten sind Mock-Daten.
          Nur die PID-Felder (Name, Geburtsdatum) kommen aus der echten EUDI Wallet.
        </div>
      </div>
    </div>
  )
}

function CredentialIcon({ type }: { type: string }) {
  if (type === 'genossenschaft-mitglied') {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-600">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}
