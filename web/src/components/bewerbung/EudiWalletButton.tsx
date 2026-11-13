'use client'

import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CompactContext } from '@/components/ui/density'
import { titleCaseFromCaps } from '@/lib/pid'
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
      const mobile = isMobileDevice()
      const resp = await fetch(`${EUDI_SERVICE_URL}/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only send returnUrl on mobile – desktop QR flow runs on localhost which the phone can't reach
        body: JSON.stringify({ returnUrl: mobile ? window.location.origin : undefined }),
      })
      if (!resp.ok) throw new Error('Service nicht erreichbar')
      const data = await resp.json()
      if (mobile) {
        // Mobile: open wallet directly and start polling – no intermediate button needed
        window.location.href = data.walletUrl
        startPolling(data.sessionId, data.walletUrl, true)
      } else {
        // Desktop: start polling immediately as soon as QR code is shown
        startPolling(data.sessionId, data.walletUrl, false)
      }
    } catch {
      setFlow({ status: 'error', message: 'Wallet-Service nicht erreichbar.' })
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
    return <PidReceivedCard claims={flow.pidClaims} onReset={handleReset} />
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
        className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/d-you-icon.png" alt="" className="h-11 w-11 mix-blend-multiply" />
        Mit d-you Wallet ausfüllen
      </button>
    )
  }

  if (flow.status === 'loading') {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-600">
        <span className="animate-spin">⟳</span>
        Verbinde mit d-you Wallet...
      </div>
    )
  }

  // ready or polling – show QR or deep link
  const isPolling = flow.status === 'polling'
  const currentFlow = flow as Extract<FlowState, { status: 'ready' | 'polling' }>

  if (currentFlow.isMobile) {
    return (
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="mb-3 font-medium text-blue-900">d-you Wallet öffnen und Daten freigeben</p>
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
        QR-Code mit d-you Wallet scannen
      </p>
      <div className="flex justify-center">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <QRCodeSVG value={currentFlow.walletUrl} size={200} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-blue-700">
        <span className="animate-spin inline-block">⟳</span>
        Warte auf Freigabe in der Wallet...
      </div>
      <button onClick={handleReset} className="mt-2 w-full text-xs text-blue-500 underline">
        Abbrechen
      </button>
    </div>
  )
}

// Shown once the wallet has released the PID: every value that was taken over
// into the application appears one after another with a green check.
function PidReceivedCard({ claims, onReset }: { claims: PidClaims; onReset: () => void }) {
  const birthdate = claims.birthdate?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const rows = [
    { label: 'Vorname', value: titleCaseFromCaps(claims.given_name) },
    { label: 'Nachname', value: titleCaseFromCaps(claims.family_name) },
    { label: 'Geburtsdatum', value: birthdate ? `${birthdate[3]}.${birthdate[2]}.${birthdate[1]}` : claims.birthdate },
    { label: 'Straße', value: titleCaseFromCaps(claims.street_address) },
    { label: 'PLZ', value: claims.postal_code },
    { label: 'Ort', value: titleCaseFromCaps(claims.locality) },
  ].filter((row) => row.value)
  const personalId = claims.personal_administrative_number
  const compact = useContext(CompactContext)
  const doneDelay = 0.3 + rows.length * 0.3

  return (
    <div className="overflow-hidden rounded-xl border border-green-200 bg-white" role="status">
      <div className="flex items-center gap-2 bg-green-50 px-4 py-2.5 text-sm text-green-800">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-green-600">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M16 12h2" />
          <path d="M2 9h20" />
        </svg>
        <span className="font-semibold">Aus Ihrer d-you Wallet übernommen</span>
        <button onClick={onReset} className="ml-auto text-xs text-green-700 underline hover:no-underline">
          Zurücksetzen
        </button>
      </div>

      <ul>
        {rows.map((row, i) => (
          <li
            key={row.label}
            className={`mp-rise flex items-center gap-3 border-t border-gray-100 px-4 ${compact ? 'py-1.5' : 'py-2'}`}
            style={{ animationDelay: `${0.15 + i * 0.3}s` }}
          >
            <div className={`min-w-0 flex-1 ${compact ? 'flex items-baseline justify-between gap-3' : ''}`}>
              <p className="shrink-0 text-xs text-gray-500">{row.label}</p>
              <p className={`text-sm font-medium text-gray-900 [overflow-wrap:anywhere] ${compact ? 'text-right' : ''}`}>{row.value}</p>
            </div>
            <span
              className="mp-pop flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white"
              style={{ animationDelay: `${0.35 + i * 0.3}s` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </li>
        ))}
      </ul>

      <p
        className="mp-rise border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-600"
        style={{ animationDelay: `${doneDelay}s` }}
      >
        Staatlich bestätigte Angaben – wir haben sie für Sie in die Bewerbung eingetragen.
      </p>

      {personalId && (
        <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-600">
          <span className="font-medium">Persistente Personen-ID:</span>{' '}
          <span className="font-mono break-all">{personalId}</span>
        </div>
      )}
    </div>
  )
}

export function VerifiedBadge() {
  return (
    <span className="mp-pop inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Aus Wallet
    </span>
  )
}
