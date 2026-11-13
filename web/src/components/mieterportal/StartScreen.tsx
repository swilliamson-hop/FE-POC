'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Droplet,
  House,
  MessageSquareText,
  Newspaper,
  Pin,
  TriangleAlert,
} from 'lucide-react'
import { CONTRACT } from './data'

// "Start" tab of the Mieter-App, rebuilt as static scenery so the demo can
// open the way the real app does. Only the greeting and the avatar are live
// (they follow the demo account); everything else is mock content.

const CARD = 'rounded-2xl bg-white shadow-[0_1px_4px_rgba(20,36,110,0.18)]'

// Warmwasser in kWh per month; the remaining months have no reading yet
const USAGE = [
  { month: 'J', value: 252 },
  { month: 'F', value: 244 },
  { month: 'M', value: 226, estimated: true },
  { month: 'A', value: 198 },
  { month: 'M', value: 146, current: true },
  ...['J', 'J', 'A', 'S', 'O', 'N', 'D'].map((month) => ({ month, value: 0 })),
] as { month: string; value: number; estimated?: boolean; current?: boolean }[]
const USAGE_MAX = 260
const USAGE_TICKS = [260, 195, 130, 65, 0]

const NEWS = [
  { title: 'Marathon in Hamburg: Straßensperrungen', text: 'Liebe Mieterinnen und Mieter, am kommenden Sonntag …', date: 'Fr. 21.08.2026', pinned: true },
  { title: 'Zähleraustausch am 15. September', text: 'Liebe Mitglieder, am Dienstag, 15. September …', date: 'Do. 27.08.2026', pinned: true },
  { title: 'Sturmschäden umgehend melden', text: 'Geehrte Mitglieder, nach dem Unwetter …', date: 'Mo. 10.08.2026', pinned: false },
]

const TICKETS: { title: string; date: string; inProgress?: boolean }[] = [
  { title: 'Küche', date: 'Di. 03.11.2026' },
  { title: 'Heizung im Bad', date: 'Di. 27.10.2026', inProgress: true },
  { title: 'Vertragsunterlagen', date: 'Fr. 02.10.2026' },
  { title: 'Bestellung Schlüssel', date: 'Do. 01.10.2026' },
  { title: 'Namensschild Klingel', date: 'Mi. 16.09.2026' },
]

interface Props {
  name: string
  initials: string
  onAvatarClick: () => void
}

