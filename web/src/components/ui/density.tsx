'use client';

import { createContext, useContext } from 'react';

// Form density: inside <CompactContext value={true}> the text-like inputs
// (Input, DateInput, Select, PhoneInput) render with reduced height.
export const CompactContext = createContext(false);

// Vertical padding class for a field, depending on the surrounding density
export function useFieldPadding(): string {
  return useContext(CompactContext) ? 'py-2.5' : 'py-4';
}
