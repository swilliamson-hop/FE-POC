'use client';

import { useState, forwardRef } from 'react';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}

const COUNTRY_CODES = [
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+43', country: 'AT', flag: '🇦🇹' },
  { code: '+41', country: 'CH', flag: '🇨🇭' },
];

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, error, required }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [countryCode, setCountryCode] = useState('+49');
    const [showDropdown, setShowDropdown] = useState(false);

    // Extract phone number without country code prefix
    const getPhoneNumber = () => {
      for (const c of COUNTRY_CODES) {
        if (value.startsWith(c.code)) {
          return value.slice(c.code.length);
        }
      }
      return value.replace(/^\+\d{1,3}/, ''); // Fallback: remove +XX or +XXX
    };

    const phoneNumber = getPhoneNumber();
    const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newNumber = e.target.value.replace(/[^\d\s]/g, ''); // Allow digits and spaces
      onChange(countryCode + newNumber);
    };

    const handleCountryChange = (code: string) => {
      setCountryCode(code);
      onChange(code + phoneNumber);
      setShowDropdown(false);
    };

    return (
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Telefon (ggf. mobil)
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div
          className={`
            flex border-2 rounded-xl overflow-hidden transition-all duration-200 bg-white
            ${isFocused ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
            ${error ? 'border-red-500' : ''}
          `}
        >
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-4 bg-gray-50 border-r border-gray-300 hover:bg-gray-100"
          >
            <span className="text-xl">{selectedCountry?.flag}</span>
            <span className="text-sm text-gray-600">{countryCode}</span>
          </button>
          <input
            ref={ref}
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="z.B. 0151 23456789"
            className="flex-1 px-4 py-4 outline-none text-gray-900"
          />
        </div>

        {showDropdown && (
          <div className="absolute z-50 left-0 mt-1 w-40 bg-white border border-gray-200 rounded-xl shadow-lg">
            {COUNTRY_CODES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountryChange(country.code)}
                className={`
                  w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50
                  ${country.code === countryCode ? 'bg-blue-50' : ''}
                `}
              >
                <span className="text-xl">{country.flag}</span>
                <span className="text-sm">{country.code}</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
