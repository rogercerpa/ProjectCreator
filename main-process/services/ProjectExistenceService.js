const fs = require('fs-extra');
const path = require('path');

/**
 * ProjectExistenceService - Service for checking existing projects on server
 * 
 * This service handles:
 * - Server connectivity validation with timeout and retry logic
 * - Multi-year folder checking (current, previous, second year folders)
 * - Duplicate project detection with user prompts and conflict resolution
 * - Project folder existence validation
 * - Server path resolution and validation
 */
class ProjectExistenceService {
  constructor() {
    this.pathResolver = null; // Will be initialized lazily to avoid circular dependencies
    this.connectivityCache = new Map(); // Cache for server connectivity results
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes cache timeout
    this.connectionTimeout = 10000; // 10 seconds connection timeout
    this.maxRetries = 3; // Maximum retry attempts for server operations
    
    // Server configuration (based on HTA logic)
    this.serverConfig = {
      baseServerPath: '\\\\10.3.10.30\\DAS',
      regionalTeams: {
        'Desktop Emergency Use only': { serverPath: null, useLocal: true },
        'All': { serverPath: '\\\\10.3.10.30\\DAS', useLocal: false },
        'NAVS': { serverPath: '\\\\10.3.10.30\\DAS', useLocal: false },
        'C&I': { serverPath: '\\\\10.3.10.30\\DAS', useLocal: false }
      }
    };
  }

  /**
   * Initialize path resolver (lazy loading to avoid circular dependencies)
   */
  async getPathResolver() {
    if (!this.pathResolver) {
      const PathResolutionService = require('./PathResolutionService');
      this.pathResolver = new PathResolutionService();
    }
    return this.pathResolver;
  }

