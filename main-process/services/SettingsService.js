const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class SettingsService {
  constructor() {
    this.settingsDir = path.join(os.homedir(), '.project-creator');
    this.settingsFile = path.join(this.settingsDir, 'settings.json');
    this.defaultSettings = {
      agencySync: {
        enabled: false,
        mode: 'manual', // 'auto' or 'manual'
        filePath: '',
        lastSync: null,
        lastExport: null,
        autoSyncInterval: 30, // seconds
        lastUpdated: null
      },
      app: {
        theme: 'light',
        notifications: true,
        autoSave: true
      },
      form: {
        defaultValues: {}
      }
    };
  }

  /**
   * Ensure settings directory exists
   */
  async ensureSettingsDir() {
    try {
      await fs.mkdir(this.settingsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating settings directory:', error);
      throw error;
    }
  }

  /**
   * Load settings from file
   */
  async getSettings() {
    try {
      await this.ensureSettingsDir();
      
      try {
        const data = await fs.readFile(this.settingsFile, 'utf8');
        const settings = JSON.parse(data);
        
        // Merge with defaults to ensure all properties exist
        return this.mergeWithDefaults(settings);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, return defaults
          console.log('Settings file not found, using defaults');
          return this.defaultSettings;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      throw error;
    }
  }

  /**
   * Save settings to file
   */
  async saveSettings(settings) {
    try {
      await this.ensureSettingsDir();
      
      const mergedSettings = this.mergeWithDefaults(settings);
      const data = JSON.stringify(mergedSettings, null, 2);
      
      await fs.writeFile(this.settingsFile, data, 'utf8');
      
      console.log('Settings saved successfully');
      return mergedSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Update specific settings section
   */
  async updateSection(sectionName, sectionData) {
    try {
      const currentSettings = await this.getSettings();
      
      const updatedSettings = {
        ...currentSettings,
        [sectionName]: {
          ...currentSettings[sectionName],
          ...sectionData
        }
      };
      
      return await this.saveSettings(updatedSettings);
    } catch (error) {
      console.error(`Error updating ${sectionName} settings:`, error);
      throw error;
    }
  }

  /**
   * Get specific settings section
   */
  async getSection(sectionName) {
    try {
      const settings = await this.getSettings();
      return settings[sectionName] || {};
    } catch (error) {
      console.error(`Error getting ${sectionName} settings:`, error);
      throw error;
    }
  }

  /**
   * Merge settings with defaults
   */
  mergeWithDefaults(settings) {
    const merged = { ...this.defaultSettings };
    
    if (settings) {
      // Deep merge each section
      Object.keys(this.defaultSettings).forEach(key => {
        if (settings[key]) {
          merged[key] = { ...this.defaultSettings[key], ...settings[key] };
        }
      });
      
      // Add any additional settings not in defaults
      Object.keys(settings).forEach(key => {
        if (!this.defaultSettings[key]) {
          merged[key] = settings[key];
        }
      });
    }
    
    return merged;
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    try {
      return await this.saveSettings(this.defaultSettings);
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  }

  /**
   * Check if settings file exists
   */
  async settingsExist() {
    try {
      await fs.access(this.settingsFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get settings file path
   */
  getSettingsPath() {
    return this.settingsFile;
  }
}

module.exports = SettingsService;
