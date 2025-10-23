const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * SharePointUploadService - Hybrid SharePoint upload solution
 * Automatically detects OneDrive sync and falls back to web upload if needed
 */
class SharePointUploadService {
  constructor() {
    this.settings = null;
    this.uploadMethod = null; // 'onedrive' or 'web'
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

    console.log('SharePoint upload service initialized');
  }

  /**
   * Extract site and library information from SharePoint URL
   * @param {string} sharePointUrl - SharePoint URL
   * @returns {Object} - Parsed URL components
   */
  parseSharePointUrl(sharePointUrl) {
    try {
      // Parse the URL to extract site and library info
      // Example: https://acuitybrandsinc.sharepoint.com/sites/CIDesignSolutions/Shared%20Documents/Forms/AllItems.aspx?...&id=%2Fsites%2FCIDesignSolutions%2FShared%20Documents%2FLnT
      
      const url = new URL(sharePointUrl);
      
      // Extract site name from URL
      const pathParts = url.pathname.split('/');
      const sitesIndex = pathParts.findIndex(part => part === 'sites');
      
      if (sitesIndex === -1) {
        throw new Error('Invalid SharePoint URL: cannot find site');
      }
      
      const siteName = pathParts[sitesIndex + 1];
      
      // Extract folder path from the 'id' parameter
      const urlParams = new URLSearchParams(url.search);
      const idParam = urlParams.get('id');
      
      if (idParam) {
        // Decode the path from the id parameter
        const decodedPath = decodeURIComponent(idParam);
        const pathSegments = decodedPath.split('/').filter(segment => segment);
        
        // Remove the /sites/siteName part
        const siteIndex = pathSegments.findIndex(segment => segment === 'sites');
        if (siteIndex !== -1) {
          pathSegments.splice(siteIndex, 2); // Remove 'sites' and siteName
        }
        
        const libraryName = pathSegments[0] || 'Shared Documents';
        const folderPath = pathSegments.slice(1).join('/') || '';
        
        return {
          tenant: url.hostname,
          siteName,
          libraryName,
          folderPath,
          siteUrl: `${url.protocol}//${url.hostname}/sites/${siteName}`
        };
      }
      
      // Fallback parsing
      return {
        tenant: url.hostname,
        siteName,
        libraryName: 'Shared Documents',
        folderPath: 'LnT',
        siteUrl: `${url.protocol}//${url.hostname}/sites/${siteName}`
      };

    } catch (error) {
      console.error('Failed to parse SharePoint URL:', error);
      throw new Error('Invalid SharePoint URL format');
    }
  }

  /**
   * Detect OneDrive sync folder for SharePoint library
   * @returns {Promise<string|null>} - Local OneDrive sync path or null if not found
   */
  async detectOneDriveSyncPath() {
    try {
      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      const userProfile = os.userInfo().username;
      
      // Common OneDrive sync patterns
      const oneDrivePaths = [
        // Pattern 1: Company Name - Site Name - Library Name
        `C:\\Users\\${userProfile}\\Acuity Brands, Inc\\${urlInfo.siteName} - ${urlInfo.libraryName}\\${urlInfo.folderPath}`,
        
        // Pattern 2: Company Name\\Site Name - Library Name  
        `C:\\Users\\${userProfile}\\Acuity Brands, Inc\\${urlInfo.siteName} - ${urlInfo.libraryName}\\${urlInfo.folderPath}`,
        
        // Pattern 3: OneDrive - Company Name\\Site Name - Library Name
        `C:\\Users\\${userProfile}\\OneDrive - Acuity Brands, Inc\\${urlInfo.siteName} - ${urlInfo.libraryName}\\${urlInfo.folderPath}`,
        
        // Pattern 4: Direct library name
        `C:\\Users\\${userProfile}\\Acuity Brands, Inc\\${urlInfo.libraryName}\\${urlInfo.folderPath}`,
        
        // Pattern 5: Without folder path (for manual browsing)
        `C:\\Users\\${userProfile}\\Acuity Brands, Inc\\${urlInfo.siteName} - ${urlInfo.libraryName}`,
        `C:\\Users\\${userProfile}\\OneDrive - Acuity Brands, Inc\\${urlInfo.siteName} - ${urlInfo.libraryName}`,
      ];

      console.log('Searching for OneDrive sync folders...');
      console.log('Possible paths:', oneDrivePaths);

      // Test each possible path
      for (const testPath of oneDrivePaths) {
        try {
          if (await fs.pathExists(testPath)) {
            const stats = await fs.stat(testPath);
            if (stats.isDirectory()) {
              console.log(`Found OneDrive sync folder: ${testPath}`);
              return testPath;
            }
          }
        } catch (error) {
          // Continue to next path
          continue;
        }
      }

      console.log('OneDrive sync folder not found');
      return null;

    } catch (error) {
      console.error('Error detecting OneDrive sync path:', error);
      return null;
    }
  }

