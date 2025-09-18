const fs = require('fs-extra');
const path = require('path');

/**
 * DuplicateProjectDetectionService
 * Detects existing projects to prevent duplicates and guide users toward revision workflow
 * Searches last 5 years for projects with matching name and container number
 */
class DuplicateProjectDetectionService {
  constructor() {
    this.config = {
      serverPaths: {
        basePath: '\\\\10.3.10.30\\das'  // Fixed: lowercase 'das' to match server
      },
      searchYears: 5, // Search last 5 years
      desktopPaths: {
        triage: process.env.USERPROFILE ? 
          path.join(process.env.USERPROFILE, 'Desktop', '1) Triage') : 
          'C:\\Users\\USERNAME\\Desktop\\1) Triage'
      }
    };
  }

  /**
   * Check for existing projects that match the new project data
   * @param {Object} projectData - Project information from form/Agile import
   * @returns {Promise<Object>} Detection result with existing project details
   */
  async checkForExistingProject(projectData) {
    try {
      console.log('🔍 DuplicateProjectDetectionService: Checking for existing project duplicates');
      console.log('📋 Project data:', {
        projectName: projectData.projectName,
        projectContainer: projectData.projectContainer,
        rfaType: projectData.rfaType
      });

      // Sanitize project name (same logic as RevisionDetectionService)
      const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      // Fixed: Add space before underscore to match actual folder structure
      const projectFolderName = `${sanitizedProjectName} _${projectData.projectContainer}`;

      console.log(`✅ Sanitized project: "${projectFolderName}" (${firstLetter}) - NOTE: space before underscore`);

      // Search last 5 years for existing projects
      const searchResults = await this.searchLastFiveYears(projectFolderName, firstLetter);

      if (searchResults.length === 0) {
        console.log('✅ No duplicate projects found - safe to proceed');
        return {
          isDuplicate: false,
          canProceed: true,
          message: 'No existing projects found'
        };
      }

      console.log(`⚠️ Found ${searchResults.length} potential duplicate(s)`);

      // Analyze each found project for RFA details
      const detailedResults = await Promise.all(
        searchResults.map(result => this.analyzeExistingProject(result))
      );

      // Filter out analysis failures and find the best match
      const validDuplicates = detailedResults.filter(result => result.success);

      if (validDuplicates.length === 0) {
        console.log('✅ Analysis failed for all candidates - safe to proceed');
        return {
          isDuplicate: false,
          canProceed: true,
          message: 'Found potential matches but analysis failed'
        };
      }

      // Find the most recent/relevant duplicate
      const primaryDuplicate = this.selectPrimaryDuplicate(validDuplicates);

      console.log('🚨 DUPLICATE PROJECT DETECTED:', primaryDuplicate.projectPath);

      return {
        isDuplicate: true,
        canProceed: false,
        primaryDuplicate: primaryDuplicate,
        allDuplicates: validDuplicates,
        recommendedAction: 'revision',
        nextRFAVersion: primaryDuplicate.suggestedNextVersion,
        message: this.generateDuplicateWarningMessage(primaryDuplicate)
      };

    } catch (error) {
      console.error('❌ DuplicateProjectDetectionService: Error during duplicate detection:', error);
      return {
        isDuplicate: false,
        canProceed: true,
        error: error.message,
        message: 'Duplicate detection failed - proceeding with caution'
      };
    }
  }

  /**
   * Search for existing projects across the last 5 years
   * @param {string} projectFolderName - Sanitized project folder name
   * @param {string} firstLetter - First letter for directory organization
   * @returns {Promise<Array>} Array of found project paths
   */
  async searchLastFiveYears(projectFolderName, firstLetter) {
    const currentYear = new Date().getFullYear();
    const searchYears = [];
    
    // Build array of years to search (current year back 5 years)
    for (let i = 0; i < this.config.searchYears; i++) {
      searchYears.push(currentYear - i);
    }

    console.log(`🗓️ Searching years: ${searchYears.join(', ')}`);

    const searchResults = [];
    const serverBasePath = this.config.serverPaths.basePath;

    for (const year of searchYears) {
      try {
        const yearPath = `${serverBasePath}\\${year} Projects\\${firstLetter}\\${projectFolderName}`;
        console.log(`🔍 Checking ${year}: ${yearPath}`);

        if (await fs.pathExists(yearPath)) {
          console.log(`✅ Found existing project in ${year}: ${yearPath}`);
          searchResults.push({
            year: year,
            projectPath: yearPath,
            projectFolderName: projectFolderName
          });
        } else {
          console.log(`❌ No project found in ${year}`);
        }
      } catch (error) {
        console.error(`❌ Error searching ${year}:`, error.message);
        // Continue searching other years
      }
    }

    // Also check desktop emergency mode if no server results
    if (searchResults.length === 0) {
      console.log('🖥️ No server results - checking desktop emergency mode');
      const desktopResult = await this.checkDesktopEmergencyMode(projectFolderName);
      if (desktopResult) {
        searchResults.push(desktopResult);
      }
    }

    return searchResults;
  }