  /**
   * Check if a project already exists on the server
   * @param {Object} projectData - Project data including name, container, etc.
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Object>} Existence check result with details
   */
  async checkProjectExistence(projectData, useCache = true) {
    try {
      console.log('ProjectExistenceService: Checking project existence for:', projectData.projectName);
      
      // Check cache first
      const cacheKey = `${projectData.projectName}_${projectData.projectContainer}_${projectData.regionalTeam || 'Default'}`;
      if (useCache && this.connectivityCache.has(cacheKey)) {
        const cached = this.connectivityCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('ProjectExistenceService: Using cached result for', cacheKey);
          return cached.result;
        }
      }

      const pathResolver = await this.getPathResolver();
      
      // Get project year from container
      const projectYear = this.getProjectYear(projectData.projectContainer);
      const currentYear = new Date().getFullYear();
      
      // Sanitize project name
      const sanitizedName = this.sanitizeProjectName(projectData.projectName);
      const firstLetter = this.getFirstLetter(sanitizedName);
      
      // Check multiple year folders (current, previous, second year)
      const yearChecks = await this.checkMultipleYearFolders(
        projectData, 
        projectYear, 
        currentYear, 
        firstLetter
      );
      
      // Check for duplicate projects
      const duplicateCheck = await this.checkForDuplicates(
        projectData,
        yearChecks,
        firstLetter
      );
      
      const result = {
        success: true,
        projectName: projectData.projectName,
        projectContainer: projectData.projectContainer,
        exists: duplicateCheck.exists,
        existingPaths: duplicateCheck.existingPaths,
        yearChecks: yearChecks,
        duplicateInfo: duplicateCheck.duplicateInfo,
        recommendations: this.generateRecommendations(duplicateCheck, yearChecks),
        errors: [],
        warnings: []
      };

      // Cache the result
      if (useCache) {
        this.connectivityCache.set(cacheKey, {
          result: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      console.error('ProjectExistenceService: Error checking project existence:', error);
      return {
        success: false,
        projectName: projectData.projectName,
        projectContainer: projectData.projectContainer,
        exists: false,
        existingPaths: [],
        yearChecks: {},
        duplicateInfo: null,
        recommendations: [],
        errors: [`Project existence check failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Check multiple year folders for project existence
   */
  async checkMultipleYearFolders(projectData, projectYear, currentYear, firstLetter) {
    const yearDiff = projectYear - currentYear;
    const results = {
      current: null,
      previous: null,
      second: null,
      projectYear: projectYear,
      yearDiff: yearDiff
    };

    try {
      // Check current year folder
      const currentYearPath = await this.buildServerPath(currentYear, firstLetter, projectData);
      results.current = await this.checkFolderExists(currentYearPath, projectData);

      // Check previous year folder
      const prevYearPath = await this.buildServerPath(currentYear - 1, firstLetter, projectData);
      results.previous = await this.checkFolderExists(prevYearPath, projectData);

      // Check second year folder
      const secondYearPath = await this.buildServerPath(currentYear - 2, firstLetter, projectData);
      results.second = await this.checkFolderExists(secondYearPath, projectData);

    } catch (error) {
      console.error('ProjectExistenceService: Error checking year folders:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Check for duplicate projects across all year folders
   */
  async checkForDuplicates(projectData, yearChecks, firstLetter) {
    const existingPaths = [];
    const duplicateInfo = {
      hasDuplicates: false,
      duplicateCount: 0,
      duplicatePaths: [],
      suggestedAction: null
    };

    // Check all year folders for existing projects
    const yearFolders = [
      { year: 'current', check: yearChecks.current },
      { year: 'previous', check: yearChecks.previous },
      { year: 'second', check: yearChecks.second }
    ];

    for (const folder of yearFolders) {
      if (folder.check && folder.check.exists) {
        existingPaths.push({
          year: folder.year,
          path: folder.check.path,
          projectPath: folder.check.projectPath,
          rfaFolders: folder.check.rfaFolders || []
        });
      }
    }

    if (existingPaths.length > 0) {
      duplicateInfo.hasDuplicates = true;
      duplicateInfo.duplicateCount = existingPaths.length;
      duplicateInfo.duplicatePaths = existingPaths.map(p => p.projectPath);
      
      // Determine suggested action based on HTA logic
      if (existingPaths.length === 1) {
        duplicateInfo.suggestedAction = 'revision';
      } else {
        duplicateInfo.suggestedAction = 'manual_selection';
      }
    }

    return {
      exists: duplicateInfo.hasDuplicates,
      existingPaths: existingPaths,
      duplicateInfo: duplicateInfo
    };
  }

  /**
   * Check if a specific folder exists on the server
   */
  async checkFolderExists(serverPath, projectData) {
    try {
      if (!serverPath) {
        return {
          exists: false,
          path: null,
          projectPath: null,
          error: 'No server path provided'
        };
      }

      // Test server connectivity first
      const connectivity = await this.testServerConnectivity(serverPath);
      if (!connectivity.connected) {
        return {
          exists: false,
          path: serverPath,
          projectPath: null,
          error: `Server connectivity failed: ${connectivity.error}`,
          connectivity: connectivity
        };
      }

      // Build project folder path
      const projectFolderName = `${this.sanitizeProjectName(projectData.projectName)}_${projectData.projectContainer}`;
      const projectPath = path.join(serverPath, projectFolderName);

      // Check if project folder exists
      const exists = await fs.pathExists(projectPath);
      if (!exists) {
        return {
          exists: false,
          path: serverPath,
          projectPath: projectPath,
          connectivity: connectivity
        };
      }

      // Check for RFA folders within the project
      const rfaFolders = await this.findRFAFolders(projectPath);

      return {
        exists: true,
        path: serverPath,
        projectPath: projectPath,
        rfaFolders: rfaFolders,
        connectivity: connectivity
      };

    } catch (error) {
      console.error('ProjectExistenceService: Error checking folder existence:', error);
      return {
        exists: false,
        path: serverPath,
        projectPath: null,
        error: error.message
      };
    }
  }

  /**
   * Test server connectivity with timeout and retry logic
   */
  async testServerConnectivity(serverPath, retryCount = 0) {
    try {
      if (!serverPath) {
        return {
          connected: false,
          error: 'No server path provided',
          retryCount: retryCount
        };
      }

      // Check if server path is accessible
      const exists = await this.withTimeout(
        fs.pathExists(serverPath),
        this.connectionTimeout
      );

      if (!exists) {
        throw new Error('Server path does not exist');
      }

      // Try to read directory to test permissions
      await this.withTimeout(
        fs.readdir(serverPath),
        this.connectionTimeout
      );

      return {
        connected: true,
        error: null,
        retryCount: retryCount,
        serverPath: serverPath
      };

    } catch (error) {
      console.warn(`ProjectExistenceService: Server connectivity test failed (attempt ${retryCount + 1}):`, error.message);
      
      // Retry if we haven't exceeded max retries
      if (retryCount < this.maxRetries) {
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.testServerConnectivity(serverPath, retryCount + 1);
      }

      return {
        connected: false,
        error: error.message,
        retryCount: retryCount + 1,
        serverPath: serverPath
      };
    }
  }

  /**
   * Build server path for a specific year
   */
  async buildServerPath(year, firstLetter, projectData) {
    const regionalTeam = projectData.regionalTeam || 'All';
    const teamConfig = this.serverConfig.regionalTeams[regionalTeam];
    
    if (!teamConfig || teamConfig.useLocal) {
      return null; // Use local storage
    }

    const basePath = teamConfig.serverPath || this.serverConfig.baseServerPath;
    const yearPath = path.join(basePath, `${year} Projects`, firstLetter);
    
    // Add National Account subfolder if specified
    if (projectData.nationalAccount && 
        projectData.nationalAccount !== 'Default' && 
        projectData.nationalAccount !== 'N/A') {
      return path.join(yearPath, projectData.nationalAccount);
    }
    
    return yearPath;
  }

  /**
   * Find RFA folders within a project directory
   */
  async findRFAFolders(projectPath) {
    try {
      const items = await fs.readdir(projectPath);
      const rfaFolders = [];

      for (const item of items) {
        const itemPath = path.join(projectPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory() && item.includes('RFA#')) {
          rfaFolders.push({
            name: item,
            path: itemPath,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }

      return rfaFolders.sort((a, b) => b.modified - a.modified); // Sort by modification date, newest first

    } catch (error) {
      console.error('ProjectExistenceService: Error finding RFA folders:', error);
      return [];
    }
  }

  /**
   * Generate recommendations based on existence check results
   */
  generateRecommendations(duplicateCheck, yearChecks) {
    const recommendations = [];

    if (duplicateCheck.exists) {
      if (duplicateCheck.duplicateInfo.suggestedAction === 'revision') {
        recommendations.push({
          type: 'suggestion',
          message: 'Project already exists. Consider creating a revision instead.',
          action: 'switch_to_revision',
          priority: 'high'
        });
      } else if (duplicateCheck.duplicateInfo.suggestedAction === 'manual_selection') {
        recommendations.push({
          type: 'warning',
          message: 'Multiple existing projects found. Manual selection may be required.',
          action: 'manual_selection',
          priority: 'medium'
        });
      }
    }

    // Check for connectivity issues
    const connectivityIssues = [];
    if (yearChecks.current && yearChecks.current.connectivity && !yearChecks.current.connectivity.connected) {
      connectivityIssues.push('Current year folder');
    }
    if (yearChecks.previous && yearChecks.previous.connectivity && !yearChecks.previous.connectivity.connected) {
      connectivityIssues.push('Previous year folder');
    }
    if (yearChecks.second && yearChecks.second.connectivity && !yearChecks.second.connectivity.connected) {
      connectivityIssues.push('Second year folder');
    }

    if (connectivityIssues.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `Server connectivity issues detected for: ${connectivityIssues.join(', ')}`,
        action: 'check_connectivity',
        priority: 'medium'
      });
    }

    return recommendations;
  }

  /**
   * Get project year from container number
   */
  getProjectYear(projectContainer) {
    if (!projectContainer) return new Date().getFullYear();
    
    const yearPart = projectContainer.substring(0, 2);
    return parseInt(`20${yearPart}`);
  }

  /**
   * Sanitize project name (same logic as HTA)
   */
  sanitizeProjectName(projectName) {
    if (!projectName) return '';
    
    return projectName
      .replace(/[\\/:_]/g, ' ') // Replace \, /, :, _ with spaces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .toUpperCase();
  }

  /**
   * Get first letter for folder organization
   */
  getFirstLetter(projectName) {
    if (!projectName) return '#';
    
    const firstChar = projectName.charAt(0);
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  }

  /**
   * Execute a promise with timeout
   */
  async withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Delay execution for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear connectivity cache
   */
  clearCache() {
    this.connectivityCache.clear();
    console.log('ProjectExistenceService: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.connectivityCache.values())
      .filter(entry => now - entry.timestamp < this.cacheTimeout);
    
    return {
      totalEntries: this.connectivityCache.size,
      validEntries: validEntries.length,
      expiredEntries: this.connectivityCache.size - validEntries.length
    };
  }

  /**
   * Validate server configuration
   */
  validateServerConfig() {
    const issues = [];

    for (const [team, config] of Object.entries(this.serverConfig.regionalTeams)) {
      if (!config.useLocal && !config.serverPath) {
        issues.push(`Missing server path for team: ${team}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }
}

module.exports = ProjectExistenceService;
