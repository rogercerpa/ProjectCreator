const fs = require('fs-extra');
const path = require('path');

/**
 * RevisionDetectionService
 * Handles detection of existing projects and previous revisions
 * Implements the HTA logic for finding previous revision folders
 */
class RevisionDetectionService {
  constructor() {
    this.config = {
      serverPaths: {
        currentYear: '\\\\10.3.10.30\\DAS',
        fileDirectory: '\\\\10.3.10.30\\DAS'
      },
      desktopPaths: {
        triage: process.env.USERPROFILE ? 
          path.join(process.env.USERPROFILE, 'Desktop', '1) Triage') : 
          'C:\\Users\\USERNAME\\Desktop\\1) Triage'
      }
    };
  }

  /**
   * Detect revision requirements for validation pipeline
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Detection result for validation
   */
  async detectRevision(projectData) {
    try {
      console.log('RevisionDetectionService: Detecting revision requirements for validation pipeline');
      
      // Use the existing detectExistingProject method
      const detectionResult = await this.detectExistingProject(projectData);
      
      return {
        success: true,
        result: detectionResult,
        recommendations: detectionResult.shouldPromptRevision ? 
          ['Consider creating a revision instead of a new project'] : 
          ['Safe to create new project'],
        validationPassed: true
      };
    } catch (error) {
      console.error('RevisionDetectionService: Error in detectRevision:', error);
      return {
        success: false,
        error: error.message,
        validationPassed: false
      };
    }
  }

  /**
   * Detect if a project already exists on the server
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Detection result
   */
  async detectExistingProject(projectData) {
    try {
      console.log('RevisionDetectionService: Detecting existing project for:', projectData.projectName);
      
      // Sanitize project name like HTA
      const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      const projectFolderName = `${sanitizedProjectName}_${projectData.projectContainer}`;
      
      // Skip detection for desktop emergency use
      if (projectData.regionalTeam === 'Desktop Emergency Use only') {
        return {
          exists: false,
          reason: 'Desktop emergency mode - server check skipped',
          shouldPromptRevision: false
        };
      }

      // Build search paths for multiple years
      const searchPaths = this.buildProjectSearchPaths(projectData, firstLetter, projectFolderName);
      
      // Search for existing project
      for (const searchPath of searchPaths) {
        console.log('RevisionDetectionService: Checking path:', searchPath.path);
        
        if (await fs.pathExists(searchPath.path)) {
          console.log('RevisionDetectionService: Found existing project at:', searchPath.path);
          
          return {
            exists: true,
            location: searchPath.path,
            year: searchPath.year,
            shouldPromptRevision: true,
            message: `Project already exists in ${searchPath.year}. Would you like to create a revision?`
          };
        }
      }

      console.log('RevisionDetectionService: No existing project found');
      return {
        exists: false,
        reason: 'Project not found in any year folder',
        shouldPromptRevision: false,
        searchedPaths: searchPaths.map(p => p.path)
      };

    } catch (error) {
      console.error('RevisionDetectionService: Error detecting existing project:', error);
      return {
        exists: false,
        error: error.message,
        shouldPromptRevision: false
      };
    }
  }