  /**
   * Analyze an existing project to get RFA folder details
   * @param {Object} projectResult - Project search result
   * @returns {Promise<Object>} Detailed analysis of the existing project
   */
  async analyzeExistingProject(projectResult) {
    try {
      console.log(`📊 Analyzing existing project: ${projectResult.projectPath}`);

      const contents = await fs.readdir(projectResult.projectPath, { withFileTypes: true });
      
      // Find all RFA folders
      const rfaFolders = contents
        .filter(dirent => dirent.isDirectory() && dirent.name.includes('RFA#'))
        .map(dirent => ({
          name: dirent.name,
          path: path.join(projectResult.projectPath, dirent.name)
        }))
        .sort((a, b) => {
          // Sort by RFA version number (highest first)
          const versionA = this.extractRFAVersion(a.name);
          const versionB = this.extractRFAVersion(b.name);
          return (versionB || 0) - (versionA || 0);
        });

      console.log(`📁 Found ${rfaFolders.length} RFA folders:`, rfaFolders.map(f => f.name));

      if (rfaFolders.length === 0) {
        return {
          success: false,
          reason: 'No RFA folders found in existing project'
        };
      }

      const latestRFA = rfaFolders[0];
      const latestVersion = this.extractRFAVersion(latestRFA.name);
      const rfaNumber = this.extractRFANumber(latestRFA.name);
      const rfaType = this.extractRFAType(latestRFA.name);
      const rfaDate = this.extractRFADate(latestRFA.name);

      return {
        success: true,
        ...projectResult,
        rfaFolders: rfaFolders,
        latestRFA: {
          name: latestRFA.name,
          path: latestRFA.path,
          version: latestVersion,
          rfaNumber: rfaNumber,
          rfaType: rfaType,
          date: rfaDate
        },
        suggestedNextVersion: (latestVersion || 0) + 1,
        totalRFACount: rfaFolders.length
      };

    } catch (error) {
      console.error(`❌ Error analyzing project ${projectResult.projectPath}:`, error);
      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * Select the primary duplicate from multiple candidates
   * @param {Array} duplicates - Array of valid duplicate results
   * @returns {Object} Primary duplicate to show in warning
   */
  selectPrimaryDuplicate(duplicates) {
    // Prefer most recent year, then highest RFA version
    const sorted = duplicates.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year; // Most recent year first
      }
      return (b.latestRFA.version || 0) - (a.latestRFA.version || 0); // Highest version first
    });

