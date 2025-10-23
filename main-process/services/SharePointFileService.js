const fs = require('fs-extra');
const path = require('path');

/**
 * SharePointFileService - Simple file copy service for VPN-connected SharePoint access
 * Uses direct file system operations instead of Microsoft Graph API
 */
class SharePointFileService {
  constructor() {
    this.settings = null;
  }

  /**
   * Initialize the service with settings
   * @param {Object} settings - SharePoint settings from app configuration
   */
  initialize(settings) {
    this.settings = settings;
    
    if (!settings || !settings.enabled) {
      console.log('SharePoint integration is disabled');
      return;
    }

    console.log('SharePoint file service initialized for direct access');
  }

  /**
   * Convert SharePoint web URL to UNC path
   * @param {string} sharePointUrl - SharePoint web URL
   * @returns {string} - UNC path for file operations
   */
  convertToUNCPath(sharePointUrl) {
    try {
      // Example conversion:
      // From: https://acuitybrandsinc.sharepoint.com/:f:/r/sites/CIDesignSolutions/Shared%20Documents/LnT
      // To: \\acuitybrandsinc.sharepoint.com\sites\CIDesignSolutions\Shared Documents\LnT
      
      const url = new URL(sharePointUrl);
      let pathPart = url.pathname;
      
      // Remove the :f:/r/ part if present (SharePoint folder link format)
      pathPart = pathPart.replace(/^\/:[a-z]:\/r\//, '/');
      
      // Decode URL encoding
      pathPart = decodeURIComponent(pathPart);
      
      // Convert to UNC path format
      const uncPath = `\\\\${url.hostname}${pathPart}`.replace(/\//g, '\\');
      
      console.log('Converted SharePoint URL to UNC path:', uncPath);
      return uncPath;
      
    } catch (error) {
      console.error('Failed to convert SharePoint URL:', error);
      
      // Fallback: try to extract from settings or use manual conversion
      return this.manualURLConversion(sharePointUrl);
    }
  }

  /**
   * Manual URL conversion for common SharePoint patterns
   * @param {string} sharePointUrl - SharePoint URL
   * @returns {string} - UNC path
   */
  manualURLConversion(sharePointUrl) {
    // For Acuity Brands SharePoint, convert known patterns
    if (sharePointUrl.includes('acuitybrandsinc.sharepoint.com')) {
      // Extract the path after the domain
      const urlParts = sharePointUrl.split('sharepoint.com')[1];
      
      if (urlParts.includes('/sites/')) {
        // Standard site pattern
        const cleanPath = urlParts
          .replace(/\/:[a-z]:\/r\//, '/')  // Remove SharePoint link formatting
          .replace(/%20/g, ' ')           // Replace URL encoded spaces
          .replace(/\//g, '\\');          // Convert to Windows path separators
        
        return `\\\\acuitybrandsinc.sharepoint.com${cleanPath}`;
      }
    }
    
    // Default fallback - use the original URL as-is (might work for some configurations)
    return sharePointUrl;
  }

  /**
   * Check if SharePoint path is accessible
   * @returns {Promise<boolean>} - Access test result
   */
  async testAccess() {
    try {
      if (!this.settings || !this.settings.sharePointUrl) {
        throw new Error('SharePoint URL not configured');
      }

      const uncPath = this.convertToUNCPath(this.settings.sharePointUrl);
      
      // Test if we can access the directory
      const stats = await fs.stat(uncPath);
      
      if (stats.isDirectory()) {
        console.log('SharePoint access test successful');
        return true;
      } else {
        throw new Error('SharePoint path is not a directory');
      }
      
    } catch (error) {
      console.error('SharePoint access test failed:', error);
      return false;
    }
  }

  /**
   * Check if a file exists in SharePoint
   * @param {string} fileName - Name of the file to check
   * @returns {Promise<Object|null>} - File information if exists, null otherwise
   */
  async checkFileExists(fileName) {
    try {
      const uncPath = this.convertToUNCPath(this.settings.sharePointUrl);
      const filePath = path.join(uncPath, fileName);
      
      const stats = await fs.stat(filePath);
      
      return {
        name: fileName,
        size: stats.size,
        lastModified: stats.mtime,
        fullPath: filePath
      };
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error('Error checking file existence:', error);
      throw error;
    }
  }

  /**
   * Upload (copy) a file to SharePoint
   * @param {string} sourcePath - Local path to the file
   * @param {string} fileName - Name for the file in SharePoint
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<string>} - SharePoint file path
   */
  async uploadFile(sourcePath, fileName, progressCallback = null) {
    try {
      console.log(`Copying file to SharePoint: ${fileName}`);

      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 0,
          message: 'Starting upload to SharePoint...'
        });
      }

      const uncPath = this.convertToUNCPath(this.settings.sharePointUrl);
      const destinationPath = path.join(uncPath, fileName);
      
      // Ensure the destination directory exists
      await fs.ensureDir(uncPath);

      // Check file size for progress tracking
      const stats = await fs.stat(sourcePath);
      const fileSize = stats.size;
      
      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 10,
          message: 'Preparing file transfer...'
        });
      }

