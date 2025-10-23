const fs = require('fs-extra');
const path = require('path');

/**
 * PathResolutionService - Centralized path management and resolution
 * 
 * This service handles:
 * - Loading user path settings from configuration
 * - Resolving path variables like {userHome}
 * - Providing fallback logic for missing paths
 * - Validating path accessibility
 * - Mapping save location choices to actual file system paths
 */
class PathResolutionService {
  constructor() {
    this.defaultSettings = {
      pathSettings: {
        templates: {
          primaryPath: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
          fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
          agentRequirementsPath: '\\\\10.3.10.30\\DAS\\Agent Requirements'
        },
        projectOutput: {
          outputMappings: {
            'Desktop': '{userHome}\\Desktop',
            'Triage': '{userHome}\\Desktop\\1) Triage',
            'Server': '{userHome}\\Desktop' // Will be overridden by server logic
          },
          defaultMapping: 'Desktop'
        }
      }
    };
    
    this.userHome = process.env.USERPROFILE || process.env.HOME || '';
  }

  /**
   * Load path settings from persistence service
   */
  async loadPathSettings() {
    try {
      // Import here to avoid circular dependencies
      const ProjectPersistenceService = require('./ProjectPersistenceService');
      const persistenceService = new ProjectPersistenceService();
      
      const result = await persistenceService.loadSettings();
      
      if (result.success && result.data && result.data.pathSettings) {
        console.log('PathResolutionService: Loaded user path settings');
        return result.data.pathSettings;
      } else {
        console.log('PathResolutionService: Using default path settings');
        return this.defaultSettings.pathSettings;
      }
    } catch (error) {
      console.error('PathResolutionService: Error loading settings, using defaults:', error);
      return this.defaultSettings.pathSettings;
    }
  }

  /**
   * Resolve path variables in a path string
   * Currently supports: {userHome}
   */
  resolvePathVariables(pathString) {
    if (!pathString) return '';
    
    return pathString.replace(/{userHome}/g, this.userHome);
  }

