'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { DateInput } from '@/components/ui/DateInput';
import { FileUpload } from '@/components/ui/FileUpload';
import { WBSSelector } from '@/components/bewerbung/WBSSelector';
import { EudiWalletButton, VerifiedBadge } from '@/components/bewerbung/EudiWalletButton';
import { searchAddress, AddressSuggestion } from '@/lib/api/address-autocomplete';
import { uploadFile } from '@/lib/api/file-upload';
import type { UploadedDocument } from '@/lib/types/application';
import type { PidClaims } from '@/components/bewerbung/types';

interface StepPersonalAndContactProps {
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  housingPermissionBundesland: string | null;
  housingPermissionType: string | null;
  housingPermissionAmountPeople: number;
  wbsCertificate: UploadedDocument | null;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  country: string;
  phone: string;
  walletVerifiedFields?: Set<string>;
  onFirstnameChange: (value: string) => void;
  onLastnameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onHousingPermissionBundeslandChange: (value: string | null) => void;
  onWBSChange: (value: string | null) => void;
  onAmountPeopleChange: (value: number) => void;
  onWbsCertificateChange: (doc: UploadedDocument | null) => void;
  onStreetChange: (value: string) => void;
  onHouseNumberChange: (value: string) => void;
  onZipCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPidReceived: (claims: PidClaims) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPersonalAndContact({
  firstname,
  lastname,
  dateOfBirth,
  housingPermissionBundesland,
  housingPermissionType,
  housingPermissionAmountPeople,
  wbsCertificate,
  street,
  houseNumber,
  zipCode,
  city,
  country,
  phone,
  walletVerifiedFields = new Set(),
  onFirstnameChange,
  onLastnameChange,
  onDateOfBirthChange,
  onHousingPermissionBundeslandChange,
  onWBSChange,
  onAmountPeopleChange,
  onWbsCertificateChange,
  onStreetChange,
  onHouseNumberChange,
  onZipCodeChange,
  onCityChange,
  onCountryChange,
  onPhoneChange,
  onPidReceived,
  onNext,
  onBack,
}: StepPersonalAndContactProps) {
  const [uploadingWbs, setUploadingWbs] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [streetQuery, setStreetQuery] = useState(street);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Verhindert, dass das Autocomplete-Dropdown aufpoppt, wenn die Straße
  // extern gesetzt wurde (z. B. durch Wallet-Pre-Fill) statt durch User-Eingabe.
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    if (street !== streetQuery) {
      skipNextSearchRef.current = true;
      setStreetQuery(street);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street]);

  const isNextEnabled = firstname.trim().length > 0 && lastname.trim().length > 0;

  const handleWbsUpload = async (file: File) => {
    setUploadingWbs(true);
    setUploadError(null);
    try {
      const result = await uploadFile(file, 'WB_CERTIFICATE');
      onWbsCertificateChange(result as UploadedDocument);
    } catch (err) {
      setUploadError('Fehler beim Hochladen. Bitte versuchen Sie es erneut.');
      console.error('Upload failed:', err);
    } finally {
      setUploadingWbs(false);
    }
  };

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const results = await searchAddress(query);
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const timeoutId = setTimeout(() => {
      searchAddresses(streetQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [streetQuery, searchAddresses]);

  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    onStreetChange(suggestion.street);
    setStreetQuery(suggestion.street);
    onHouseNumberChange(suggestion.houseNumber);
    onZipCodeChange(suggestion.zipCode);
    onCityChange(suggestion.city);
    setShowSuggestions(false);
  };

  const handleStreetInputChange = (value: string) => {
    setStreetQuery(value);
    onStreetChange(value);
  };

  const countryOptions = [{ value: 'DE', label: 'Deutschland' }];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Persönliche Angaben</h2>
      </div>

      <EudiWalletButton onPidReceived={onPidReceived} />

      <div className="relative flex items-center">
        <div className="flex-grow border-t border-gray-200" />
        <span className="mx-3 flex-shrink text-xs text-gray-400">oder manuell eingeben</span>
        <div className="flex-grow border-t border-gray-200" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label={
            <span className="flex items-center gap-2">
              Vorname {walletVerifiedFields.has('firstname') && <VerifiedBadge />}
            </span>
          }
          value={firstname}
          onChange={(e) => onFirstnameChange(e.target.value)}
          required
        />
        <Input
          label={
            <span className="flex items-center gap-2">
              Nachname {walletVerifiedFields.has('lastname') && <VerifiedBadge />}
            </span>
          }
          value={lastname}
          onChange={(e) => onLastnameChange(e.target.value)}
          required
        />
      </div>

      <DateInput
        label={
          <span className="flex items-center gap-2">
            Geburtstag {walletVerifiedFields.has('dateOfBirth') && <VerifiedBadge />}
          </span>
        }
        value={dateOfBirth}
        onChange={onDateOfBirthChange}
      />

      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800">{uploadError}</p>
        </div>
      )}

      <Select
        label={
          <span className="flex items-center gap-2">
            Land {walletVerifiedFields.has('country') && <VerifiedBadge />}
          </span>
        }
        value={country}
        onChange={onCountryChange}
        options={countryOptions}
      />

      <div className="relative">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 relative">
            <Input
              label={
                <span className="flex items-center gap-2">
                  Straße {walletVerifiedFields.has('street') && <VerifiedBadge />}
                </span>
              }
              value={streetQuery}
              onChange={(e) => handleStreetInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 text-sm"
                  >
                    <span className="font-medium">{suggestion.street}</span>
                    {suggestion.houseNumber && ` ${suggestion.houseNumber}`}
                    <br />
                    <span className="text-gray-500">
                      {suggestion.zipCode} {suggestion.city}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input
            label={
              <span className="flex items-center gap-2">
                Nr. {walletVerifiedFields.has('houseNumber') && <VerifiedBadge />}
              </span>
            }
            value={houseNumber}
            onChange={(e) => onHouseNumberChange(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input
          label={
            <span className="flex items-center gap-2">
              PLZ {walletVerifiedFields.has('zipCode') && <VerifiedBadge />}
            </span>
          }
          value={zipCode}
          onChange={(e) => onZipCodeChange(e.target.value.slice(0, 5))}
          maxLength={5}
        />
        <div className="col-span-2">
          <Input
            label={
              <span className="flex items-center gap-2">
                Stadt {walletVerifiedFields.has('city') && <VerifiedBadge />}
              </span>
            }
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
          />
        </div>
      </div>

      <PhoneInput value={phone} onChange={onPhoneChange} />

      <WBSSelector
        selectedBundesland={housingPermissionBundesland}
        selectedWBS={housingPermissionType}
        onBundeslandChange={onHousingPermissionBundeslandChange}
        onWBSChange={onWBSChange}
      />

      {housingPermissionType && (
        <div className="space-y-4">
          <NumberInput
            label="Anzahl zugelassener Personen lt. Bescheinigung"
            value={housingPermissionAmountPeople}
            onChange={onAmountPeopleChange}
            min={1}
            max={20}
          />

          <FileUpload
            label="Wohnberechtigungsnachweis"
            description="Laden Sie eine Kopie der Bescheinigung hoch"
            onFileSelect={handleWbsUpload}
            onRemove={() => onWbsCertificateChange(null)}
            uploadedFileName={wbsCertificate?.title}
            loading={uploadingWbs}
          />
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onBack}>
          Zurück
        </Button>
        <Button onClick={onNext} disabled={!isNextEnabled} fullWidth>
          Weiter
        </Button>
      </div>
    </div>
  );
}
