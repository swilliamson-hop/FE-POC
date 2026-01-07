import { graphqlClient } from './graphql-client';
import type { CheckGuestApplicationResponse } from '../types/application';

const CHECK_GUEST_APPLICATION_QUERY = `
  query checkGuestApplication($email: String!, $propertyId: ID!) {
    checkGuestApplication(email: $email, propertyId: $propertyId) {
      applicationPossible
      alreadyRegistered
      alreadyGuest
      token
    }
  }
`;

export async function checkGuestApplication(
  email: string,
  propertyId: string
): Promise<CheckGuestApplicationResponse['checkGuestApplication']> {
  const data = await graphqlClient.request<CheckGuestApplicationResponse>(
    CHECK_GUEST_APPLICATION_QUERY,
    { email, propertyId }
  );
  return data.checkGuestApplication;
}

const PROPERTY_QUERY = `
  query property($id: ID!) {
    property(id: $id) {
      id
      status
      size
      externalId
      type
      totalRentGross
      entryPrice
      marketingType
      rented
      dataPrivacyUrl
      data {
        referenceId
        name
        address {
          city
          country
          region
          street
          houseNumber
          zipCode
        }
        showAddress
        basePrice
        availableFrom {
          dateAvailable
          stringAvailable
        }
        heatingCostIncluded
        size
        documents {
          url
          title
          type
          identifier
          extension
          encrypted
        }
        totalRentGross
        otherCosts
        parkingPrice
        buildingCondition
        attachments {
          url
          title
          type
          identifier
          extension
          encrypted
        }
        constructionYear
        heater
        objectType
        numberOfFloors
        bathRooms
        guestToilette
        kitchenette
        landArea
        storeRoom
        washDryRoom
        garden
        gardenUse
        attic
        ground
        bicycleRoom
        seniors
        barrierFree
        fireplace
        parkingSpaces {
          type
          price
          count
          purchasePrice
        }
        rooms
        halfRooms
        elevator
        tvSatCable
        flatType
        floor
        heatingCost
        heatingCostIncluded
        serviceCharge
        bailment
        showContact
        objectDescription {
          de
          en
        }
        objectLocationText {
          de
          en
        }
        objectMiscellaneousText {
          de
          en
        }
        furnishingDescription {
          de
          en
        }
        customerName
        customerLogo
        numberOfBalconies
        numberOfTerraces
        numberOfLoggias
        balconyTerraceArea
        numberOfBedrooms
        basementAvailable
        basementSize
        wheelchairAccessible
        energyCertificate {
          energyCertificateType
          creationDate
          primaryEnergyProvider
          primaryEnergyConsumption
          usageCertificate {
            energyConsumption
            energyEfficiencyClass
            includesHeatConsumption
          }
          demandCertificate {
            endEnergyConsumption
            energyEfficiencyClass
          }
        }
      }
      titleImage {
        url
        title
        type
        identifier
        extension
        encrypted
        index
      }
      branding {
        theme {
          name
          primaryColor
          secondaryColor
          primaryTextColor
          secondaryTextColor
          buttonTextColor
          backgroundColor
          cardBackgroundColor
          active
        }
        logoRedirectUrl
        logo {
          title
          url
          name
        }
        itpSettings {
          informalLanguage
        }
      }
      allowContinueAsGuest
      applyLink
      customer {
        id
        name
        logo
      }
      wbs
    }
  }
`;