  /**
   * Find previous revision folders for a project
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Previous revision search result
   */
  async findPreviousRevision(projectData) {
    try {
      console.log('RevisionDetectionService: Finding previous revision for:', projectData.projectName);
      
      const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      const projectFolderName = `${sanitizedProjectName}_${projectData.projectContainer}`;
      
      // Build search paths (same as project detection)
      const searchPaths = this.buildProjectSearchPaths(projectData, firstLetter, projectFolderName);
      
      // Search for project folder first
      let projectFolderPath = null;
      for (const searchPath of searchPaths) {
        if (await fs.pathExists(searchPath.path)) {
          projectFolderPath = searchPath.path;
          console.log('RevisionDetectionService: Found project folder at:', projectFolderPath);
          break;
        }
      }

      if (!projectFolderPath) {
        console.log('RevisionDetectionService: No project folder found, will need manual selection');
        return {
          success: false,
          requiresManualSelection: true,
          reason: 'Project folder not found in any year location',
          searchedPaths: searchPaths.map(p => p.path)
        };
      }

      // Find the most recent RFA folder within the project
      const mostRecentRFA = await this.findMostRecentRFAFolder(projectFolderPath);
      
      if (mostRecentRFA) {
        console.log('RevisionDetectionService: Found most recent RFA:', mostRecentRFA);
        return {
          success: true,
          projectPath: projectFolderPath,
          revisionPath: mostRecentRFA,
          searchMethod: 'automatic',
          message: 'Previous revision found automatically'
        };
      } else {
        return {
          success: false,
          requiresManualSelection: true,
          reason: 'No RFA folders found in project directory',
          projectPath: projectFolderPath
        };
      }

    } catch (error) {
      console.error('RevisionDetectionService: Error finding previous revision:', error);
      return {
        success: false,
        error: error.message,
        requiresManualSelection: true
      };
    }
  }

  /**
   * Validate that a manually selected folder is a valid RFA folder
   * @param {string} folderPath - Path to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateRFAFolder(folderPath) {
    try {
      if (!folderPath || !await fs.pathExists(folderPath)) {
        return {
          isValid: false,
          error: 'Folder does not exist'
        };
      }

      const folderName = path.basename(folderPath);
      
      // Check if folder name contains "RFA#" pattern (like HTA validation)
      if (!folderName.includes('RFA#')) {
        return {
          isValid: false,
          error: 'Selected folder is not an RFA folder. Please select a folder containing "RFA#" in the name.'
        };
      }

      // Check if it's a directory
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        return {
          isValid: false,
          error: 'Selected path is not a directory'
        };
      }

      // Additional validation - check for typical RFA folder contents
      const contents = await fs.readdir(folderPath);
      const hasAgentFiles = contents.includes('!Agent Files');
      const hasRequestOutput = contents.includes('!!Request Output');
      
      return {
        isValid: true,
        folderName: folderName,
        hasStandardStructure: hasAgentFiles && hasRequestOutput,
        contents: contents,
        message: hasAgentFiles && hasRequestOutput ? 
          'Valid RFA folder with standard structure' : 
          'Valid RFA folder (non-standard structure)'
      };

    } catch (error) {
      console.error('RevisionDetectionService: Error validating RFA folder:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Suggest revision mode based on project existence
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Suggestion result
   */
  async suggestRevisionMode(projectData) {
    try {
      const existingProject = await this.detectExistingProject(projectData);
      
      if (existingProject.exists) {
        return {
          shouldBeRevision: true,
          confidence: 'high',
          reason: `Project "${projectData.projectName}" already exists at ${existingProject.location}`,
          existingPath: existingProject.location,
          autoPrompt: true
        };
      }

      return {
        shouldBeRevision: false,
        confidence: 'high',
        reason: 'No existing project found',
        autoPrompt: false
      };

    } catch (error) {
      console.error('RevisionDetectionService: Error suggesting revision mode:', error);
      return {
        shouldBeRevision: false,
        confidence: 'low',
        reason: 'Unable to determine due to error',
        error: error.message,
        autoPrompt: false
      };
    }
  }

  /**
   * Build search paths for project detection (implements HTA multi-year logic)
   * @param {Object} projectData - Project information
   * @param {string} firstLetter - First letter for folder organization
   * @param {string} projectFolderName - Project folder name
   * @returns {Array} Array of search path objects
   */
  buildProjectSearchPaths(projectData, firstLetter, projectFolderName) {
    const currentYear = new Date().getFullYear();
    const projectYear = parseInt('20' + projectData.projectContainer.substring(0, 2));
    
    const searchPaths = [
      {
        path: `${this.config.serverPaths.currentYear}\\${currentYear} Projects\\${firstLetter}\\${projectFolderName}`,
        year: currentYear,
        type: 'current'
      },
      {
        path: `${this.config.serverPaths.currentYear}\\${currentYear - 1} Projects\\${firstLetter}\\${projectFolderName}`,
        year: currentYear - 1,
        type: 'previous'
      },
      {
        path: `${this.config.serverPaths.currentYear}\\${currentYear - 2} Projects\\${firstLetter}\\${projectFolderName}`,
        year: currentYear - 2,
        type: 'two_years_ago'
      }
    ];

    // Handle national accounts (add subfolder if specified)
    if (projectData.nationalAccount && projectData.nationalAccount !== 'Default') {
      searchPaths.forEach(searchPath => {
        searchPath.path = searchPath.path.replace(
          `\\${projectFolderName}`,
          `\\${projectData.nationalAccount}\\${projectFolderName}`
        );
      });
    }

    return searchPaths;
  }

