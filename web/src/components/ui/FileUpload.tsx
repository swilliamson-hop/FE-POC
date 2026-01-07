'use client';

import { useCallback, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

interface FileUploadProps {
  label: string;
  description?: string;
  accept?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File) => void;
  onRemove?: () => void;
  uploadedFileName?: string;
  error?: string;
  loading?: boolean;
}

export function FileUpload({
  label,
  description = 'PDF / JPG / PNG bis zu 20 MB',
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMB = 20,
  onFileSelect,
  onRemove,
  uploadedFileName,
  error,
  loading,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.size <= maxSizeMB * 1024 * 1024) {
        onFileSelect(file);
      }
    },
    [maxSizeMB, onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.size <= maxSizeMB * 1024 * 1024) {
        onFileSelect(file);
      }
      e.target.value = '';
    },
    [maxSizeMB, onFileSelect]
  );

  const isImage = uploadedFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  if (uploadedFileName) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          {isImage ? (
            <ImageIcon className="w-5 h-5 text-green-600" />
          ) : (
            <FileText className="w-5 h-5 text-green-600" />
          )}
          <span className="flex-1 text-sm text-green-800 truncate">
            {uploadedFileName}
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 hover:bg-green-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-green-600" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all bg-white
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${error ? 'border-red-500' : ''}
          ${loading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={loading}
        />
        <div className="flex flex-col items-center gap-2">
          {loading ? (
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
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
          ) : (
            <Upload className="w-8 h-8 text-gray-400" />
          )}
          <div className="text-sm">
            <span className="text-gray-600">
              Datei in den gestrichelten Kasten ziehen oder{' '}
            </span>
            <span className="text-blue-500 font-medium">Datei hochladen</span>
          </div>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