export function StartScreen({ name, initials, onAvatarClick }: Props) {
  const hero = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Once the greeting has scrolled away the header shrinks to the landlord logo
  useEffect(() => {
    const onScroll = () => {
      const height = hero.current?.offsetHeight ?? 0
      setCollapsed(window.scrollY > height - 72)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const avatar = (
    <button
      onClick={onAvatarClick}
      aria-label="Demo-Einstellungen"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-[#151f5e]"
    >
      {initials}
    </button>
  )

  return (
    <>
      {/* Collapsed header */}
      <header
        aria-hidden={!collapsed}
        className={`fixed inset-x-0 top-0 z-20 mx-auto flex max-w-[430px] items-center justify-between bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_2px_6px_rgba(20,36,110,0.12)] transition-all duration-200 ${collapsed ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0'}`}
      >
        <Image src="/mionauten-logo.png" alt="Bauverein der Mionauten" width={500} height={150} className="h-11 w-auto" />
        {collapsed && avatar}
      </header>

      {/* Hero with greeting */}
      <div ref={hero} className="relative bg-[#14246e]">
        <div className="relative aspect-[985/400]">
          <Image src="/mieterportal-hero.jpg" alt="" fill sizes="430px" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-55% to-[#14246e]" />
        </div>
        <div className="absolute right-5 top-[max(1rem,env(safe-area-inset-top))]">{avatar}</div>
        <div className="-mt-6 px-5 pb-4 text-white relative">
          <h1 className="text-2xl font-bold leading-tight [overflow-wrap:anywhere]">Guten Tag, {name}</h1>
          <p className="mt-0.5 text-lg">Schön, dass Sie wieder da sind.</p>
        </div>
      </div>

      <main className="flex-1 space-y-7 px-4 pt-6 pb-32">
        {/* Consumption */}
        <section>
          <h2 className="text-2xl font-semibold">Verbrauchsübersicht</h2>
          <p className="mt-2 flex items-center gap-1.5 text-[15px]">
            <House size={16} />
            {CONTRACT.street} ({CONTRACT.number})
            <ChevronDown size={18} />
          </p>
          <div className="mt-4 rounded-2xl bg-[#14246e] p-4 text-white shadow-[0_1px_4px_rgba(20,36,110,0.3)]">
            <div className="flex items-center justify-between px-1 py-2">
              <span className="flex items-center gap-2.5 text-xl font-semibold">
                <Droplet size={22} />
                Warmwasser in kWh
              </span>
              <span className="flex gap-4">
                <ChevronLeft size={26} />
                <ChevronRight size={26} />
              </span>
            </div>
            <div className="mt-2 rounded-2xl bg-white px-4 py-3 text-[#151f5e]">
              <p className="flex items-center justify-end gap-1.5 text-lg font-semibold">
                Details <ArrowRight size={20} />
              </p>
              <UsageChart />
              <div className="mt-3 flex gap-5 text-[15px] font-medium">
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-[#14246e]" />
                  Echter Wert
                </span>
                <span className="flex items-center gap-2">
                  <span className="mp-hatch h-3.5 w-3.5 rounded" />
                  Schätzwert
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-center gap-3" aria-hidden>
              <span className="h-3 w-3 rounded-full border-2 border-white" />
              <span className="h-3 w-3 rounded-full bg-white" />
            </div>
          </div>
        </section>

        {/* News */}
        <section>
          <SectionHeader icon={<Newspaper size={24} />} title="Mitteilungen" />
          <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
            {NEWS.map((item) => (
              <article key={item.title} className={`${CARD} relative w-40 shrink-0 snap-start overflow-hidden`}>
                {item.pinned && (
                  <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#14246e] text-white">
                    <Pin size={14} />
                  </span>
                )}
                <div className="p-3.5 pr-9">
                  <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[15px] leading-snug text-slate-400">{item.text}</p>
                </div>
                <p className="flex items-center gap-2 bg-[#f4f7fe] px-3.5 py-2.5 text-sm text-slate-400">
                  <Clock size={15} />
                  {item.date}
                </p>
              </article>
            ))}
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* Tickets */}
        <section>
          <SectionHeader icon={<MessageSquareText size={24} />} title="Meine Anliegen" />
          <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
            {TICKETS.map((ticket) => (
              <article key={ticket.date} className={`${CARD} w-40 shrink-0 snap-start overflow-hidden`}>
                <div className="h-28 p-3.5">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wider ${ticket.inProgress ? 'bg-[#f6c343] text-black' : 'bg-[#0b4fc4] text-white'}`}
                  >
                    {ticket.inProgress ? 'IN ARBEIT' : 'OFFEN'}
                  </span>
                  <h3 lang="de" className="mt-3 hyphens-auto text-[17px] font-semibold leading-snug">{ticket.title}</h3>
                </div>
                <p className="flex items-center gap-2 bg-[#f4f7fe] px-3.5 py-2.5 text-sm text-slate-400">
                  <Calendar size={15} />
                  {ticket.date}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <div className={`${CARD} flex gap-3 p-4`}>
            <CircleHelp size={24} className="mt-0.5 shrink-0" />
            <div>
              <h3 className="text-lg font-semibold">FAQ</h3>
              <p className="text-[17px] leading-snug text-slate-400">Finde Antworten auf häufig gestellte Fragen</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-[#fbe3e3] p-4 shadow-[0_1px_4px_rgba(20,36,110,0.18)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ec5b5b] text-white">
              <TriangleAlert size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold leading-snug">Besteht ein akuter Notfall?</h3>
              <p className="text-[17px] leading-snug text-slate-500">Kontaktieren Sie uns bitte direkt</p>
            </div>
            <ChevronRight size={26} className="shrink-0" />
          </div>
        </div>
      </main>
    </>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-3 text-xl font-semibold">
        {icon}
        {title}
      </h2>
      <span className="rounded-2xl border-2 border-[#d9822f] bg-white px-4 py-1.5 text-lg font-semibold text-[#d9822f]">Übersicht</span>
    </div>
  )
}

function UsageChart() {
  return (
    <div className="mt-1" role="img" aria-label="Warmwasserverbrauch Januar bis Mai, zuletzt 146 kWh">
      <div className="flex gap-2">
        <div className="flex h-24 flex-col justify-between text-right text-xs text-slate-400">
          {USAGE_TICKS.map((tick) => (
            <span key={tick} className="leading-none">{tick}</span>
          ))}
        </div>
        <div className="relative h-24 flex-1">
          {USAGE_TICKS.map((tick) => (
            <span key={tick} className="absolute inset-x-0 border-t border-slate-200" style={{ bottom: `${(tick / USAGE_MAX) * 100}%` }} />
          ))}
          <div className="absolute inset-0 grid grid-cols-12 items-end justify-items-center pl-1">
            {USAGE.map((bar, i) => (
              <span
                key={i}
                className={`w-3 rounded-t ${bar.current ? 'bg-[#14246e]' : bar.estimated ? 'mp-hatch' : 'bg-[#dfe8fb]'}`}
                style={{ height: `${(bar.value / USAGE_MAX) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="ml-7 mt-2 grid grid-cols-12 justify-items-center pl-1 text-[15px] text-slate-400">
        {USAGE.map((bar, i) => (
          <span key={i} className={bar.current ? 'font-bold text-[#14246e]' : ''}>{bar.month}</span>
        ))}
      </div>
    </div>
  )
}
