'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ErfolgPage() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Bewerbung erfolgreich gesendet!
          </h1>
          <p className="text-gray-600">
            Vielen Dank für Ihre Bewerbung. Der Vermieter wird sich in Kürze bei Ihnen melden.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
          <h2 className="font-semibold text-blue-900 mb-2">Was passiert als nächstes?</h2>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">1.</span>
              Der Vermieter prüft Ihre Bewerbung
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">2.</span>
              Sie erhalten eine E-Mail mit dem Ergebnis
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500">3.</span>
              Bei Interesse wird ein Besichtigungstermin vereinbart
            </li>
          </ul>
        </div>

        {/* Back Button */}
        <div className="pt-4">
          <Link href="/expose">
            <Button variant="outline" fullWidth>
              Zurück zur Übersicht
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
