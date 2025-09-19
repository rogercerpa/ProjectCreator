const { Client } = require('@microsoft/microsoft-graph-client');
const { PublicClientApplication } = require('@azure/msal-node');
const fs = require('fs-extra');
const path = require('path');

/**
 * SharePointService - Handles SharePoint integration via Microsoft Graph API
 * Provides functionality to upload files to SharePoint with authentication
 */
class SharePointService {
  constructor() {
    this.graphClient = null;
    this.msalInstance = null;
    this.isAuthenticated = false;
    this.accessToken = null;
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

    // Validate required settings
    if (!settings.authentication.clientId) {
      throw new Error('SharePoint Client ID is required for authentication');
    }

    // Initialize MSAL instance
    this.msalInstance = new PublicClientApplication({
      auth: {
        clientId: settings.authentication.clientId,
        authority: `https://login.microsoftonline.com/${settings.authentication.tenantId}`,
      },
      cache: {
        cacheLocation: 'filesystem', // Use filesystem cache for desktop app
      }
    });

    console.log('SharePoint service initialized');
  }

  /**
   * Authenticate with Microsoft Graph using device code flow
   * @returns {Promise<boolean>} - Authentication success
   */
  async authenticate() {
    try {
      if (!this.msalInstance) {
        throw new Error('SharePoint service not initialized');
      }

      console.log('Starting SharePoint authentication...');

      // Request device code
      const deviceCodeRequest = {
        scopes: ['Sites.ReadWrite.All', 'Files.ReadWrite.All'],
        deviceCodeCallback: (response) => {
          // Show device code to user
          console.log('Device code authentication required:');
          console.log(`Go to: ${response.verificationUri}`);
          console.log(`Enter code: ${response.userCode}`);
          
          // In production, show this in a modal dialog
          this.showDeviceCodeDialog(response);
        }
      };

      const response = await this.msalInstance.acquireTokenByDeviceCode(deviceCodeRequest);
      
      if (response.accessToken) {
        this.accessToken = response.accessToken;
        this.isAuthenticated = true;
        
        // Initialize Graph client
        this.graphClient = Client.init({
          authProvider: (done) => {
            done(null, this.accessToken);
          }
        });

        console.log('SharePoint authentication successful');
        return true;
      }

      return false;

    } catch (error) {
      console.error('SharePoint authentication failed:', error);
      this.isAuthenticated = false;
      throw error;
    }
  }

  /**
   * Show device code dialog to user (placeholder for UI implementation)
   * @param {Object} response - Device code response
   */
  showDeviceCodeDialog(response) {
    // This should be implemented in the UI layer
    // For now, we'll use console output
    console.log('\n=== SharePoint Authentication Required ===');
    console.log(`1. Go to: ${response.verificationUri}`);
    console.log(`2. Enter this code: ${response.userCode}`);
    console.log('3. Sign in with your Acuity Brands account');
    console.log('==========================================\n');
  }

  /**
   * Parse SharePoint URL to extract site and library information
   * @param {string} sharePointUrl - Full SharePoint URL
   * @returns {Object} - Parsed URL components
   */
  parseSharePointUrl(sharePointUrl) {
    try {
      // Example URL: https://acuitybrandsinc.sharepoint.com/:f:/r/sites/CIDesignSolutions/Shared%20Documents/LnT
      const url = new URL(sharePointUrl);
      const pathParts = url.pathname.split('/');
      
      // Find site name
      const sitesIndex = pathParts.findIndex(part => part === 'sites');
      if (sitesIndex === -1) {
        throw new Error('Invalid SharePoint URL: cannot find site');
      }
      
      const siteName = pathParts[sitesIndex + 1];
      
      // Extract library and folder from remaining path
      const remainingPath = pathParts.slice(sitesIndex + 2).join('/');
      const decodedPath = decodeURIComponent(remainingPath);
      
      // Parse path to get library and folder
      const pathSegments = decodedPath.split('/').filter(segment => segment);
      const libraryName = pathSegments[0] || 'Shared Documents';
      const folderPath = pathSegments.slice(1).join('/') || '';

      return {
        tenant: url.hostname,
        siteName,
        libraryName,
        folderPath,
        siteUrl: `${url.protocol}//${url.hostname}/sites/${siteName}`
      };

    } catch (error) {
      console.error('Failed to parse SharePoint URL:', error);
      throw new Error('Invalid SharePoint URL format');
    }
  }

