const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { shell } = require('electron');
const { sanitizeProjectName: sanitizeProjectNameUtil } = require('./FileUtils');

/**
 * DasUploadService - Handles uploading project folders to the DAS Drive (Z:)
 * 
 * DAS Drive Structure:
 * Z:\YYYY Projects\<Letter>\<ProjectName_ProjectContainer>
 * 
 * For new projects: Copy entire folder from Downloads to DAS
 * For revisions: Copy only the RFA subfolder to existing project folder on DAS
 */
class DasUploadService {
  constructor() {
    // DAS Drive path - mapped network drive
    this.dasDrivePath = 'Z:';
    
    // Downloads folder path
    this.downloadsPath = path.join(os.homedir(), 'Downloads');
  }

  /**
   * Sanitize project name using centralized utility
   * @param {string} projectName - Project name
   * @returns {string} Sanitized project name (uppercase)
   */
  sanitizeProjectName(projectName) {
    return sanitizeProjectNameUtil(projectName);
  }

  /**
   * Get the first letter folder name from project name
   * @param {string} projectName - Project name
   * @returns {string} First letter (A-Z) or '#' for numeric names
   */
  getFirstLetter(projectName) {
    const sanitized = this.sanitizeProjectName(projectName);
    const firstChar = sanitized.charAt(0).toUpperCase();
    return /[A-Z]/.test(firstChar) ? firstChar : '#';
  }

  /**
   * Get year from project container number
   * @param {string} projectContainer - Project container (e.g., "26-12345")
   * @returns {string} Full year (e.g., "2026")
   */
  getYearFromContainer(projectContainer) {
    if (!projectContainer || projectContainer.length < 2) {
      throw new Error('Invalid project container format');
    }
    const yearPrefix = projectContainer.substring(0, 2);
    return `20${yearPrefix}`;
  }

  /**
   * Build the project folder name (no-space variant)
   * @param {Object} project - Project data
   * @returns {string} Folder name in format: PROJECTNAME_CONTAINER
   */
  buildProjectFolderName(project) {
    const sanitizedName = this.sanitizeProjectName(project.projectName);
    return `${sanitizedName}_${project.projectContainer}`;
  }

  /**
   * Get both folder name variants for searching
   * @param {Object} project - Project data
   * @returns {Array<string>} Array of possible folder names
   */
  getProjectFolderNameVariants(project) {
    const sanitizedName = this.sanitizeProjectName(project.projectName);
    return [
      `${sanitizedName}_${project.projectContainer}`,
      `${sanitizedName} _${project.projectContainer}`
    ];
  }

  /**
   * Build the target DAS path for a project
   * @param {Object} project - Project data
   * @returns {string} Full DAS path (e.g., "Z:\2026 Projects\A\PROJECTNAME_26-12345")
   */
  buildDasTargetPath(project) {
    const year = this.getYearFromContainer(project.projectContainer);
    const letter = this.getFirstLetter(project.projectName);
    const folderName = this.buildProjectFolderName(project);
    
    return path.join(this.dasDrivePath, `${year} Projects`, letter, folderName);
  }

  /**
   * Build the year/letter base path on DAS
   * @param {Object} project - Project data
   * @returns {string} Base path (e.g., "Z:\2026 Projects\A")
   */
  buildDasBasePath(project) {
    const year = this.getYearFromContainer(project.projectContainer);
    const letter = this.getFirstLetter(project.projectName);
    
    return path.join(this.dasDrivePath, `${year} Projects`, letter);
  }

  /**
   * Check if DAS drive is accessible
   * @returns {Promise<Object>} Result with success status and message
   */
  async checkDriveAccess() {
    try {
      const exists = await fs.pathExists(this.dasDrivePath);
      if (!exists) {
        return {
          success: false,
          error: 'DAS Drive (Z:) is not accessible. Please check your network connection.'
        };
      }
      
      // Try to read the directory to verify access
      await fs.readdir(this.dasDrivePath);
      
      return {
        success: true,
        message: 'DAS Drive is accessible'
      };
    } catch (error) {
      console.error('[DasUpload] Error checking drive access:', error);
      return {
        success: false,
        error: `DAS Drive (Z:) is not accessible: ${error.message}`
      };
    }
  }