  /**
   * Find the most recent RFA folder in a project directory
   * @param {string} projectPath - Path to project directory
   * @returns {Promise<string|null>} Path to most recent RFA folder
   */
  async findMostRecentRFAFolder(projectPath) {
    try {
      const contents = await fs.readdir(projectPath);
      
      // Filter for RFA folders
      const rfaFolders = contents.filter(item => item.includes('RFA#'));
      
      if (rfaFolders.length === 0) {
        return null;
      }

      // Sort by name (which includes date) to get most recent
      rfaFolders.sort((a, b) => b.localeCompare(a));
      
      const mostRecentRFA = rfaFolders[0];
      const rfaPath = path.join(projectPath, mostRecentRFA);
      
      // Verify it's a directory
      const stats = await fs.stat(rfaPath);
      if (stats.isDirectory()) {
        return rfaPath;
      }

      return null;

    } catch (error) {
      console.error('RevisionDetectionService: Error finding most recent RFA folder:', error);
      return null;
    }
  }

  /**
   * Sanitize project name (implements HTA logic)
   * @param {string} projectName - Raw project name
   * @returns {string} Sanitized project name
   */
  sanitizeProjectName(projectName) {
    return projectName
      .replace(/[\\\/:]/g, ' ')  // Replace backslashes, forward slashes, colons
      .replace(/_/g, ' ')        // Replace underscores
      .toUpperCase()             // Convert to uppercase
      .trim();
  }

  /**
   * Get first letter for folder organization (implements HTA logic)
   * @param {string} projectName - Sanitized project name
   * @returns {string} First letter or '#' for non-alphabetic
   */
  getFirstLetter(projectName) {
    const first = projectName.charAt(0);
    return /[A-Z]/.test(first) ? first : '#';
  }

  /**
   * Check folder name mismatch and offer rename suggestion
   * @param {string} selectedPath - User selected path
   * @param {string} expectedPath - Expected path based on current project data
   * @returns {Object} Mismatch analysis and rename suggestion
   */
  analyzeFolderNameMismatch(selectedPath, expectedPath) {
    try {
      const selectedFolder = path.basename(path.dirname(selectedPath));
      const expectedFolder = path.basename(path.dirname(expectedPath));
      
      if (selectedFolder !== expectedFolder) {
        return {
          hasMismatch: true,
          selectedFolder: selectedFolder,
          expectedFolder: expectedFolder,
          shouldRename: true,
          message: `Selected folder name "${selectedFolder}" doesn't match expected "${expectedFolder}". Would you like to rename it?`
        };
      }

      return {
        hasMismatch: false,
        shouldRename: false,
        message: 'Folder name matches expected naming convention'
      };

    } catch (error) {
      console.error('RevisionDetectionService: Error analyzing folder name mismatch:', error);
      return {
        hasMismatch: false,
        shouldRename: false,
        error: error.message
      };
    }
  }

  /**
   * Clear any caches (for ValidationOrchestrator compatibility)
   */
  clearCache() {
    console.log('RevisionDetectionService: Cache cleared (no cache implemented yet)');
  }

  /**
   * Get cache statistics (for ValidationOrchestrator compatibility)
   */
  getCacheStats() {
    return {
      size: 0,
      hits: 0,
      misses: 0,
      enabled: false
    };
  }
}

module.exports = RevisionDetectionService;