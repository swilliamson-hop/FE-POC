'use client'

import { useState } from 'react'
import { DEFAULT_SETTINGS, saveSettings, type DemoSettings } from './demo-settings'
import { Sheet } from './Sheet'

interface Props {
  settings: DemoSettings
  onClose: () => void
}

// Presenter controls, reached via the avatar. Not part of the product story.
export function DemoSettingsSheet({ settings, onClose }: Props) {
  const [draft, setDraft] = useState(settings)
  const account = draft.account
  const valid =
    account.givenName.trim() !== '' && account.familyName.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(account.birthdate)

  function setAccount(patch: Partial<DemoSettings['account']>) {
    setDraft((d) => ({ ...d, account: { ...d.account, ...patch } }))
  }

  function save() {
    saveSettings({
      ...draft,
      account: { ...account, givenName: account.givenName.trim(), familyName: account.familyName.trim() },
    })
    onClose()
  }

  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-[#151f5e] outline-none focus:border-[#14246e]'

  return (
    <Sheet eyebrow="Demo-Einstellungen" title="Angemeldetes Mieterkonto" onClose={onClose}>
      <p className="text-[15px] leading-snug text-slate-600">
        Diese Person ist im Mietvertrag hinterlegt. Der Nachweis wird nur ausgestellt, wenn der Ausweis in
        der Wallet dazu passt.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-slate-600">
          Vorname
          <input className={input} value={account.givenName} onChange={(e) => setAccount({ givenName: e.target.value })} />
        </label>
        <label className="block text-sm font-medium text-slate-600">
          Nachname
          <input className={input} value={account.familyName} onChange={(e) => setAccount({ familyName: e.target.value })} />
        </label>
        <label className="block text-sm font-medium text-slate-600">
          Geburtsdatum
          <input type="date" className={input} value={account.birthdate} onChange={(e) => setAccount({ birthdate: e.target.value })} />
        </label>
      </div>

      <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
        <Toggle
          label="PIN-Abfrage in der Wallet"
          hint="Aus: Nachweis wird ohne PIN-Eingabe übernommen."
          checked={draft.pin}
          onChange={(pin) => setDraft((d) => ({ ...d, pin }))}
        />
        <Toggle
          label="Wallet simulieren"
          hint="Offline-Durchlauf ohne Wallet und Service. Die simulierte Wallet gehört Erika Mustermann, 12.08.1964."
          checked={draft.simulate}
          onChange={(simulate) => setDraft((d) => ({ ...d, simulate }))}
        />
      </div>

      <button
        onClick={save}
        disabled={!valid}
        className="mt-6 w-full rounded-2xl bg-[#14246e] py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        Speichern
      </button>
      <button
        onClick={() => {
          saveSettings(DEFAULT_SETTINGS)
          onClose()
        }}
        className="mt-3 w-full py-2 text-[15px] font-semibold text-[#14246e] underline"
      >
        Demo zurücksetzen
      </button>
    </Sheet>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-base font-medium text-[#151f5e]">{label}</span>
        <span className="block text-sm leading-snug text-slate-500">{hint}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[#14246e] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#d9822f]" />
    </label>
  )
}
