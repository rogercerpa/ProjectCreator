// DropdownOptionsService - Manages dropdown options for form fields
class DropdownOptionsService {
  constructor() {
    this.defaultOptions = {
      rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE', 'GRAPHICS', 'PHOTOMETRICS', 'Consultation'],
      regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
      nationalAccounts: ['Default', 'ARBYS', 'MCDONALDS', 'WALMART', 'TARGET', 'HOMEDEPOT', 'LOWES', 'KROGER', 'CVS', 'WALGREENS'],
      saveLocations: ['Triage', 'Desktop', 'Server'],
      complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
      statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
      productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
      assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger']
    };
    
    this.options = { ...this.defaultOptions };
    this.listeners = [];
  }

  // Get all dropdown options
  getOptions() {
    return { ...this.options };
  }

  // Get specific dropdown options
  getOptionsForField(fieldName) {
    return this.options[fieldName] ? [...this.options[fieldName]] : [];
  }

  // Update options from settings
  updateOptions(newOptions) {
    this.options = { ...this.defaultOptions, ...newOptions };
    this.notifyListeners();
  }

  // Reset to default options
  resetToDefaults() {
    this.options = { ...this.defaultOptions };
    this.notifyListeners();
  }

  // Add listener for option changes
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify all listeners of option changes
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.getOptions());
      } catch (error) {
        console.error('Error in dropdown options listener:', error);
      }
    });
  }

  // Load options from settings
  async loadFromSettings() {
    try {
      if (window.electronAPI && window.electronAPI.settingsLoad) {
        const result = await window.electronAPI.settingsLoad();
        if (result && result.success && result.data) {
          // Extract dropdown options from settings
          const dropdownOptions = {};
          Object.keys(this.defaultOptions).forEach(key => {
            if (result.data[key]) {
              dropdownOptions[key] = result.data[key];
            }
          });
          this.updateOptions(dropdownOptions);
        }
      }
    } catch (error) {
      console.error('Failed to load dropdown options from settings:', error);
    }
  }
}

// Create singleton instance
const dropdownOptionsService = new DropdownOptionsService();

export default dropdownOptionsService;
