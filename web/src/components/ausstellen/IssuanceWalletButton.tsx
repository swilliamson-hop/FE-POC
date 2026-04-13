'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const EUDI_SERVICE_URL = process.env.NEXT_PUBLIC_EUDI_SERVICE_URL ?? 'http://localhost:3001'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 3 * 60 * 1000

type FlowState =
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'polling'; walletUrl: string; isMobile: boolean; txCode: string }
  | { status: 'success' }
  | { status: 'error'; message: string }

interface Props {
  issuanceSessionId: string
  onIssued: () => void
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function IssuanceWalletButton({ issuanceSessionId, onIssued }: Props) {
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

  function startPolling(walletUrl: string, isMobile: boolean, txCode: string) {
    setFlow({ status: 'polling', walletUrl, isMobile, txCode })

    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/result/${issuanceSessionId}`)
        if (resp.status === 202) return

        stopPolling()
        const data = await resp.json()

        if (resp.ok && data.status === 'issued') {
          setFlow({ status: 'success' })
          onIssued()
        } else {
          setFlow({ status: 'error', message: data.errorMessage ?? 'Ausstellung fehlgeschlagen' })
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

  async function handleIssue() {
    setFlow({ status: 'creating' })
    try {
      const resp = await fetch(`${EUDI_SERVICE_URL}/issuer/create-offer/${issuanceSessionId}`, {
        method: 'POST',
      })
      if (!resp.ok) throw new Error('Offer creation failed')
      const data = await resp.json()

      const mobile = isMobileDevice()
      if (mobile) {
        window.location.href = data.walletUrl
      }
      startPolling(data.walletUrl, mobile, data.txCode)
    } catch {
      setFlow({ status: 'error', message: 'Credential-Offer konnte nicht erstellt werden.' })
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
        <span>Credential erfolgreich in Wallet ausgestellt!</span>
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
      <button
        onClick={handleIssue}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Credential in Wallet ausstellen
      </button>
    )
  }

  if (flow.status === 'creating') {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-600">
        <span className="animate-spin">&#x27F3;</span>
        Erstelle Credential-Offer...
      </div>
    )
  }

  // polling – show QR or mobile waiting
  if (flow.isMobile) {
    return (
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="mb-3 font-medium text-blue-900">Credential in Wallet empfangen</p>
        <div className="mb-3 rounded-lg bg-white p-3 text-center">
          <p className="text-xs text-gray-600">PIN für Wallet:</p>
          <p className="text-3xl font-mono font-bold tracking-widest text-blue-700">{flow.txCode}</p>
        </div>
        <div className="flex items-center gap-2 text-blue-700">
          <span className="animate-spin inline-block">&#x27F3;</span>
          Warte auf Empfang in der Wallet...
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
        QR-Code mit EU Digital Identity Wallet scannen um das Credential zu empfangen
      </p>
      <div className="flex justify-center">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <QRCodeSVG value={flow.walletUrl} size={200} />
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-white p-3 text-center">
        <p className="text-xs text-gray-600">PIN für Wallet:</p>
        <p className="text-3xl font-mono font-bold tracking-widest text-blue-700">{flow.txCode}</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-700">
        <span className="animate-spin inline-block">&#x27F3;</span>
        Warte auf Empfang in der Wallet...
      </div>
      <button onClick={handleReset} className="mt-2 w-full text-xs text-blue-500 underline">
        Abbrechen
      </button>
    </div>
  )
}