  /**
   * Validate if a path exists and is accessible
   */
  async validatePath(resolvedPath) {
    try {
      if (!resolvedPath) return { valid: false, reason: 'Path is empty' };
      
      const exists = await fs.pathExists(resolvedPath);
      if (!exists) {
        return { valid: false, reason: 'Path does not exist' };
      }
      
      // Try to access the directory
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return { valid: false, reason: 'Path is not a directory' };
      }
      
      return { valid: true, reason: 'Path is accessible' };
    } catch (error) {
      return { valid: false, reason: `Access error: ${error.message}` };
    }
  }

  /**
   * Get template paths with fallback logic
   */
  async getTemplatePaths() {
    const settings = await this.loadPathSettings();
    const templates = settings.templates;
    
    const primaryPath = this.resolvePathVariables(templates.primaryPath);
    const fallbackPath = this.resolvePathVariables(templates.fallbackPath);
    const agentRequirementsPath = this.resolvePathVariables(templates.agentRequirementsPath);
    
    // Validate paths
    const primaryValid = await this.validatePath(primaryPath);
    const fallbackValid = await this.validatePath(fallbackPath);
    const agentValid = await this.validatePath(agentRequirementsPath);
    
    return {
      primary: {
        path: primaryPath,
        valid: primaryValid.valid,
        reason: primaryValid.reason
      },
      fallback: {
        path: fallbackPath,
        valid: fallbackValid.valid,
        reason: fallbackValid.reason
      },
      agentRequirements: {
        path: agentRequirementsPath,
        valid: agentValid.valid,
        reason: agentValid.reason
      },
      // Provide the best available template path
      bestTemplatePath: primaryValid.valid ? primaryPath : fallbackPath
    };
  }

  /**
   * Get specific template path based on RFA type
   */
  async getTemplatePathForRFAType(rfaType) {
    const templatePaths = await this.getTemplatePaths();
    const basePath = templatePaths.bestTemplatePath;
    
    if (!basePath) {
      throw new Error('No valid template path available');
    }
    
    // Determine subfolder based on RFA type (like the original HTA logic)
    let subFolder;
    if (rfaType.includes('Reloc')) {
      subFolder = 'RELOC-RFA#_TYPE_MMDDYYYY';
    } else if (rfaType === 'PHOTOMETRICS') {
      subFolder = 'PHOTOMETRICS-RFA#_TYPE_MMDDYYYY';
    } else {
      subFolder = 'RFA#_TYPE_MMDDYYYY';
    }
    
    const fullTemplatePath = path.join(basePath, subFolder);
    const validation = await this.validatePath(fullTemplatePath);
    
    return {
      path: fullTemplatePath,
      valid: validation.valid,
      reason: validation.reason,
      basePath: basePath,
      subFolder: subFolder
    };
  }

  /**
   * Resolve project output path based on save location choice
   */
  async getProjectOutputPath(saveLocation) {
    const settings = await this.loadPathSettings();
    
    // Ensure outputMappings exists (backward compatibility)
    let outputMappings = settings.projectOutput.outputMappings;
    if (!outputMappings) {
      console.log('PathResolutionService: outputMappings not found, creating default mappings');
      outputMappings = {
        'Desktop': '{userHome}\\Desktop',
        'Triage': '{userHome}\\Desktop\\1) Triage',
        'Server': '{userHome}\\Desktop' // Will be overridden by server logic
      };
    }
    
    // Get the path for the selected save location
    let rawPath = outputMappings[saveLocation];
    
    // If save location not found, use default
    if (!rawPath) {
      const defaultLocation = settings.projectOutput.defaultMapping || 'Desktop';
      rawPath = outputMappings[defaultLocation];
      console.warn(`PathResolutionService: Save location '${saveLocation}' not found, using default '${defaultLocation}'`);
    }
    
    // Resolve variables in the path
    const resolvedPath = this.resolvePathVariables(rawPath);
    
    // Validate the path
    const validation = await this.validatePath(resolvedPath);
    
    return {
      path: resolvedPath,
      valid: validation.valid,
      reason: validation.reason,
      originalChoice: saveLocation,
      rawPath: rawPath
    };
  }

  /**
   * Get all available save location options from settings
   */
  async getAvailableSaveLocations() {
    const settings = await this.loadPathSettings();
    const outputMappings = settings.projectOutput.outputMappings;
    
    const locations = [];
    for (const [key, rawPath] of Object.entries(outputMappings)) {
      const resolvedPath = this.resolvePathVariables(rawPath);
      const validation = await this.validatePath(resolvedPath);
      
      locations.push({
        key: key,
        label: key,
        path: resolvedPath,
        valid: validation.valid,
        reason: validation.reason
      });
    }
    
    return locations;
  }

  /**
   * Get comprehensive path resolution for project creation
   */
  async resolveAllProjectPaths(projectData) {
    const saveLocation = projectData.saveLocation || 'Desktop';
    
    // Get template paths
    const templatePaths = await this.getTemplatePaths();
    
    // Get specific template path for RFA type
    const rfaTemplatePath = await this.getTemplatePathForRFAType(projectData.rfaType);
    
    // Get output path
    const outputPath = await this.getProjectOutputPath(saveLocation);
    
    // Handle server-based logic (from original HTA)
    let finalOutputPath = outputPath.path;
    if (saveLocation === 'Server') {
      finalOutputPath = await this.resolveServerPath(projectData, outputPath.path);
    }
    
    return {
      templates: templatePaths,
      rfaTemplate: rfaTemplatePath,
      output: {
        ...outputPath,
        finalPath: finalOutputPath
      },
      // Legacy compatibility - provide the old structure for existing code
      legacy: {
        masterTemplate: templatePaths.bestTemplatePath,
        baseSave: finalOutputPath,
        agentRequirements: templatePaths.agentRequirements.path
      }
    };
  }

  /**
   * Sanitize a string for use in file paths (remove invalid characters)
   */
  sanitizePathComponent(pathComponent) {
    if (!pathComponent) return '';
    
    // Remove invalid characters for Windows file paths
    return pathComponent
      .replace(/[<>:"|?*\\\/]/g, '') // Remove invalid chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim(); // Remove leading/trailing spaces
  }

  /**
   * Handle server-based path logic (from original implementation)
   */
  async resolveServerPath(projectData, basePath) {
    const currentYear = new Date().getFullYear();
    const projectYear = parseInt('20' + projectData.projectContainer.substring(0, 2));
    const yearDiff = projectYear - currentYear;
    
    // Sanitize project name for folder creation
    const sanitizedName = projectData.projectName
      .replace(/[\\/:_]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    
    const firstLetter = /^[A-Z]/.test(sanitizedName) ? sanitizedName[0] : '#';
    
    // Build server path based on year difference
    let serverPath;
    if (yearDiff === -1) {
      serverPath = `\\\\10.3.10.30\\DAS\\${currentYear - 1} Projects\\${firstLetter}`;
    } else if (yearDiff === -2) {
      serverPath = `\\\\10.3.10.30\\DAS\\${currentYear - 2} Projects\\${firstLetter}`;
    } else {
      serverPath = `\\\\10.3.10.30\\DAS\\${currentYear} Projects\\${firstLetter}`;
    }
    
    // Add national account subfolder if specified (with sanitization)
    if (projectData.nationalAccount && projectData.nationalAccount !== 'Default' && projectData.nationalAccount !== 'N/A') {
      const sanitizedAccount = this.sanitizePathComponent(projectData.nationalAccount);
      if (sanitizedAccount) {
        serverPath = path.join(serverPath, sanitizedAccount);
      }
    }
    
    return serverPath;
  }

  /**
   * Create directory if it doesn't exist
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return { success: true, path: dirPath };
    } catch (error) {
      console.error(`PathResolutionService: Failed to create directory ${dirPath}:`, error);
      return { success: false, error: error.message, path: dirPath };
    }
  }
}

module.exports = PathResolutionService;
