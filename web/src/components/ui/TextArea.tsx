'use client';

import { TextareaHTMLAttributes, forwardRef, useState } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  maxChars?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, maxChars, value, className = '', onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const charCount = typeof value === 'string' ? value.length : 0;

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className={`space-y-1 ${className}`}>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div
          className={`
            border-2 rounded-xl transition-all duration-200 bg-white
            ${isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
            ${error ? 'border-red-500' : ''}
          `}
        >
          <textarea
            ref={ref}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            maxLength={maxChars}
            className="w-full px-4 py-3 bg-transparent outline-none text-gray-900 resize-none min-h-[120px]"
            {...props}
          />
        </div>
        <div className="flex justify-end">
          {maxChars && (
            <span className="text-sm text-gray-500">
              {maxChars - charCount} übrig
            </span>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
