'use client';

import { Shield } from 'lucide-react';

interface DataPrivacyBannerProps {
  phase: 0 | 1 | 2 | 3;
}

const PHASE_TEXTS: Record<number, string> = {
  0: 'Die nachfolgenden Angaben werden mit dem Anbieter geteilt, wenn dieser ein passendes Objekt zu Ihrem Suchprofil hat oder wenn Sie eine Kontaktanfrage über ein Portal gesendet haben. Pflichtangaben sind mit * gekennzeichnet.',
  1: 'Die Adressdaten werden nur mit einem Anbieter geteilt, wenn Sie aktiv ein Angebot annehmen oder wenn Sie eine Kontaktanfrage über ein Portal gesendet haben.',
  2: 'Die Haushaltsinformationen werden nur mit einem Anbieter geteilt, wenn Sie Ihr Interesse an der Anmietung eines konkreten Objektes bekundet haben.',
  3: 'Diese Dokumente kann der Anbieter erst einsehen, wenn dieser mit Ihnen einen Mietvertrag schließen möchte.',
};

export function DataPrivacyBanner({ phase }: DataPrivacyBannerProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800 uppercase">
              Datenschutz
            </span>
          </div>
          <span className="inline-block px-2 py-0.5 bg-white border border-blue-300 rounded text-xs text-blue-700 font-medium">
            PHASE {phase}
          </span>
        </div>
      </div>
      <p className="mt-3 text-sm text-blue-800 leading-relaxed">
        {PHASE_TEXTS[phase]}
      </p>
    </div>
  );
}
