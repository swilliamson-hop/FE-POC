export enum HousingPermissionType {
  // Bundesweit
  WBS = 'WBS',
  SIXTH_PARAGRAPH_SECOND_SUPPORT_PATH = 'SIXTH_PARAGRAPH_SECOND_SUPPORT_PATH',

  // Hamburg
  URGENCY_CERTIFICATE = 'URGENCY_CERTIFICATE',
  URGENCY_CONFIRMATION = 'URGENCY_CONFIRMATION',
  HAMBURG_SIXTEENTH_PARAGRAPH = 'HAMBURG_SIXTEENTH_PARAGRAPH',

  // Berlin
  WBS_100 = 'WBS_100',
  WBS_140 = 'WBS_140',
  WBS_160 = 'WBS_160',
  WBS_180 = 'WBS_180',
  WBS_240 = 'WBS_240',
  WBS_SPECIAL_HOUSING_NEEDS = 'WBS_SPECIAL_HOUSING_NEEDS',

  // Bayern
  BAVARIA_EOF_INCOME_GROUP_1 = 'BAVARIA_EOF_INCOME_GROUP_1',
  BAVARIA_EOF_INCOME_GROUP_2 = 'BAVARIA_EOF_INCOME_GROUP_2',
  BAVARIA_EOF_INCOME_GROUP_3 = 'BAVARIA_EOF_INCOME_GROUP_3',

  // Schleswig-Holstein
  SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_STANDARD = 'SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_STANDARD',
  SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_20 = 'SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_20',
  SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_40 = 'SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_40',
  SCHLESWIG_HOLSTEIN_EIGHTY_EIGHTH_PARAGRAPH_D_2 = 'SCHLESWIG_HOLSTEIN_EIGHTY_EIGHTH_PARAGRAPH_D_2',

  // Baden-Württemberg
  BADEN_WUERTTEMBERG_WOSU_EMERGENCY_CERTIFICATE = 'BADEN_WUERTTEMBERG_WOSU_EMERGENCY_CERTIFICATE',
}

export const HousingPermissionLabels: Record<HousingPermissionType, string> = {
  // Bundesweit
  [HousingPermissionType.WBS]: 'Wohnberechtigungsschein (§5 Schein)',
  [HousingPermissionType.SIXTH_PARAGRAPH_SECOND_SUPPORT_PATH]: '§6-Schein (2. Förderweg)',

  // Hamburg
  [HousingPermissionType.URGENCY_CERTIFICATE]: 'Dringlichkeitsschein',
  [HousingPermissionType.URGENCY_CONFIRMATION]: 'Dringlichkeitsbestätigung',
  [HousingPermissionType.HAMBURG_SIXTEENTH_PARAGRAPH]: '§16 Schein (Hamburg)',

  // Berlin
  [HousingPermissionType.WBS_100]: 'WBS 100',
  [HousingPermissionType.WBS_140]: 'WBS 140',
  [HousingPermissionType.WBS_160]: 'WBS 160',
  [HousingPermissionType.WBS_180]: 'WBS 180',
  [HousingPermissionType.WBS_240]: 'WBS 240',
  [HousingPermissionType.WBS_SPECIAL_HOUSING_NEEDS]: 'WBS besonderer Wohnbedarf',

  // Bayern
  [HousingPermissionType.BAVARIA_EOF_INCOME_GROUP_1]: 'EOF Einkommensgruppe 1',
  [HousingPermissionType.BAVARIA_EOF_INCOME_GROUP_2]: 'EOF Einkommensgruppe 2',
  [HousingPermissionType.BAVARIA_EOF_INCOME_GROUP_3]: 'EOF Einkommensgruppe 3',

  // Schleswig-Holstein
  [HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_STANDARD]: '§8 Standard',
  [HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_20]: '§8 +20%',
  [HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTH_PARAGRAPH_PLUS_40]: '§8 +40%',
  [HousingPermissionType.SCHLESWIG_HOLSTEIN_EIGHTY_EIGHTH_PARAGRAPH_D_2]: '§88d Abs. 2',

  // Baden-Württemberg
  [HousingPermissionType.BADEN_WUERTTEMBERG_WOSU_EMERGENCY_CERTIFICATE]: 'Wohnungssucherschein (WOSU/Notfallschein)',
};
