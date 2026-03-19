'use client'

import type { PidClaims, CredentialTypeConfig } from './types'

interface Props {
  config: CredentialTypeConfig
  pidClaims: PidClaims
}

export function CredentialPreview({ config, pidClaims }: Props) {
  const pidFields = [
    { label: 'Vorname', value: pidClaims.given_name },
    { label: 'Nachname', value: pidClaims.family_name },
    { label: 'Geburtsdatum', value: pidClaims.birthdate },
  ]

  const mockFields = Object.entries(config.mockClaims).map(([key, value]) => ({
    label: config.mockClaimLabels[key] ?? key,
    value,
  }))

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Aus PID (verifiziert)
        </h3>
        <div className="space-y-2">
          {pidFields.map((f) => (
            <div key={f.label} className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <span className="text-sm text-gray-600">{f.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{f.value}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  PID
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Bescheinigungsdaten (Mock)
        </h3>
        <div className="space-y-2">
          {mockFields.map((f) => (
            <div key={f.label} className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <span className="text-sm text-gray-600">{f.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{f.value}</span>
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                  Mock
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
