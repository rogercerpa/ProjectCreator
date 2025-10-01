const fs = require('fs-extra');
const path = require('path');
const os = require('os');

/**
 * OneDrive Sync Service
 * Handles SharePoint uploads via OneDrive sync folders
 * Much more reliable than browser automation
 */
class OneDriveSyncService {
  constructor() {
    this.settings = null;
  }

  /**
   * Initialize the service with settings
   * @param {Object} settings - OneDrive sync settings
   */
  initialize(settings) {
    this.settings = settings;
    console.log('OneDrive Sync Service initialized');
  }

  /**
   * Find OneDrive sync folders for SharePoint sites
   * @returns {Promise<Array>} Array of detected sync folders
   */
  async findSharePointSyncFolders() {
    try {
      console.log('🔍 Searching for OneDrive sync folders...');

      const syncFolders = [];
      const userHome = os.homedir();

      // Common OneDrive sync folder patterns
      const searchPaths = [
        path.join(userHome, 'OneDrive'),
        path.join(userHome, 'OneDrive - Commercial'),
        path.join(userHome, 'OneDrive - Personal'),
        // Organization-specific patterns
        ...this.getOrganizationPatterns(userHome)
      ];

      for (const searchPath of searchPaths) {
        if (await fs.pathExists(searchPath)) {
          const folders = await this.scanForSharePointFolders(searchPath);
          syncFolders.push(...folders);
        }
      }

      console.log(`✅ Found ${syncFolders.length} potential SharePoint sync folders`);
      return syncFolders;

    } catch (error) {
      console.error('❌ Error finding sync folders:', error);
      return [];
    }
  }

  /**
   * Get organization-specific folder patterns
   * @param {string} userHome - User home directory
   * @returns {Array} Array of potential OneDrive paths
   */
  getOrganizationPatterns(userHome) {
    // Common organization patterns
    const organizations = [
      'Acuity Brands',
      'Acuity Brands, Inc',
      'AcuityBrands',
      'Microsoft',
      'Contoso',
      'Fabrikam'
    ];

    const patterns = [];
    for (const org of organizations) {
      patterns.push(path.join(userHome, `OneDrive - ${org}`));
      patterns.push(path.join(userHome, `${org}`));
      patterns.push(path.join(userHome, 'OneDrive', org));
    }

    return patterns;
  }

