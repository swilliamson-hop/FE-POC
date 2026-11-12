'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface Props {
  eyebrow?: string
  title: string
  onClose: () => void
  // Content scrolls back to the top whenever this changes
  scrollKey?: string
  children: React.ReactNode
}

// Full-height bottom sheet, constrained to the phone-width portal column.
export function Sheet({ eyebrow, title, onClose, scrollKey, children }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [scrollKey])

  // Lock page scroll behind the sheet
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[#0b1437]/50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mp-sheet mt-[max(1.5rem,env(safe-area-inset-top))] flex w-full max-w-[430px] flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-[#d9822f]">{eyebrow}</p>}
            <h2 className="text-2xl font-bold leading-tight text-[#151f5e]">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#151f5e]"
          >
            <X size={20} />
          </button>
        </div>
        <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
