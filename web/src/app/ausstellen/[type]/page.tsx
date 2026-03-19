'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CREDENTIAL_CONFIGS, type PidClaims, type CredentialType } from '@/components/ausstellen/types'
import { PidVerificationStep } from '@/components/ausstellen/PidVerificationStep'
import { CredentialPreview } from '@/components/ausstellen/CredentialPreview'
import { IssuanceWalletButton } from '@/components/ausstellen/IssuanceWalletButton'

type Step = 'verify' | 'preview' | 'issue' | 'success'

export default function IssuancePage() {
  const params = useParams()
  const credentialType = params.type as CredentialType

  const config = CREDENTIAL_CONFIGS[credentialType]

  const [step, setStep] = useState<Step>('verify')
  const [pidClaims, setPidClaims] = useState<PidClaims | null>(null)
  const [issuanceSessionId, setIssuanceSessionId] = useState<string | null>(null)

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unbekannter Credential-Typ</h1>
          <Link href="/ausstellen" className="text-blue-600 underline text-sm">
            Zurück zur Auswahl
          </Link>
        </div>
      </div>
    )
  }

  function handlePidVerified(claims: PidClaims, sessionId: string) {
    setPidClaims(claims)
    setIssuanceSessionId(sessionId)
    setStep('preview')
  }

  function handleIssueClick() {
    setStep('issue')
  }

  function handleIssued() {
    setStep('success')
  }

  const steps = [
    { key: 'verify', label: '1. Identität' },
    { key: 'preview', label: '2. Vorschau' },
    { key: 'issue', label: '3. Ausstellen' },
  ]
  const stepIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/ausstellen" className="text-xs text-blue-600 hover:underline mb-2 inline-block">
            &larr; Zurück zur Auswahl
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{config.title}</h1>
          <p className="mt-1 text-sm text-gray-600">{config.description}</p>
        </div>

        {/* Progress */}
        {step !== 'success' && (
          <div className="mb-6 flex gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex-1">
                <div className={`h-1 rounded-full ${i <= stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <span className={`mt-1 block text-xs ${i <= stepIndex ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          {step === 'verify' && (
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Identität verifizieren
              </h2>
              <PidVerificationStep
                credentialType={credentialType}
                onPidVerified={handlePidVerified}
              />
            </div>
          )}

          {step === 'preview' && pidClaims && (
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Credential-Vorschau
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Diese Daten werden in das Credential geschrieben und in Ihrer Wallet gespeichert.
              </p>
              <CredentialPreview config={config} pidClaims={pidClaims} />
              <button
                onClick={handleIssueClick}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Weiter zur Ausstellung
              </button>
            </div>
          )}

          {step === 'issue' && issuanceSessionId && (
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Credential empfangen
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Scannen Sie den QR-Code mit Ihrer EUDI Wallet oder tippen Sie auf den Button,
                um das Credential zu empfangen.
              </p>
              <IssuanceWalletButton
                issuanceSessionId={issuanceSessionId}
                onIssued={handleIssued}
              />
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                Credential ausgestellt!
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Die <strong>{config.title}</strong> wurde erfolgreich in Ihre EUDI Wallet ausgestellt.
                Sie finden das Credential jetzt in Ihrer Wallet-App.
              </p>
              <Link
                href="/ausstellen"
                className="inline-block rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Weiteres Credential ausstellen
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
