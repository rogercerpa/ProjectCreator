// FieldMappingService - Manages field mapping configuration for Excel sync
const fs = require('fs-extra');
const path = require('path');

class FieldMappingService {
  constructor() {
    this.defaultMappingPath = path.join(__dirname, '..', 'config', 'defaultFieldMapping.json');
    this.cachedMapping = null;
  }

  /**
   * Load default field mapping configuration
   */
  async loadDefaultMapping() {
    try {
      const mapping = await fs.readJson(this.defaultMappingPath);
      return {
        success: true,
        mapping
      };
    } catch (error) {
      console.error('Error loading default field mapping:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get field mapping from settings or default
   */
  async getFieldMapping(settingsService) {
    try {
      // Try to get from cache first
      if (this.cachedMapping) {
        return {
          success: true,
          mapping: this.cachedMapping
        };
      }

      // Try to get from settings
      if (settingsService) {
        const settings = await settingsService.getSettings();
        if (settings.workloadFieldMapping) {
          this.cachedMapping = settings.workloadFieldMapping;
          return {
            success: true,
            mapping: this.cachedMapping
          };
        }
      }

      // Fall back to default
      const defaultResult = await this.loadDefaultMapping();
      if (defaultResult.success) {
        this.cachedMapping = defaultResult.mapping;
        return defaultResult;
      }

      return {
        success: false,
        error: 'Could not load field mapping'
      };
    } catch (error) {
      console.error('Error getting field mapping:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Save field mapping to settings
   */
  async saveFieldMapping(settingsService, mapping) {
    try {
      if (!settingsService) {
        return {
          success: false,
          error: 'Settings service not provided'
        };
      }

      // Validate mapping before saving
      const validation = this.validateMapping(mapping);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Invalid field mapping',
          validationErrors: validation.errors
        };
      }

      const settings = await settingsService.getSettings();
      settings.workloadFieldMapping = mapping;
      await settingsService.saveSettings(settings);

      // Update cache
      this.cachedMapping = mapping;

      return {
        success: true,
        message: 'Field mapping saved successfully'
      };
    } catch (error) {
      console.error('Error saving field mapping:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate field mapping configuration
   */
  validateMapping(mapping) {
    const errors = [];

    // Check required sheets
    const requiredSheets = ['projects', 'assignments', 'users', 'timeTracking'];
    for (const sheet of requiredSheets) {
      if (!mapping[sheet]) {
        errors.push(`Missing required sheet: ${sheet}`);
      }
    }

    // Check required fields in each sheet
    const requiredFields = {
      projects: ['ProjectID', 'ProjectNumber', 'ProjectName', 'Status'],
      assignments: ['AssignmentID', 'ProjectID', 'UserID', 'Status'],
      users: ['UserID', 'UserName', 'Email'],
      timeTracking: ['EntryID', 'AssignmentID', 'UserID', 'Date', 'HoursWorked']
    };

    for (const [sheet, fields] of Object.entries(requiredFields)) {
      if (mapping[sheet]) {
        for (const field of fields) {
          if (!mapping[sheet][field] || !mapping[sheet][field].enabled) {
            errors.push(`Required field ${field} is missing or disabled in ${sheet} sheet`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Reset field mapping to default
   */
  async resetToDefault(settingsService) {
    try {
      const defaultResult = await this.loadDefaultMapping();
      if (!defaultResult.success) {
        return defaultResult;
      }

      if (settingsService) {
        await this.saveFieldMapping(settingsService, defaultResult.mapping);
      }

      this.cachedMapping = defaultResult.mapping;

      return {
        success: true,
        mapping: defaultResult.mapping,
        message: 'Field mapping reset to default'
      };
    } catch (error) {
      console.error('Error resetting field mapping:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get mapped value from object using field path (supports nested paths like metadata.lastSeen)
   */
  getMappedValue(obj, appField) {
    if (!obj || !appField) return null;

    // Handle nested paths
    const parts = appField.split('.');
    let value = obj;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Map object to Excel row based on field mapping
   */
  mapObjectToExcelRow(obj, sheetMapping) {
    const row = {};

    for (const [excelColumn, fieldConfig] of Object.entries(sheetMapping)) {
      if (!fieldConfig.enabled) continue;

      const value = this.getMappedValue(obj, fieldConfig.appField);
      row[excelColumn] = this.formatValueForExcel(value, fieldConfig.dataType);
    }

    return row;
  }

  /**
   * Format value based on data type for Excel
   */
  formatValueForExcel(value, dataType) {
    if (value === null || value === undefined) return '';

    switch (dataType) {
      case 'date':
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'string') {
          return value;
        }
        return '';

      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;

      case 'boolean':
        return value ? 'Yes' : 'No';

      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * Map Excel row to object based on field mapping
   */
  mapExcelRowToObject(excelRow, sheetMapping) {
    const obj = {};

    for (const [excelColumn, fieldConfig] of Object.entries(sheetMapping)) {
      if (!fieldConfig.enabled) continue;
      if (!(excelColumn in excelRow)) continue;

      const value = this.parseValueFromExcel(excelRow[excelColumn], fieldConfig.dataType);
      this.setNestedValue(obj, fieldConfig.appField, value);
    }

    return obj;
  }

  /**
   * Parse value from Excel based on data type
   */
  parseValueFromExcel(value, dataType) {
    if (value === null || value === undefined || value === '') return null;

    switch (dataType) {
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();

      case 'number':
        const num = Number(value);
        return isNaN(num) ? null : num;

      case 'boolean':
        if (typeof value === 'boolean') return value;
        const str = String(value).toLowerCase();
        return str === 'yes' || str === 'true' || str === '1';

      case 'string':
      default:
        return String(value);
    }
  }

  /**
   * Set nested value in object (supports paths like metadata.lastSeen)
   */
  setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Get Excel column headers for a sheet
   */
  getExcelHeaders(sheetMapping) {
    return Object.keys(sheetMapping).filter(col => sheetMapping[col].enabled);
  }

  /**
   * Clear cached mapping
   */
  clearCache() {
    this.cachedMapping = null;
  }
}

module.exports = FieldMappingService;
