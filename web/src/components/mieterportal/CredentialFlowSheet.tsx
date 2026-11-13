'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowRight, Building2, Check, Loader2, ShieldCheck, Wallet, X } from 'lucide-react'
import { titleCaseFromCaps } from '@/lib/pid'
import { CLAIM_LABELS, CONTRACT, CREDENTIALS, LANDLORD, formatClaim, formatDate, type CredentialType } from './data'
import type { DemoSettings } from './demo-settings'
import { realApi, simulatedApi, type TenantMatch, type WalletIdentity } from './issuance-api'
import { Sheet } from './Sheet'

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 5 * 60 * 1000
const STORAGE_KEY = 'mieterportal-flow-v1'

type Phase =
  | 'intro'
  | 'starting'
  | 'await_pid' // wallet is presenting the PID
  | 'matched' // PID equals tenant account, offer is ready
  | 'mismatch' // PID belongs to someone else – refused
  | 'await_issue' // wallet is fetching the credential
  | 'issued'
  | 'error'

export interface FlowState {
  type: CredentialType
  phase: Phase
  sessionId?: string
  walletUrl?: string // openid4vp:// – PID presentation
  offerUrl?: string // openid-credential-offer://
  txCode?: string
  sameDevice?: boolean
  simulated?: boolean
  identity?: WalletIdentity
  tenantMatch?: TenantMatch
  credentialClaims?: Record<string, string>
  error?: string
}

// Phases worth resuming if the browser reloads the tab while the user is in
// the wallet app. Simulated sessions live in memory only and are not stored.
const RESUMABLE: Phase[] = ['await_pid', 'matched', 'await_issue']

export function loadStoredFlow(): FlowState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const flow = JSON.parse(raw) as FlowState
    return RESUMABLE.includes(flow.phase) && flow.sessionId ? flow : null
  } catch {
    return null
  }
}

function storeFlow(flow: FlowState): void {
  try {
    if (!flow.simulated && RESUMABLE.includes(flow.phase)) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(flow))
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // storage unavailable – flow still works without resume
  }
}

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

interface Props {
  type: CredentialType
  settings: DemoSettings
  resume?: FlowState
  onClose: () => void
  onIssued: (type: CredentialType) => void
}