  /**
   * Find the project folder in Downloads
   * @param {Object} project - Project data
   * @returns {Promise<Object>} Result with found path or error
   */
  async findSourceFolder(project) {
    try {
      const variants = this.getProjectFolderNameVariants(project);
      
      for (const folderName of variants) {
        const folderPath = path.join(this.downloadsPath, folderName);
        if (await fs.pathExists(folderPath)) {
          const stats = await fs.stat(folderPath);
          if (stats.isDirectory()) {
            console.log(`[DasUpload] Found source folder: ${folderPath}`);
            return {
              success: true,
              path: folderPath,
              folderName: folderName
            };
          }
        }
      }
      
      return {
        success: false,
        error: `Project folder not found in Downloads. Expected: ${variants[0]}`
      };
    } catch (error) {
      console.error('[DasUpload] Error finding source folder:', error);
      return {
        success: false,
        error: `Error searching for project folder: ${error.message}`
      };
    }
  }

  /**
   * Find existing project folder on DAS (for revisions)
   * @param {Object} project - Project data
   * @returns {Promise<Object>} Result with found path or error
   */
  async findExistingDasFolder(project) {
    try {
      const basePath = this.buildDasBasePath(project);
      
      // Check if base path exists
      if (!await fs.pathExists(basePath)) {
        return {
          success: false,
          error: `DAS path does not exist: ${basePath}`
        };
      }
      
      const variants = this.getProjectFolderNameVariants(project);
      
      for (const folderName of variants) {
        const folderPath = path.join(basePath, folderName);
        if (await fs.pathExists(folderPath)) {
          const stats = await fs.stat(folderPath);
          if (stats.isDirectory()) {
            console.log(`[DasUpload] Found existing DAS folder: ${folderPath}`);
            return {
              success: true,
              path: folderPath,
              folderName: folderName
            };
          }
        }
      }
      
      return {
        success: false,
        error: `Existing project folder not found on DAS. Cannot upload revision. Expected folder in: ${basePath}`
      };
    } catch (error) {
      console.error('[DasUpload] Error finding existing DAS folder:', error);
      return {
        success: false,
        error: `Error searching for existing project folder: ${error.message}`
      };
    }
  }

