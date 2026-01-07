import { HousingPermissionType, HousingPermissionLabels } from '../types/housing-permission';

export const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const;

export type Bundesland = typeof BUNDESLAENDER[number];

// Bundesweite Scheine die bei allen Bundesländern angezeigt werden
const BUNDESWEIT_TYPES: HousingPermissionType[] = [
  HousingPermissionType.WBS,
  HousingPermissionType.SIXTH_PARAGRAPH_SECOND_SUPPORT_PATH,
];

// Spezifische Scheine pro Bundesland
const BUNDESLAND_SPECIFIC_TYPES: Partial<Record<Bundesland, HousingPermissionType[]>> = {
  'Hamburg': [
    HousingPermissionType.URGENCY_CERTIFICATE,
    HousingPermissionType.URGENCY_CONFIRMATION,
    HousingPermissionType.HAMBURG_SIXTEENTH_PARAGRAPH,
  ],
  'Berlin': [
    HousingPermissionType.URGENCY_CERTIFICATE,
    HousingPermissionType.URGENCY_CONFIRMATION,
    HousingPermissionType.WBS_100,
    HousingPermissionType.WBS_140,
    HousingPermissionType.WBS_160,
    HousingPermissionType.WBS_180,
    HousingPermissionType.WBS_240,
    HousingPermissionType.WBS_SPECIAL_HOUSING_NEEDS,
  ],
  'Bayern': [
    HousingPermissionType.BAVARIA_EOF_INCOME_GROUP_1,
    HousingPermissionType.BAVARIA_EOF_INCOME_GROUP_2,
    HousingPermissionType.BAVARIA_EOF_INCOME_GROUP_3,
  ],
  'Schleswig-Holstein': [
    HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_STANDARD,
    HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_20,
    HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_40,
    HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTY_EIGHTH_PARAGRAPH_D_2,
  ],
  'Baden-Württemberg': [
    HousingPermissionType.BADEN_WUERTTEMBERG_WOSU_EMERGENCY_CERTIFICATE,
  ],
};

export interface WBSOption {
  value: HousingPermissionType;
  label: string;
}

export function getWBSOptionsForBundesland(bundesland: Bundesland | string): WBSOption[] {
  const specificTypes = BUNDESLAND_SPECIFIC_TYPES[bundesland as Bundesland] || [];
  const allTypes = [...BUNDESWEIT_TYPES, ...specificTypes];

  return allTypes.map(type => ({
    value: type,
    label: HousingPermissionLabels[type],
  }));
}