  /**
   * Test SharePoint access and determine upload method
   * @returns {Promise<Object>} - Access test result with method
   */
  async testAccess() {
    try {
      if (!this.settings || !this.settings.sharePointUrl) {
        throw new Error('SharePoint URL not configured');
      }

      // First try OneDrive sync
      const oneDrivePath = await this.detectOneDriveSyncPath();
      
      if (oneDrivePath) {
        this.uploadMethod = 'onedrive';
        return {
          success: true,
          method: 'onedrive',
          path: oneDrivePath,
          message: 'OneDrive sync folder detected - files will be uploaded locally and synced automatically'
        };
      }

      // If OneDrive sync not available, check if we can use web upload
      // This would require the Microsoft Graph API implementation
      this.uploadMethod = 'web';
      return {
        success: true,
        method: 'web',
        message: 'OneDrive sync not detected - will use web upload (requires authentication setup)'
      };

    } catch (error) {
      console.error('SharePoint access test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a file exists in SharePoint
   * @param {string} fileName - Name of the file to check
   * @returns {Promise<Object|null>} - File information if exists, null otherwise
   */
  async checkFileExists(fileName) {
    try {
      if (this.uploadMethod === 'onedrive') {
        return await this.checkFileExistsOneDrive(fileName);
      } else {
        return await this.checkFileExistsWeb(fileName);
      }
    } catch (error) {
      console.error('Error checking file existence:', error);
      return null;
    }
  }

  /**
   * Check file existence in OneDrive sync folder
   * @param {string} fileName - File name
   * @returns {Promise<Object|null>} - File info or null
   */
  async checkFileExistsOneDrive(fileName) {
    const oneDrivePath = await this.detectOneDriveSyncPath();
    if (!oneDrivePath) return null;

    const filePath = path.join(oneDrivePath, fileName);
    
    try {
      const stats = await fs.stat(filePath);
      return {
        name: fileName,
        size: stats.size,
        lastModified: stats.mtime,
        fullPath: filePath,
        method: 'onedrive'
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Check file existence via web API (placeholder)
   * @param {string} fileName - File name
   * @returns {Promise<Object|null>} - File info or null
   */
  async checkFileExistsWeb(fileName) {
    // This would use Microsoft Graph API
    console.log('Web API file check not implemented yet - would require authentication');
    return null;
  }

  /**
   * Upload a file to SharePoint
   * @param {string} sourcePath - Local path to the file
   * @param {string} fileName - Name for the file in SharePoint
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<string>} - SharePoint file path or URL
   */
  async uploadFile(sourcePath, fileName, progressCallback = null) {
    try {
      console.log(`Uploading file to SharePoint: ${fileName}`);

      // Determine upload method if not already set
      if (!this.uploadMethod) {
        const accessTest = await this.testAccess();
        if (!accessTest.success) {
          throw new Error(accessTest.error);
        }
      }

      if (this.uploadMethod === 'onedrive') {
        return await this.uploadFileOneDrive(sourcePath, fileName, progressCallback);
      } else {
        return await this.uploadFileWeb(sourcePath, fileName, progressCallback);
      }

    } catch (error) {
      console.error('SharePoint upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload file via OneDrive sync
   * @param {string} sourcePath - Source file path
   * @param {string} fileName - Target file name
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - Local file path
   */
  async uploadFileOneDrive(sourcePath, fileName, progressCallback) {
    const oneDrivePath = await this.detectOneDriveSyncPath();
    if (!oneDrivePath) {
      throw new Error('OneDrive sync folder not accessible');
    }

    if (progressCallback) {
      progressCallback({
        phase: 'uploading',
        progress: 0,
        message: 'Copying to OneDrive sync folder...'
      });
    }

    const destinationPath = path.join(oneDrivePath, fileName);
    
    // Ensure the destination directory exists
    await fs.ensureDir(oneDrivePath);

    if (progressCallback) {
      progressCallback({
        phase: 'uploading',
        progress: 20,
        message: 'Preparing file copy...'
      });
    }

    // Copy the file
    await fs.copy(sourcePath, destinationPath, { overwrite: true });

    if (progressCallback) {
      progressCallback({
        phase: 'uploading',
        progress: 80,
        message: 'File copied - OneDrive will sync automatically...'
      });
    }

    // OneDrive will automatically sync this file to SharePoint
    if (progressCallback) {
      progressCallback({
        phase: 'complete',
        progress: 100,
        message: 'Upload completed - file will sync to SharePoint automatically'
      });
    }

    console.log('File copied to OneDrive sync folder - will sync automatically');
    return destinationPath;
  }

  /**
   * Upload file via web API (placeholder)
   * @param {string} sourcePath - Source file path
   * @param {string} fileName - Target file name
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - SharePoint URL
   */
  async uploadFileWeb(sourcePath, fileName, progressCallback) {
    throw new Error('Web upload not implemented yet - requires Microsoft Graph API authentication setup');
  }

  /**
   * Delete a file from SharePoint
   * @param {string} fileName - Name of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileName) {
    try {
      if (this.uploadMethod === 'onedrive') {
        const oneDrivePath = await this.detectOneDriveSyncPath();
        if (oneDrivePath) {
          const filePath = path.join(oneDrivePath, fileName);
          await fs.remove(filePath);
          console.log(`File deleted from OneDrive sync folder: ${fileName}`);
          return true;
        }
      }
      
      // Web deletion would go here
      return false;

    } catch (error) {
      if (error.code === 'ENOENT') {
        return true; // File doesn't exist, consider it "deleted"
      }
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Get SharePoint file URL
   * @param {string} fileName - Name of the uploaded file
   * @returns {string} - SharePoint web URL
   */
  getSharePointFileUrl(fileName) {
    if (!this.settings) return null;

    const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
    const folderPath = urlInfo.folderPath ? `/${urlInfo.folderPath}` : '';
    
    return `${urlInfo.siteUrl}/_layouts/15/Doc.aspx?sourcedoc=${fileName}&file=${fileName}`;
  }

  /**
   * Get upload method information
   * @returns {Object} - Upload method details
   */
  getUploadMethodInfo() {
    return {
      method: this.uploadMethod,
      available: this.uploadMethod !== null,
      description: this.uploadMethod === 'onedrive' 
        ? 'Files are copied to OneDrive sync folder and automatically synced to SharePoint'
        : 'Files are uploaded directly to SharePoint via web API'
    };
  }
}

module.exports = SharePointUploadService;



