/**
 * BOMBulkImportService
 * Handles bulk import of BOM files from folder structures
 * 
 * - Scans folders for BOM CHECK directories
 * - Matches BOMs to existing projects by RFA number
 * - Supports retroactive import for historical projects
 */

const fs = require('fs-extra');
const path = require('path');
const BOMParserService = require('./BOMParserService');

class BOMBulkImportService {
  constructor(bomPersistenceService, projectPersistenceService) {
    this.bomPersistenceService = bomPersistenceService;
    this.projectPersistenceService = projectPersistenceService;
    this.bomParser = new BOMParserService();
  }

  /**
   * Scan a folder recursively for BOM CHECK directories
   * @param {string} rootFolder - Root folder to scan
   * @param {object} options - Scan options
   * @returns {object[]} Array of found BOM locations
   */
  async scanForBOMFiles(rootFolder, options = {}) {
    const {
      maxDepth = 5,
      includeSubfolders = true
    } = options;

    const results = [];

    try {
      await this.scanFolderRecursive(rootFolder, results, 0, maxDepth, includeSubfolders);
      console.log(`📂 Found ${results.length} BOM CHECK folders`);
      return results;
    } catch (error) {
      console.error('Error scanning for BOM files:', error);
      return [];
    }
  }

  /**
   * Recursive folder scanner
   */
  async scanFolderRecursive(folder, results, currentDepth, maxDepth, includeSubfolders) {
    if (currentDepth > maxDepth) return;

    try {
      const items = await fs.readdir(folder, { withFileTypes: true });

      for (const item of items) {
        if (!item.isDirectory()) continue;

        const itemPath = path.join(folder, item.name);

        // Check if this is a BOM CHECK folder
        if (item.name.toUpperCase() === 'BOM CHECK') {
          const bomFile = await this.bomParser.selectBOMFile(itemPath);
          if (bomFile) {
            // Extract RFA number from parent folder path
            const rfaNumber = this.bomParser.extractRFAFromPath(folder);
            
            results.push({
              bomCheckPath: itemPath,
              bomFile: bomFile,
              parentFolder: folder,
              folderName: path.basename(folder),
              rfaNumber: rfaNumber,
              hasMatch: false, // Will be updated during matching
              matchedProject: null
            });
          }
        } else if (includeSubfolders) {
          // Recurse into subfolders
          await this.scanFolderRecursive(itemPath, results, currentDepth + 1, maxDepth, includeSubfolders);
        }
      }
    } catch (error) {
      // Silently skip inaccessible folders
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        console.warn(`Warning scanning ${folder}:`, error.message);
      }
    }
  }

  /**
   * Match found BOMs to existing projects
   * @param {object[]} bomLocations - Array from scanForBOMFiles
   * @returns {object} Match results
   */
  async matchBOMsToProjects(bomLocations) {
    try {
      const projects = await this.projectPersistenceService.loadProjects();
      
      let matchedCount = 0;
      let unmatchedCount = 0;
      let alreadyHasBOM = 0;

      for (const bomLocation of bomLocations) {
        if (!bomLocation.rfaNumber) {
          unmatchedCount++;
          continue;
        }

        // Try to find matching project by RFA number
        const matchedProject = projects.find(p => {
          const projectRFA = this.normalizeRFANumber(p.rfaNumber);
          const bomRFA = this.normalizeRFANumber(bomLocation.rfaNumber);
          return projectRFA === bomRFA;
        });

        if (matchedProject) {
          bomLocation.hasMatch = true;
          bomLocation.matchedProject = {
            id: matchedProject.id,
            projectName: matchedProject.projectName,
            rfaNumber: matchedProject.rfaNumber,
            rfaStatus: matchedProject.rfaStatus,
            hasBOMData: !!(matchedProject.bomData && matchedProject.bomData.totalDevices > 0)
          };

          if (bomLocation.matchedProject.hasBOMData) {
            alreadyHasBOM++;
          } else {
            matchedCount++;
          }
        } else {
          unmatchedCount++;
        }
      }

      return {
        total: bomLocations.length,
        matched: matchedCount,
        alreadyHasBOM: alreadyHasBOM,
        unmatched: unmatchedCount,
        locations: bomLocations
      };
    } catch (error) {
      console.error('Error matching BOMs to projects:', error);
      return {
        total: bomLocations.length,
        matched: 0,
        alreadyHasBOM: 0,
        unmatched: bomLocations.length,
        locations: bomLocations,
        error: error.message
      };
    }
  }

  /**
   * Normalize RFA number for comparison
   * @param {string} rfaNumber - RFA number to normalize
   * @returns {string} Normalized RFA number
   */
  normalizeRFANumber(rfaNumber) {
    if (!rfaNumber) return '';
    // Remove common prefixes and normalize separators
    return rfaNumber
      .replace(/^RFA[#\-_\s]*/i, '')
      .replace(/[\s\-_]/g, '-')
      .toLowerCase()
      .trim();
  }

  /**
   * Import BOMs for matched projects
   * @param {object[]} bomLocations - Array with matched projects
   * @param {object} options - Import options
   * @returns {object} Import results
   */
  async importMatchedBOMs(bomLocations, options = {}) {
    const {
      skipExisting = true, // Skip projects that already have BOM data
      onProgress = null    // Progress callback: (current, total, status) => void
    } = options;

    const results = {
      success: [],
      skipped: [],
      failed: [],
      total: 0
    };

    // Filter to only matched locations
    const toImport = bomLocations.filter(loc => {
      if (!loc.hasMatch || !loc.matchedProject) return false;
      if (skipExisting && loc.matchedProject.hasBOMData) return false;
      return true;
    });

    results.total = toImport.length;

    for (let i = 0; i < toImport.length; i++) {
      const location = toImport[i];

      if (onProgress) {
        onProgress(i + 1, toImport.length, `Importing: ${location.matchedProject.projectName}`);
      }

      try {
        // Parse the BOM file
        const bomData = await this.bomParser.parse(location.bomFile);

        // Save to project
        const saveResult = await this.bomPersistenceService.saveBOMToProject(
          location.matchedProject.id,
          bomData
        );

        if (saveResult.success) {
          results.success.push({
            projectId: location.matchedProject.id,
            projectName: location.matchedProject.projectName,
            rfaNumber: location.matchedProject.rfaNumber,
            totalDevices: bomData.totalDevices,
            startupCost: bomData.startupCosts?.total || 0
          });
        } else {
          results.failed.push({
            projectId: location.matchedProject.id,
            projectName: location.matchedProject.projectName,
            error: saveResult.error
          });
        }
      } catch (error) {
        results.failed.push({
          projectId: location.matchedProject.id,
          projectName: location.matchedProject.projectName,
          error: error.message
        });
      }
    }

    // Count skipped
    results.skipped = bomLocations.filter(loc => 
      loc.hasMatch && loc.matchedProject?.hasBOMData && skipExisting
    ).map(loc => ({
      projectId: loc.matchedProject.id,
      projectName: loc.matchedProject.projectName,
      reason: 'Already has BOM data'
    }));

    console.log(`✅ Bulk import complete: ${results.success.length} imported, ${results.skipped.length} skipped, ${results.failed.length} failed`);

    return results;
  }

  /**
   * Preview bulk import (scan and match without importing)
   * @param {string} rootFolder - Root folder to scan
   * @param {object} options - Scan options
   * @returns {object} Preview results
   */
  async previewBulkImport(rootFolder, options = {}) {
    console.log(`🔍 Scanning folder: ${rootFolder}`);

    // Scan for BOM files
    const bomLocations = await this.scanForBOMFiles(rootFolder, options);

    if (bomLocations.length === 0) {
      return {
        success: false,
        message: 'No BOM CHECK folders found',
        locations: []
      };
    }

    // Match to projects
    const matchResults = await this.matchBOMsToProjects(bomLocations);

    return {
      success: true,
      message: `Found ${matchResults.total} BOM files, ${matchResults.matched} can be imported`,
      ...matchResults
    };
  }

  /**
   * Execute full bulk import process
   * @param {string} rootFolder - Root folder to scan
   * @param {object} options - Import options
   * @returns {object} Import results
   */
  async executeBulkImport(rootFolder, options = {}) {
    // Preview first
    const preview = await this.previewBulkImport(rootFolder, options);

    if (!preview.success || preview.matched === 0) {
      return {
        success: false,
        message: preview.message || 'No BOMs to import',
        preview: preview
      };
    }

    // Execute import
    const importResults = await this.importMatchedBOMs(preview.locations, options);

    return {
      success: importResults.success.length > 0,
      message: `Imported ${importResults.success.length} of ${preview.matched} BOMs`,
      preview: preview,
      import: importResults
    };
  }

  /**
   * Get import summary statistics
   * @param {object} importResults - Results from importMatchedBOMs
   * @returns {object} Summary stats
   */
  getImportSummary(importResults) {
    const totalDevices = importResults.success.reduce((sum, r) => sum + (r.totalDevices || 0), 0);
    const totalStartupCost = importResults.success.reduce((sum, r) => sum + (r.startupCost || 0), 0);

    return {
      projectsImported: importResults.success.length,
      projectsSkipped: importResults.skipped.length,
      projectsFailed: importResults.failed.length,
      totalDevicesImported: totalDevices,
      totalStartupCostImported: totalStartupCost,
      averageDevicesPerProject: importResults.success.length > 0 ? 
        Math.round(totalDevices / importResults.success.length) : 0
    };
  }
}

module.exports = BOMBulkImportService;
