'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { PidClaims, CredentialType } from './types'

const EUDI_SERVICE_URL = process.env.NEXT_PUBLIC_EUDI_SERVICE_URL ?? 'http://localhost:3001'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 3 * 60 * 1000

type FlowState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'polling'; issuanceSessionId: string; walletUrl: string; isMobile: boolean }
  | { status: 'success'; pidClaims: PidClaims; issuanceSessionId: string }
  | { status: 'error'; message: string }

interface Props {
  credentialType: CredentialType
  onPidVerified: (pidClaims: PidClaims, issuanceSessionId: string) => void
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function PidVerificationStep({ credentialType, onPidVerified }: Props) {
  const [flow, setFlow] = useState<FlowState>({ status: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pollRef.current = null
    timeoutRef.current = null
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  function startPolling(issuanceSessionId: string, walletUrl: string, isMobile: boolean) {
    setFlow({ status: 'polling', issuanceSessionId, walletUrl, isMobile })

    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/result/${issuanceSessionId}`)
        if (resp.status === 202) return

        stopPolling()
        const data = await resp.json()

        if (resp.ok && data.status === 'pid_verified' && data.pidClaims) {
          setFlow({ status: 'success', pidClaims: data.pidClaims, issuanceSessionId })
          onPidVerified(data.pidClaims, issuanceSessionId)
        } else {
          setFlow({ status: 'error', message: data.errorMessage ?? 'PID-Verifikation fehlgeschlagen' })
        }
      } catch {
        // network error – keep polling
      }
    }, POLL_INTERVAL_MS)

    timeoutRef.current = setTimeout(() => {
      stopPolling()
      setFlow({ status: 'error', message: 'Zeitüberschreitung – bitte erneut versuchen.' })
    }, POLL_TIMEOUT_MS)
  }

  async function handleStart() {
    setFlow({ status: 'loading' })
    try {
      const mobile = isMobileDevice()
      const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialType,
          returnUrl: mobile ? window.location.origin : undefined,
        }),
      })
      if (!resp.ok) throw new Error('Service nicht erreichbar')
      const data = await resp.json()

      if (mobile) {
        window.location.href = data.walletUrl
      }
      startPolling(data.sessionId, data.walletUrl, mobile)
    } catch {
      setFlow({ status: 'error', message: 'EUDI Wallet Service nicht erreichbar.' })
    }
  }

  function handleReset() {
    stopPolling()
    setFlow({ status: 'idle' })
  }

  if (flow.status === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        <span className="text-green-600 font-semibold">&#10003;</span>
        <span>Identität verifiziert: {flow.pidClaims.given_name} {flow.pidClaims.family_name}</span>
      </div>
    )
  }

  if (flow.status === 'error') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
        <span className="font-medium">Fehler:</span> {flow.message}
        <button onClick={handleReset} className="ml-2 text-xs text-red-600 underline hover:no-underline">
          Erneut versuchen
        </button>
      </div>
    )
  }

  if (flow.status === 'idle') {
    return (
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://interoperable-europe.ec.europa.eu/sites/default/files/news/logo/2024-03/Logo%20-%20EUDIW.png"
          alt="EU Digital Identity Wallet"
          className="h-16 w-auto"
        />
        <p className="text-sm text-gray-600 text-center">
          Zur Ausstellung des Credentials muss zuerst Ihre Identität verifiziert werden.
        </p>
        <button
          onClick={handleStart}
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-blue-600 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
        >
          <WalletIcon />
          Identität mit EUDI Wallet verifizieren
        </button>
      </div>
    )
  }

  if (flow.status === 'loading') {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-600">
        <span className="animate-spin">&#x27F3;</span>
        Verbinde mit EUDI Wallet...
      </div>
    )
  }

  // polling – show QR or mobile waiting
  if (flow.isMobile) {
    return (
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="mb-3 font-medium text-blue-900">EUDI Wallet öffnen und PID freigeben</p>
        <div className="flex items-center gap-2 text-blue-700">
          <span className="animate-spin inline-block">&#x27F3;</span>
          Warte auf Freigabe in der Wallet...
        </div>
        <button onClick={handleReset} className="mt-2 text-xs text-blue-500 underline">
          Abbrechen
        </button>
      </div>
    )
  }

  // Desktop – QR code
  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
      <p className="mb-3 text-sm font-medium text-blue-900">
        QR-Code mit EU Digital Identity Wallet scannen
      </p>
      <div className="flex justify-center">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <QRCodeSVG value={flow.walletUrl} size={200} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-700">
        <span className="animate-spin inline-block">&#x27F3;</span>
        Warte auf PID-Freigabe in der Wallet...
      </div>
      <button onClick={handleReset} className="mt-2 w-full text-xs text-blue-500 underline">
        Abbrechen
      </button>
    </div>
  )
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M16 12h2" />
      <path d="M2 9h20" />
    </svg>
  )
}