  /**
   * Check if a file exists in SharePoint
   * @param {string} fileName - Name of the file to check
   * @returns {Promise<Object|null>} - File information if exists, null otherwise
   */
  async checkFileExists(fileName) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      const folderPath = urlInfo.folderPath || this.settings.targetFolder || '';
      
      // Construct the file path
      const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const encodedPath = encodeURIComponent(filePath);

      // Query the file
      const fileUrl = `/sites/${urlInfo.siteName}/drive/root:/${encodedPath}`;
      
      const file = await this.graphClient.api(fileUrl).get();
      
      return {
        id: file.id,
        name: file.name,
        size: file.size,
        lastModified: new Date(file.lastModifiedDateTime),
        downloadUrl: file['@microsoft.graph.downloadUrl']
      };

    } catch (error) {
      if (error.status === 404) {
        return null; // File doesn't exist
      }
      console.error('Error checking file existence:', error);
      throw error;
    }
  }

  /**
   * Upload a file to SharePoint
   * @param {string} filePath - Local path to the file
   * @param {string} fileName - Name for the file in SharePoint
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<string>} - SharePoint file URL
   */
  async uploadFile(filePath, fileName, progressCallback = null) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      console.log(`Uploading file to SharePoint: ${fileName}`);

      // Check file size
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      if (progressCallback) {
        progressCallback({
          phase: 'uploading',
          progress: 0,
          message: 'Starting upload to SharePoint...'
        });
      }

      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      const folderPath = urlInfo.folderPath || this.settings.targetFolder || '';
      
      let sharePointFileUrl;

      if (fileSize < 4 * 1024 * 1024) { // Less than 4MB - simple upload
        sharePointFileUrl = await this.simpleUpload(filePath, fileName, folderPath, urlInfo, progressCallback);
      } else { // Large file - use resumable upload
        sharePointFileUrl = await this.resumableUpload(filePath, fileName, folderPath, urlInfo, progressCallback);
      }

      if (progressCallback) {
        progressCallback({
          phase: 'complete',
          progress: 100,
          message: 'Upload completed successfully'
        });
      }

      console.log('File uploaded successfully to SharePoint');
      return sharePointFileUrl;

    } catch (error) {
      console.error('SharePoint upload failed:', error);
      throw error;
    }
  }

  /**
   * Simple upload for small files
   * @param {string} filePath - Local file path
   * @param {string} fileName - SharePoint file name
   * @param {string} folderPath - SharePoint folder path
   * @param {Object} urlInfo - Parsed URL information
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - File URL
   */
  async simpleUpload(filePath, fileName, folderPath, urlInfo, progressCallback) {
    const fileContent = await fs.readFile(filePath);
    const targetPath = folderPath ? `${folderPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(targetPath);

    const uploadUrl = `/sites/${urlInfo.siteName}/drive/root:/${encodedPath}:/content`;
    
    if (progressCallback) {
      progressCallback({
        phase: 'uploading',
        progress: 50,
        message: 'Uploading file...'
      });
    }

    const uploadResponse = await this.graphClient
      .api(uploadUrl)
      .put(fileContent);

    return uploadResponse.webUrl;
  }

  /**
   * Resumable upload for large files
   * @param {string} filePath - Local file path
   * @param {string} fileName - SharePoint file name
   * @param {string} folderPath - SharePoint folder path
   * @param {Object} urlInfo - Parsed URL information
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<string>} - File URL
   */
  async resumableUpload(filePath, fileName, folderPath, urlInfo, progressCallback) {
    const targetPath = folderPath ? `${folderPath}/${fileName}` : fileName;
    const encodedPath = encodeURIComponent(targetPath);
    
    // Create upload session
    const createSessionUrl = `/sites/${urlInfo.siteName}/drive/root:/${encodedPath}:/createUploadSession`;
    const uploadSession = await this.graphClient
      .api(createSessionUrl)
      .post({
        item: {
          '@microsoft.graph.conflictBehavior': 'replace'
        }
      });

    // Upload file in chunks
    const fileSize = (await fs.stat(filePath)).size;
    const chunkSize = 320 * 1024; // 320KB chunks
    let uploadedBytes = 0;

    const fileHandle = await fs.open(filePath, 'r');

    try {
      while (uploadedBytes < fileSize) {
        const remainingBytes = fileSize - uploadedBytes;
        const currentChunkSize = Math.min(chunkSize, remainingBytes);
        
        const buffer = Buffer.alloc(currentChunkSize);
        await fileHandle.read(buffer, 0, currentChunkSize, uploadedBytes);

        const range = `bytes ${uploadedBytes}-${uploadedBytes + currentChunkSize - 1}/${fileSize}`;
        
        const chunkResponse = await this.uploadChunk(uploadSession.uploadUrl, buffer, range);
        
        uploadedBytes += currentChunkSize;
        const progress = Math.round((uploadedBytes / fileSize) * 100);

        if (progressCallback) {
          progressCallback({
            phase: 'uploading',
            progress,
            message: `Uploading... ${progress}%`
          });
        }

        if (chunkResponse && chunkResponse.webUrl) {
          return chunkResponse.webUrl;
        }
      }
    } finally {
      await fileHandle.close();
    }

    throw new Error('Upload completed but no file URL returned');
  }

  /**
   * Upload a single chunk
   * @param {string} uploadUrl - Upload session URL
   * @param {Buffer} chunk - Chunk data
   * @param {string} range - Content range
   * @returns {Promise<Object>} - Upload response
   */
  async uploadChunk(uploadUrl, chunk, range) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': range,
        'Content-Length': chunk.length.toString()
      },
      body: chunk
    });

    if (response.status === 202) {
      // Chunk uploaded, more chunks expected
      return null;
    } else if (response.status === 200 || response.status === 201) {
      // Upload complete
      return await response.json();
    } else {
      throw new Error(`Upload chunk failed with status ${response.status}`);
    }
  }

  /**
   * Delete a file from SharePoint
   * @param {string} fileName - Name of the file to delete
   * @returns {Promise<boolean>} - Success status
   */
  async deleteFile(fileName) {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      const folderPath = urlInfo.folderPath || this.settings.targetFolder || '';
      const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const encodedPath = encodeURIComponent(filePath);

      const deleteUrl = `/sites/${urlInfo.siteName}/drive/root:/${encodedPath}`;
      
      await this.graphClient.api(deleteUrl).delete();
      
      console.log(`File deleted from SharePoint: ${fileName}`);
      return true;

    } catch (error) {
      if (error.status === 404) {
        console.log(`File not found for deletion: ${fileName}`);
        return true; // File doesn't exist, consider it "deleted"
      }
      console.error('Error deleting file from SharePoint:', error);
      throw error;
    }
  }

  /**
   * Test SharePoint connection
   * @returns {Promise<boolean>} - Connection test result
   */
  async testConnection() {
    try {
      if (!this.isAuthenticated) {
        await this.authenticate();
      }

      const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
      
      // Try to access the site
      const siteUrl = `/sites/${urlInfo.siteName}`;
      const site = await this.graphClient.api(siteUrl).get();
      
      console.log(`Connected to SharePoint site: ${site.displayName}`);
      return true;

    } catch (error) {
      console.error('SharePoint connection test failed:', error);
      return false;
    }
  }

  /**
   * Get the final SharePoint URL for a uploaded file
   * @param {string} fileName - Name of the uploaded file
   * @returns {string} - SharePoint file URL
   */
  getSharePointFileUrl(fileName) {
    if (!this.settings) {
      return null;
    }

    const urlInfo = this.parseSharePointUrl(this.settings.sharePointUrl);
    const folderPath = urlInfo.folderPath || this.settings.targetFolder || '';
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    
    return `${urlInfo.siteUrl}/_layouts/15/Doc.aspx?sourcedoc={${fileName}}&file=${fileName}`;
  }

  /**
   * Sign out and clear authentication
   */
  async signOut() {
    try {
      if (this.msalInstance) {
        const accounts = await this.msalInstance.getTokenCache().getAllAccounts();
        for (const account of accounts) {
          await this.msalInstance.getTokenCache().removeAccount(account);
        }
      }
      
      this.isAuthenticated = false;
      this.accessToken = null;
      this.graphClient = null;
      
      console.log('Signed out from SharePoint');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  }
}

module.exports = SharePointService;
