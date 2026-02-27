'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { PidClaims } from './types'

const EUDI_SERVICE_URL = process.env.NEXT_PUBLIC_EUDI_SERVICE_URL ?? 'http://localhost:3001'
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes

type FlowState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; walletUrl: string; isMobile: boolean }
  | { status: 'polling'; sessionId: string; walletUrl: string; isMobile: boolean }
  | { status: 'success'; pidClaims: PidClaims }
  | { status: 'error'; message: string }

interface Props {
  onPidReceived: (claims: PidClaims) => void
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

export function EudiWalletButton({ onPidReceived }: Props) {
  const [flow, setFlow] = useState<FlowState>({ status: 'idle' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    pollRef.current = null
    timeoutRef.current = null
  }, [])

  const startPolling = useCallback(
    (sessionId: string, walletUrl: string, isMobile: boolean) => {
      setFlow({ status: 'polling', sessionId, walletUrl, isMobile })

      pollRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`${EUDI_SERVICE_URL}/result/${sessionId}`)
          if (resp.status === 202) return // still pending

          stopPolling()
          const data = await resp.json()

          if (resp.ok && data.status === 'complete' && data.pidClaims) {
            setFlow({ status: 'success', pidClaims: data.pidClaims })
            onPidReceived(data.pidClaims)
          } else {
            setFlow({ status: 'error', message: data.errorMessage ?? 'Unbekannter Fehler' })
          }
        } catch {
          // network error – keep polling
        }
      }, POLL_INTERVAL_MS)

      timeoutRef.current = setTimeout(() => {
        stopPolling()
        setFlow({ status: 'error', message: 'Zeitüberschreitung – bitte erneut versuchen.' })
      }, POLL_TIMEOUT_MS)
    },
    [onPidReceived, stopPolling]
  )

  useEffect(() => {
    // Check for wallet_session in URL (same-device redirect back from wallet)
    const params = new URLSearchParams(window.location.search)
    const walletSession = params.get('wallet_session')
    if (walletSession) {
      // Remove param from URL without page reload
      const url = new URL(window.location.href)
      url.searchParams.delete('wallet_session')
      window.history.replaceState({}, '', url.toString())
      // Start polling for this session
      startPolling(walletSession, '', true)
    }
  }, [startPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  async function handleStart() {
    setFlow({ status: 'loading' })
    try {
      const resp = await fetch(`${EUDI_SERVICE_URL}/initiate`, { method: 'POST' })
      if (!resp.ok) throw new Error('Service nicht erreichbar')
      const data = await resp.json()
      const mobile = isMobileDevice()
      setFlow({ status: 'ready', sessionId: data.sessionId, walletUrl: data.walletUrl, isMobile: mobile })
    } catch {
      setFlow({ status: 'error', message: 'EUDI Wallet Service nicht erreichbar.' })
    }
  }

  function handleOpenWallet() {
    if (flow.status !== 'ready') return
    window.location.href = flow.walletUrl
    startPolling(flow.sessionId, flow.walletUrl, true)
  }

  function handleReset() {
    stopPolling()
    setFlow({ status: 'idle' })
  }

  if (flow.status === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        <span className="text-green-600 font-semibold">✓</span>
        <span>Daten aus EU Digital Identity Wallet übernommen</span>
        <button
          onClick={handleReset}
          className="ml-auto text-xs text-green-600 underline hover:no-underline"
        >
          Zurücksetzen
        </button>
      </div>
    )
  }

  if (flow.status === 'error') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
        <span className="font-medium">Fehler:</span> {flow.message}
        <button
          onClick={handleReset}
          className="ml-2 text-xs text-red-600 underline hover:no-underline"
        >
          Erneut versuchen
        </button>
      </div>
    )
  }

  if (flow.status === 'idle') {
    return (
      <button
        onClick={handleStart}
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-blue-600 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
      >
        <WalletIcon />
        Mit EU Digital Identity Wallet ausfüllen
      </button>
    )
  }

  if (flow.status === 'loading') {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-600">
        <span className="animate-spin">⟳</span>
        Verbinde mit EUDI Wallet...
      </div>
    )
  }

  // ready or polling – show QR or deep link
  const isPolling = flow.status === 'polling'
  const currentFlow = flow as Extract<FlowState, { status: 'ready' | 'polling' }>

  if (currentFlow.isMobile) {
    return (
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="mb-3 font-medium text-blue-900">EUDI Wallet öffnen und Daten freigeben</p>
        {isPolling ? (
          <div className="flex items-center gap-2 text-blue-700">
            <span className="animate-spin inline-block">⟳</span>
            Warte auf Freigabe in der Wallet...
          </div>
        ) : (
          <button
            onClick={handleOpenWallet}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Wallet öffnen
          </button>
        )}
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
          <QRCodeSVG value={currentFlow.walletUrl} size={200} />
        </div>
      </div>
      {isPolling ? (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-700">
          <span className="animate-spin inline-block">⟳</span>
          Warte auf Freigabe in der Wallet...
        </div>
      ) : (
        <button
          onClick={() => startPolling(currentFlow.sessionId, currentFlow.walletUrl, false)}
          className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ich habe den QR-Code gescannt
        </button>
      )}
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

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Aus Wallet
    </span>
  )
}