export interface PropertyData {
  property: {
    id: string;
    status: string;
    size: number;
    externalId: string;
    type: string;
    totalRentGross: number;
    entryPrice: number;
    marketingType: string;
    rented: boolean;
    dataPrivacyUrl: string;
    data: {
      referenceId: string;
      name: string;
      address: {
        city: string;
        country: string;
        region: string;
        street: string;
        houseNumber: string;
        zipCode: string;
      };
      showAddress: boolean;
      basePrice: number;
      availableFrom: {
        dateAvailable: string;
        stringAvailable: string;
      };
      heatingCostIncluded: boolean;
      size: number;
      documents: Array<{
        url: string;
        title: string;
        type: string;
        identifier: string;
        extension: string;
        encrypted: boolean;
      }>;
      totalRentGross: number;
      otherCosts: number;
      parkingPrice: number;
      buildingCondition: string;
      attachments: Array<{
        url: string;
        title: string;
        type: string;
        identifier: string;
        extension: string;
        encrypted: boolean;
      }>;
      constructionYear: number;
      heater: string;
      objectType: string;
      numberOfFloors: number;
      bathRooms: number;
      guestToilette: boolean;
      kitchenette: boolean;
      landArea: number;
      storeRoom: boolean;
      washDryRoom: boolean;
      garden: boolean;
      gardenUse: boolean;
      attic: boolean;
      ground: string;
      bicycleRoom: boolean;
      seniors: boolean;
      barrierFree: boolean;
      fireplace: boolean;
      parkingSpaces: Array<{
        type: string;
        price: number;
        count: number;
        purchasePrice: number;
      }>;
      rooms: number;
      halfRooms: number;
      elevator: boolean;
      tvSatCable: string;
      flatType: string;
      floor: number;
      heatingCost: number;
      serviceCharge: number;
      bailment: number;
      showContact: boolean;
      objectDescription: {
        de: string;
        en: string;
      };
      objectLocationText: {
        de: string;
        en: string;
      };
      objectMiscellaneousText: {
        de: string;
        en: string;
      };
      furnishingDescription: {
        de: string;
        en: string;
      };
      customerName: string;
      customerLogo: string;
      numberOfBalconies: number;
      numberOfTerraces: number;
      numberOfLoggias: number;
      balconyTerraceArea: number;
      numberOfBedrooms: number;
      basementAvailable: boolean;
      basementSize: number;
      wheelchairAccessible: boolean;
      energyCertificate: {
        energyCertificateType: string;
        creationDate: string;
        primaryEnergyProvider: string;
        primaryEnergyConsumption: string;
        usageCertificate: {
          energyConsumption: string;
          energyEfficiencyClass: string;
          includesHeatConsumption: boolean;
        } | null;
        demandCertificate: {
          endEnergyConsumption: string;
          energyEfficiencyClass: string;
        } | null;
      } | null;
    };
    titleImage: {
      url: string;
      title: string;
      type: string;
      identifier: string;
      extension: string;
      encrypted: boolean;
      index: number;
    };
    branding: {
      theme: {
        name: string;
        primaryColor: string;
        secondaryColor: string;
        primaryTextColor: string;
        secondaryTextColor: string;
        buttonTextColor: string;
        backgroundColor: string;
        cardBackgroundColor: string;
        active: boolean;
      };
      logoRedirectUrl: string;
      logo: {
        title: string;
        url: string;
        name: string;
      };
      itpSettings: {
        informalLanguage: boolean;
      };
    };
    allowContinueAsGuest: boolean;
    applyLink: string;
    customer: {
      id: string;
      name: string;
      logo: string;
    };
    wbs: boolean;
  };
}

export async function getProperty(id: string): Promise<PropertyData['property']> {
  const data = await graphqlClient.request<PropertyData>(PROPERTY_QUERY, { id });
  return data.property;
}

const TRANSLATIONS_QUERY = `
  query translations($appName: String!, $langCode: String!, $informal: Boolean!) {
    translations(appName: $appName, langCode: $langCode, informal: $informal)
  }
`;

export interface TranslationsData {
  translations: Record<string, string>;
}

export async function getTranslations(
  langCode: string = 'de',
  informal: boolean = false
): Promise<Record<string, string>> {
  const data = await graphqlClient.request<TranslationsData>(TRANSLATIONS_QUERY, {
    appName: 'tenant',
    langCode,
    informal,
  });
  return data.translations;
}
