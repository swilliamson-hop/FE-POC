'use client';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { Slider } from '@/components/ui/Slider';
import { NumberInput } from '@/components/ui/NumberInput';
import { DateInput } from '@/components/ui/DateInput';
import { TextArea } from '@/components/ui/TextArea';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { DataPrivacyBanner } from './DataPrivacyBanner';
import type { HouseholdType, ProfessionType } from '@/lib/types/application';

interface StepHouseholdProps {
  dateOfBirth: string;
  professionType: ProfessionType | '';
  professionSubType: string;
  income: number;
  householdType: HouseholdType | '';
  residents: number;
  hasAnimals: boolean | null;
  moveInDate: string;
  hasGuarantor: boolean | null;
  furtherInformation: string;
  onDateOfBirthChange: (value: string) => void;
  onProfessionTypeChange: (value: ProfessionType) => void;
  onProfessionSubTypeChange: (value: string) => void;
  onIncomeChange: (value: number) => void;
  onHouseholdTypeChange: (value: HouseholdType) => void;
  onResidentsChange: (value: number) => void;
  onHasAnimalsChange: (value: boolean) => void;
  onMoveInDateChange: (value: string) => void;
  onHasGuarantorChange: (value: boolean) => void;
  onFurtherInformationChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const PROFESSION_OPTIONS = [
  { value: 'EMPLOYED_UNLIMITED', label: 'Angestellt (unbefristet)' },
  { value: 'EMPLOYED_LIMITED', label: 'Angestellt (befristet)' },
  { value: 'SELF_EMPLOYED', label: 'Selbstständig' },
  { value: 'CIVIL_SERVANT', label: 'Beamter' },
  { value: 'STUDENT', label: 'Student/in' },
  { value: 'APPRENTICE', label: 'Auszubildende/r' },
  { value: 'RETIRED', label: 'Rentner/in' },
  { value: 'LOOKING_FOR_WORK', label: 'Arbeitssuchend' },
  { value: 'HOUSEHOLD_MANAGER', label: 'Haushaltsführend' },
];

const HOUSEHOLD_OPTIONS = [
  { value: 'SINGLE', label: 'Alleinstehend' },
  { value: 'COUPLE_WITHOUT_CHILDREN', label: 'Paar ohne Kinder' },
  { value: 'COUPLE_WITH_CHILDREN', label: 'Familie' },
  { value: 'SHARED_APARTMENT', label: 'Wohngemeinschaft' },
  { value: 'SINGLE_WITH_CHILDREN', label: 'Alleinstehend mit Kind/ern' },
];

export function StepHousehold({
  dateOfBirth,
  professionType,
  professionSubType,
  income,
  householdType,
  residents,
  hasAnimals,
  moveInDate,
  hasGuarantor,
  furtherInformation,
  onDateOfBirthChange,
  onProfessionTypeChange,
  onProfessionSubTypeChange,
  onIncomeChange,
  onHouseholdTypeChange,
  onResidentsChange,
  onHasAnimalsChange,
  onMoveInDateChange,
  onHasGuarantorChange,
  onFurtherInformationChange,
  onNext,
  onBack,
}: StepHouseholdProps) {
  const isNextEnabled = true;

  return (
    <div className="space-y-6">
      <DataPrivacyBanner phase={2} />

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Haushalt</h2>
      </div>

      <DateInput
        label="Geburtstag"
        value={dateOfBirth}
        onChange={onDateOfBirthChange}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Beschäftigungsstatus"
          value={professionType}
          onChange={(value) => onProfessionTypeChange(value as ProfessionType)}
          options={PROFESSION_OPTIONS}
        />
        <Input
          label="Beruf"
          value={professionSubType}
          onChange={(e) => onProfessionSubTypeChange(e.target.value)}
          placeholder="Beruf eingeben"
        />
      </div>

      <Slider
        label="Wie hoch ist das gesamte monatliche Einkommen Ihres gesamten Haushalts (netto in €)?"
        value={income}
        onChange={onIncomeChange}
        min={0}
        max={8000}
        step={100}
        formatValue={(v) => `${v.toLocaleString('de-DE')} €`}
      />

      <ChipGroup
        label="Haushaltsart"
        options={HOUSEHOLD_OPTIONS}
        value={householdType}
        onChange={(value) => onHouseholdTypeChange(value as HouseholdType)}
      />

      <NumberInput
        label="Wie viele Personen leben im Haushalt?"
        value={residents}
        onChange={onResidentsChange}
        min={1}
        max={20}
      />

      <ToggleGroup
        label="Leben Haustiere im Haushalt (keine Kleintiere)?"
        value={hasAnimals}
        onChange={onHasAnimalsChange}
      />

      <DateInput
        label="Frühestes Einzugsdatum"
        value={moveInDate}
        onChange={onMoveInDateChange}
      />

      <ToggleGroup
        label="Ist ein Bürge vorhanden?"
        value={hasGuarantor}
        onChange={onHasGuarantorChange}
      />

      <TextArea
        label="Kurze Beschreibung für den Vermieter"
        value={furtherInformation}
        onChange={(e) => onFurtherInformationChange(e.target.value)}
        maxChars={700}
        placeholder="Erzählen Sie etwas über sich..."
      />

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
