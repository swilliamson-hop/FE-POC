// Types for the application/Bewerbung flow

export interface CheckGuestApplicationResponse {
  checkGuestApplication: {
    applicationPossible: boolean;
    alreadyRegistered: boolean;
    alreadyGuest: boolean;
    token: string | null;
  };
}

export interface ApplyAsGuestResponse {
  applyAsGuest: {
    status: string;
    statusText: string;
  };
}

export interface FileUploadResponse {
  title: string;
  name: string;
  type: string;
  documentFileType: string;
  documentType: string | null;
  identifier: string;
  extension: string;
  encrypted: boolean;
  url: string;
  bucket: string;
  publicId: string;
}

export interface UploadedDocument {
  title: string;
  name: string;
  type: DocumentType;
  documentFileType: 'PDF' | 'IMG';
  documentType: DocumentType | null;
  identifier: string;
  extension: string;
  encrypted: boolean;
  url: string;
  bucket: string;
  publicId: string;
}

export type DocumentType =
  | 'IMG'
  | 'WB_CERTIFICATE'
  | 'INCOME_STATEMENT'
  | 'CREDIT_REPORT'
  | 'OTHER';

export type HouseholdType =
  | 'SINGLE'
  | 'COUPLE_WITHOUT_CHILDREN'
  | 'COUPLE_WITH_CHILDREN'
  | 'SINGLE_WITH_CHILDREN'
  | 'SHARED_APARTMENT';

export type ProfessionType =
  | 'EMPLOYED_UNLIMITED'
  | 'EMPLOYED_LIMITED'
  | 'SELF_EMPLOYED'
  | 'CIVIL_SERVANT'
  | 'STUDENT'
  | 'APPRENTICE'
  | 'RETIRED'
  | 'LOOKING_FOR_WORK'
  | 'HOUSEHOLD_MANAGER';

export interface Profession {
  type: ProfessionType;
  subType: string;
  income: number;
  employmentDate?: string | null;
}

export interface Address {
  city: string;
  zipCode: string;
  street: string;
  houseNumber: string;
  district?: string | null;
  region?: string | null;
  country: string;
}

export interface HousingPermission {
  type: string;
  amountPeople: number;
}

export interface AdditionalInformation {
  animals: boolean;
  housingPermission?: HousingPermission | null;
}

export interface ProfileData {
  firstname: string;
  name: string;
  portrait?: UploadedDocument | null;
  phone: string;
  householdType?: HouseholdType;
  residents: number;
  moveInDate: string;
  guarantorExist: boolean;
  furtherInformation: string;
  dateOfBirth: string;
  gender?: string | null;
  title?: string | null;
  personalStatus?: string | null;
  profession?: Profession;
  additionalInformation: AdditionalInformation;
  attachments: UploadedDocument[];
}

export interface GuestDataInput {
  email: string;
  propertyId: string;
  profileData: ProfileData;
  address: Address;
  preferredLanguage: string;
}

// Form state for multi-step form
export interface ApplicationFormState {
  // Step 1 - Email
  email: string;
  token: string | null;

  // Step 2 - Personal Info
  firstname: string;
  lastname: string;
  housingPermissionType: string | null;
  housingPermissionBundesland: string | null;
  housingPermissionAmountPeople: number;

  // Step 3 - Contact Info
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  bundesland: string;
  country: string;
  phone: string;

  // Step 4 - Household
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

  // Step 5 - Documents
  portrait: UploadedDocument | null;
  incomeStatement: UploadedDocument | null;
  creditReport: UploadedDocument | null;
  wbsCertificate: UploadedDocument | null;
  otherDocuments: UploadedDocument[];
}

export const initialFormState: ApplicationFormState = {
  // Step 1
  email: '',
  token: null,

  // Step 2
  firstname: '',
  lastname: '',
  housingPermissionType: null,
  housingPermissionBundesland: null,
  housingPermissionAmountPeople: 1,

  // Step 3
  street: '',
  houseNumber: '',
  zipCode: '',
  city: '',
  bundesland: '',
  country: 'DE',
  phone: '',

  // Step 4
  dateOfBirth: '',
  professionType: '' as ProfessionType,
  professionSubType: '',
  income: 0,
  householdType: '' as HouseholdType,
  residents: 1,
  hasAnimals: null as unknown as boolean,
  moveInDate: '',
  hasGuarantor: null as unknown as boolean,
  furtherInformation: '',

  // Step 5
  portrait: null,
  incomeStatement: null,
  creditReport: null,
  wbsCertificate: null,
  otherDocuments: [],
};
