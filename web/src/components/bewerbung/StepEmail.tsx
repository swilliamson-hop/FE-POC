'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, Shield } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { checkGuestApplication } from '@/lib/api/queries';
import { z } from 'zod';

const emailSchema = z.string().email('Bitte geben Sie eine gültige E-Mail-Adresse ein');

interface StepEmailProps {
  email: string;
  onEmailChange: (email: string) => void;
  onTokenReceived: (token: string) => void;
  onNext: () => void;
  propertyId: string;
}

type EmailStatus = 'idle' | 'checking' | 'valid' | 'already_registered' | 'already_guest' | 'error';

export function StepEmail({
  email,
  onEmailChange,
  onTokenReceived,
  onNext,
  propertyId,
}: StepEmailProps) {
  const [status, setStatus] = useState<EmailStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [receivedToken, setReceivedToken] = useState<string | null>(null);
  const lastCheckedEmail = useRef<string>('');

  // Store callback in ref to avoid dependency issues
  const onTokenReceivedRef = useRef(onTokenReceived);
  onTokenReceivedRef.current = onTokenReceived;

  // Debounced email check
  useEffect(() => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setValidationError(email.length > 0 ? result.error.issues[0].message : null);
      setStatus('idle');
      setReceivedToken(null);
      return;
    }

    // Don't re-check if email hasn't changed
    if (lastCheckedEmail.current === email) {
      return;
    }

    setValidationError(null);
    setStatus('checking');
    setError(null);
    setReceivedToken(null);

    const timeoutId = setTimeout(async () => {
      try {
        const response = await checkGuestApplication(email, propertyId);
        lastCheckedEmail.current = email;

        if (response.alreadyGuest) {
          setStatus('already_guest');
        } else if (response.alreadyRegistered) {
          setStatus('already_registered');
        } else if (response.applicationPossible && response.token) {
          setReceivedToken(response.token);
          onTokenReceivedRef.current(response.token);
          setStatus('valid');
        } else {
          setStatus('error');
          setError('Bewerbung für diese E-Mail-Adresse nicht möglich.');
        }
      } catch (err) {
        setStatus('error');
        setError('Fehler bei der Überprüfung. Bitte versuchen Sie es erneut.');
        console.error('Email check failed:', err);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email, propertyId]);

  const isNextEnabled = status === 'valid';

  return (
    <div className="space-y-8">
      {/* Privacy Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800 uppercase">
            Datenschutz
          </span>
        </div>
        <p className="text-sm text-blue-800 leading-relaxed">
          Ihre Bewerbungsdaten werden verschlüsselt gespeichert und stufenweise dem Vermieter freigeschaltet. Sensible Daten, wie bspw. Ihr Einkommen, werden erst angezeigt, wenn Sie die Wohnung besichtigt und Ihr Interesse bekundet haben. Sie können Ihre Bewerbung und Ihre Daten jederzeit löschen. Mehr zum Datenschutz{' '}
          <a
            href="https://www.mieter.immomio.com/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            hier
          </a>.
        </p>
      </div>

      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">E-Mail Adresse</h2>
      </div>

      {/* Input */}
      <Input
        type="email"
        label="E-Mail-Adresse"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        required
        error={validationError || error || undefined}
        icon={<Mail className="w-5 h-5" />}
      />

      {/* Already guest message */}
      {status === 'already_guest' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm text-yellow-800">
            Sie haben bereits eine Gast-Bewerbung mit dieser E-Mail-Adresse erstellt.
            Bitte schauen Sie in Ihrem E-Mail Postfach nach der Bestätigungsmail Ihrer Bewerbung.
          </p>
        </div>
      )}

      {/* Already registered message */}
      {status === 'already_registered' && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm text-yellow-800">
            Für diese E-Mail-Adresse existiert bereits ein Immomio-Konto.
            Bitte melden Sie sich an, um fortzufahren.
          </p>
        </div>
      )}

      {/* Loading indicator */}
      {status === 'checking' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          E-Mail wird überprüft...
        </div>
      )}

      {/* Button */}
      <div className="pt-4">
        <Button onClick={onNext} disabled={!isNextEnabled} fullWidth>
          Weiter
        </Button>
      </div>
    </div>
  );
}
