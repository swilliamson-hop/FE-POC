'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FileUpload } from '@/components/ui/FileUpload';
import { DataPrivacyBanner } from './DataPrivacyBanner';
import { uploadFile } from '@/lib/api/file-upload';
import type { UploadedDocument, DocumentType } from '@/lib/types/application';

interface StepDocumentsProps {
  incomeStatement: UploadedDocument | null;
  creditReport: UploadedDocument | null;
  otherDocuments: UploadedDocument[];
  onIncomeStatementChange: (doc: UploadedDocument | null) => void;
  onCreditReportChange: (doc: UploadedDocument | null) => void;
  onOtherDocumentsChange: (docs: UploadedDocument[]) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function StepDocuments({
  incomeStatement,
  creditReport,
  otherDocuments,
  onIncomeStatementChange,
  onCreditReportChange,
  onOtherDocumentsChange,
  onSubmit,
  onBack,
  isSubmitting,
}: StepDocumentsProps) {
  const [uploadingIncome, setUploadingIncome] = useState(false);
  const [uploadingCredit, setUploadingCredit] = useState(false);
  const [uploadingOther, setUploadingOther] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (
    file: File,
    documentType: DocumentType,
    setUploading: (v: boolean) => void,
    onSuccess: (doc: UploadedDocument) => void
  ) => {
    setUploading(true);
    setError(null);

    try {
      const result = await uploadFile(file, documentType);
      onSuccess(result as UploadedDocument);
    } catch (err) {
      setError('Fehler beim Hochladen. Bitte versuchen Sie es erneut.');
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleIncomeUpload = (file: File) => {
    handleFileUpload(file, 'INCOME_STATEMENT', setUploadingIncome, onIncomeStatementChange);
  };

  const handleCreditUpload = (file: File) => {
    handleFileUpload(file, 'CREDIT_REPORT', setUploadingCredit, onCreditReportChange);
  };

  const handleOtherUpload = (file: File) => {
    handleFileUpload(file, 'OTHER', setUploadingOther, (doc) => {
      onOtherDocumentsChange([...otherDocuments, doc]);
    });
  };

  const handleRemoveOther = (index: number) => {
    onOtherDocumentsChange(otherDocuments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <DataPrivacyBanner phase={3} />

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dokumente</h2>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <FileUpload
        label="Einkommensnachweis (letzte 3 Monate)"
        onFileSelect={handleIncomeUpload}
        onRemove={() => onIncomeStatementChange(null)}
        uploadedFileName={incomeStatement?.title}
        loading={uploadingIncome}
      />

      <FileUpload
        label="Bonitätsauskunft"
        onFileSelect={handleCreditUpload}
        onRemove={() => onCreditReportChange(null)}
        uploadedFileName={creditReport?.title}
        loading={uploadingCredit}
      />

      <div className="space-y-3">
        <FileUpload
          label="Weitere Dokumente"
          onFileSelect={handleOtherUpload}
          loading={uploadingOther}
        />
        {otherDocuments.length > 0 && (
          <div className="space-y-2">
            {otherDocuments.map((doc, index) => (
              <div
                key={doc.identifier}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-sm text-gray-700">{doc.title}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveOther(index)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Zurück
        </Button>
        <Button onClick={onSubmit} loading={isSubmitting} fullWidth>
          {isSubmitting ? 'Wird gesendet...' : 'Bewerbung absenden'}
        </Button>
      </div>
    </div>
  );
}
