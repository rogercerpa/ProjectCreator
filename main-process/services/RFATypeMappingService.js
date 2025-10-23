/**
 * RFATypeMappingService - Maps display labels to internal values
 * This service allows users to customize labels while maintaining validation compatibility
 * with the HTA tool's internal value system.
 */
class RFATypeMappingService {
  constructor() {
    // Map display labels to internal values for RFA types
    this.rfaLabelToValueMap = {
      'BOM (No Layout)': 'BOM',
      'BOM (With Layout)': 'LAYOUT',
      'Budget BOM': 'BUDGET',
      'Submittal': 'SUBMITTAL',
      'Release/ Preprogramming': 'RELEASE',
      'Reloc BOM': 'RelocBOM',
      'Reloc Submittal': 'RelocSUB',
      'Reloc Controls BOM': 'RelocControlsBOM',
      'Reloc Controls Submittal': 'RelocControlsSUB',
      'Graphics': 'GRAPHICS',
      'Atrius BOM (No Layout)': 'AtriusBOM',
      'Atrius BOM (With Layout)': 'AtriusLAYOUT',
      'Atrius Submittal': 'AtriusSub',
      'Controls Atrius Submittal': 'ControlsAtriusSub',
      'Controls Atrius Layout': 'ControlsAtriusLayout',
      'Controls DC2DC Layout': 'CONTROLSDCLAYOUT',
      'Photometrics': 'PHOTOMETRICS',
      'Consultation': 'Consultation'
    };

    // Map display labels to internal values for National Accounts
    this.naLabelToValueMap = {
      'N/A': 'Default',
      'Arby\'s': 'ARBYS',
      'Bealls': 'BEALLS',
      'Chick Fil A': 'CHICK FIL A',
      'CHIPOTLE': 'CHIPOTLE',
      'CRUMBL Cookies': 'CRUMBL',
      'Dave & Busters': 'DAVE AND BUSTERS',
      'Davita': 'DAVITA',
      'Drive Shack': 'DRIVE SHACK',
      'Drybar': 'DRYBAR',
      'Floor and Decor': 'FLOOR AND DECOR',
      'FMC': 'FMC',
      'Home Depot': 'HOME DEPOT',
      'Inplant Office': 'INPLANT OFFICE',
      'JD SPORTS': 'JD SPORTS',
      'Levis': 'LEVIS',
      'Lucky Brands': 'LUCKY BRANDS',
      'NORDSTROM RACK': 'NORDSTROM RACK',
      'Office Depot': 'OFFICE DEPOT',
      'Pottery Barn': 'POTTERY BARN',
      'Raising Cane\'s': 'Raising Cane\'s',
      'Regus': 'REGUS',
      'Target': 'TARGET',
      'TD Ameritrade': 'TD AMERITRADE',
      'US BANK': 'US BANK',
      'West Elm': 'WEST ELM',
      'Sikorsky': 'Sikorsky'
    };

    // Create reverse mappings for display
    this.rfaValueToLabelMap = Object.fromEntries(
      Object.entries(this.rfaLabelToValueMap).map(([label, value]) => [value, label])
    );

    this.naValueToLabelMap = Object.fromEntries(
      Object.entries(this.naLabelToValueMap).map(([label, value]) => [value, label])
    );
  }

  // RFA Type Methods
  getRFAValueFromLabel(label) {
    if (!label) return 'Default';
    
    // Try exact match first
    if (this.rfaLabelToValueMap[label]) {
      return this.rfaLabelToValueMap[label];
    }
    
    // Try case-insensitive match
    const lowerLabel = label.toLowerCase();
    for (const [key, value] of Object.entries(this.rfaLabelToValueMap)) {
      if (key.toLowerCase() === lowerLabel) {
        return value;
      }
    }
    
    // If no match found, return the original label
    console.warn(`RFATypeMappingService: No mapping found for RFA type: "${label}"`);
    return label;
  }

  getRFALabelFromValue(value) {
    return this.rfaValueToLabelMap[value] || value;
  }

  getValidRFAValues() {
    return Object.values(this.rfaLabelToValueMap);
  }

  isValidRFALabel(label) {
    return label in this.rfaLabelToValueMap;
  }

  // National Account Methods
  getNAValueFromLabel(label) {
    if (!label) return 'Default';
    
    // Try exact match first
    if (this.naLabelToValueMap[label]) {
      return this.naLabelToValueMap[label];
    }
    
    // Try case-insensitive match
    const lowerLabel = label.toLowerCase();
    for (const [key, value] of Object.entries(this.naLabelToValueMap)) {
      if (key.toLowerCase() === lowerLabel) {
        return value;
      }
    }
    
    // If no match found, return 'Default' for unknown National Accounts
    console.warn(`RFATypeMappingService: No mapping found for National Account: "${label}", using 'Default'`);
    return 'Default';
  }

  getNALabelFromValue(value) {
    return this.naValueToLabelMap[value] || value;
  }

  getValidNAValues() {
    return Object.values(this.naLabelToValueMap);
  }

  isValidNALabel(label) {
    return label in this.naLabelToValueMap;
  }

  // Utility Methods
  getDefaultRFATypes() {
    return Object.keys(this.rfaLabelToValueMap).map(label => ({
      value: this.rfaLabelToValueMap[label],
      label: label
    }));
  }

  getDefaultNationalAccounts() {
    return Object.keys(this.naLabelToValueMap).map(label => ({
      value: this.naLabelToValueMap[label],
      label: label
    }));
  }

  // Validate and convert form data
  convertFormDataToInternal(formData) {
    const converted = { ...formData };
    
    console.log('RFATypeMappingService: Converting form data:', formData);
    
    if (formData.rfaType) {
      const originalRfaType = formData.rfaType;
      converted.rfaType = this.getRFAValueFromLabel(formData.rfaType);
      console.log(`RFATypeMappingService: RFA Type "${originalRfaType}" -> "${converted.rfaType}"`);
    }
    
    if (formData.nationalAccount) {
      const originalNA = formData.nationalAccount;
      converted.nationalAccount = this.getNAValueFromLabel(formData.nationalAccount);
      console.log(`RFATypeMappingService: National Account "${originalNA}" -> "${converted.nationalAccount}"`);
    }
    
    console.log('RFATypeMappingService: Converted data:', converted);
    return converted;
  }

  // Convert internal data back to display format
  convertInternalToDisplay(internalData) {
    const converted = { ...internalData };
    
    if (internalData.rfaType) {
      converted.rfaType = this.getRFALabelFromValue(internalData.rfaType);
    }
    
    if (internalData.nationalAccount) {
      converted.nationalAccount = this.getNALabelFromValue(internalData.nationalAccount);
    }
    
    return converted;
  }
}

module.exports = RFATypeMappingService;
