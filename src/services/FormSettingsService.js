/**
 * FormSettingsService - Manages form settings and options
 * 
 * This service provides:
 * - Default RFA types and National Accounts
 * - Settings persistence
 * - Custom option management
 * - Integration with RFATypeMappingService
 */
const RFATypeMappingService = require('./RFATypeMappingService');

class FormSettingsService {
  constructor() {
    this.rfaMapping = new RFATypeMappingService();
    this.settings = this.loadDefaultSettings();
  }

  /**
   * Load default settings
   */
  loadDefaultSettings() {
    return {
      rfaTypes: this.rfaMapping.getDefaultRFATypes(),
      nationalAccounts: this.rfaMapping.getDefaultNationalAccounts(),
      regionalTeams: [
        { value: "All", label: "All" },
        { value: "C&I", label: "C&I" },
        { value: "NAVS", label: "NAVS" },
        { value: "Desktop Emergency Use only", label: "Desktop Emergency Use only" }
      ],
      saveLocations: [
        { value: "Triage", label: "Triage Folder" },
        { value: "Desktop", label: "Desktop" },
        { value: "Server", label: "Server" }
      ],
      photometricSoftware: [
        { value: "VL", label: "Visual Lighting (VL)" },
        { value: "AGI", label: "AGI" },
        { value: "M3", label: "M3 AI" },
        { value: "M3+VL", label: "M3 AI + VL" }
      ]
    };
  }

  /**
   * Get all RFA types
   */
  getRFATypes() {
    return this.settings.rfaTypes;
  }

  /**
   * Get all National Accounts
   */
  getNationalAccounts() {
    return this.settings.nationalAccounts;
  }

  /**
   * Get all Regional Teams
   */
  getRegionalTeams() {
    return this.settings.regionalTeams;
  }

  /**
   * Get all Save Locations
   */
  getSaveLocations() {
    return this.settings.saveLocations;
  }

  /**
   * Get all Photometric Software options
   */
  getPhotometricSoftware() {
    return this.settings.photometricSoftware;
  }

  /**
   * Add custom RFA type
   */
  addCustomRFAType(label, value) {
    const newType = { label, value };
    this.settings.rfaTypes.push(newType);
    
    // Update mapping service
    this.rfaMapping.rfaLabelToValueMap[label] = value;
    this.rfaMapping.rfaValueToLabelMap[value] = label;
    
    this.saveSettings();
    return newType;
  }

  /**
   * Add custom National Account
   */
  addCustomNationalAccount(label, value) {
    const newAccount = { label, value };
    this.settings.nationalAccounts.push(newAccount);
    
    // Update mapping service
    this.rfaMapping.naLabelToValueMap[label] = value;
    this.rfaMapping.naValueToLabelMap[value] = label;
    
    this.saveSettings();
    return newAccount;
  }

  /**
   * Remove custom RFA type
   */
  removeCustomRFAType(label) {
    this.settings.rfaTypes = this.settings.rfaTypes.filter(type => type.label !== label);
    
    // Remove from mapping service
    const value = this.rfaMapping.rfaLabelToValueMap[label];
    delete this.rfaMapping.rfaLabelToValueMap[label];
    delete this.rfaMapping.rfaValueToLabelMap[value];
    
    this.saveSettings();
  }

  /**
   * Remove custom National Account
   */
  removeCustomNationalAccount(label) {
    this.settings.nationalAccounts = this.settings.nationalAccounts.filter(account => account.label !== label);
    
    // Remove from mapping service
    const value = this.rfaMapping.naLabelToValueMap[label];
    delete this.rfaMapping.naLabelToValueMap[label];
    delete this.rfaMapping.naValueToLabelMap[value];
    
    this.saveSettings();
  }

  /**
   * Get all settings
   */
  getAllSettings() {
    return this.settings;
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * Save settings to storage (placeholder - implement based on your storage needs)
   */
  saveSettings() {
    // TODO: Implement settings persistence
    // This could save to localStorage, a config file, or database
    console.log('FormSettingsService: Settings saved', this.settings);
  }

  /**
   * Load settings from storage (placeholder - implement based on your storage needs)
   */
  loadSettings() {
    // TODO: Implement settings loading
    // This could load from localStorage, a config file, or database
    console.log('FormSettingsService: Settings loaded');
  }

  /**
   * Reset to default settings
   */
  resetToDefaults() {
    this.settings = this.loadDefaultSettings();
    this.rfaMapping = new RFATypeMappingService();
    this.saveSettings();
  }

  /**
   * Validate form data using mapping service
   */
  validateFormData(formData) {
    return this.rfaMapping.convertFormDataToInternal(formData);
  }

  /**
   * Convert internal data back to display format
   */
  convertToDisplayFormat(internalData) {
    return this.rfaMapping.convertInternalToDisplay(internalData);
  }
}

module.exports = FormSettingsService;
