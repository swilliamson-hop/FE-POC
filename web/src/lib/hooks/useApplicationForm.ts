'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApplicationFormState, initialFormState } from '../types/application';

const STORAGE_KEY = 'immomio_application_form';

export function useApplicationForm(propertyId: string) {
  const [formState, setFormState] = useState<ApplicationFormState>(initialFormState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${propertyId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFormState({ ...initialFormState, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load form state from localStorage:', error);
    }
    setIsLoaded(true);
  }, [propertyId]);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(`${STORAGE_KEY}_${propertyId}`, JSON.stringify(formState));
      } catch (error) {
        console.error('Failed to save form state to localStorage:', error);
      }
    }
  }, [formState, isLoaded, propertyId]);

  const updateField = useCallback(
    <K extends keyof ApplicationFormState>(field: K, value: ApplicationFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateFields = useCallback((updates: Partial<ApplicationFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(initialFormState);
    try {
      localStorage.removeItem(`${STORAGE_KEY}_${propertyId}`);
    } catch (error) {
      console.error('Failed to remove form state from localStorage:', error);
    }
  }, [propertyId]);

  return {
    formState,
    updateField,
    updateFields,
    resetForm,
    isLoaded,
  };
}
