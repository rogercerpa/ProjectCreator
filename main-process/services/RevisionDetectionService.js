const fs = require('fs-extra');
const path = require('path');
const RFATypeMatchingService = require('./RFATypeMatchingService');
const { INVALID_FILENAME_CHARS } = require('./FileUtils');

/**
 * RevisionDetectionService
 * Handles detection of existing projects and previous revisions
 * Implements the HTA logic for finding previous revision folders
 */
class RevisionDetectionService {
  constructor() {
    this.config = {
      serverPaths: {
        currentYear: '\\\\10.3.10.30\\das',  // Fixed: lowercase 'das' to match server
        fileDirectory: '\\\\10.3.10.30\\das'  // Fixed: lowercase 'das' to match server
      },
      desktopPaths: {
        triage: process.env.USERPROFILE ? 
          path.join(process.env.USERPROFILE, 'Desktop', '1) Triage') : 
          'C:\\Users\\USERNAME\\Desktop\\1) Triage'
      }
    };
    this.rfaMatchingService = new RFATypeMatchingService();
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
   * Find previous revision folders for a project (HTA-like automatic detection)
   * @param {Object} projectData - Project information
   * @returns {Promise<Object>} Previous revision search result
   */
  async findPreviousRevision(projectData) {
    try {
      console.log('🔍 RevisionDetectionService: Starting HTA-like automatic revision detection');
      console.log('📋 RevisionDetectionService: Project data received:', {
        projectName: projectData?.projectName,
        projectContainer: projectData?.projectContainer,
        regionalTeam: projectData?.regionalTeam,
        nationalAccount: projectData?.nationalAccount
      });
      
      // Safety check for required fields
      if (!projectData) {
        throw new Error('Project data is required');
      }
      
      if (!projectData.projectName) {
        throw new Error('Project name is required');
      }
      
      if (!projectData.projectContainer) {
        throw new Error('Project container is required');
      }
      
      // HTA-like: Skip detection for desktop emergency use
      if (projectData.regionalTeam === 'Desktop Emergency Use only') {
        console.log('RevisionDetectionService: Desktop emergency mode - skipping automatic detection');
      return {
          success: false,
          requiresManualSelection: true,
          reason: 'Desktop emergency mode - automatic detection skipped',
          searchMethod: 'manual_required',
          // Ensure backwards compatibility
          revisionPath: null,
          projectPath: null
        };
      }
      
      console.log(`🔍 RevisionDetectionService: Raw project name from form: "${projectData.projectName}"`);
      
      const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
      const originalProjectName = projectData.projectName.trim();
      const firstLetter = this.getFirstLetter(sanitizedProjectName);
      
      console.log(`✅ RevisionDetectionService: Sanitized: "${sanitizedProjectName}", Original: "${originalProjectName}"`);
      console.log(`🎯 RevisionDetectionService: Will try MULTIPLE folder name patterns to find project`);
      
      // Generate multiple folder name patterns
      const folderPatterns = this.buildProjectSearchPathsWithPatterns(projectData, firstLetter);
      
      // HTA-like: Search hierarchically trying all patterns
      let projectFolderPath = null;
      let foundInYear = null;
      let matchedPattern = null;
      
      // Build year list for searching
      const currentYear = new Date().getFullYear();
      const projectYear = parseInt('20' + projectData.projectContainer.substring(0, 2));
      const yearOffset = projectYear - currentYear;
      
      let searchYears = [];
      if (yearOffset === 0) {
        searchYears = [currentYear, currentYear - 1, currentYear - 2];
      } else if (yearOffset === -1) {
        searchYears = [currentYear - 1, currentYear, currentYear - 2];
      } else if (yearOffset === -2) {
        searchYears = [currentYear - 2, currentYear - 1, currentYear];
      } else {
        searchYears = [projectYear, currentYear, currentYear - 1].filter(y => y >= 2020 && y <= 2030);
      }
      
      const serverBasePath = this.config?.serverPaths?.currentYear || '\\\\10.3.10.30\\das';
      const sanitizedNationalAccount = this.sanitizeNationalAccount(projectData.nationalAccount);
      
      for (const year of searchYears) {
        console.log(`\n🔍 Searching in ${year}:`);
        
        // Build base path for this year
        let basePath = `${serverBasePath}\\${year} Projects\\${firstLetter}`;
        if (sanitizedNationalAccount && sanitizedNationalAccount !== 'Default') {
          basePath = `${basePath}\\${sanitizedNationalAccount}`;
        }
        
        // Try each naming pattern
        for (const pattern of folderPatterns) {
          const testPath = `${basePath}\\${pattern}`;
          console.log(`   Testing: ${testPath}`);
          
          if (await fs.pathExists(testPath)) {
            projectFolderPath = testPath;
            foundInYear = year;
            matchedPattern = pattern;
            console.log(`✅ FOUND! Pattern "${pattern}" matched in ${foundInYear}`);
            break;
          }
        }
        
        if (projectFolderPath) break;
        console.log(`❌ RevisionDetectionService: Project not found in ${year} with any pattern`);
      }

      if (!projectFolderPath) {
        console.log('❌ RevisionDetectionService: Project folder not found in any year with any naming pattern - manual selection required');
    return {
          success: false,
          requiresManualSelection: true,
          reason: 'Project folder not found in any year location with any naming pattern',
          searchedYears: searchYears,
          triedPatterns: folderPatterns,
          searchMethod: 'automatic_failed',
          // Ensure backwards compatibility
          revisionPath: null,
          projectPath: null
        };
      }

      console.log(`✅ RevisionDetectionService: Project found in ${foundInYear} using pattern "${matchedPattern}"`);
      console.log(`📁 Full path: ${projectFolderPath}`);
      console.log(`🔍 Now scanning for RFA folders...`);

      // HTA-like: Find the most recent RFA folder within the discovered project
      const rfaSelectionResult = await this.findMostRecentRFAFolder(projectFolderPath, projectData.rfaType);
      
      if (rfaSelectionResult && rfaSelectionResult.folderPath) {
        const selectedPath = rfaSelectionResult.folderPath;
        console.log(`✅ RevisionDetectionService: Smart selection SUCCESS! Using: ${path.basename(selectedPath)}`);
        console.log(`📋 Selection reasoning: ${rfaSelectionResult.reasoning}`);
        
        return {
          success: true,
          projectPath: projectFolderPath,
          revisionPath: selectedPath,
          searchMethod: 'automatic_smart',
          foundInYear: foundInYear,
          message: `Previous revision found automatically in ${foundInYear}`,
          rfaFolderName: path.basename(selectedPath),
          selectionStrategy: rfaSelectionResult.selectionStrategy,
          selectionReasoning: rfaSelectionResult.reasoning,
          confidence: rfaSelectionResult.confidence
        };
      } else if (rfaSelectionResult && rfaSelectionResult.requiresManualSelection) {
        console.log('⚠️ RevisionDetectionService: Smart selection requires manual input');
        return {
          success: false,
          requiresManualSelection: true,
          reason: rfaSelectionResult.reasoning || 'Multiple RFA folders found - manual selection required',
          projectPath: projectFolderPath,
          foundInYear: foundInYear,
          searchMethod: 'automatic_partial',
          revisionPath: null,
          availableFolders: rfaSelectionResult.allFolders
        };
      } else {
        console.log('❌ RevisionDetectionService: Project found but no valid RFA folders');
        return {
          success: false,
          requiresManualSelection: true,
          reason: 'No valid RFA folders found in project directory',
          projectPath: projectFolderPath,
          foundInYear: foundInYear,
          searchMethod: 'automatic_partial',
          revisionPath: null
        };
      }

    } catch (error) {
      console.error('❌ RevisionDetectionService: Error during automatic revision detection:', error);
      return {
        success: false,
        error: error.message,
        requiresManualSelection: true,
        searchMethod: 'error',
        // Ensure backwards compatibility
        revisionPath: null,
        projectPath: null
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
   * Build search paths with multiple naming patterns to match server conventions
   * @param {Object} projectData - Project information
   * @param {string} firstLetter - First letter for folder organization
   * @returns {Array} Array of search path objects with multiple patterns
   */
  buildProjectSearchPathsWithPatterns(projectData, firstLetter) {
    const currentYear = new Date().getFullYear();
    
    // Generate multiple folder name patterns to match different conventions
    const sanitizedProjectName = this.sanitizeProjectName(projectData.projectName);
    const originalProjectName = projectData.projectName.trim();
    const container = projectData.projectContainer;
    
    // Try multiple patterns in order of likelihood
    const folderPatterns = [
      `${originalProjectName} ${container}`,                    // Most common: "Jacksonville Jaguars Stadium 25-57145"
      `${sanitizedProjectName} _${container}`,                  // Uppercase with space-underscore: "JACKSONVILLE JAGUARS _25-57145"
      `${sanitizedProjectName}_${container}`,                   // Uppercase with underscore: "JACKSONVILLE JAGUARS_25-57145"
      `${originalProjectName} _${container}`,                   // Original with space-underscore: "Jacksonville Jaguars _25-57145"
      `${originalProjectName}_${container}`                     // Original with underscore: "Jacksonville Jaguars_25-57145"
    ];
    
    console.log('📋 Will try folder name patterns:', folderPatterns);
    
    return folderPatterns;
  }

  /**
   * Build search paths for project detection (implements HTA multi-year logic)
   * @param {Object} projectData - Project information
   * @param {string} firstLetter - First letter for folder organization
   * @param {string} projectFolderName - Project folder name (legacy parameter)
   * @returns {Array} Array of search path objects
   */
  buildProjectSearchPaths(projectData, firstLetter, projectFolderName) {
    const currentYear = new Date().getFullYear();
    
    // HTA-like: Extract project year from container (first 2 digits) with safety checks
    let projectYear = currentYear; // Default fallback
    
    try {
      if (projectData.projectContainer && typeof projectData.projectContainer === 'string' && projectData.projectContainer.length >= 2) {
        const yearSuffix = projectData.projectContainer.substring(0, 2);
        const parsedYear = parseInt('20' + yearSuffix);
        
        // Validate the year is reasonable (2020-2030 range)
        if (parsedYear >= 2020 && parsedYear <= 2030) {
          projectYear = parsedYear;
        } else {
          console.warn(`RevisionDetectionService: Invalid project year ${parsedYear} from container ${projectData.projectContainer}, using current year`);
        }
      } else {
        console.warn(`RevisionDetectionService: Invalid project container '${projectData.projectContainer}', using current year`);
      }
    } catch (error) {
      console.error('RevisionDetectionService: Error extracting project year:', error);
      console.log('RevisionDetectionService: Using current year as fallback');
    }
    
    const yearOffset = projectYear - currentYear;
    
    console.log(`RevisionDetectionService: Project year ${projectYear}, Current year ${currentYear}, Offset: ${yearOffset}`);
    
    // HTA-like: Build year-based search strategy
    let searchYears = [];
    
    switch (yearOffset) {
      case 0:
        // Project is current year - search current, then previous years
        searchYears = [currentYear, currentYear - 1, currentYear - 2];
        break;
      case -1:
        // Project is from last year - search previous, then current, then older
        searchYears = [currentYear - 1, currentYear, currentYear - 2];
        break;
      case -2:
        // Project is from 2 years ago - search that year first
        searchYears = [currentYear - 2, currentYear - 1, currentYear];
        break;
      default:
        // For other years, search intelligently
        if (yearOffset < 0) {
          // Older project - search project year first, then newer
          searchYears = [projectYear, projectYear + 1, projectYear + 2].filter(year => year <= currentYear);
        } else {
          // Future project - search current year first
          searchYears = [currentYear, currentYear - 1, currentYear - 2];
        }
    }
    
    // Ensure we always have at least 3 years to search with safety checks
    if (searchYears.length === 0) {
      // Fallback to basic current year search if array is somehow empty
      console.warn('RevisionDetectionService: searchYears array empty, using fallback');
      searchYears = [currentYear, currentYear - 1, currentYear - 2];
    }
    
    while (searchYears.length < 3) {
      const lastYear = searchYears[searchYears.length - 1];
      if (lastYear && lastYear > currentYear - 5) { // Don't go back more than 5 years
        searchYears.push(lastYear - 1);
      } else {
        // Safety fallback - add remaining years from current
        const missingCount = 3 - searchYears.length;
        for (let i = 1; i <= missingCount; i++) {
          const yearToAdd = currentYear - i;
          if (!searchYears.includes(yearToAdd) && yearToAdd >= currentYear - 5) {
            searchYears.push(yearToAdd);
          }
        }
        break;
      }
    }
    
    // Build search paths in priority order with safety checks
    const serverBasePath = this.config?.serverPaths?.currentYear || '\\\\10.3.10.30\\DAS';
    
    const searchPaths = searchYears.map((year, index) => {
      const basePath = `${serverBasePath}\\${year} Projects\\${firstLetter}\\${projectFolderName}`;
      
      return {
        path: basePath,
        year: year,
        type: index === 0 ? 'primary' : index === 1 ? 'secondary' : 'tertiary',
        priority: index + 1,
        reasoning: this.getSearchReasoning(year, projectYear, currentYear) || 'unknown'
      };
    });

    // Handle national accounts (add subfolder if specified)
    // FIXED: Sanitize nationalAccount to prevent Agile import pollution
    const sanitizedNationalAccount = this.sanitizeNationalAccount(projectData.nationalAccount);
    
    if (sanitizedNationalAccount && sanitizedNationalAccount !== 'Default') {
      console.log(`🏢 Using national account folder: "${sanitizedNationalAccount}"`);
      searchPaths.forEach(searchPath => {
        searchPath.path = searchPath.path.replace(
          `\\${projectFolderName}`,
          `\\${sanitizedNationalAccount}\\${projectFolderName}`
        );
      });
    } else {
      console.log(`📁 Using standard project folder structure (no national account)`);
    }

    console.log('RevisionDetectionService: Search strategy:', searchPaths.map(p => `${p.year} (${p.reasoning})`));
    return searchPaths;
  }

  /**
   * Get reasoning for search year selection (for debugging)
   * @param {number} searchYear - Year being searched
   * @param {number} projectYear - Project's year
   * @param {number} currentYear - Current year
   * @returns {string} Human-readable reasoning
   */
  getSearchReasoning(searchYear, projectYear, currentYear) {
    try {
      // Safety checks for valid numbers
      if (typeof searchYear !== 'number' || typeof projectYear !== 'number' || typeof currentYear !== 'number') {
        return 'invalid parameters';
      }
      
      if (searchYear === projectYear) return 'project year';
      if (searchYear === currentYear) return 'current year';
      if (searchYear === currentYear - 1) return 'previous year';
      if (searchYear === currentYear - 2) return 'two years ago';
      
      const yearDiff = currentYear - searchYear;
      if (yearDiff > 0) {
        return `${yearDiff} years ago`;
      } else if (yearDiff < 0) {
        return `${Math.abs(yearDiff)} years in future`;
      } else {
        return 'current year';
      }
    } catch (error) {
      console.error('RevisionDetectionService: Error in getSearchReasoning:', error);
      return 'error';
    }
  }

  /**
   * Find the most recent RFA folder in a project directory using smart RFA type matching
   * @param {string} projectPath - Path to project directory  
   * @param {string} formRFAType - RFA type from project form
   * @returns {Promise<Object|null>} Selection result with folder path and reasoning, or null
   */
  async findMostRecentRFAFolder(projectPath, formRFAType) {
    try {
      console.log(`🔍 RevisionDetectionService: Smart RFA folder selection for "${formRFAType}" in:`, projectPath);
      
      const contents = await fs.readdir(projectPath, { withFileTypes: true });
      
      // Filter for RFA folders (directories only, containing "RFA#")
      const rfaFolders = contents
        .filter(dirent => dirent.isDirectory() && dirent.name.includes('RFA#'))
        .map(dirent => ({
          name: dirent.name,
          path: path.join(projectPath, dirent.name)
        }));
      
      console.log(`📋 Found ${rfaFolders.length} RFA folders:`, rfaFolders.map(f => f.name));
      
      if (rfaFolders.length === 0) {
        console.log('❌ No RFA folders found');
        return null;
      }

      // Use smart RFA type matching to select the best folder
      const selectionResult = this.rfaMatchingService.selectBestRFAFolder(formRFAType, rfaFolders);
      
      if (!selectionResult.selectedFolder) {
        console.log('❌ Smart RFA matching failed to select a folder');
        return null;
      }

      const selectedFolder = selectionResult.selectedFolder;
      console.log(`🎯 Smart selection result:`, {
        strategy: selectionResult.strategy,
        confidence: selectionResult.confidence,
        folder: selectedFolder.name,
        reasoning: selectionResult.reasoning
      });

      // Validate the selected RFA folder has expected content
      const isValid = await this.validateRFAFolderContent(selectedFolder.path);
      if (!isValid) {
        console.log(`⚠️ Selected RFA folder "${selectedFolder.name}" is invalid, trying alternatives...`);
        
        // Try other high-scoring folders if the selected one is invalid
        const alternatives = selectionResult.allFolders.slice(1); // Skip the first (already tried)
        
        for (const candidate of alternatives) {
          const candidateValid = await this.validateRFAFolderContent(candidate.path);
          
          if (candidateValid) {
            console.log(`✅ Using valid alternative RFA folder: ${candidate.name}`);
            return {
              folderPath: candidate.path,
              selectionStrategy: 'fallback_validation',
              reasoning: `Selected "${candidate.name}" after validation failure of primary choice`,
              requiresManualSelection: false,
              allFolders: selectionResult.allFolders
            };
          }
        }
        
        console.log('❌ No valid RFA folders found after validation');
        return {
          folderPath: null,
          selectionStrategy: 'validation_failed',
          reasoning: 'All RFA folders failed content validation',
          requiresManualSelection: true,
          allFolders: selectionResult.allFolders
        };
      }

      // Return successful selection result
      return {
        folderPath: selectedFolder.path,
        selectionStrategy: selectionResult.strategy,
        reasoning: selectionResult.reasoning,
        requiresManualSelection: selectionResult.requiresManualSelection,
        confidence: selectionResult.confidence,
        selectedFolder: selectedFolder,
        allFolders: selectionResult.allFolders
      };

          } catch (error) {
      console.error('❌ RevisionDetectionService: Error in smart RFA folder selection:', error);
      return null;
    }
  }

  /**
   * Extract RFA version number from folder name (format: RFA#12345-1, RFA#12345-2, etc.)
   * @param {string} rfaName - RFA folder name
   * @returns {number|null} Version number or null if not found
   */
  extractRFAVersion(rfaName) {
    try {
      // Look for pattern RFA#[number]-[version] 
      const versionMatch = rfaName.match(/RFA#\d+-(\d+)/i);
      
      if (versionMatch) {
        const version = parseInt(versionMatch[1]);
        console.log(`📋 Extracted version ${version} from: ${rfaName}`);
        return version;
      }
      
      console.log(`⚠️ No version number found in: ${rfaName}`);
      return null;
          } catch (error) {
      console.log(`❌ Error extracting version from ${rfaName}:`, error);
      return null;
    }
  }

  /**
   * Extract date from RFA folder name (format: RFA#123_TYPE_MMDDYYYY)
   * @param {string} rfaName - RFA folder name
   * @returns {Date|null} Parsed date or null if invalid
   */
  extractDateFromRFAName(rfaName) {
    try {
      // Look for date pattern MMDDYYYY at the end
      const dateMatch = rfaName.match(/_(\d{2})(\d{2})(\d{4})$/);
      
      if (dateMatch) {
        const [, month, day, year] = dateMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        // Validate the date is reasonable
        if (date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
          return date;
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate that an RFA folder has expected content (basic validation)
   * @param {string} rfaPath - Path to RFA folder
   * @returns {Promise<boolean>} True if folder appears to be a valid RFA folder
   */
  async validateRFAFolderContent(rfaPath) {
    try {
      // Check if the folder exists and is readable
      await fs.access(rfaPath);
      
      // Check for typical RFA folder structure
      const contents = await fs.readdir(rfaPath);
      
      // Look for common folders/files that indicate a valid RFA
      const hasAgentFiles = contents.some(item => item.includes('Agent Files'));
      const hasRequestOutput = contents.some(item => item.includes('Request Output'));
      const hasBOMCheck = contents.some(item => item.includes('BOM CHECK'));
      
      // RFA folder should have at least one of these
      const isValid = hasAgentFiles || hasRequestOutput || hasBOMCheck || contents.length > 0;
      
      console.log(`RevisionDetectionService: RFA validation for ${path.basename(rfaPath)}: ${isValid} (contents: ${contents.length} items)`);
      
      return isValid;

    } catch (error) {
      console.log(`RevisionDetectionService: RFA validation failed for ${rfaPath}:`, error.message);
      return false;
    }
  }

  /**
   * Sanitize national account field to remove Agile import pollution
   * @param {string} nationalAccount - Raw national account from form
   * @returns {string|null} Clean national account or null if invalid
   */
  sanitizeNationalAccount(nationalAccount) {
    if (!nationalAccount || typeof nationalAccount !== 'string') {
      return null;
    }

    let sanitized = nationalAccount.trim();
    
    // Remove common Agile import pollution patterns
    if (sanitized.match(/^(Last Updated:|Updated:|Created:)/i)) {
      console.log(`🧹 Removing nationalAccount pollution: "${sanitized}" → null`);
      return null;
    }
    
    // Remove date/time patterns that indicate pollution
    if (sanitized.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
      console.log(`🧹 Removing nationalAccount date pollution: "${sanitized}" → null`);
      return null;
    }
    
    // If it's just "Default" or empty, return null
    if (sanitized === 'Default' || sanitized === '') {
      return null;
    }
    
    console.log(`✅ Valid nationalAccount: "${sanitized}"`);
    return sanitized;
  }

  /**
   * Sanitize project name (implements HTA logic with enhanced Agile import handling)
   * Uses centralized INVALID_FILENAME_CHARS pattern for consistency
   * @param {string} projectName - Raw project name
   * @returns {string} Sanitized project name
   */
  sanitizeProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
      console.warn('RevisionDetectionService: Invalid project name, using fallback');
      return 'UNKNOWN PROJECT';
    }

    let sanitized = projectName;
    
    // Remove common Agile import pollution
    sanitized = sanitized.replace(/^Last Updated:\s*/i, ''); // Remove "Last Updated:" prefix
    sanitized = sanitized.replace(/^Updated:\s*/i, '');      // Remove "Updated:" prefix
    sanitized = sanitized.replace(/^Created:\s*/i, '');      // Remove "Created:" prefix
    
    // Remove date/time stamps that might be imported
    sanitized = sanitized.replace(/\d{1,2}\/\d{1,2}\/\d{4}.*$/g, ''); // Remove dates like "12/15/2024"
    sanitized = sanitized.replace(/\d{4}-\d{2}-\d{2}.*$/g, '');        // Remove dates like "2024-12-15"
    
    // Replace invalid Windows path characters (including parentheses)
    // Uses centralized pattern: \ / : * ? " < > | ( )
    sanitized = sanitized.replace(INVALID_FILENAME_CHARS, ' ');
    sanitized = sanitized.replace(/_/g, ' ');               // Replace underscores
    
    // Clean up multiple spaces and trim
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Convert to uppercase
    sanitized = sanitized.toUpperCase();
    
    // Validate result
    if (!sanitized || sanitized.length === 0) {
      console.warn('RevisionDetectionService: Project name became empty after sanitization, using fallback');
      return 'UNKNOWN PROJECT';
    }
    
    console.log(`RevisionDetectionService: Sanitized "${projectName}" → "${sanitized}"`);
    return sanitized;
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
