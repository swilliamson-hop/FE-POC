'use client';

import { forwardRef, useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, value, onChange, error, required, placeholder = 'TT.MM.JJJJ' }, ref) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div
          className={`
            flex items-center border-2 rounded-xl transition-all duration-200 overflow-hidden bg-white
            ${isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
            ${error ? 'border-red-500' : ''}
          `}
        >
          <span className="pl-4 text-gray-400">
            <Calendar className="w-5 h-5" />
          </span>
          <input
            ref={ref}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className="w-full px-4 py-4 outline-none text-gray-900"
          />
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