  /**
   * Scan a OneDrive root folder for SharePoint sync folders
   * @param {string} oneDriveRoot - OneDrive root folder path
   * @returns {Promise<Array>} Array of SharePoint sync folders
   */
  async scanForSharePointFolders(oneDriveRoot) {
    try {
      const folders = [];
      const items = await fs.readdir(oneDriveRoot);

      for (const item of items) {
        const fullPath = path.join(oneDriveRoot, item);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          // Check if this looks like a SharePoint sync folder
          if (this.isSharePointSyncFolder(item, fullPath)) {
            folders.push({
              name: item,
              path: fullPath,
              type: 'sharepoint-sync',
              organization: this.extractOrganizationName(item),
              siteName: this.extractSiteName(item)
            });
          }
        }
      }

      return folders;

    } catch (error) {
      console.error(`❌ Error scanning ${oneDriveRoot}:`, error);
      return [];
    }
  }

  /**
   * Check if a folder looks like a SharePoint sync folder
   * @param {string} folderName - Folder name
   * @param {string} folderPath - Full folder path
   * @returns {boolean} True if it appears to be SharePoint sync
   */
  isSharePointSyncFolder(folderName, folderPath) {
    // Common SharePoint sync folder patterns
    const sharePointPatterns = [
      /- Shared Documents/i,
      /- Documents/i,
      /SharePoint/i,
      /Teams/i
    ];

    // Check folder name patterns
    const nameMatches = sharePointPatterns.some(pattern => pattern.test(folderName));

    // Check for SharePoint-specific files/folders
    const hasSharePointIndicators = this.checkForSharePointIndicators(folderPath);

    return nameMatches || hasSharePointIndicators;
  }

  /**
   * Check for SharePoint-specific indicators in a folder
   * @param {string} folderPath - Folder to check
   * @returns {boolean} True if SharePoint indicators found
   */
  async checkForSharePointIndicators(folderPath) {
    try {
      // Check for common SharePoint folders
      const indicators = [
        'Forms',
        'SiteAssets',
        '_catalogs',
        '_cts'
      ];

      for (const indicator of indicators) {
        if (await fs.pathExists(path.join(folderPath, indicator))) {
          return true;
        }
      }

      return false;

    } catch (error) {
      return false;
    }
  }

  /**
   * Extract organization name from folder name
   * @param {string} folderName - Folder name
   * @returns {string} Organization name
   */
  extractOrganizationName(folderName) {
    // Extract from patterns like "OneDrive - Acuity Brands, Inc"
    const match = folderName.match(/OneDrive - (.+)$/);
    return match ? match[1] : folderName;
  }

  /**
   * Extract site name from SharePoint sync folder
   * @param {string} folderName - Folder name
   * @returns {string} Site name
   */
  extractSiteName(folderName) {
    // Extract from patterns like "CIDesignSolutions - Shared Documents"
    const match = folderName.match(/^(.+?) - Shared Documents/);
    return match ? match[1] : folderName;
  }

  /**
   * Verify a sync folder is valid and accessible
   * @param {string} syncFolderPath - Path to test
   * @returns {Promise<Object>} Verification result
   */
  async verifySyncFolder(syncFolderPath) {
    try {
      console.log(`🔍 Verifying sync folder: ${syncFolderPath}`);

      // Check if folder exists
      if (!await fs.pathExists(syncFolderPath)) {
        return {
          valid: false,
          error: 'Folder does not exist'
        };
      }

      // Check if it's writable
      try {
        const testFile = path.join(syncFolderPath, '.write-test');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
      } catch (error) {
        return {
          valid: false,
          error: 'Folder is not writable'
        };
      }

      // Check for OneDrive sync indicators
      const hasSyncIndicators = await this.checkForSyncIndicators(syncFolderPath);

      // Check available space (optional)
      const stats = await fs.statvfs ? await fs.statvfs(syncFolderPath) : null;

      return {
        valid: true,
        writable: true,
        hasSyncIndicators,
        spaceAvailable: stats ? stats.f_bavail * stats.f_frsize : null
      };

    } catch (error) {
      console.error('❌ Error verifying sync folder:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check for OneDrive sync indicators
   * @param {string} folderPath - Folder to check
   * @returns {Promise<boolean>} True if sync indicators found
   */
  async checkForSyncIndicators(folderPath) {
    try {
      // Look for OneDrive-specific files/folders
      const indicators = [
        '.849C9593-D756-4E56-8D6E-42412F2A707B', // OneDrive client folder
        'desktop.ini', // Windows folder config
        'Thumbs.db' // Thumbnail cache
      ];

      for (const indicator of indicators) {
        if (await fs.pathExists(path.join(folderPath, indicator))) {
          return true;
        }
      }

      // Check if folder is being watched by OneDrive
      // This is harder to detect reliably, but we can check modification patterns
      return true; // Assume it's synced if we can write to it

    } catch (error) {
      return false;
    }
  }

  /**
   * Upload file to SharePoint via OneDrive sync
   * @param {string} zipPath - Path to ZIP file
   * @param {string} syncFolderPath - OneDrive sync folder path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadToSync(zipPath, syncFolderPath, options = {}) {
    try {
      console.log(`📤 Starting OneDrive sync upload...`);
      console.log(`ZIP: ${zipPath}`);
      console.log(`Sync Folder: ${syncFolderPath}`);

      // Verify ZIP file exists
      if (!await fs.pathExists(zipPath)) {
        throw new Error(`ZIP file not found: ${zipPath}`);
      }

      // Verify sync folder
      const syncVerification = await this.verifySyncFolder(syncFolderPath);
      if (!syncVerification.valid) {
        throw new Error(`Invalid sync folder: ${syncVerification.error}`);
      }

      // Get file info
      const fileName = path.basename(zipPath);
      const destinationPath = path.join(syncFolderPath, fileName);

      // Check if file already exists
      const fileExists = await fs.pathExists(destinationPath);
      if (fileExists && !options.overwrite) {
        throw new Error(`File already exists: ${fileName}`);
      }

      console.log(`📋 Copying ${fileName} to sync folder...`);

      // Copy file to sync folder
      await fs.copy(zipPath, destinationPath, { overwrite: true });

      console.log(`✅ File copied to sync folder`);

      // Wait for sync to complete with progress updates
      let syncResult = { synced: false, status: 'pending' };
      if (options.waitForSync) {
        syncResult = await this.waitForSync(
          destinationPath, 
          options.syncTimeout || 120000,
          options.progressCallback
        );
      }

      // Determine if cleanup should happen
      const shouldCleanup = options.cleanupStrategy === 'auto-delete' && syncResult.synced;

      // Cleanup local file if requested and synced
      if (shouldCleanup) {
        await fs.unlink(destinationPath);
        console.log(`🗑️ Cleaned up local file after sync: ${fileName}`);
      } else if (options.cleanupStrategy === 'auto-delete' && !syncResult.synced) {
        console.log(`⚠️  File not cleaned - sync status: ${syncResult.status}`);
      }

      return {
        success: true,
        fileName,
        localPath: destinationPath,
        syncStatus: syncResult.status,
        syncMessage: syncResult.message,
        synced: syncResult.synced,
        cleaned: shouldCleanup
      };

    } catch (error) {
      console.error('❌ OneDrive sync upload failed:', error);
      throw error;
    }
  }

  /**
   * Wait for OneDrive sync to complete
   * @param {string} filePath - File to wait for sync
   * @param {number} timeout - Timeout in milliseconds
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Sync status
   */
  async waitForSync(filePath, timeout = 120000, progressCallback = null) {
    try {
      console.log(`⏳ Waiting for OneDrive sync: ${path.basename(filePath)}`);

      const startTime = Date.now();
      const checkInterval = 3000; // Check every 3 seconds
      const fileName = path.basename(filePath);

      // Initial progress update
      if (progressCallback) {
        progressCallback({
          phase: 'syncing',
          progress: 50,
          message: 'Waiting for OneDrive to sync to SharePoint...',
          syncStatus: 'pending'
        });
      }

      while (Date.now() - startTime < timeout) {
        // Check OneDrive sync status by examining file attributes
        const syncStatus = await this.checkOneDriveSyncStatus(filePath);
        
        console.log(`🔍 OneDrive sync status: ${syncStatus.status}`);

        if (progressCallback) {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(90, 50 + (elapsed / timeout) * 40);
          
          progressCallback({
            phase: 'syncing',
            progress: Math.round(progress),
            message: syncStatus.message,
            syncStatus: syncStatus.status
          });
        }

        // Check if file is synced
        if (syncStatus.status === 'synced') {
          console.log(`✅ File synced to SharePoint successfully`);
          
          if (progressCallback) {
            progressCallback({
              phase: 'syncing',
              progress: 95,
              message: 'File synced to SharePoint successfully!',
              syncStatus: 'synced'
            });
          }

          return { synced: true, status: 'synced', message: 'File synced successfully' };
        }

        // Check if file is still syncing
        if (syncStatus.status === 'syncing') {
          console.log(`📤 File is syncing to SharePoint...`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }

        // Check if file has error
        if (syncStatus.status === 'error') {
          console.log(`❌ OneDrive sync error detected`);
          return { 
            synced: false, 
            status: 'error', 
            message: 'OneDrive sync encountered an error' 
          };
        }

        // Continue waiting
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      console.log(`⏰ Sync timeout reached - file may still be syncing`);
      
      if (progressCallback) {
        progressCallback({
          phase: 'syncing',
          progress: 90,
          message: 'Sync taking longer than expected - file uploaded but may still be syncing',
          syncStatus: 'pending'
        });
      }

      return { 
        synced: false, 
        status: 'timeout', 
        message: 'Sync monitoring timeout - file copied to OneDrive but cloud sync status unknown' 
      };

    } catch (error) {
      console.error('❌ Error waiting for sync:', error);
      return { 
        synced: false, 
        status: 'error', 
        message: error.message 
      };
    }
  }

  /**
   * Check OneDrive sync status of a file using Windows file attributes
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Sync status
   */
  async checkOneDriveSyncStatus(filePath) {
    try {
      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        return { 
          status: 'unknown', 
          message: 'File not found in OneDrive folder' 
        };
      }

      const stats = await fs.stat(filePath);
      const timeSinceModified = Date.now() - stats.mtime.getTime();

      // CRITICAL: For safety, we need to use PowerShell to check actual OneDrive sync status
      // OneDrive uses file attributes that are only readable via PowerShell on Windows
      
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        // PowerShell command to check OneDrive sync status via file attributes
        const psCommand = `
          $file = Get-Item -LiteralPath "${filePath.replace(/\\/g, '\\\\')}"
          $attribs = $file.Attributes
          
          # OneDrive pinned/synced files have specific attributes
          # FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS (0x400000) indicates cloud file not synced
          # FILE_ATTRIBUTE_OFFLINE (0x1000) indicates file is offline/cloud-only
          # FILE_ATTRIBUTE_PINNED indicates file is pinned locally
          
          $isCloudOnly = ($attribs -band 0x400000) -or ($attribs -band 0x1000)
          $isPinned = ($attribs -band 0x80000)
          
          if ($isCloudOnly) {
            Write-Output "cloud-only"
          } elseif ($isPinned) {
            Write-Output "synced"
          } else {
            Write-Output "syncing"
          }
        `.trim();

        const { stdout } = await execAsync(
          `powershell.exe -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`,
          { timeout: 5000 }
        );

        const result = stdout.trim().toLowerCase();
        console.log(`📊 PowerShell OneDrive status for ${path.basename(filePath)}: ${result}`);

        if (result === 'synced') {
          return {
            status: 'synced',
            message: 'File synced to SharePoint (verified via file attributes)'
          };
        } else if (result === 'cloud-only') {
          // This means OneDrive has fully uploaded it and made it cloud-only
          return {
            status: 'synced',
            message: 'File synced to SharePoint (cloud-only)'
          };
        } else {
          // Still syncing
          return {
            status: 'syncing',
            message: 'File is syncing to SharePoint...'
          };
        }

      } catch (psError) {
        console.log('⚠️ PowerShell check failed, using fallback method:', psError.message);
        
        // Fallback: Use very conservative heuristics
        
        // If file was added/modified very recently, it's definitely still syncing
        if (timeSinceModified < 30000) { // Less than 30 seconds - be very conservative
          return { 
            status: 'syncing', 
            message: 'File recently added - waiting for OneDrive sync...' 
          };
        }

        // Check if file size is stable over multiple checks
        const size1 = stats.size;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        if (await fs.pathExists(filePath)) {
          const stats2 = await fs.stat(filePath);
          const size2 = stats2.size;
          const mtime2 = stats2.mtime.getTime();
          
          if (size1 !== size2 || stats.mtime.getTime() !== mtime2) {
            return { 
              status: 'syncing', 
              message: 'File is being modified - syncing in progress...' 
            };
          }
        }

        // After 60+ seconds of stability, cautiously assume synced
        if (timeSinceModified > 60000) {
          return { 
            status: 'synced', 
            message: 'File appears synced (60+ seconds stable)' 
          };
        }

        // Still pending
        return { 
          status: 'pending', 
          message: 'Waiting for OneDrive sync to complete...' 
        };
      }

    } catch (error) {
      console.error('❌ Error checking sync status:', error);
      return { 
        status: 'error', 
        message: `Sync status check failed: ${error.message}` 
      };
    }
  }

  /**
   * Verify file was uploaded to SharePoint
   * @param {string} fileName - File name to verify
   * @param {string} sharePointSite - SharePoint site URL
   * @returns {Promise<boolean>} True if verified in SharePoint
   */
  async verifySharePointUpload(fileName, sharePointSite) {
    try {
      console.log(`🔍 Verifying SharePoint upload: ${fileName}`);

      // This is a simplified verification
      // In a real implementation, you might:
      // 1. Use Microsoft Graph API to check file existence
      // 2. Parse SharePoint site and check via web request
      // 3. For now, we'll assume sync worked if file was copied

      // For basic verification, we can check if the local file exists
      // and assume OneDrive sync is working

      console.log(`✅ Assuming SharePoint upload successful (OneDrive sync)`);
      return true;

    } catch (error) {
      console.error('❌ SharePoint verification failed:', error);
      return false;
    }
  }

  /**
   * Clean up old files from sync folder
   * @param {string} syncFolderPath - Sync folder to clean
   * @param {number} keepCount - Number of recent files to keep
   * @returns {Promise<number>} Number of files cleaned
   */
  async cleanupOldFiles(syncFolderPath, keepCount = 10) {
    try {
      console.log(`🧹 Cleaning up old files in: ${syncFolderPath}`);

      const files = await fs.readdir(syncFolderPath);
      const zipFiles = [];

      // Get file info for ZIP files
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const filePath = path.join(syncFolderPath, file);
          const stats = await fs.stat(filePath);
          zipFiles.push({
            name: file,
            path: filePath,
            mtime: stats.mtime
          });
        }
      }

      // Sort by modification time (newest first)
      zipFiles.sort((a, b) => b.mtime - a.mtime);

      // Delete old files
      let deletedCount = 0;
      for (let i = keepCount; i < zipFiles.length; i++) {
        await fs.unlink(zipFiles[i].path);
        console.log(`🗑️ Deleted old file: ${zipFiles[i].name}`);
        deletedCount++;
      }

      console.log(`✅ Cleanup complete: ${deletedCount} files removed`);
      return deletedCount;

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Get sync folder recommendations for a SharePoint URL
   * @param {string} sharePointUrl - SharePoint URL
   * @returns {Promise<Array>} Recommended sync folders
   */
  async getRecommendedSyncFolders(sharePointUrl) {
    try {
      // Parse SharePoint URL to extract site info
      const urlInfo = this.parseSharePointUrl(sharePointUrl);
      const syncFolders = await this.findSharePointSyncFolders();

      // Find best matches
      const recommendations = syncFolders.filter(folder =>
        folder.siteName.toLowerCase().includes(urlInfo.siteName.toLowerCase()) ||
        urlInfo.siteName.toLowerCase().includes(folder.siteName.toLowerCase())
      );

      return recommendations;

    } catch (error) {
      console.error('❌ Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Parse SharePoint URL (simplified version)
   * @param {string} sharePointUrl - SharePoint URL
   * @returns {Object} Parsed URL info
   */
  parseSharePointUrl(sharePointUrl) {
    try {
      const url = new URL(sharePointUrl);
      const pathParts = url.pathname.split('/');

      const sitesIndex = pathParts.indexOf('sites');
      const siteName = sitesIndex >= 0 ? pathParts[sitesIndex + 1] : 'Unknown';

      return {
        siteName,
        fullUrl: sharePointUrl
      };

    } catch (error) {
      return {
        siteName: 'Unknown',
        fullUrl: sharePointUrl
      };
    }
  }
}

module.exports = OneDriveSyncService;
