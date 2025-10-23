const archiver = require('archiver');
const fs = require('fs-extra');
const path = require('path');

/**
 * ZipService - Handles project folder compression
 * Provides functionality to zip project folders with progress tracking
 */
class ZipService {
  constructor() {
    this.isZipping = false;
    this.currentOperation = null;
  }

  /**
   * Zip a project folder
   * @param {string} projectPath - Path to the project folder
   * @param {Object} projectData - Project metadata for naming
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<string>} - Path to the created zip file
   */
  async zipProjectFolder(projectPath, projectData, progressCallback = null) {
    try {
      this.isZipping = true;
      console.log('Starting zip operation for:', projectPath);

      // Validate input
      if (!projectPath || !await fs.pathExists(projectPath)) {
        throw new Error('Project folder does not exist');
      }

      // Generate zip filename
      const zipFileName = this.generateZipFileName(projectData);
      // Create zip in same directory as project folder (parent directory)
      const projectParentDir = path.dirname(projectPath);
      const zipPath = path.join(projectParentDir, zipFileName);

      // Remove existing zip file if it exists
      if (await fs.pathExists(zipPath)) {
        await fs.remove(zipPath);
      }

      // Create zip file
      await this.createZipFile(projectPath, zipPath, progressCallback);
      
      console.log('Zip operation completed:', zipPath);
      return zipPath;

    } catch (error) {
      console.error('Zip operation failed:', error);
      throw error;
    } finally {
      this.isZipping = false;
      this.currentOperation = null;
    }
  }

  /**
   * Create zip file with progress tracking
   * @param {string} sourcePath - Source folder path
   * @param {string} outputPath - Output zip file path
   * @param {Function} progressCallback - Progress callback
   */
  async createZipFile(sourcePath, outputPath, progressCallback) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get total file count for progress calculation
        const totalFiles = await this.countFiles(sourcePath);
        let processedFiles = 0;

        // Create write stream
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        // Handle errors
        archive.on('error', (err) => {
          console.error('Archive error:', err);
          reject(err);
        });

        output.on('error', (err) => {
          console.error('Output stream error:', err);
          reject(err);
        });

        // Handle completion
        output.on('close', () => {
          console.log(`Archive created: ${archive.pointer()} total bytes`);
          if (progressCallback) {
            progressCallback({
              phase: 'complete',
              progress: 100,
              message: 'Zip file created successfully'
            });
          }
          resolve();
        });

        // Track progress
        archive.on('entry', (entry) => {
          processedFiles++;
          const progress = Math.min(99, Math.round((processedFiles / Math.max(totalFiles, 1)) * 100));
          
          if (progressCallback) {
            progressCallback({
              phase: 'zipping',
              progress,
              message: `Compressing files... (${processedFiles}/${totalFiles})`,
              currentFile: entry.name
            });
          }
        });

        // Pipe archive data to the file
        archive.pipe(output);

        // Add files to archive (excluding unwanted files)
        await this.addFilesToArchive(archive, sourcePath);

        // Finalize the archive
        await archive.finalize();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add files to archive with filtering
   * @param {Object} archive - Archiver instance
   * @param {string} sourcePath - Source folder path
   */
  async addFilesToArchive(archive, sourcePath) {
    const stats = await fs.stat(sourcePath);
    const projectFolderName = path.basename(sourcePath);
    
    if (stats.isDirectory()) {
      // Recursively add files with filtering
      await this.addDirectoryContents(archive, sourcePath, projectFolderName);
    } else {
      // Add single file
      const fileName = path.basename(sourcePath);
      if (this.shouldIncludeFile(fileName)) {
        archive.file(sourcePath, { name: fileName });
      }
    }
  }

