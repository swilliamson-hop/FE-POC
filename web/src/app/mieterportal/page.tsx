'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Contact,
  Gauge,
  Home,
  House,
  MessageSquare,
  Newspaper,
  Wallet,
} from 'lucide-react'
import { CredentialFlowSheet, loadStoredFlow, type FlowState } from '@/components/mieterportal/CredentialFlowSheet'
import { DemoSettingsSheet } from '@/components/mieterportal/DemoSettingsSheet'
import { CONTRACT, CREDENTIALS, formatDate, formatEuro, type CredentialType } from '@/components/mieterportal/data'
import { saveSettings, useDemoSettings } from '@/components/mieterportal/demo-settings'
import { StartScreen } from '@/components/mieterportal/StartScreen'

// Tenant-portal showcase for credential issuance: the logged-in tenant pulls a
// landlord-attested credential into their d-you wallet. Styled after the native
// Mieter-App and built phone-first for the same-device flow. The demo opens on
// the app's start screen; the issuance lives under the "Zuhause" tab.
export default function MieterportalPage() {
  const settings = useDemoSettings()
  const [active, setActive] = useState<{ type: CredentialType; resume?: FlowState } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [tab, setTab] = useState<'start' | 'zuhause'>('start')

  function switchTab(next: 'start' | 'zuhause') {
    setTab(next)
    window.scrollTo(0, 0)
  }

  // Coming back from the wallet app the browser may have reloaded the tab –
  // pick the running issuance up where it was.
  useEffect(() => {
    const stored = loadStoredFlow()
    /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from sessionStorage after hydration */
    if (stored) {
      setActive({ type: stored.type, resume: stored })
      setTab('zuhause')
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const handleIssued = useCallback(
    (type: CredentialType) => {
      saveSettings({ ...settings, issued: { ...settings.issued, [type]: new Date().toISOString() } })
    },
    [settings],
  )

  const { account } = settings
  const initials = `${account.givenName.charAt(0)}${account.familyName.charAt(0)}`.toUpperCase()
  const total = CONTRACT.costs.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="min-h-dvh bg-[#dfe5f3] text-[#151f5e]">
      <div className="relative mx-auto flex min-h-dvh max-w-[430px] flex-col bg-[#f4f7fe] shadow-xl">
        {tab === 'start' && (
          <StartScreen
            name={`${account.givenName} ${account.familyName}`}
            initials={initials}
            onAvatarClick={() => setShowSettings(true)}
          />
        )}

        {tab === 'zuhause' && (
        <>
        {/* App header */}
        <header className="sticky top-0 z-20 bg-white shadow-[0_2px_6px_rgba(20,36,110,0.12)]">
          <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
            <h1 className="text-[2rem] font-bold leading-tight">Zuhause</h1>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="Demo-Einstellungen"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold"
            >
              {initials}
            </button>
          </div>
          <nav className="mt-3 grid grid-cols-3 text-center text-lg font-semibold" aria-label="Bereiche">
            <span className="border-b-[3px] border-[#14246e] pb-2.5">Verträge</span>
            <span className="relative pb-2.5 text-slate-400">
              Dokumente
              <span className="absolute -top-0.5 ml-0.5 h-2 w-2 rounded-full bg-red-600" />
            </span>
            <span className="pb-2.5 text-slate-400">Zahlungen</span>
          </nav>
        </header>

        <main className="flex-1 space-y-4 px-4 pt-5 pb-28">
          {settings.simulate && (
            <p className="rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-semibold text-amber-900">
              Simulation aktiv – ohne echte Wallet
            </p>
          )}

          {/* Contract */}
          <section className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(20,36,110,0.18)]">
            <div className="flex items-center gap-2">
              <House size={22} />
              <h2 className="text-xl font-semibold">Wohnung/Haus</h2>
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{CONTRACT.street}</p>
                <p>{CONTRACT.zipCity}</p>
              </div>
              <div className="text-right text-[15px] text-slate-500">
                <p>Vertr.Nr: {CONTRACT.number}</p>
                <p>seit {formatDate(CONTRACT.since)}</p>
              </div>
            </div>
            <p className="mt-2 text-[15px] text-slate-500">
              Mieter:in: <span className="font-medium text-[#151f5e]">{account.givenName} {account.familyName}</span>
            </p>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
              {CONTRACT.costs.map((c) => (
                <span key={c.label} style={{ width: `${(c.amount / total) * 100}%`, backgroundColor: c.color }} />
              ))}
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[15px] text-slate-500">Gesamtmiete</span>
              <span className="text-xl font-bold text-slate-600">{formatEuro(total)}</span>
            </div>
          </section>

          {/* Digital credentials – the showcase */}
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_4px_rgba(20,36,110,0.18)] ring-2 ring-[#d9822f]/60">
            <div className="flex items-center justify-between gap-2 bg-[#14246e] px-5 py-3 text-white">
              <div className="flex items-center gap-2">
                <Wallet size={22} />
                <h2 className="text-xl font-semibold">Digitale Nachweise</h2>
              </div>
              <span className="rounded-full bg-[#d9822f] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">Neu</span>
            </div>
            <p className="px-5 pt-3 text-[15px] leading-snug text-slate-600">
              Von Ihrem Vermieter bestätigt, direkt in Ihre d-you Wallet – ohne Papier, ohne Wartezeit.
            </p>
            <ul className="mt-1 divide-y divide-slate-100">
              {Object.values(CREDENTIALS).map((cred) => {
                const issuedAt = settings.issued[cred.id]
                return (
                  <li key={cred.id}>
                    <button
                      onClick={() => setActive({ type: cred.id })}
                      className="flex w-full items-center gap-3 px-5 py-4 text-left active:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold leading-tight">{cred.title}</span>
                        {issuedAt ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[15px] font-medium text-emerald-700">
                            <BadgeCheck size={16} />
                            In Ihrer Wallet seit {formatDate(issuedAt)}
                          </span>
                        ) : (
                          <span className="mt-0.5 block text-[15px] leading-snug text-slate-500">{cred.purpose}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#fdf1e4] px-3 py-1.5 text-sm font-semibold text-[#b5651d]">
                        {issuedAt ? 'Erneut' : 'Abrufen'}
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Remaining app content, static – keeps the screen recognisable */}
          <section className="rounded-2xl bg-white p-5 shadow-[0_1px_4px_rgba(20,36,110,0.18)]">
            <h2 className="text-xl font-semibold">Bankverbindung des Vermieters</h2>
            <dl className="mt-3 grid grid-cols-[5.5rem_1fr] gap-y-1.5 text-[15px]">
              <dt className="font-semibold">Bank</dt>
              <dd>Hamburger Sparkasse</dd>
              <dt className="font-semibold">Inhaber</dt>
              <dd>Bauverein Mionauten</dd>
              <dt className="font-semibold">IBAN</dt>
              <dd className="[overflow-wrap:anywhere]">DE02200505501015871393</dd>
              <dt className="font-semibold">BIC</dt>
              <dd>HASPDEHH</dd>
            </dl>
          </section>
          <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-[0_1px_4px_rgba(20,36,110,0.18)]">
            <span className="flex items-center gap-3 text-xl font-semibold">
              <Contact size={22} />
              Ansprechpartner
            </span>
            <ChevronRight size={22} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-[0_1px_4px_rgba(20,36,110,0.18)]">
            <span className="text-xl font-semibold">Vertragspartner</span>
            <ChevronDown size={22} />
          </div>
        </main>
        </>
        )}

        {/* Tab bar */}
        <nav
          aria-label="Hauptnavigation"
          className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-[430px] grid-cols-4 rounded-t-3xl bg-[#14246e] px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white"
        >
          {(
            [
              { label: 'Start', icon: Gauge, target: 'start' },
              { label: 'News', icon: Newspaper },
              { label: 'Anliegen', icon: MessageSquare, dot: true },
              { label: 'Zuhause', icon: Home, target: 'zuhause', dot: true },
            ] as const
          ).map((item) => {
            const Icon = item.icon
            const target = 'target' in item ? item.target : undefined
            const current = target === tab
            const dot = 'dot' in item && item.dot
            const className = `flex flex-col items-center gap-1 rounded-2xl py-2 text-xs font-medium uppercase tracking-wider ${current ? 'bg-white/15 text-[#f0a35a]' : ''}`
            const content = (
              <>
                <span className="relative">
                  <Icon size={24} />
                  {dot && <span className="absolute h-2 w-2 rounded-full bg-red-600" style={{ top: -2, right: -4 }} />}
                </span>
                {item.label}
              </>
            )
            return target ? (
              <button key={item.label} onClick={() => switchTab(target)} aria-current={current ? 'page' : undefined} className={className}>
                {content}
              </button>
            ) : (
              <span key={item.label} className={className}>
                {content}
              </span>
            )
          })}
        </nav>
      </div>

      {active && (
        <CredentialFlowSheet
          key={active.type}
          type={active.type}
          settings={settings}
          resume={active.resume}
          onClose={() => setActive(null)}
          onIssued={handleIssued}
        />
      )}
      {showSettings && <DemoSettingsSheet settings={settings} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
