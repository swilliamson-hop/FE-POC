'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StepEmail } from '@/components/bewerbung/StepEmail';
import { StepPersonalInfo } from '@/components/bewerbung/StepPersonalInfo';
import { StepContactInfo } from '@/components/bewerbung/StepContactInfo';
import { StepHousehold } from '@/components/bewerbung/StepHousehold';
import { StepDocuments } from '@/components/bewerbung/StepDocuments';
import { useApplicationForm } from '@/lib/hooks/useApplicationForm';
import { applyAsGuest } from '@/lib/api/mutations';
import type { GuestDataInput, HouseholdType, ProfessionType } from '@/lib/types/application';
import type { PidClaims } from '@/components/bewerbung/types';

const TOTAL_STEPS = 5;

function BewerbungContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const propertyId = searchParams.get('propertyId') || process.env.NEXT_PUBLIC_PROPERTY_ID || '300375578';

  const { formState, updateField, updateFields, isLoaded } = useApplicationForm(propertyId);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePidReceived = (claims: PidClaims) => {
    updateFields({
      firstname: claims.given_name,
      lastname: claims.family_name,
      dateOfBirth: claims.birth_date,
      ...(claims.street_address ? { street: claims.street_address } : {}),
      ...(claims.postal_code ? { zipCode: claims.postal_code } : {}),
      ...(claims.locality ? { city: claims.locality } : {}),
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

      // Clear localStorage and redirect to success page
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
      {/* Header */}
      <div className="sticky top-0 bg-page border-b border-gray-200 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-center font-semibold text-gray-900 mb-4">
            Bewerbung erfassen
          </h1>
          <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
      </div>

      {/* Content */}
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
          <StepPersonalInfo
            firstname={formState.firstname}
            lastname={formState.lastname}
            housingPermissionBundesland={formState.housingPermissionBundesland}
            housingPermissionType={formState.housingPermissionType}
            housingPermissionAmountPeople={formState.housingPermissionAmountPeople}
            wbsCertificate={formState.wbsCertificate}
            onFirstnameChange={(value) => updateField('firstname', value)}
            onLastnameChange={(value) => updateField('lastname', value)}
            onBundeslandChange={(value) => updateField('housingPermissionBundesland', value)}
            onWBSChange={(value) => updateField('housingPermissionType', value)}
            onAmountPeopleChange={(value) => updateField('housingPermissionAmountPeople', value)}
            onWbsCertificateChange={(doc) => updateField('wbsCertificate', doc)}
            onPidReceived={handlePidReceived}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 3 && (
          <StepContactInfo
            street={formState.street}
            houseNumber={formState.houseNumber}
            zipCode={formState.zipCode}
            city={formState.city}
            bundesland={formState.bundesland}
            country={formState.country}
            phone={formState.phone}
            portrait={formState.portrait}
            onStreetChange={(value) => updateField('street', value)}
            onHouseNumberChange={(value) => updateField('houseNumber', value)}
            onZipCodeChange={(value) => updateField('zipCode', value)}
            onCityChange={(value) => updateField('city', value)}
            onBundeslandChange={(value) => updateField('bundesland', value)}
            onCountryChange={(value) => updateField('country', value)}
            onPhoneChange={(value) => updateField('phone', value)}
            onPortraitChange={(doc) => updateField('portrait', doc)}
            onNext={goToNextStep}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 4 && (
          <StepHousehold
            dateOfBirth={formState.dateOfBirth}
            professionType={formState.professionType}
            professionSubType={formState.professionSubType}
            income={formState.income}
            householdType={formState.householdType}
            residents={formState.residents}
            hasAnimals={formState.hasAnimals}
            moveInDate={formState.moveInDate}
            hasGuarantor={formState.hasGuarantor}
            furtherInformation={formState.furtherInformation}
            onDateOfBirthChange={(value) => updateField('dateOfBirth', value)}
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

        {currentStep === 5 && (
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

export default function BewerbungPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <BewerbungContent />
    </Suspense>
  );
}
