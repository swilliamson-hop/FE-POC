'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FileUpload } from '@/components/ui/FileUpload';
import { DataPrivacyBanner } from './DataPrivacyBanner';
import { VerifiedBadge } from './EudiWalletButton';
import { searchAddress, AddressSuggestion } from '@/lib/api/address-autocomplete';
import { uploadFile } from '@/lib/api/file-upload';
import { BUNDESLAENDER } from '@/lib/constants/bundeslaender-wbs';
import type { UploadedDocument } from '@/lib/types/application';

interface StepContactInfoProps {
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  bundesland: string;
  country: string;
  phone: string;
  portrait: UploadedDocument | null;
  walletVerifiedFields?: Set<string>;
  onStreetChange: (value: string) => void;
  onHouseNumberChange: (value: string) => void;
  onZipCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onBundeslandChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPortraitChange: (doc: UploadedDocument | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepContactInfo({
  street,
  houseNumber,
  zipCode,
  city,
  bundesland,
  country,
  phone,
  portrait,
  walletVerifiedFields = new Set(),
  onStreetChange,
  onHouseNumberChange,
  onZipCodeChange,
  onCityChange,
  onBundeslandChange,
  onCountryChange,
  onPhoneChange,
  onPortraitChange,
  onNext,
  onBack,
}: StepContactInfoProps) {
  const [streetQuery, setStreetQuery] = useState(street);

  // Sync streetQuery when street prop is updated externally (e.g. wallet pre-fill)
  useEffect(() => {
    setStreetQuery(street);
  }, [street]);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePortraitUpload = async (file: File) => {
    setUploadingPortrait(true);
    setUploadError(null);
    try {
      const result = await uploadFile(file, 'IMG');
      onPortraitChange(result as UploadedDocument);
    } catch (err) {
      setUploadError('Fehler beim Hochladen. Bitte versuchen Sie es erneut.');
      console.error('Upload failed:', err);
    } finally {
      setUploadingPortrait(false);
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
    onBundeslandChange(suggestion.bundesland);
    setShowSuggestions(false);
  };

  const handleStreetInputChange = (value: string) => {
    setStreetQuery(value);
    onStreetChange(value);
  };

  const isNextEnabled = true;

  const countryOptions = [{ value: 'DE', label: 'Deutschland' }];
  const bundeslandOptions = BUNDESLAENDER.map((bl) => ({ value: bl, label: bl }));

  return (
    <div className="space-y-6">
      <DataPrivacyBanner phase={1} />

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Kontaktdaten</h2>
      </div>

      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800">{uploadError}</p>
        </div>
      )}

      <FileUpload
        label="Profilbild (optional)"
        accept=".jpg,.jpeg,.png"
        description="JPG / PNG bis zu 20 MB"
        onFileSelect={handlePortraitUpload}
        onRemove={() => onPortraitChange(null)}
        uploadedFileName={portrait?.title}
        loading={uploadingPortrait}
      />

      <Select
        label="Land"
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
            label="Nr."
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

      <Select
        label="Bundesland"
        value={bundesland}
        onChange={onBundeslandChange}
        options={bundeslandOptions}
        placeholder="Bundesland wählen"
      />

      <PhoneInput value={phone} onChange={onPhoneChange} />

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