      // For large files, we can implement chunked copying with progress
      if (fileSize > 10 * 1024 * 1024) { // 10MB+
        await this.copyFileWithProgress(sourcePath, destinationPath, progressCallback);
      } else {
        // Simple copy for smaller files
        await fs.copy(sourcePath, destinationPath, { overwrite: true });
        
        if (progressCallback) {
          progressCallback({
            phase: 'uploading',
            progress: 90,
            message: 'Finalizing upload...'
          });
        }
      }

      if (progressCallback) {
        progressCallback({
          phase: 'complete',
          progress: 100,
          message: 'Upload completed successfully'
        });
      }

      console.log('File copied successfully to SharePoint');
      return destinationPath;

    } catch (error) {
      console.error('SharePoint upload failed:', error);
      
      // Provide helpful error messages based on common issues
      if (error.code === 'ENOENT') {
        throw new Error('SharePoint path not accessible. Please ensure you are connected to VPN and the path is correct.');
      } else if (error.code === 'EACCES') {
        throw new Error('Access denied to SharePoint. Please check your permissions.');
      } else if (error.code === 'ENOSPC') {
        throw new Error('Not enough space on SharePoint. Please free up space and try again.');
      }
      
      throw error;
    }
  }

  /**
   * Copy file with progress tracking for large files
   * @param {string} sourcePath - Source file path
   * @param {string} destinationPath - Destination file path
   * @param {Function} progressCallback - Progress callback
   */
  async copyFileWithProgress(sourcePath, destinationPath, progressCallback) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(sourcePath);
      const writeStream = fs.createWriteStream(destinationPath);
      
      let copiedBytes = 0;
      const totalBytes = fs.statSync(sourcePath).size;

      readStream.on('data', (chunk) => {
        copiedBytes += chunk.length;
        const progress = Math.min(Math.round((copiedBytes / totalBytes) * 80) + 10, 90); // 10-90%
        
        if (progressCallback) {
          progressCallback({
            phase: 'uploading',
            progress,
            message: `Uploading... ${this.formatBytes(copiedBytes)} / ${this.formatBytes(totalBytes)}`
          });
        }
      });

      writeStream.on('finish', () => {
        resolve();
      });

      writeStream.on('error', (error) => {
        reject(error);
      });

      readStream.on('error', (error) => {
        reject(error);
      });

      readStream.pipe(writeStream);
    });
  }

  /**
   * Delete a file from SharePoint
   * @param {string} fileName - Name of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileName) {
    try {
      const uncPath = this.convertToUNCPath(this.settings.sharePointUrl);
      const filePath = path.join(uncPath, fileName);
      
      await fs.remove(filePath);
      
      console.log(`File deleted from SharePoint: ${fileName}`);
      return true;

    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`File not found for deletion: ${fileName}`);
        return true; // File doesn't exist, consider it "deleted"
      }
      console.error('Error deleting file from SharePoint:', error);
      throw error;
    }
  }

  /**
   * Get SharePoint file URL for web access
   * @param {string} fileName - Name of the uploaded file
   * @returns {string} - SharePoint web URL
   */
  getSharePointFileUrl(fileName) {
    if (!this.settings || !this.settings.sharePointUrl) {
      return null;
    }

    // Convert back to web URL format
    const baseUrl = this.settings.sharePointUrl;
    
    // If it's already a web URL, just append the filename
    if (baseUrl.startsWith('http')) {
      return `${baseUrl}/${fileName}`;
    }
    
    return `${baseUrl}\\${fileName}`;
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} - Formatted string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * List files in SharePoint directory
   * @returns {Promise<Array>} - List of files
   */
  async listFiles() {
    try {
      const uncPath = this.convertToUNCPath(this.settings.sharePointUrl);
      const files = await fs.readdir(uncPath);
      
      const fileDetails = await Promise.all(
        files.map(async (fileName) => {
          const filePath = path.join(uncPath, fileName);
          const stats = await fs.stat(filePath);
          
          return {
            name: fileName,
            size: stats.size,
            lastModified: stats.mtime,
            isDirectory: stats.isDirectory()
          };
        })
      );
      
      return fileDetails.filter(file => !file.isDirectory);
      
    } catch (error) {
      console.error('Error listing SharePoint files:', error);
      return [];
    }
  }
}

module.exports = SharePointFileService;