    return sorted[0];
  }

  /**
   * Generate user-friendly warning message for duplicate detection
   * @param {Object} duplicate - Primary duplicate project details
   * @returns {string} Formatted warning message
   */
  generateDuplicateWarningMessage(duplicate) {
    const rfaNumber = duplicate.latestRFA.rfaNumber;
    const nextVersion = duplicate.suggestedNextVersion;
    
    return `Duplicate project detected in ${duplicate.year}. ` +
           `Latest: ${duplicate.latestRFA.name}. ` +
           `This should be a REVISION request for RFA#${rfaNumber} (next version: REV-${nextVersion}).`;
  }

  /**
   * Check desktop emergency mode for existing projects
   * @param {string} projectFolderName - Project folder name to search for
   * @returns {Promise<Object|null>} Desktop project result or null
   */
  async checkDesktopEmergencyMode(projectFolderName) {
    try {
      const desktopPath = this.config.desktopPaths.triage;
      console.log(`🖥️ Checking desktop emergency mode: ${desktopPath}`);

      if (!await fs.pathExists(desktopPath)) {
        return null;
      }

      // Look for project folders containing the project name
      const contents = await fs.readdir(desktopPath, { withFileTypes: true });
      const matchingFolders = contents.filter(dirent => 
        dirent.isDirectory() && dirent.name.includes(projectFolderName)
      );

      if (matchingFolders.length > 0) {
        const firstMatch = matchingFolders[0];
        console.log(`✅ Found desktop project: ${firstMatch.name}`);
        return {
          year: 'Desktop',
          projectPath: path.join(desktopPath, firstMatch.name),
          projectFolderName: firstMatch.name,
          isDesktopMode: true
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error checking desktop emergency mode:', error);
      return null;
    }
  }

  /**
   * Extract RFA version number from folder name
   * @param {string} rfaFolderName - RFA folder name
   * @returns {number|null} Version number or null
   */
  extractRFAVersion(rfaFolderName) {
    try {
      const versionMatch = rfaFolderName.match(/RFA#\d+-(\d+)/i);
      return versionMatch ? parseInt(versionMatch[1]) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract RFA number from folder name
   * @param {string} rfaFolderName - RFA folder name
   * @returns {string|null} RFA number or null
   */
  extractRFANumber(rfaFolderName) {
    try {
      const numberMatch = rfaFolderName.match(/RFA#(\d+)-/i);
      return numberMatch ? numberMatch[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract RFA type from folder name
   * @param {string} rfaFolderName - RFA folder name
   * @returns {string|null} RFA type or null
   */
  extractRFAType(rfaFolderName) {
    try {
      const typeMatch = rfaFolderName.match(/RFA#\d+-\d+_([A-Z]+)_/i);
      return typeMatch ? typeMatch[1].toUpperCase() : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract RFA date from folder name
   * @param {string} rfaFolderName - RFA folder name
   * @returns {string|null} RFA date or null
   */
  extractRFADate(rfaFolderName) {
    try {
      const dateMatch = rfaFolderName.match(/_(\d{8})$/);
      return dateMatch ? dateMatch[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize project name (same logic as RevisionDetectionService)
   * @param {string} projectName - Raw project name
   * @returns {string} Sanitized project name
   */
  sanitizeProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
      console.warn('DuplicateProjectDetectionService: Invalid project name, using fallback');
      return 'UNKNOWN PROJECT';
    }

    let sanitized = projectName;
    
    // Remove common Agile import pollution
    sanitized = sanitized.replace(/^Last Updated:\s*/i, '');
    sanitized = sanitized.replace(/^Updated:\s*/i, '');
    sanitized = sanitized.replace(/^Created:\s*/i, '');
    
    // Remove date/time stamps
    sanitized = sanitized.replace(/\d{1,2}\/\d{1,2}\/\d{4}.*$/g, '');
    sanitized = sanitized.replace(/\d{4}-\d{2}-\d{2}.*$/g, '');
    
    // Replace invalid Windows path characters
    sanitized = sanitized.replace(/[\\\/:*?"<>|]/g, ' ');
    sanitized = sanitized.replace(/_/g, ' ');
    
    // Clean up multiple spaces and trim
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Convert to uppercase
    sanitized = sanitized.toUpperCase();
    
    if (!sanitized || sanitized.length === 0) {
      console.warn('DuplicateProjectDetectionService: Project name became empty after sanitization');
      return 'UNKNOWN PROJECT';
    }
    
    return sanitized;
  }

  /**
   * Get first letter for directory organization
   * @param {string} projectName - Sanitized project name
   * @returns {string} First letter (uppercase)
   */
  getFirstLetter(projectName) {
    if (!projectName || projectName.length === 0) {
      return 'U'; // Default for 'Unknown'
    }
    return projectName.charAt(0).toUpperCase();
  }

  /**
   * Format duplicate detection results for UI display
   * @param {Object} detectionResult - Result from checkForExistingProject
   * @returns {Object} Formatted data for UI components
   */
  formatForUI(detectionResult) {
    if (!detectionResult.isDuplicate) {
      return {
        showWarning: false,
        canProceed: true
      };
    }

    const primary = detectionResult.primaryDuplicate;
    
    return {
      showWarning: true,
      canProceed: false,
      warningData: {
        projectName: primary.projectFolderName,
        foundInYear: primary.year,
        latestRFA: primary.latestRFA,
        suggestedNextVersion: primary.suggestedNextVersion,
        allRFAFolders: primary.rfaFolders,
        totalProjects: detectionResult.allDuplicates.length,
        message: detectionResult.message
      }
    };
  }
}

module.exports = DuplicateProjectDetectionService;
