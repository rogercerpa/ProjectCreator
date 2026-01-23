const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const extract = require('extract-zip');
const { sanitizeProjectName: sanitizeProjectNameUtil, sanitizeForFilename } = require('./FileUtils');

/**
 * ReadyForQCService - Handles scanning, matching, and downloading zip files from Ready for QC folder
 */
class ReadyForQCService {
  constructor() {
    // OneDrive SharePoint Ready for QC folder path
    // Note: This path is user-specific and should be configurable in the future
    this.readyForQCFolderPath = path.join(
      os.homedir(),
      'OneDrive - Acuity Brands, Inc',
      'C&I Design Solutions - LnT',
      'Ready for QC'
    );
    
    this.projectPersistenceService = null; // Will be injected
  }

  /**
   * Set project persistence service (dependency injection)
   * @param {ProjectPersistenceService} service - Project persistence service instance
   */
  setProjectPersistenceService(service) {
    this.projectPersistenceService = service;
  }

  /**
   * Sanitize project name (uses centralized utility for consistency)
   * @param {string} projectName - Project name
   * @returns {string} Sanitized project name
   */
  sanitizeProjectName(projectName) {
    return sanitizeProjectNameUtil(projectName);
  }

  /**
   * Get expected project folder name from project data
   * Format: {sanitizedProjectName}_{projectContainer} or {sanitizedProjectName} _{projectContainer}
   * @param {Object} project - Project data
   * @returns {Array<string>} Array of possible folder name variations
   */
  getProjectFolderName(project) {
    if (!project.projectName || !project.projectContainer) {
      return null;
    }
    const sanitizedName = this.sanitizeProjectName(project.projectName);
    // Return both variations: with and without space before underscore
    return [
      `${sanitizedName}_${project.projectContainer}`,
      `${sanitizedName} _${project.projectContainer}`
    ];
  }

  /**
   * Calculate the date that is N business days ago (excluding weekends)
   * @param {number} businessDays - Number of business days to go back
   * @returns {Date} Date that is N business days ago
   */
  getBusinessDaysAgo(businessDays) {
    const date = new Date();
    let daysToSubtract = 0;
    let businessDaysCount = 0;

    while (businessDaysCount < businessDays) {
      daysToSubtract++;
      const checkDate = new Date(date);
      checkDate.setDate(date.getDate() - daysToSubtract);
      const dayOfWeek = checkDate.getDay();
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDaysCount++;
      }
    }

