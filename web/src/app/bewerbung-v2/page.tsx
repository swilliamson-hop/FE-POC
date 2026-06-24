'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StepEmail } from '@/components/bewerbung/StepEmail';
import { StepPersonalAndContact } from '@/components/bewerbung-v2/StepPersonalAndContact';
import { StepHousehold } from '@/components/bewerbung-v2/StepHousehold';
import { StepDocuments } from '@/components/bewerbung-v2/StepDocuments';
import { useApplicationForm } from '@/lib/hooks/useApplicationForm';
import { applyAsGuest } from '@/lib/api/mutations';
import type { GuestDataInput, HouseholdType, ProfessionType } from '@/lib/types/application';
import type { PidClaims } from '@/components/bewerbung/types';

const TOTAL_STEPS = 4;

// Showcase: PID-Adressfelder werden aktuell von der Wallet nicht sauber ausgelesen.
// Wir simulieren die in der PID hinterlegten Werte hart verdrahtet.
const SHOWCASE_PID_ADDRESS = {
  street: 'Heidestraße',
  houseNumber: '17',
  zipCode: '51147',
  city: 'Köln',
};

// PID liefert Namen vollständig in Großbuchstaben (z. B. "ERIKA", "MUSTERMANN").
// Wir normalisieren zu "Erika" / "Mustermann" und respektieren Bindestriche/Leerzeichen.
function normalizeName(s: string | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/([\s-])/)
    .map((part) => (/[\s-]/.test(part) || part.length === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function BewerbungV2Content() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const propertyId = searchParams.get('propertyId') || process.env.NEXT_PUBLIC_PROPERTY_ID || '6850da6f-a361-40ec-bea2-3cbf2f8fe8b3';

  const { formState, updateField, updateFields, resetForm, isLoaded } = useApplicationForm(propertyId);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletVerifiedFields, setWalletVerifiedFields] = useState<Set<string>>(new Set());

  const handlePidReceived = (claims: PidClaims) => {
    const verified = new Set([
      'firstname',
      'lastname',
      'street',
      'houseNumber',
      'zipCode',
      'city',
      'country',
    ]);
    if (claims.birthdate) verified.add('dateOfBirth');
    setWalletVerifiedFields(verified);

    updateFields({
      firstname: normalizeName(claims.given_name),
      lastname: normalizeName(claims.family_name),
      dateOfBirth: claims.birthdate,
      street: SHOWCASE_PID_ADDRESS.street,
      houseNumber: SHOWCASE_PID_ADDRESS.houseNumber,
      zipCode: SHOWCASE_PID_ADDRESS.zipCode,
      city: SHOWCASE_PID_ADDRESS.city,
    });
  };

  const goToNextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    if (!formState.token) {
      console.error('No token available');
      return;
    }

    setIsSubmitting(true);

    try {
      const guestData: GuestDataInput = {
        email: formState.email,
        propertyId,
        profileData: {
          firstname: formState.firstname,
          name: formState.lastname,
          portrait: formState.portrait || undefined,
          phone: formState.phone,
          householdType: formState.householdType || undefined,
          residents: formState.residents,
          moveInDate: formState.moveInDate || '',
          guarantorExist: formState.hasGuarantor ?? false,
          furtherInformation: formState.furtherInformation,
          dateOfBirth: formState.dateOfBirth,
          gender: null,
          title: null,
          personalStatus: null,
          profession: formState.professionType
            ? {
                type: formState.professionType,
                subType: formState.professionSubType,
                income: formState.income,
                employmentDate: null,
              }
            : undefined,
          additionalInformation: {
            animals: formState.hasAnimals ?? false,
            housingPermission: formState.housingPermissionType
              ? {
                  type: formState.housingPermissionType,
                  amountPeople: formState.housingPermissionAmountPeople,
                }
              : null,
          },
          attachments: [
            ...(formState.incomeStatement ? [formState.incomeStatement] : []),
            ...(formState.creditReport ? [formState.creditReport] : []),
            ...(formState.wbsCertificate ? [formState.wbsCertificate] : []),
            ...formState.otherDocuments,
          ],
        },
        address: {
          city: formState.city,
          zipCode: formState.zipCode,
          street: formState.street,
          houseNumber: formState.houseNumber,
          district: null,
          region: formState.bundesland || null,
          country: formState.country,
        },
        preferredLanguage: 'de',
      };

      const result = await applyAsGuest(guestData, formState.token);
      console.log('Application submitted:', result);

      localStorage.removeItem(`immomio_application_form_${propertyId}`);
      router.push(`/bewerbung/erfolg?propertyId=${propertyId}`);
    } catch (error) {
      console.error('Application submission failed:', error);
      alert('Fehler beim Absenden der Bewerbung. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="sticky top-0 bg-page border-b border-gray-200 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-semibold text-gray-900">Bewerbung erfassen</h1>
            <button
              onClick={() => {
                resetForm();
                setWalletVerifiedFields(new Set());
                setCurrentStep(1);
                window.scrollTo(0, 0);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Neu starten
            </button>
          </div>
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {currentStep === 1 && (
          <StepEmail
            email={formState.email}
            onEmailChange={(value) => updateField('email', value)}
            onTokenReceived={(token) => updateField('token', token)}
            onNext={goToNextStep}
            propertyId={propertyId}
          />
        )}

        {currentStep === 2 && (
          <StepPersonalAndContact
            firstname={formState.firstname}
            lastname={formState.lastname}
            dateOfBirth={formState.dateOfBirth}
            housingPermissionBundesland={formState.housingPermissionBundesland}
            housingPermissionType={formState.housingPermissionType}
            housingPermissionAmountPeople={formState.housingPermissionAmountPeople}
            wbsCertificate={formState.wbsCertificate}
            street={formState.street}
            houseNumber={formState.houseNumber}
            zipCode={formState.zipCode}
            city={formState.city}
            country={formState.country}
            phone={formState.phone}
            walletVerifiedFields={walletVerifiedFields}
            onFirstnameChange={(value) => updateField('firstname', value)}
            onLastnameChange={(value) => updateField('lastname', value)}
            onDateOfBirthChange={(value) => updateField('dateOfBirth', value)}
            onHousingPermissionBundeslandChange={(value) => updateField('housingPermissionBundesland', value)}
            onWBSChange={(value) => updateField('housingPermissionType', value)}
            onAmountPeopleChange={(value) => updateField('housingPermissionAmountPeople', value)}
            onWbsCertificateChange={(doc) => updateField('wbsCertificate', doc)}
            onStreetChange={(value) => updateField('street', value)}
            onHouseNumberChange={(value) => updateField('houseNumber', value)}
            onZipCodeChange={(value) => updateField('zipCode', value)}
            onCityChange={(value) => updateField('city', value)}
            onCountryChange={(value) => updateField('country', value)}
            onPhoneChange={(value) => updateField('phone', value)}
            onPidReceived={handlePidReceived}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 3 && (
          <StepHousehold
            professionType={formState.professionType}
            professionSubType={formState.professionSubType}
            income={formState.income}
            householdType={formState.householdType}
            residents={formState.residents}
            hasAnimals={formState.hasAnimals}
            moveInDate={formState.moveInDate}
            hasGuarantor={formState.hasGuarantor}
            furtherInformation={formState.furtherInformation}
            onProfessionTypeChange={(value) => updateField('professionType', value as ProfessionType)}
            onProfessionSubTypeChange={(value) => updateField('professionSubType', value)}
            onIncomeChange={(value) => updateField('income', value)}
            onHouseholdTypeChange={(value) => updateField('householdType', value as HouseholdType)}
            onResidentsChange={(value) => updateField('residents', value)}
            onHasAnimalsChange={(value) => updateField('hasAnimals', value)}
            onMoveInDateChange={(value) => updateField('moveInDate', value)}
            onHasGuarantorChange={(value) => updateField('hasGuarantor', value)}
            onFurtherInformationChange={(value) => updateField('furtherInformation', value)}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 4 && (
          <StepDocuments
            incomeStatement={formState.incomeStatement}
            creditReport={formState.creditReport}
            otherDocuments={formState.otherDocuments}
            onIncomeStatementChange={(doc) => updateField('incomeStatement', doc)}
            onCreditReportChange={(doc) => updateField('creditReport', doc)}
            onOtherDocumentsChange={(docs) => updateField('otherDocuments', docs)}
            onSubmit={handleSubmit}
            onBack={goToPreviousStep}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}

export default function BewerbungV2Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <BewerbungV2Content />
    </Suspense>
  );
}
