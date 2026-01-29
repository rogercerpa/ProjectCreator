const fs = require('fs-extra');
const path = require('path');
const { sanitizeProjectName: sanitizeProjectNameUtil } = require('./FileUtils');

/**
 * DASSearchService - Smart search for projects on the DAS Drive
 * 
 * Supports searching by:
 * - Project container number (e.g., "24-16071") -> derives year folder
 * - RFA number (e.g., "12345-0" or "RFA#12345-1") -> searches RFA subfolders
 * - Project name (e.g., "YOKOTA B118") -> derives letter folder
 * 
 * DAS Drive Structure:
 * Z:\{YYYY} Projects\{Letter}\{ProjectName}_{Container}
 *                            \RFA#{RFA}_{Type}_{Date}
 */
class DASSearchService {
  constructor() {
    // DAS Drive paths - try both mapped drive and UNC path
    this.dasDrivePaths = ['Z:', '\\\\10.3.10.30\\DAS'];
    this.activeDasPath = null;
    
    // Regex patterns for input detection
    this.patterns = {
      // Container: ##-##### (e.g., 24-16071, 26-12345)
      container: /^(\d{2})-(\d{4,6})$/,
      // RFA Number: #####-# or RFA#####-# (e.g., 12345-0, RFA#12345-1, RFA#12345)
      rfaNumber: /^(?:RFA#?)?(\d{4,6})(?:-(\d+))?$/i,
      // RFA folder pattern: RFA#?\d+-\d+_
      rfaFolder: /^RFA#?(\d+)-(\d+)_/i
    };
  }

  /**
   * Find the accessible DAS Drive path
   * @returns {Promise<string|null>} Accessible path or null
   */
  async findAccessibleDasPath() {
    if (this.activeDasPath) {
      // Verify it's still accessible
      try {
        await fs.access(this.activeDasPath);
        return this.activeDasPath;
      } catch {
        this.activeDasPath = null;
      }
    }

    for (const dasPath of this.dasDrivePaths) {
      try {
        await fs.access(dasPath);
        this.activeDasPath = dasPath;
        console.log(`[DASSearch] Using DAS path: ${dasPath}`);
        return dasPath;
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Detect the type of search input
   * @param {string} input - User search input
   * @returns {Object} Detection result with type and parsed values
   */
  detectInputType(input) {
    if (!input || typeof input !== 'string') {
      return { type: 'invalid', input };
    }

    const trimmed = input.trim();

    // Check for container pattern (##-#####)
    const containerMatch = trimmed.match(this.patterns.container);
    if (containerMatch) {
      const yearPrefix = containerMatch[1];
      const fullYear = `20${yearPrefix}`;
      return {
        type: 'container',
        input: trimmed,
        yearPrefix,
        fullYear,
        containerNumber: trimmed
      };
    }

    // Check for RFA number pattern
    const rfaMatch = trimmed.match(this.patterns.rfaNumber);
    if (rfaMatch) {
      return {
        type: 'rfa',
        input: trimmed,
        rfaBase: rfaMatch[1],
        rfaRevision: rfaMatch[2] || null,
        rfaNumber: rfaMatch[2] ? `${rfaMatch[1]}-${rfaMatch[2]}` : rfaMatch[1]
      };
    }

    // Default to project name search
    return {
      type: 'projectName',
      input: trimmed,
      sanitizedName: this.sanitizeProjectName(trimmed),
      firstLetter: this.getFirstLetter(trimmed)
    };
  }

  /**
   * Sanitize project name for folder matching
   * @param {string} projectName - Project name
   * @returns {string} Sanitized name (uppercase)
   */
  sanitizeProjectName(projectName) {
    return sanitizeProjectNameUtil(projectName);
  }

  /**
   * Get first letter for folder search
   * @param {string} projectName - Project name
   * @returns {string} First letter (A-Z) or '#' for numeric
   */
  getFirstLetter(projectName) {
    const sanitized = this.sanitizeProjectName(projectName);
    const firstChar = sanitized.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  }

  /**
   * Get year from container number
   * @param {string} container - Container number (e.g., "24-16071")
   * @returns {string} Full year (e.g., "2024")
   */
  getYearFromContainer(container) {
    if (!container || container.length < 2) return null;
    const yearPrefix = container.substring(0, 2);
    return `20${yearPrefix}`;
  }

  /**
   * Get available year folders on DAS Drive
   * @returns {Promise<Array>} Array of year folder info
   */
  async getAvailableYearFolders() {
    const dasPath = await this.findAccessibleDasPath();
    if (!dasPath) return [];

    try {
      const entries = await fs.readdir(dasPath, { withFileTypes: true });
      const yearFolders = entries
        .filter(entry => entry.isDirectory() && /^\d{4} Projects$/.test(entry.name))
        .map(entry => ({
          name: entry.name,
          year: entry.name.substring(0, 4),
          path: path.join(dasPath, entry.name)
        }))
        .sort((a, b) => b.year - a.year); // Most recent first

      return yearFolders;
    } catch (error) {
      console.error('[DASSearch] Error getting year folders:', error);
      return [];
    }
  }

  /**
   * Search for projects by container number
   * @param {Object} detection - Detection result from detectInputType
   * @returns {Promise<Array>} Array of matching project folders
   */
  async searchByContainer(detection) {
    const results = [];
    const dasPath = await this.findAccessibleDasPath();
    if (!dasPath) {
      return { success: false, error: 'DAS Drive not accessible', results: [] };
    }

    const yearFolder = `${detection.fullYear} Projects`;
    const yearPath = path.join(dasPath, yearFolder);

    // Check if year folder exists
    if (!await fs.pathExists(yearPath)) {
      return { 
        success: true, 
        results: [], 
        message: `Year folder "${yearFolder}" not found on DAS Drive` 
      };
    }

    try {
      // Get all letter folders
      const letterFolders = await fs.readdir(yearPath, { withFileTypes: true });
      
      for (const letterFolder of letterFolders) {
        if (!letterFolder.isDirectory()) continue;

        const letterPath = path.join(yearPath, letterFolder.name);
        const projectFolders = await fs.readdir(letterPath, { withFileTypes: true });

        for (const projectFolder of projectFolders) {
          if (!projectFolder.isDirectory()) continue;

          // Check if folder name contains the container number
          if (projectFolder.name.includes(`_${detection.containerNumber}`) ||
              projectFolder.name.includes(` _${detection.containerNumber}`)) {
            
            const fullPath = path.join(letterPath, projectFolder.name);
            const stats = await fs.stat(fullPath);
            
            results.push({
              type: 'project',
              name: projectFolder.name,
              path: fullPath,
              year: detection.fullYear,
              letter: letterFolder.name,
              container: detection.containerNumber,
              created: stats.birthtime,
              modified: stats.mtime,
              matchedBy: 'container'
            });
          }
        }
      }

      return { success: true, results, searchedYear: detection.fullYear };
    } catch (error) {
      console.error('[DASSearch] Error searching by container:', error);
      return { success: false, error: error.message, results: [] };
    }
  }

  /**
   * Search for projects by RFA number
   * @param {Object} detection - Detection result from detectInputType
   * @param {number} yearLimit - How many years back to search (default: 3)
   * @returns {Promise<Object>} Search results
   */
  async searchByRFA(detection, yearLimit = 3) {
    const results = [];
    const dasPath = await this.findAccessibleDasPath();
    if (!dasPath) {
      return { success: false, error: 'DAS Drive not accessible', results: [] };
    }

    const yearFolders = await this.getAvailableYearFolders();
    const yearsToSearch = yearFolders.slice(0, yearLimit);

    for (const yearInfo of yearsToSearch) {
      try {
        const letterFolders = await fs.readdir(yearInfo.path, { withFileTypes: true });

        for (const letterFolder of letterFolders) {
          if (!letterFolder.isDirectory()) continue;

          const letterPath = path.join(yearInfo.path, letterFolder.name);
          
          // Handle potential national account subfolders
          const subFolders = await fs.readdir(letterPath, { withFileTypes: true });

          for (const subFolder of subFolders) {
            if (!subFolder.isDirectory()) continue;

            const subFolderPath = path.join(letterPath, subFolder.name);
            
            // Check if this is a project folder or national account folder
            await this.searchRFAInFolder(subFolderPath, detection, results, yearInfo, letterFolder.name);
          }
        }
      } catch (error) {
        console.warn(`[DASSearch] Error searching year ${yearInfo.year}:`, error.message);
        continue;
      }
    }

    return { success: true, results, searchedYears: yearsToSearch.map(y => y.year) };
  }

  /**
   * Search for RFA folders within a project folder
   * @param {string} folderPath - Path to search in
   * @param {Object} detection - RFA detection info
   * @param {Array} results - Results array to populate
   * @param {Object} yearInfo - Year folder info
   * @param {string} letter - Letter folder name
   */
  async searchRFAInFolder(folderPath, detection, results, yearInfo, letter) {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Check if this is an RFA folder matching our search
        const rfaMatch = entry.name.match(this.patterns.rfaFolder);
        if (rfaMatch) {
          const rfaBase = rfaMatch[1];
          const rfaRev = rfaMatch[2];

          // Check if matches our search criteria
          if (rfaBase === detection.rfaBase) {
            if (!detection.rfaRevision || rfaRev === detection.rfaRevision) {
              const rfaPath = path.join(folderPath, entry.name);
              const stats = await fs.stat(rfaPath);
              
              // Get parent project folder name
              const projectFolderName = path.basename(folderPath);
              
              results.push({
                type: 'rfa',
                name: entry.name,
                path: rfaPath,
                projectFolder: projectFolderName,
                projectPath: folderPath,
                year: yearInfo.year,
                letter: letter,
                rfaNumber: `${rfaBase}-${rfaRev}`,
                created: stats.birthtime,
                modified: stats.mtime,
                matchedBy: 'rfa'
              });
            }
          }
        }
        
        // Also recursively check subfolders (for national account structure)
        if (!rfaMatch) {
          // This might be a project folder, check for RFA folders inside
          const subPath = path.join(folderPath, entry.name);
          try {
            const subEntries = await fs.readdir(subPath, { withFileTypes: true });
            for (const subEntry of subEntries) {
              if (subEntry.isDirectory()) {
                const subRfaMatch = subEntry.name.match(this.patterns.rfaFolder);
                if (subRfaMatch && subRfaMatch[1] === detection.rfaBase) {
                  if (!detection.rfaRevision || subRfaMatch[2] === detection.rfaRevision) {
                    const rfaPath = path.join(subPath, subEntry.name);
                    const stats = await fs.stat(rfaPath);
                    
                    results.push({
                      type: 'rfa',
                      name: subEntry.name,
                      path: rfaPath,
                      projectFolder: entry.name,
                      projectPath: subPath,
                      year: yearInfo.year,
                      letter: letter,
                      rfaNumber: `${subRfaMatch[1]}-${subRfaMatch[2]}`,
                      created: stats.birthtime,
                      modified: stats.mtime,
                      matchedBy: 'rfa'
                    });
                  }
                }
              }
            }
          } catch {
            // Ignore access errors on subfolders
          }
        }
      }
    } catch (error) {
      // Ignore access errors
    }
  }

  /**
   * Search for projects by project name
   * @param {Object} detection - Detection result from detectInputType
   * @param {number} yearLimit - How many years back to search (default: 3)
   * @returns {Promise<Object>} Search results
   */
  async searchByProjectName(detection, yearLimit = 3) {
    const results = [];
    const dasPath = await this.findAccessibleDasPath();
    if (!dasPath) {
      return { success: false, error: 'DAS Drive not accessible', results: [] };
    }

    const yearFolders = await this.getAvailableYearFolders();
    const yearsToSearch = yearFolders.slice(0, yearLimit);
    const searchTerm = detection.sanitizedName.toUpperCase();

    for (const yearInfo of yearsToSearch) {
      // Start with the most likely letter folder
      const primaryLetter = detection.firstLetter;
      const letterPath = path.join(yearInfo.path, primaryLetter);

      if (await fs.pathExists(letterPath)) {
        await this.searchProjectNameInLetter(letterPath, searchTerm, results, yearInfo, primaryLetter);
      }

      // Also search '#' folder if the primary letter is a number
      if (primaryLetter === '#') {
        // Already searched
      } else {
        // For broader searches, optionally search all letter folders
        // This is commented out for performance - enable if needed
        // const letterFolders = await fs.readdir(yearInfo.path, { withFileTypes: true });
        // for (const letterFolder of letterFolders) { ... }
      }
    }

    return { success: true, results, searchedYears: yearsToSearch.map(y => y.year) };
  }

  /**
   * Search for projects within a letter folder
   * @param {string} letterPath - Path to letter folder
   * @param {string} searchTerm - Uppercase search term
   * @param {Array} results - Results array to populate
   * @param {Object} yearInfo - Year folder info
   * @param {string} letter - Letter folder name
   */
  async searchProjectNameInLetter(letterPath, searchTerm, results, yearInfo, letter) {
    try {
      const entries = await fs.readdir(letterPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const folderNameUpper = entry.name.toUpperCase();

        // Check if folder name contains the search term
        if (folderNameUpper.includes(searchTerm)) {
          const fullPath = path.join(letterPath, entry.name);
          const stats = await fs.stat(fullPath);

          // Extract container from folder name if present
          const containerMatch = entry.name.match(/_(\d{2}-\d{4,6})$/);
          const container = containerMatch ? containerMatch[1] : null;

          results.push({
            type: 'project',
            name: entry.name,
            path: fullPath,
            year: yearInfo.year,
            letter: letter,
            container: container,
            created: stats.birthtime,
            modified: stats.mtime,
            matchedBy: 'projectName'
          });
        }

        // Also check if this is a national account folder containing matching projects
        const subPath = path.join(letterPath, entry.name);
        try {
          const subEntries = await fs.readdir(subPath, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.isDirectory() && subEntry.name.toUpperCase().includes(searchTerm)) {
              const subFullPath = path.join(subPath, subEntry.name);
              const subStats = await fs.stat(subFullPath);
              const subContainerMatch = subEntry.name.match(/_(\d{2}-\d{4,6})$/);

              results.push({
                type: 'project',
                name: subEntry.name,
                path: subFullPath,
                year: yearInfo.year,
                letter: letter,
                nationalAccount: entry.name,
                container: subContainerMatch ? subContainerMatch[1] : null,
                created: subStats.birthtime,
                modified: subStats.mtime,
                matchedBy: 'projectName'
              });
            }
          }
        } catch {
          // Ignore access errors
        }
      }
    } catch (error) {
      console.warn(`[DASSearch] Error searching letter folder ${letter}:`, error.message);
    }
  }

  /**
   * Main search method - auto-detects input type and searches accordingly
   * @param {string} query - User search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    const { yearLimit = 3 } = options;

    if (!query || query.trim().length === 0) {
      return { 
        success: false, 
        error: 'Search query is required',
        results: [] 
      };
    }

    // Check DAS Drive accessibility
    const dasPath = await this.findAccessibleDasPath();
    if (!dasPath) {
      return {
        success: false,
        error: 'DAS Drive is not accessible. Please check your network connection and ensure the Z: drive is mapped.',
        results: []
      };
    }

    // Detect input type
    const detection = this.detectInputType(query);
    console.log(`[DASSearch] Search query: "${query}" detected as: ${detection.type}`);

    let searchResult;

    switch (detection.type) {
      case 'container':
        searchResult = await this.searchByContainer(detection);
        break;

      case 'rfa':
        searchResult = await this.searchByRFA(detection, yearLimit);
        break;

      case 'projectName':
        searchResult = await this.searchByProjectName(detection, yearLimit);
        break;

      default:
        return {
          success: false,
          error: 'Invalid search input',
          results: []
        };
    }

    // Add detection info to result
    return {
      ...searchResult,
      query,
      detectedType: detection.type,
      detection
    };
  }

  /**
   * Check if DAS Drive is accessible
   * @returns {Promise<Object>} Status object
   */
  async checkDriveStatus() {
    const dasPath = await this.findAccessibleDasPath();
    
    if (dasPath) {
      const yearFolders = await this.getAvailableYearFolders();
      return {
        accessible: true,
        path: dasPath,
        availableYears: yearFolders.map(y => y.year)
      };
    }

    return {
      accessible: false,
      error: 'DAS Drive is not accessible'
    };
  }
}

module.exports = DASSearchService;
