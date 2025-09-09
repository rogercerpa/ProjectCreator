const fs = require('fs-extra');
const path = require('path');

/**
 * RevisionDetectionService - Service for handling revision vs new project logic
 * 
 * This service handles:
 * - Revision detection logic based on RFA number and existing folders
 * - Previous project folder selection with validation
 * - Working document validation (.vsp, .dwg files) for revisions
 * - Revision-specific folder structure and file copying logic
 * - RFA number parsing and revision identification
 */
class RevisionDetectionService {
  constructor() {
    this.pathResolver = null; // Will be initialized lazily to avoid circular dependencies
    this.projectExistenceService = null; // Will be initialized lazily
    this.revisionCache = new Map(); // Cache for revision detection results
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
    
    // RFA number patterns for revision detection
    this.rfaPatterns = {
      // Standard pattern: RFA-REVISION (e.g., "12345-01", "67890-02")
      standard: /^(\d+)-(\d+)$/,
      // Alternative patterns that might be encountered
      alternative: /^(\d+)_(\d+)$/,
      // Legacy pattern: RFA.REVISION
      legacy: /^(\d+)\.(\d+)$/
    };

    // Working document file extensions (based on HTA logic)
    this.workingDocumentExtensions = ['.vsp', '.dwg'];
    
    // Required revision folders (based on HTA logic)
    this.requiredRevisionFolders = ['AE Markups', 'XREF', 'LCD'];
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
   * Initialize project existence service (lazy loading to avoid circular dependencies)
   */
  async getProjectExistenceService() {
    if (!this.projectExistenceService) {
      const ProjectExistenceService = require('./ProjectExistenceService');
      this.projectExistenceService = new ProjectExistenceService();
    }
    return this.projectExistenceService;
  }

  /**
   * Detect if a project should be treated as a revision
   * @param {Object} projectData - Project data including RFA number, name, etc.
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Object>} Revision detection result with recommendations
   */
  async detectRevision(projectData, useCache = true) {
    try {
      console.log('RevisionDetectionService: Detecting revision for RFA:', projectData.rfaNumber);
      
      // Check cache first
      const cacheKey = `${projectData.rfaNumber}_${projectData.projectName}_${projectData.projectContainer}`;
      if (useCache && this.revisionCache.has(cacheKey)) {
        const cached = this.revisionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          console.log('RevisionDetectionService: Using cached result for', cacheKey);
          return cached.result;
        }
      }

      // Parse RFA number to extract revision information
      const rfaInfo = this.parseRFANumber(projectData.rfaNumber);
      
      // Check for existing projects
      const existenceService = await this.getProjectExistenceService();
      const existenceCheck = await existenceService.checkProjectExistence(projectData, useCache);
      
      // Determine revision status
      const revisionStatus = this.determineRevisionStatus(rfaInfo, existenceCheck);
      
      // Find previous project folders if this is a revision
      let previousProjectInfo = null;
      if (revisionStatus.isRevision) {
        previousProjectInfo = await this.findPreviousProjectFolders(
          projectData, 
          existenceCheck, 
          rfaInfo
        );
      }

      const result = {
        success: true,
        rfaNumber: projectData.rfaNumber,
        isRevision: revisionStatus.isRevision,
        revisionNumber: rfaInfo.revisionNumber,
        baseRFANumber: rfaInfo.baseRFANumber,
        rfaInfo: rfaInfo,
        existenceCheck: existenceCheck,
        previousProjectInfo: previousProjectInfo,
        recommendations: this.generateRevisionRecommendations(revisionStatus, previousProjectInfo),
        errors: [],
        warnings: []
      };

      // Cache the result
      if (useCache) {
        this.revisionCache.set(cacheKey, {
          result: result,
          timestamp: Date.now()
        });
      }

      return result;

    } catch (error) {
      console.error('RevisionDetectionService: Error detecting revision:', error);
      return {
        success: false,
        rfaNumber: projectData.rfaNumber,
        isRevision: false,
        revisionNumber: null,
        baseRFANumber: null,
        rfaInfo: null,
        existenceCheck: null,
        previousProjectInfo: null,
        recommendations: [],
        errors: [`Revision detection failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Parse RFA number to extract revision information
   */
  parseRFANumber(rfaNumber) {
    if (!rfaNumber) {
      return {
        baseRFANumber: null,
        revisionNumber: null,
        isRevision: false,
        originalNumber: rfaNumber,
        parseError: 'No RFA number provided'
      };
    }

    // Try different patterns
    for (const [patternName, pattern] of Object.entries(this.rfaPatterns)) {
      const match = rfaNumber.match(pattern);
      if (match) {
        const baseNumber = match[1];
        const revisionNumber = parseInt(match[2]);
        const isRevision = revisionNumber > 0;

        return {
          baseRFANumber: baseNumber,
          revisionNumber: revisionNumber,
          isRevision: isRevision,
          originalNumber: rfaNumber,
          patternUsed: patternName,
          parseError: null
        };
      }
    }

    // If no pattern matches, treat as base RFA (revision 0)
    return {
      baseRFANumber: rfaNumber,
      revisionNumber: 0,
      isRevision: false,
      originalNumber: rfaNumber,
      patternUsed: 'none',
      parseError: 'No recognized RFA number pattern found'
    };
  }

  /**
   * Determine revision status based on RFA info and existence check
   */
  determineRevisionStatus(rfaInfo, existenceCheck) {
    const status = {
      isRevision: false,
      reason: null,
      confidence: 'low'
    };

    // Check if RFA number indicates revision
    if (rfaInfo.isRevision) {
      status.isRevision = true;
      status.reason = 'RFA number indicates revision';
      status.confidence = 'high';
      return status;
    }

    // Check if project already exists (suggests revision)
    if (existenceCheck.exists) {
      status.isRevision = true;
      status.reason = 'Project already exists on server';
      status.confidence = 'high';
      return status;
    }

    // Check for similar projects (lower confidence)
    if (existenceCheck.duplicateInfo && existenceCheck.duplicateInfo.hasDuplicates) {
      status.isRevision = true;
      status.reason = 'Similar projects found';
      status.confidence = 'medium';
      return status;
    }

    return status;
  }

  /**
   * Find previous project folders for revision workflow
   */
  async findPreviousProjectFolders(projectData, existenceCheck, rfaInfo) {
    try {
      const previousFolders = [];
      
      // Look through existing project paths
      for (const existingPath of existenceCheck.existingPaths) {
        const rfaFolders = existingPath.rfaFolders || [];
        
        // Find RFA folders that match the base RFA number
        const matchingRFAs = rfaFolders.filter(rfa => 
          rfa.name.includes(`RFA#${rfaInfo.baseRFANumber}`)
        );

        for (const rfaFolder of matchingRFAs) {
          // Validate working documents
          const workingDocs = await this.validateWorkingDocuments(rfaFolder.path);
          
          previousFolders.push({
            projectPath: existingPath.projectPath,
            rfaPath: rfaFolder.path,
            rfaName: rfaFolder.name,
            workingDocuments: workingDocs,
            created: rfaFolder.created,
            modified: rfaFolder.modified,
            validation: {
              hasWorkingDocs: workingDocs.validFiles.length > 0,
              hasRequiredFolders: workingDocs.requiredFolders.length > 0,
              isValid: workingDocs.validFiles.length > 0 || workingDocs.requiredFolders.length > 0
            }
          });
        }
      }

      // Sort by modification date (newest first)
      previousFolders.sort((a, b) => b.modified - a.modified);

      return {
        found: previousFolders.length > 0,
        folders: previousFolders,
        recommendedFolder: previousFolders.length > 0 ? previousFolders[0] : null,
        totalCount: previousFolders.length
      };

    } catch (error) {
      console.error('RevisionDetectionService: Error finding previous project folders:', error);
      return {
        found: false,
        folders: [],
        recommendedFolder: null,
        totalCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Validate working documents in a folder
   */
  async validateWorkingDocuments(folderPath) {
    try {
      const validFiles = [];
      const requiredFolders = [];
      const errors = [];

      // Check for working document files
      const items = await fs.readdir(folderPath);
      
      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (this.workingDocumentExtensions.includes(ext)) {
            validFiles.push({
              name: item,
              path: itemPath,
              extension: ext,
              size: stats.size,
              modified: stats.mtime
            });
          }
        } else if (stats.isDirectory()) {
          if (this.requiredRevisionFolders.includes(item)) {
            requiredFolders.push({
              name: item,
              path: itemPath,
              created: stats.birthtime,
              modified: stats.mtime
            });
          }
        }
      }

      return {
        validFiles: validFiles,
        requiredFolders: requiredFolders,
        errors: errors,
        isValid: validFiles.length > 0 || requiredFolders.length > 0
      };

    } catch (error) {
      console.error('RevisionDetectionService: Error validating working documents:', error);
      return {
        validFiles: [],
        requiredFolders: [],
        errors: [error.message],
        isValid: false
      };
    }
  }

  /**
   * Generate revision recommendations
   */
  generateRevisionRecommendations(revisionStatus, previousProjectInfo) {
    const recommendations = [];

    if (revisionStatus.isRevision) {
      if (revisionStatus.confidence === 'high') {
        recommendations.push({
          type: 'suggestion',
          message: 'This appears to be a revision. Consider using revision workflow.',
          action: 'use_revision_workflow',
          priority: 'high'
        });
      } else if (revisionStatus.confidence === 'medium') {
        recommendations.push({
          type: 'warning',
          message: 'Similar projects found. Verify if this should be a revision.',
          action: 'verify_revision_status',
          priority: 'medium'
        });
      }
    }

    if (previousProjectInfo && previousProjectInfo.found) {
      if (previousProjectInfo.recommendedFolder) {
        recommendations.push({
          type: 'info',
          message: `Found previous project folder: ${previousProjectInfo.recommendedFolder.rfaName}`,
          action: 'use_previous_folder',
          priority: 'medium',
          data: previousProjectInfo.recommendedFolder
        });
      }

      if (previousProjectInfo.totalCount > 1) {
        recommendations.push({
          type: 'warning',
          message: `Multiple previous folders found (${previousProjectInfo.totalCount}). Manual selection may be required.`,
          action: 'manual_folder_selection',
          priority: 'low'
        });
      }
    }

    return recommendations;
  }

  /**
   * Create revision-specific folder structure
   */
  async createRevisionStructure(projectData, previousProjectInfo, targetPath) {
    try {
      console.log('RevisionDetectionService: Creating revision structure');

      const revisionStructure = {
        success: false,
        createdFolders: [],
        copiedFiles: [],
        errors: [],
        warnings: []
      };

      // Create standard revision folders
      const standardFolders = ['!Agent Files', '!!Request Output'];
      
      for (const folder of standardFolders) {
        const folderPath = path.join(targetPath, folder);
        await fs.ensureDir(folderPath);
        revisionStructure.createdFolders.push(folderPath);
      }

      // Copy working documents from previous project if available
      if (previousProjectInfo && previousProjectInfo.recommendedFolder) {
        const sourcePath = previousProjectInfo.recommendedFolder.rfaPath;
        const workingDocs = previousProjectInfo.recommendedFolder.workingDocuments;

        // Copy working document files
        for (const file of workingDocs.validFiles) {
          try {
            const fileName = path.basename(file.path);
            const targetFilePath = path.join(targetPath, fileName);
            await fs.copyFile(file.path, targetFilePath);
            revisionStructure.copiedFiles.push({
              source: file.path,
              target: targetFilePath,
              name: fileName
            });
          } catch (error) {
            revisionStructure.warnings.push(`Failed to copy ${file.name}: ${error.message}`);
          }
        }

        // Copy required folders
        for (const folder of workingDocs.requiredFolders) {
          try {
            const folderName = path.basename(folder.path);
            const targetFolderPath = path.join(targetPath, folderName);
            await fs.copy(folder.path, targetFolderPath);
            revisionStructure.copiedFiles.push({
              source: folder.path,
              target: targetFolderPath,
              name: folderName,
              type: 'folder'
            });
          } catch (error) {
            revisionStructure.warnings.push(`Failed to copy folder ${folder.name}: ${error.message}`);
          }
        }
      }

      revisionStructure.success = true;
      return revisionStructure;

    } catch (error) {
      console.error('RevisionDetectionService: Error creating revision structure:', error);
      return {
        success: false,
        createdFolders: [],
        copiedFiles: [],
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Validate RFA number format
   */
  validateRFAFormat(rfaNumber) {
    const rfaInfo = this.parseRFANumber(rfaNumber);
    
    return {
      isValid: !rfaInfo.parseError,
      rfaInfo: rfaInfo,
      suggestions: rfaInfo.parseError ? this.getRFAFormatSuggestions(rfaNumber) : []
    };
  }

  /**
   * Get suggestions for RFA number format
   */
  getRFAFormatSuggestions(rfaNumber) {
    const suggestions = [];
    
    if (!rfaNumber) {
      suggestions.push('RFA number is required');
      return suggestions;
    }

    // Check for common format issues
    if (rfaNumber.includes('_')) {
      suggestions.push('Consider using dash (-) instead of underscore (_)');
    }
    
    if (rfaNumber.includes('.')) {
      suggestions.push('Consider using dash (-) instead of period (.)');
    }

    if (!rfaNumber.includes('-') && !rfaNumber.includes('_') && !rfaNumber.includes('.')) {
      suggestions.push('RFA number should include revision number (e.g., 12345-01)');
    }

    return suggestions;
  }

  /**
   * Clear revision cache
   */
  clearCache() {
    this.revisionCache.clear();
    console.log('RevisionDetectionService: Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.revisionCache.values())
      .filter(entry => now - entry.timestamp < this.cacheTimeout);
    
    return {
      totalEntries: this.revisionCache.size,
      validEntries: validEntries.length,
      expiredEntries: this.revisionCache.size - validEntries.length
    };
  }
}

module.exports = RevisionDetectionService;
