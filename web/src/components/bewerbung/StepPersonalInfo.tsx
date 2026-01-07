'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';
import { FileUpload } from '@/components/ui/FileUpload';
import { DataPrivacyBanner } from './DataPrivacyBanner';
import { WBSSelector } from './WBSSelector';
import { uploadFile } from '@/lib/api/file-upload';
import type { UploadedDocument } from '@/lib/types/application';

interface StepPersonalInfoProps {
  firstname: string;
  lastname: string;
  housingPermissionBundesland: string | null;
  housingPermissionType: string | null;
  housingPermissionAmountPeople: number;
  wbsCertificate: UploadedDocument | null;
  onFirstnameChange: (value: string) => void;
  onLastnameChange: (value: string) => void;
  onBundeslandChange: (value: string | null) => void;
  onWBSChange: (value: string | null) => void;
  onAmountPeopleChange: (value: number) => void;
  onWbsCertificateChange: (doc: UploadedDocument | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPersonalInfo({
  firstname,
  lastname,
  housingPermissionBundesland,
  housingPermissionType,
  housingPermissionAmountPeople,
  wbsCertificate,
  onFirstnameChange,
  onLastnameChange,
  onBundeslandChange,
  onWBSChange,
  onAmountPeopleChange,
  onWbsCertificateChange,
  onNext,
  onBack,
}: StepPersonalInfoProps) {
  const [uploadingWbs, setUploadingWbs] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <DataPrivacyBanner phase={0} />

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Persönliche Angaben</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Vorname"
          value={firstname}
          onChange={(e) => onFirstnameChange(e.target.value)}
          required
        />
        <Input
          label="Nachname"
          value={lastname}
          onChange={(e) => onLastnameChange(e.target.value)}
          required
        />
      </div>

      <WBSSelector
        selectedBundesland={housingPermissionBundesland}
        selectedWBS={housingPermissionType}
        onBundeslandChange={onBundeslandChange}
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

          {uploadError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{uploadError}</p>
            </div>
          )}

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