    const resultDate = new Date(date);
    resultDate.setDate(date.getDate() - daysToSubtract);
    resultDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
    return resultDate;
  }

  /**
   * Check if a date is within the last N business days
   * @param {Date} fileDate - File modification date
   * @param {number} businessDays - Number of business days to check
   * @returns {boolean} True if file is within the last N business days
   */
  isWithinBusinessDays(fileDate, businessDays = 5) {
    const cutoffDate = this.getBusinessDaysAgo(businessDays);
    const fileDateOnly = new Date(fileDate);
    fileDateOnly.setHours(0, 0, 0, 0);
    return fileDateOnly >= cutoffDate;
  }

  /**
   * Scan the Ready for QC folder for zip files
   * Only includes zip files modified within the last 5 business days
   * @returns {Promise<Array>} Array of zip file info objects
   */
  async scanReadyForQCFolder() {
    try {
      // Check if folder exists
      if (!await fs.pathExists(this.readyForQCFolderPath)) {
        console.warn(`Ready for QC folder does not exist: ${this.readyForQCFolderPath}`);
        return [];
      }

      // Read directory contents
      const files = await fs.readdir(this.readyForQCFolderPath);
      const zipFiles = [];
      const cutoffDate = this.getBusinessDaysAgo(5);
      const cutoffDateStr = cutoffDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

      console.log(`[ReadyForQC] Scanning for zip files modified after ${cutoffDateStr} (5 business days ago)`);

      for (const file of files) {
        const filePath = path.join(this.readyForQCFolderPath, file);
        const stats = await fs.stat(filePath);

        // Check if it's a zip file
        if (stats.isFile() && file.toLowerCase().endsWith('.zip')) {
          const modifiedDate = stats.mtime;
          const isRecent = this.isWithinBusinessDays(modifiedDate, 5);

          if (isRecent) {
            zipFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
              modifiedDate: modifiedDate,
              // Remove .zip extension for matching
              nameWithoutExtension: file.replace(/\.zip$/i, '')
            });
          } else {
            const fileDateStr = modifiedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            console.log(`[ReadyForQC] Skipping old zip file "${file}" (modified: ${fileDateStr}, cutoff: ${cutoffDateStr})`);
          }
        }
      }

      console.log(`[ReadyForQC] Found ${zipFiles.length} recent zip files (within 5 business days) out of ${files.filter(f => f.toLowerCase().endsWith('.zip')).length} total zip files`);
      return zipFiles;

    } catch (error) {
      console.error('Error scanning Ready for QC folder:', error);
      throw error;
    }
  }

  /**
   * Match zip files with projects based on folder naming convention
   * @param {Array} projects - Array of project objects
   * @returns {Promise<Object>} Object mapping project IDs to matching zip files
   */
  async matchProjectsWithZipFiles(projects) {
    try {
      const zipFiles = await this.scanReadyForQCFolder();
      const matches = {};

      console.log(`[ReadyForQC] Scanning ${zipFiles.length} zip files against ${projects.length} projects`);
      
      // Log all zip files found for debugging
      if (zipFiles.length > 0) {
        console.log(`[ReadyForQC] Zip files found: ${zipFiles.map(z => z.nameWithoutExtension).join(', ')}`);
      } else {
        console.log(`[ReadyForQC] No zip files found in Ready for QC folder`);
      }

      for (const project of projects) {
        const projectFolderNames = this.getProjectFolderName(project);
        if (!projectFolderNames) {
          console.log(`[ReadyForQC] Skipping project ${project.id} (${project.projectName}): missing projectName or projectContainer`);
          continue;
        }

        // Find matching zip files (case-insensitive) - check both naming variations
        // IMPORTANT: Must be EXACT match, not partial
        const matchingZips = zipFiles.filter(zip => {
          // Verify zip file actually exists on disk
          if (!fs.existsSync(zip.path)) {
            console.warn(`[ReadyForQC] ⚠️ Zip file path does not exist: ${zip.path}`);
            return false;
          }

          const zipNameLower = zip.nameWithoutExtension.toLowerCase().trim();
          const isMatch = projectFolderNames.some(folderName => {
            const folderNameLower = folderName.toLowerCase().trim();
            // STRICT EXACT MATCH - no partial matching allowed
            const matches = folderNameLower === zipNameLower;
            if (matches) {
              console.log(`[ReadyForQC] ✓ MATCH FOUND: Project "${project.projectName}" (${project.projectContainer}) matches zip "${zip.name}"`);
              console.log(`[ReadyForQC]   Project ID: ${project.id}`);
              console.log(`[ReadyForQC]   Project folder name: "${folderName}"`);
              console.log(`[ReadyForQC]   Zip file name: "${zip.nameWithoutExtension}"`);
              console.log(`[ReadyForQC]   Zip file path: "${zip.path}"`);
              console.log(`[ReadyForQC]   Match verification: "${folderNameLower}" === "${zipNameLower}" = ${matches}`);
              
              // Additional verification: check character-by-character if needed
              if (folderNameLower.length !== zipNameLower.length) {
                console.error(`[ReadyForQC] ⚠️ LENGTH MISMATCH! Project name length: ${folderNameLower.length}, Zip name length: ${zipNameLower.length}`);
              }
            }
            return matches;
          });
          return isMatch;
        });

        // Only add to matches if we have at least one EXACT match
        if (matchingZips.length > 0) {
          matches[project.id] = {
            project: project,
            zipFiles: matchingZips
          };
          console.log(`[ReadyForQC] Added project ${project.id} (${project.projectName}) to matches with ${matchingZips.length} zip file(s)`);
        } else {
          // Log when a project is checked but doesn't match (for debugging)
          // Only log for "In Progress" projects to reduce noise
          if (project.rfaStatus === 'In Progress') {
            console.log(`[ReadyForQC] ✗ NO MATCH for project ${project.id}: "${project.projectName}" (${project.projectContainer})`);
            console.log(`[ReadyForQC]   Expected folder names: "${projectFolderNames.join('" or "')}"`);
            if (zipFiles.length > 0) {
              console.log(`[ReadyForQC]   Available zip files: ${zipFiles.map(z => `"${z.nameWithoutExtension}"`).join(', ')}`);
            } else {
              console.log(`[ReadyForQC]   No zip files available to match against`);
            }
          }
        }
      }

      console.log(`[ReadyForQC] Found ${Object.keys(matches).length} matching project(s)`);
      return matches;

    } catch (error) {
      console.error('Error matching projects with zip files:', error);
      throw error;
    }
  }

  /**
   * Get all zip files matching a specific project
   * @param {Object} project - Project object
   * @returns {Promise<Array>} Array of matching zip file info objects
   */
  async getMatchingZipFiles(project) {
    try {
      const zipFiles = await this.scanReadyForQCFolder();
      const projectFolderNames = this.getProjectFolderName(project);
      
      if (!projectFolderNames) {
        return [];
      }

      // Find matching zip files (case-insensitive) - check both naming variations
      return zipFiles.filter(zip => {
        const zipNameLower = zip.nameWithoutExtension.toLowerCase();
        return projectFolderNames.some(folderName => 
          folderName.toLowerCase() === zipNameLower
        );
      });

    } catch (error) {
      console.error('Error getting matching zip files:', error);
      throw error;
    }
  }

  /**
   * Download and extract zip file to Downloads folder
   * @param {string} zipFilePath - Path to the zip file
   * @param {Object} project - Project object
   * @returns {Promise<Object>} Result object with success status and extracted path
   */
  async downloadAndExtractZip(zipFilePath, project) {
    try {
      // Verify zip file exists
      if (!await fs.pathExists(zipFilePath)) {
        throw new Error(`Zip file not found: ${zipFilePath}`);
      }

      // Get project folder name (use first variation, without space before underscore)
      const projectFolderNames = this.getProjectFolderName(project);
      if (!projectFolderNames || projectFolderNames.length === 0) {
        throw new Error('Invalid project data: missing projectName or projectContainer');
      }
      const projectFolderName = projectFolderNames[0]; // Use standard format without space

      // Determine download location (user's Downloads folder)
      const downloadsPath = path.join(os.homedir(), 'Downloads');
      await fs.ensureDir(downloadsPath);
      
      const extractPath = path.join(downloadsPath, projectFolderName);

      // Check if folder already exists
      if (await fs.pathExists(extractPath)) {
        // Optionally handle overwrite - for now, we'll extract to a new folder with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extractPathWithTimestamp = `${extractPath}_${timestamp}`;
        console.log(`Folder exists, extracting to: ${extractPathWithTimestamp}`);
        
        // Extract zip file
        await extract(zipFilePath, { dir: extractPathWithTimestamp });
        
        return {
          success: true,
          extractedPath: extractPathWithTimestamp,
          message: `Extracted to ${extractPathWithTimestamp} (original folder exists)`
        };
      } else {
        // Extract zip file
        await extract(zipFilePath, { dir: extractPath });
        
        return {
          success: true,
          extractedPath: extractPath,
          message: `Successfully extracted to ${extractPath}`
        };
      }

    } catch (error) {
      console.error('Error downloading and extracting zip:', error);
      throw error;
    }
  }

  /**
   * Update project RFA status to "Ready for QC" if currently "In Progress"
   * @param {Object} project - Project object
   * @returns {Promise<Object>} Updated project object
   */
  async updateProjectStatus(project) {
    try {
      // Only update if status is "In Progress"
      if (project.rfaStatus === 'In Progress') {
        const updatedProject = {
          ...project,
          rfaStatus: 'Ready for QC',
          lastModified: new Date().toISOString(),
          // Mark the source as automatic for status tracking
          _statusChangeSource: 'automatic'
        };

        // Save updated project if persistence service is available
        if (this.projectPersistenceService) {
          const result = await this.projectPersistenceService.saveProject(updatedProject);
          if (result.success) {
            console.log(`[ReadyForQC] Status tracking: recorded automatic transition to "Ready for QC"`);
            return result.project;
          }
        }

        return updatedProject;
      }

      return project;

    } catch (error) {
      console.error('Error updating project status:', error);
      throw error;
    }
  }

  /**
   * Scan folder and update all matching projects
   * @param {Array} projects - Array of all projects
   * @returns {Promise<Object>} Object with updated projects and match count
   */
  async scanAndUpdateProjects(projects) {
    try {
      const matches = await this.matchProjectsWithZipFiles(projects);
      const updatedProjects = [];
      let updateCount = 0;

      console.log(`[ReadyForQC] Processing ${Object.keys(matches).length} matches for status updates`);

      for (const [projectId, matchData] of Object.entries(matches)) {
        const project = matchData.project;
        
        // CRITICAL: Verify that we actually have matching zip files before updating
        if (!matchData.zipFiles || matchData.zipFiles.length === 0) {
          console.warn(`[ReadyForQC] ⚠️ WARNING: Project ${projectId} (${project.projectName}) in matches but has no zip files! Skipping update.`);
          continue;
        }

        // DOUBLE-CHECK: Verify each zip file still exists and matches
        const validZipFiles = matchData.zipFiles.filter(zip => {
          const exists = fs.existsSync(zip.path);
          if (!exists) {
            console.warn(`[ReadyForQC] ⚠️ Zip file no longer exists: ${zip.path}`);
            return false;
          }
          
          // Re-verify the match
          const projectFolderNames = this.getProjectFolderName(project);
          const zipNameLower = zip.nameWithoutExtension.toLowerCase().trim();
          const stillMatches = projectFolderNames.some(folderName => 
            folderName.toLowerCase().trim() === zipNameLower
          );
          
          if (!stillMatches) {
            console.warn(`[ReadyForQC] ⚠️ Zip file "${zip.name}" no longer matches project "${project.projectName}"`);
            console.warn(`[ReadyForQC]   Expected: ${projectFolderNames.join(' or ')}`);
            console.warn(`[ReadyForQC]   Zip name: ${zip.nameWithoutExtension}`);
          }
          
          return stillMatches;
        });

        if (validZipFiles.length === 0) {
          console.warn(`[ReadyForQC] ⚠️ WARNING: Project ${projectId} (${project.projectName}) had matches but none are valid! Skipping update.`);
          continue;
        }
        
        // Only update if status is "In Progress"
        if (project.rfaStatus === 'In Progress') {
          console.log(`[ReadyForQC] ✓ Updating project ${projectId} (${project.projectName}) from "In Progress" to "Ready for QC"`);
          console.log(`[ReadyForQC]   Matched zip file(s): ${validZipFiles.map(z => z.name).join(', ')}`);
          console.log(`[ReadyForQC]   Project folder name(s): ${this.getProjectFolderName(project).join(' or ')}`);
          const updatedProject = await this.updateProjectStatus(project);
          updatedProjects.push(updatedProject);
          updateCount++;
        } else {
          console.log(`[ReadyForQC] Project ${projectId} (${project.projectName}) has match but status is "${project.rfaStatus}", not updating`);
        }
      }

      console.log(`[ReadyForQC] Scan complete: ${updateCount} project(s) updated, ${Object.keys(matches).length} total match(es)`);

      return {
        success: true,
        matches: matches,
        updatedProjects: updatedProjects,
        updateCount: updateCount,
        totalMatches: Object.keys(matches).length
      };

    } catch (error) {
      console.error('Error scanning and updating projects:', error);
      throw error;
    }
  }
}

module.exports = ReadyForQCService;

