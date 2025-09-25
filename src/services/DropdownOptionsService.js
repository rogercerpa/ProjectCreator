// DropdownOptionsService - Manages dropdown options for form fields
class DropdownOptionsService {
  constructor() {
    this.defaultOptions = {
      rfaTypes: [
        'BOM (No Layout)',
        'BOM (With Layout)', 
        'BUDGET',
        'SUBMITTAL',
        'RELEASE',
        'RelocBOM',
        'RelocSUB',
        'RelocControlsBOM',
        'RelocControlsSUB',
        'GRAPHICS',
        'AtriusBOM',
        'AtriusLAYOUT',
        'AtriusSub',
        'ControlsAtriusSub',
        'ControlsAtriusLayout',
        'CONTROLSDCLAYOUT',
        'PHOTOMETRICS',
        'Consultation'
      ],
      regionalTeams: ['All', 'C&I', 'NAVS', 'Desktop Emergency Use only'],
      nationalAccounts: [
        'Default', 'ARBYS', 'BEALLS', 'CHICK FIL A', 'CHIPOTLE', 'CRUMBL', 
        'DAVE AND BUSTERS', 'DAVITA', 'DRIVE SHACK', 'DRYBAR', 'FLOOR AND DECOR',
        'FMC', 'HOME DEPOT', 'INPLANT OFFICE', 'JD SPORTS', 'LEVIS', 'LUCKY BRANDS',
        'NORDSTROM RACK', 'OFFICE DEPOT', 'POTTERY BARN', 'Raising Cane\'s', 'REGUS',
        'TARGET', 'TD AMERITRADE', 'US BANK', 'WEST ELM', 'Sikorsky'
      ],
      saveLocations: ['Triage', 'Desktop', 'Server'],
      complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
      statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
      productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
      assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger'],
      projectTypes: ['Middle School', 'High School', 'University', 'Hospital', 'Office Building', 'Restaurant', 'Government Building', 'Public Building', 'Stadium', 'Park', 'Hotel', 'Other'],
      photoSoftware: ['VL', 'AGI', 'M3', 'M3+VL']
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