  /**
   * Recursively add directory contents to archive
   * @param {Object} archive - Archiver instance
   * @param {string} dirPath - Directory path
   * @param {string} archivePath - Path in archive
   */
  async addDirectoryContents(archive, dirPath, archivePath = '') {
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const archiveItemPath = archivePath ? path.join(archivePath, item) : item;
        
        // Check if file should be included
        if (!this.shouldIncludeFile(item, archivePath)) {
          continue;
        }
        
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          // Recursively add subdirectory
          await this.addDirectoryContents(archive, itemPath, archiveItemPath);
        } else {
          // Add file to archive
          archive.file(itemPath, { name: archiveItemPath });
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
      // Continue with other files instead of failing completely
    }
  }

  /**
   * Determine if a file should be included in the zip
   * @param {string} fileName - File name
   * @param {string} prefix - File path prefix
   * @returns {boolean} - Whether to include the file
   */
  shouldIncludeFile(fileName, prefix = '') {
    const fullPath = prefix ? path.join(prefix, fileName) : fileName;
    const lowerName = fileName.toLowerCase();
    
    // Exclude patterns
    const excludePatterns = [
      // Temporary files
      /\.tmp$/,
      /\.temp$/,
      /~\$/,
      /\.bak$/,
      
      // System files
      /^thumbs\.db$/,
      /^desktop\.ini$/,
      /^\.ds_store$/,
      
      // Log files
      /\.log$/,
      /\.logs$/,
      
      // Cache directories
      /^node_modules$/,
      /^\.git$/,
      /^\.svn$/,
      /^\.cache$/,
      
      // Office temp files
      /^~\$.*\.docx?$/,
      /^~\$.*\.xlsx?$/,
      /^~\$.*\.pptx?$/,
    ];

    // Check if file matches any exclude pattern
    for (const pattern of excludePatterns) {
      if (pattern.test(lowerName)) {
        console.log(`Excluding file: ${fullPath}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Count total files in directory for progress tracking
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} - Total file count
   */
  async countFiles(dirPath) {
    let count = 0;
    
    const countRecursive = async (currentPath) => {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await countRecursive(itemPath);
        } else if (this.shouldIncludeFile(item)) {
          count++;
        }
      }
    };

    const stats = await fs.stat(dirPath);
    if (stats.isDirectory()) {
      await countRecursive(dirPath);
    } else {
      count = 1;
    }

    return count;
  }

  /**
   * Generate zip filename based on project data and settings
   * @param {Object} projectData - Project data
   * @param {string} namingTemplate - Optional naming template
   * @returns {string} - Generated filename
   */
  generateZipFileName(projectData, namingTemplate = null) {
    // Default template if none provided
    const template = namingTemplate || '{projectName}_{rfaNumber}_{date}.zip';
    
    // Get current date and time
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    
    // Sanitize project name and RFA number
    const projectName = this.sanitizeFileName(projectData.projectName || 'Untitled');
    const rfaNumber = this.sanitizeFileName(projectData.rfaNumber || 'NoRFA');
    
    // Replace template variables
    let fileName = template
      .replace(/{projectName}/g, projectName)
      .replace(/{rfaNumber}/g, rfaNumber)
      .replace(/{date}/g, dateStr)
      .replace(/{time}/g, timeStr);

    // Ensure .zip extension
    if (!fileName.toLowerCase().endsWith('.zip')) {
      fileName += '.zip';
    }

    return fileName;
  }

  /**
   * Sanitize filename by removing invalid characters
   * @param {string} fileName - Original filename
   * @returns {string} - Sanitized filename
   */
  sanitizeFileName(fileName) {
    if (!fileName) return 'Untitled';
    
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_+/g, '_') // Remove duplicate underscores
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Limit length
  }

  /**
   * Get file size in human readable format
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} - Formatted file size
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const bytes = stats.size;
      
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Cancel current zip operation
   */
  cancel() {
    if (this.currentOperation) {
      this.currentOperation.cancel();
      this.isZipping = false;
    }
  }

  /**
   * Check if zip operation is in progress
   * @returns {boolean}
   */
  isOperationInProgress() {
    return this.isZipping;
  }
}

module.exports = ZipService;