export function CredentialFlowSheet({ type, settings, resume, onClose, onIssued }: Props) {
  const [flow, setFlow] = useState<FlowState>(resume ?? { type, phase: 'intro' })
  const info = CREDENTIALS[type]
  const account = settings.account
  const { phase, sessionId, simulated } = flow

  useEffect(() => storeFlow(flow), [flow])

  // Poll the service while the wallet is busy. Also fires as soon as the tab
  // becomes visible again – timers are throttled while the wallet app is in
  // the foreground, and that is exactly when the result arrives.
  useEffect(() => {
    if ((phase !== 'await_pid' && phase !== 'await_issue') || !sessionId) return
    const api = simulated ? simulatedApi : realApi
    let stopped = false
    let inFlight = false

    async function tick() {
      if (stopped || inFlight) return
      inFlight = true
      try {
        const result = await api.poll(sessionId!)
        if (stopped || result.state === 'pending') return

        if (result.state === 'error') {
          stopped = true
          setFlow((f) => ({ ...f, phase: 'error', error: result.message }))
        } else if (phase === 'await_pid' && result.state === 'pid_mismatch') {
          stopped = true
          setFlow((f) => ({ ...f, phase: 'mismatch', tenantMatch: result.tenantMatch }))
        } else if (phase === 'await_pid' && result.state === 'pid_verified') {
          stopped = true
          // Prepare the offer right away so the next tap is a plain link into
          // the wallet (custom-scheme navigation needs a direct user gesture).
          const offer = await api.createOffer(sessionId!)
          setFlow((f) => ({
            ...f,
            phase: 'matched',
            identity: result.identity,
            tenantMatch: result.tenantMatch,
            credentialClaims: result.credentialClaims,
            offerUrl: offer.walletUrl,
            txCode: offer.txCode,
          }))
        } else if (phase === 'await_issue' && result.state === 'issued') {
          stopped = true
          setFlow((f) => ({ ...f, phase: 'issued' }))
          onIssued(type)
        }
      } catch {
        if (stopped) {
          setFlow((f) => ({ ...f, phase: 'error', error: 'Der Nachweis konnte nicht vorbereitet werden.' }))
        }
        // otherwise: network hiccup – keep polling
      } finally {
        inFlight = false
      }
    }

    const interval = setInterval(tick, POLL_INTERVAL_MS)
    const timeout = setTimeout(() => {
      stopped = true
      setFlow((f) => ({ ...f, phase: 'error', error: 'Zeitüberschreitung – bitte erneut versuchen.' }))
    }, POLL_TIMEOUT_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('pageshow', onVisible)
    tick()

    return () => {
      stopped = true
      clearInterval(interval)
      clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [phase, sessionId, simulated, type, onIssued])

  async function start() {
    const sameDevice = isMobileDevice()
    const simulate = settings.simulate
    setFlow({ type, phase: 'starting' })
    try {
      const api = simulate ? simulatedApi : realApi
      const session = await api.initiate({
        credentialType: type,
        tenant: account,
        skipTxCode: !settings.pin,
        returnUrl: sameDevice ? window.location.origin : undefined,
      })
      setFlow({
        type,
        phase: 'await_pid',
        sessionId: session.sessionId,
        walletUrl: session.walletUrl,
        sameDevice,
        simulated: simulate,
      })
      if (sameDevice && session.walletUrl) window.location.href = session.walletUrl
    } catch {
      setFlow({ type, phase: 'error', error: 'Der Wallet-Service ist gerade nicht erreichbar.' })
    }
  }

  const step1Done = !['intro', 'starting', 'await_pid', 'error'].includes(phase)
  const step2Done = phase === 'matched' || phase === 'await_issue' || phase === 'issued'

  return (
    <Sheet eyebrow="Digitaler Nachweis" title={info.title} onClose={onClose} scrollKey={phase === 'issued' ? 'issued' : 'flow'}>
      <RoleStrip holder={`${account.givenName} ${account.familyName}`} />

      {phase === 'issued' ? (
        <div className="mt-6 text-center">
          <div className="mp-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={30} strokeWidth={3} />
          </div>
          <h3 className="mt-3 text-2xl font-bold text-[#151f5e]">In Ihrer Wallet gespeichert</h3>
          <p className="mt-1 text-[15px] text-slate-600">
            Ausgestellt von {LANDLORD}, sicher übermittelt durch Immomio.
          </p>
          <div className="mp-rise mt-5" style={{ animationDelay: '0.2s' }}>
            <CredentialCard title={info.title} />
          </div>
          <p className="mp-rise mt-5 rounded-2xl bg-[#eef2fd] p-4 text-left text-[15px] leading-snug text-[#151f5e]" style={{ animationDelay: '0.4s' }}>
            <span className="font-semibold">Und jetzt?</span> {info.useCase}
          </p>
          <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-[#14246e] py-3.5 text-base font-semibold text-white active:opacity-90">
            Fertig
          </button>
        </div>
      ) : (
        <ol className="mt-6">
          {/* 1 – who holds the wallet? */}
          <Step
            n={1}
            title="Identität bestätigen"
            state={step1Done ? 'done' : phase === 'error' ? 'idle' : 'active'}
            summary={
              flow.identity
                ? `Wallet-Inhaber:in: ${titleCaseFromCaps(flow.identity.given_name)} ${titleCaseFromCaps(flow.identity.family_name)}`
                : step1Done
                  ? 'Ausweisdaten aus der Wallet empfangen'
                  : undefined
            }
          >
            {(phase === 'intro' || phase === 'starting') && (
              <>
                <p className="text-[15px] leading-snug text-slate-600">
                  Zeigen Sie mit dem digitalen Ausweis in Ihrer d-you Wallet, wer Sie sind. So landet der
                  Nachweis sicher bei der richtigen Person.
                </p>
                <button
                  onClick={start}
                  disabled={phase === 'starting'}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14246e] py-3.5 text-base font-semibold text-white active:opacity-90 disabled:opacity-70"
                >
                  {phase === 'starting' ? <Loader2 size={20} className="animate-spin" /> : <Wallet size={20} />}
                  Mit d-you Wallet fortfahren
                </button>
              </>
            )}
            {phase === 'await_pid' && (
              <WalletWait
                url={flow.walletUrl}
                sameDevice={flow.sameDevice}
                simulated={flow.simulated}
                label="Warte auf Ihre Freigabe in der Wallet …"
                qrHint="QR-Code mit der d-you Wallet scannen und Ausweisdaten freigeben"
              />
            )}
          </Step>

          {/* 2 – is that person the tenant? */}
          <Step
            n={2}
            title="Abgleich mit Ihrem Mietvertrag"
            state={step2Done ? 'done' : phase === 'mismatch' ? 'failed' : 'idle'}
          >
            {flow.tenantMatch && (step2Done || phase === 'mismatch') && (
              <MatchTable
                account={account}
                identity={flow.identity}
                match={flow.tenantMatch}
                animate={phase === 'matched' || phase === 'mismatch'}
              />
            )}
            {phase === 'mismatch' && (
              <>
                <p className="mp-rise mt-3 rounded-2xl bg-red-50 p-4 text-[15px] leading-snug text-red-900" style={{ animationDelay: '1.5s' }}>
                  <span className="font-semibold">Kein Nachweis ausgestellt.</span> Die Wallet gehört nicht zur
                  Person, die im Mietvertrag {CONTRACT.number} hinterlegt ist. Bei Fragen wenden Sie sich an{' '}
                  {LANDLORD}.
                </p>
                <button
                  onClick={() => setFlow({ type, phase: 'intro' })}
                  className="mt-4 w-full rounded-2xl border-2 border-[#14246e] py-3 text-base font-semibold text-[#14246e]"
                >
                  Erneut versuchen
                </button>
              </>
            )}
          </Step>

          {/* 3 – hand over the credential */}
          <Step n={3} title="Nachweis in Wallet speichern" state={step2Done ? 'active' : 'idle'} last>
            {step2Done && (
              <div className={phase === 'matched' ? 'mp-rise' : undefined} style={{ animationDelay: '1.7s' }}>
                {flow.txCode && (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#d9822f]/40 bg-[#fdf4ea] px-4 py-2.5">
                    <p className="text-sm leading-tight text-[#8a4f1d]">
                      Ihre PIN für die Wallet
                      <br />
                      <span className="font-semibold">Bitte merken</span>
                    </p>
                    <p className="font-mono text-3xl font-bold tracking-[0.2em] text-[#151f5e]">{flow.txCode}</p>
                  </div>
                )}

                {phase === 'matched' &&
                  (flow.sameDevice && flow.offerUrl ? (
                    <a
                      href={flow.offerUrl}
                      onClick={() => setFlow((f) => ({ ...f, phase: 'await_issue' }))}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d9822f] py-3.5 text-base font-semibold text-white active:opacity-90"
                    >
                      <Wallet size={20} />
                      Jetzt in Wallet speichern
                    </a>
                  ) : (
                    <button
                      onClick={() => setFlow((f) => ({ ...f, phase: 'await_issue' }))}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#d9822f] py-3.5 text-base font-semibold text-white active:opacity-90"
                    >
                      <Wallet size={20} />
                      Jetzt in Wallet speichern
                    </button>
                  ))}

                {phase === 'await_issue' && (
                  <div className="mt-3">
                    <WalletWait
                      url={flow.offerUrl}
                      sameDevice={flow.sameDevice}
                      simulated={flow.simulated}
                      label="Warte auf die Annahme in der Wallet …"
                      qrHint="QR-Code mit der d-you Wallet scannen, um den Nachweis zu empfangen"
                    />
                  </div>
                )}

                <p className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Das erhalten Sie</p>
                <CredentialCard title={info.title} />
                <ClaimList claims={flow.credentialClaims ?? {}} />
              </div>
            )}
          </Step>
        </ol>
      )}

      {phase === 'error' && (
        <div className="mt-2 rounded-2xl bg-red-50 p-4 text-[15px] text-red-900">
          <p>{flow.error}</p>
          <button onClick={() => setFlow({ type, phase: 'intro' })} className="mt-2 font-semibold underline">
            Erneut versuchen
          </button>
        </div>
      )}
    </Sheet>
  )
}

// Who attests, who delivers, who receives – the one thing the audience must get.
function RoleStrip({ holder }: { holder: string }) {
  const roles = [
    { icon: Building2, name: LANDLORD, role: 'bestätigt die Angaben' },
    { icon: ShieldCheck, name: 'Immomio', role: 'stellt digital aus' },
    { icon: Wallet, name: holder, role: 'erhält den Nachweis' },
  ]
  return (
    <div className="flex items-start rounded-2xl bg-[#eef2fd] px-2 py-3">
      {roles.map(({ icon: Icon, name, role }, i) => (
        <div key={role} className="flex min-w-0 flex-1 items-start">
          {i > 0 && <ArrowRight size={16} className="mt-2.5 shrink-0 text-[#d9822f]" />}
          <div className="min-w-0 flex-1 px-1 text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#14246e] shadow-sm">
              <Icon size={18} />
            </div>
            <p className="mt-1.5 text-[13px] font-semibold leading-tight text-[#151f5e] [overflow-wrap:anywhere]">{name}</p>
            <p className="mt-0.5 text-xs leading-tight text-slate-500">{role}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function Step({
  n,
  title,
  state,
  summary,
  last,
  children,
}: {
  n: number
  title: string
  state: 'idle' | 'active' | 'done' | 'failed'
  summary?: string
  last?: boolean
  children?: React.ReactNode
}) {
  const bubble = {
    idle: 'bg-white text-slate-400 border-slate-300',
    active: 'bg-[#14246e] text-white border-[#14246e]',
    done: 'bg-emerald-500 text-white border-emerald-500',
    failed: 'bg-red-500 text-white border-red-500',
  }[state]
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${bubble}`}>
          {state === 'done' ? <Check size={16} strokeWidth={3} /> : state === 'failed' ? <X size={16} strokeWidth={3} /> : n}
        </div>
        {!last && <div className={`my-1 w-0.5 flex-1 ${state === 'done' ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? '' : 'pb-6'}`}>
        <h3 className={`pt-0.5 text-lg font-semibold leading-7 ${state === 'idle' ? 'text-slate-400' : 'text-[#151f5e]'}`}>{title}</h3>
        {summary && <p className="text-[15px] text-slate-600">{summary}</p>}
        {children && <div className="mt-2 empty:hidden">{children}</div>}
      </div>
    </li>
  )
}

// The visible entitlement check: tenant record vs. PID, field by field. On a
// mismatch the stranger's data is never shown (the service doesn't send it).
function MatchTable({
  account,
  identity,
  match,
  animate,
}: {
  account: DemoSettings['account']
  identity?: WalletIdentity
  match: TenantMatch
  animate: boolean
}) {
  const rows = [
    { label: 'Vorname', mine: account.givenName, wallet: titleCaseFromCaps(identity?.given_name), ok: match.givenName },
    { label: 'Nachname', mine: account.familyName, wallet: titleCaseFromCaps(identity?.family_name), ok: match.familyName },
    { label: 'Geburtsdatum', mine: formatDate(account.birthdate), wallet: formatDate(identity?.birthdate), ok: match.birthdate },
  ]
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-x-2 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Mieterkonto</span>
        <span>Wallet (Ausweis)</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={row.label} className="grid grid-cols-[1fr_1fr_1.75rem] items-center gap-x-2 border-t border-slate-100 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{row.label}</p>
            <p className="text-[15px] font-medium text-[#151f5e] [overflow-wrap:anywhere]">{row.mine}</p>
          </div>
          <div className={`min-w-0 ${animate ? 'mp-rise' : ''}`} style={{ animationDelay: `${0.2 + i * 0.4}s` }}>
            <p className="text-xs text-slate-500">&nbsp;</p>
            <p className="text-[15px] font-medium text-[#151f5e] [overflow-wrap:anywhere]">
              {identity ? row.wallet : row.ok ? 'stimmt überein' : 'weicht ab'}
            </p>
          </div>
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${row.ok ? 'bg-emerald-500' : 'bg-red-500'} ${animate ? 'mp-pop' : ''}`}
            style={{ animationDelay: `${0.4 + i * 0.4}s` }}
          >
            {row.ok ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
          </div>
        </div>
      ))}
    </div>
  )
}

function CredentialCard({ title }: { title: string }) {
  return (
    <div className="relative aspect-[1582/994] w-full overflow-hidden rounded-2xl bg-[#0b1b4d] shadow-lg">
      <Image src="/mionauten-credential.jpg" alt="" fill sizes="430px" className="object-cover" priority />
      <div className="absolute inset-x-0 bottom-0 flex h-[21%] items-center justify-between gap-2 px-4 text-left">
        <p className="truncate text-base font-semibold text-white">{title}</p>
        <ShieldCheck size={20} className="shrink-0 text-[#f0a35a]" />
      </div>
    </div>
  )
}

function ClaimList({ claims }: { claims: Record<string, string> }) {
  const entries = Object.entries(claims)
  if (entries.length === 0) return null
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <p className="py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{LANDLORD} bestätigt</p>
      <dl>
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 border-t border-slate-100 py-1.5 text-[15px]">
            <dt className="shrink-0 text-slate-500">{CLAIM_LABELS[key] ?? key}</dt>
            <dd className="text-right font-medium text-[#151f5e] [overflow-wrap:anywhere]">
              {['given_name', 'family_name'].includes(key) ? titleCaseFromCaps(value) : formatClaim(key, value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function WalletWait({
  url,
  sameDevice,
  simulated,
  label,
  qrHint,
}: {
  url?: string
  sameDevice?: boolean
  simulated?: boolean
  label: string
  qrHint: string
}) {
  return (
    <div className="rounded-2xl bg-[#eef2fd] p-4">
      {!sameDevice && !simulated && url && (
        <div className="mb-3 text-center">
          <p className="mb-3 text-[15px] text-[#151f5e]">{qrHint}</p>
          <div className="inline-block rounded-xl bg-white p-3 shadow-sm">
            <QRCodeSVG value={url} size={190} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-2 text-[15px] font-medium text-[#151f5e]">
        <Loader2 size={18} className="animate-spin" />
        {simulated ? 'Simulation läuft …' : label}
      </div>
      {sameDevice && !simulated && url && (
        <a href={url} className="mt-2 block text-center text-sm font-semibold text-[#14246e] underline">
          Wallet erneut öffnen
        </a>
      )}
    </div>
  )
}