  /**
   * Recursively search for RFA subfolders in a directory
   * @param {string} dirPath - Directory to search
   * @param {number} maxDepth - Maximum recursion depth
   * @param {number} currentDepth - Current recursion depth
   * @returns {Promise<Array>} Array of RFA folder info objects
   */
  async findRfaFoldersRecursively(dirPath, maxDepth = 5, currentDepth = 0) {
    const rfaFolders = [];
    
    if (currentDepth > maxDepth) {
      return rfaFolders;
    }
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          // Check if this folder matches RFA pattern: RFA#######-#_* or RFA######-#_*
          // Pattern: RFA followed by digits, dash, digit(s), underscore
          if (/^RFA#?\d+-\d+_/i.test(item)) {
            rfaFolders.push({
              name: item,
              path: itemPath,
              modifiedDate: stats.mtime
            });
            console.log(`[DasUpload] Found RFA folder: ${item}`);
          } else {
            // Recursively search in subdirectories
            const subFolders = await this.findRfaFoldersRecursively(itemPath, maxDepth, currentDepth + 1);
            rfaFolders.push(...subFolders);
          }
        }
      }
    } catch (error) {
      console.warn(`[DasUpload] Error reading directory ${dirPath}:`, error.message);
    }
    
    return rfaFolders;
  }

  /**
   * Find the most recent RFA subfolder in a project folder
   * @param {string} projectFolderPath - Path to project folder in Downloads
   * @returns {Promise<Object>} Result with found RFA folder or error
   */
  async findRevisionSubfolder(projectFolderPath) {
    try {
      const rfaFolders = await this.findRfaFoldersRecursively(projectFolderPath);
      
      if (rfaFolders.length === 0) {
        return {
          success: false,
          error: 'No RFA revision folder found in Downloads project folder.'
        };
      }
      
      // Sort by modification date, most recent first
      rfaFolders.sort((a, b) => b.modifiedDate - a.modifiedDate);
      
      const mostRecent = rfaFolders[0];
      console.log(`[DasUpload] Selected most recent RFA folder: ${mostRecent.name} (modified: ${mostRecent.modifiedDate})`);
      
      return {
        success: true,
        path: mostRecent.path,
        folderName: mostRecent.name,
        modifiedDate: mostRecent.modifiedDate
      };
    } catch (error) {
      console.error('[DasUpload] Error finding revision subfolder:', error);
      return {
        success: false,
        error: `Error searching for RFA folder: ${error.message}`
      };
    }
  }

  /**
   * Move a folder to the Recycle Bin (safer than permanent delete)
   * @param {string} folderPath - Path to folder to move to trash
   * @returns {Promise<Object>} Result with success status
   */
  async moveToTrash(folderPath) {
    try {
      if (!await fs.pathExists(folderPath)) {
        console.log(`[DasUpload] Folder not found for cleanup: ${folderPath}`);
        return { success: true, message: 'Folder already removed' };
      }
      
      console.log(`[DasUpload] Moving folder to Recycle Bin: ${folderPath}`);
      await shell.trashItem(folderPath);
      console.log(`[DasUpload] Successfully moved to Recycle Bin: ${folderPath}`);
      
      return {
        success: true,
        message: `Moved to Recycle Bin: ${folderPath}`
      };
    } catch (error) {
      console.error(`[DasUpload] Error moving to Recycle Bin:`, error);
      // Don't fail the overall operation if cleanup fails
      return {
        success: false,
        error: `Could not move to Recycle Bin: ${error.message}`
      };
    }
  }

  /**
   * Count total files in a directory recursively (for progress calculation)
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} Total file count
   */
  async countFiles(dirPath) {
    let count = 0;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          count += await this.countFiles(itemPath);
        } else {
          count++;
        }
      }
    } catch (error) {
      console.warn(`[DasUpload] Error counting files in ${dirPath}:`, error.message);
    }
    
    return count;
  }

  /**
   * Copy directory with progress reporting
   * @param {string} src - Source path
   * @param {string} dest - Destination path
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<void>}
   */
  async copyWithProgress(src, dest, progressCallback) {
    const totalFiles = await this.countFiles(src);
    let copiedFiles = 0;
    
    const copyRecursive = async (srcPath, destPath) => {
      await fs.ensureDir(destPath);
      const items = await fs.readdir(srcPath);
      
      for (const item of items) {
        const srcItemPath = path.join(srcPath, item);
        const destItemPath = path.join(destPath, item);
        const stats = await fs.stat(srcItemPath);
        
        if (stats.isDirectory()) {
          await copyRecursive(srcItemPath, destItemPath);
        } else {
          await fs.copy(srcItemPath, destItemPath);
          copiedFiles++;
          
          if (progressCallback) {
            const progress = totalFiles > 0 ? Math.round((copiedFiles / totalFiles) * 100) : 0;
            progressCallback({
              phase: 'copying',
              progress,
              message: `Copying files... (${copiedFiles}/${totalFiles})`,
              currentFile: item
            });
          }
        }
      }
    };
    
    await copyRecursive(src, dest);
  }

  /**
   * Upload project folder to DAS Drive
   * @param {Object} project - Project data
   * @param {boolean} confirmed - Whether user has confirmed overwrite (if needed)
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise<Object>} Upload result
   */
  async uploadProject(project, confirmed = false, progressCallback = null) {
    console.log(`[DasUpload] Starting upload for project: ${project.projectName} (${project.projectContainer})`);
    console.log(`[DasUpload] Is revision: ${project.isRevision}`);
    
    try {
      // Step 1: Check DAS drive access
      if (progressCallback) {
        progressCallback({
          phase: 'checking',
          progress: 0,
          message: 'Checking DAS Drive access...'
        });
      }
      
      const driveCheck = await this.checkDriveAccess();
      if (!driveCheck.success) {
        return driveCheck;
      }
      
      // Step 2: Find source folder in Downloads
      if (progressCallback) {
        progressCallback({
          phase: 'checking',
          progress: 10,
          message: 'Locating project folder in Downloads...'
        });
      }
      
      const sourceResult = await this.findSourceFolder(project);
      if (!sourceResult.success) {
        return sourceResult;
      }
      
      const sourcePath = sourceResult.path;
      
      // Step 3: Handle based on project type (new vs revision)
      let uploadResult;
      if (project.isRevision) {
        uploadResult = await this.uploadRevision(project, sourcePath, progressCallback);
      } else {
        uploadResult = await this.uploadNewProject(project, sourcePath, confirmed, progressCallback);
      }
      
      // Step 4: Clean up source folder after successful upload (move to Recycle Bin)
      if (uploadResult.success && !uploadResult.needsConfirmation) {
        if (progressCallback) {
          progressCallback({
            phase: 'cleanup',
            progress: 98,
            message: 'Cleaning up Downloads folder...'
          });
        }
        
        const cleanupResult = await this.moveToTrash(sourcePath);
        uploadResult.cleanedUp = cleanupResult.success;
        if (cleanupResult.success) {
          console.log(`[DasUpload] Cleaned up source folder: ${sourcePath}`);
        } else {
          console.warn(`[DasUpload] Cleanup warning: ${cleanupResult.error}`);
        }
        
        if (progressCallback) {
          progressCallback({
            phase: 'complete',
            progress: 100,
            message: uploadResult.cleanedUp ? 'Upload complete! Downloads folder cleaned up.' : 'Upload complete!'
          });
        }
      }
      
      return uploadResult;
      
    } catch (error) {
      console.error('[DasUpload] Upload failed:', error);
      return {
        success: false,
        error: `Failed to upload: ${error.message}`
      };
    }
  }

  /**
   * Upload a new project (entire folder or just RFA subfolder if main folder exists)
   * @param {Object} project - Project data
   * @param {string} sourcePath - Source folder path in Downloads
   * @param {boolean} confirmed - Whether user has confirmed overwrite (not used anymore, kept for API compatibility)
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Object>} Upload result
   */
  async uploadNewProject(project, sourcePath, confirmed, progressCallback) {
    const targetPath = this.buildDasTargetPath(project);
    const basePath = this.buildDasBasePath(project);
    
    console.log(`[DasUpload] New project upload: ${sourcePath} -> ${targetPath}`);
    
    // Check if base path exists (year/letter folder)
    if (!await fs.pathExists(basePath)) {
      // Create the base path if it doesn't exist
      console.log(`[DasUpload] Creating base path: ${basePath}`);
      await fs.ensureDir(basePath);
    }
    
    // Check if target folder already exists
    if (await fs.pathExists(targetPath)) {
      // Main project folder exists - merge by copying only the RFA subfolder
      console.log(`[DasUpload] Target folder exists, will merge by copying RFA subfolder only: ${targetPath}`);
      
      if (progressCallback) {
        progressCallback({
          phase: 'checking',
          progress: 15,
          message: 'Project folder exists on DAS, merging...'
        });
      }
      
      // Find RFA subfolder in Downloads
      const rfaFolder = await this.findRevisionSubfolder(sourcePath);
      if (!rfaFolder.success) {
        return {
          success: false,
          error: 'Project folder exists on DAS but could not find RFA subfolder in Downloads to merge.'
        };
      }
      
      const rfaSourcePath = rfaFolder.path;
      const rfaFolderName = rfaFolder.folderName;
      const rfaTargetPath = path.join(targetPath, rfaFolderName);
      
      console.log(`[DasUpload] Merging RFA folder: ${rfaSourcePath} -> ${rfaTargetPath}`);
      
      // Check if this specific RFA folder already exists
      if (await fs.pathExists(rfaTargetPath)) {
        console.log(`[DasUpload] RFA folder already exists on DAS, will overwrite: ${rfaTargetPath}`);
        if (progressCallback) {
          progressCallback({
            phase: 'preparing',
            progress: 25,
            message: 'Updating existing RFA folder...'
          });
        }
        await fs.remove(rfaTargetPath);
      }
      
      // Copy RFA folder to DAS
      if (progressCallback) {
        progressCallback({
          phase: 'copying',
          progress: 30,
          message: 'Copying RFA folder to DAS...'
        });
      }
      
      await this.copyWithProgress(rfaSourcePath, rfaTargetPath, (progress) => {
        if (progressCallback) {
          // Scale progress from 30-95
          const scaledProgress = 30 + Math.round(progress.progress * 0.65);
          progressCallback({
            ...progress,
            progress: scaledProgress
          });
        }
      });
      
      if (progressCallback) {
        progressCallback({
          phase: 'complete',
          progress: 100,
          message: 'Upload complete (merged with existing folder)!'
        });
      }
      
      console.log(`[DasUpload] Merge upload complete: ${rfaTargetPath}`);
      
      return {
        success: true,
        uploadedPath: rfaTargetPath,
        message: `Successfully merged RFA folder to ${rfaTargetPath}`,
        isRevision: false,
        wasMerged: true,
        rfaFolderName: rfaFolderName
      };
    }
    
    // Target folder doesn't exist - copy entire folder
    if (progressCallback) {
      progressCallback({
        phase: 'copying',
        progress: 25,
        message: 'Copying project folder to DAS...'
      });
    }
    
    await this.copyWithProgress(sourcePath, targetPath, (progress) => {
      if (progressCallback) {
        // Scale progress from 25-95
        const scaledProgress = 25 + Math.round(progress.progress * 0.7);
        progressCallback({
          ...progress,
          progress: scaledProgress
        });
      }
    });
    
    if (progressCallback) {
      progressCallback({
        phase: 'complete',
        progress: 100,
        message: 'Upload complete!'
      });
    }
    
    console.log(`[DasUpload] New project upload complete: ${targetPath}`);
    
    return {
      success: true,
      uploadedPath: targetPath,
      message: `Successfully uploaded to ${targetPath}`,
      isRevision: false
    };
  }

  /**
   * Upload a revision (only RFA subfolder)
   * @param {Object} project - Project data
   * @param {string} sourcePath - Source folder path in Downloads
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Object>} Upload result
   */
  async uploadRevision(project, sourcePath, progressCallback) {
    console.log(`[DasUpload] Revision upload from: ${sourcePath}`);
    
    // Step 1: Find existing project folder on DAS
    if (progressCallback) {
      progressCallback({
        phase: 'checking',
        progress: 15,
        message: 'Locating existing project folder on DAS...'
      });
    }
    
    const existingFolder = await this.findExistingDasFolder(project);
    if (!existingFolder.success) {
      return existingFolder;
    }
    
    const dasProjectPath = existingFolder.path;
    console.log(`[DasUpload] Found existing DAS folder: ${dasProjectPath}`);
    
    // Step 2: Find RFA subfolder in Downloads
    if (progressCallback) {
      progressCallback({
        phase: 'checking',
        progress: 25,
        message: 'Locating RFA revision folder...'
      });
    }
    
    const rfaFolder = await this.findRevisionSubfolder(sourcePath);
    if (!rfaFolder.success) {
      return rfaFolder;
    }
    
    const rfaSourcePath = rfaFolder.path;
    const rfaFolderName = rfaFolder.folderName;
    const rfaTargetPath = path.join(dasProjectPath, rfaFolderName);
    
    console.log(`[DasUpload] Copying RFA folder: ${rfaSourcePath} -> ${rfaTargetPath}`);
    
    // Check if RFA folder already exists on DAS
    if (await fs.pathExists(rfaTargetPath)) {
      console.log(`[DasUpload] RFA folder already exists on DAS, will overwrite: ${rfaTargetPath}`);
      if (progressCallback) {
        progressCallback({
          phase: 'preparing',
          progress: 30,
          message: 'Removing existing RFA folder on DAS...'
        });
      }
      await fs.remove(rfaTargetPath);
    }
    
    // Copy RFA folder to DAS
    if (progressCallback) {
      progressCallback({
        phase: 'copying',
        progress: 35,
        message: 'Copying RFA revision folder to DAS...'
      });
    }
    
    await this.copyWithProgress(rfaSourcePath, rfaTargetPath, (progress) => {
      if (progressCallback) {
        // Scale progress from 35-95
        const scaledProgress = 35 + Math.round(progress.progress * 0.6);
        progressCallback({
          ...progress,
          progress: scaledProgress
        });
      }
    });
    
    if (progressCallback) {
      progressCallback({
        phase: 'complete',
        progress: 100,
        message: 'Revision upload complete!'
      });
    }
    
    console.log(`[DasUpload] Revision upload complete: ${rfaTargetPath}`);
    
    return {
      success: true,
      uploadedPath: rfaTargetPath,
      message: `Successfully uploaded revision to ${rfaTargetPath}`,
      isRevision: true,
      rfaFolderName: rfaFolderName
    };
  }
}

module.exports = DasUploadService;
