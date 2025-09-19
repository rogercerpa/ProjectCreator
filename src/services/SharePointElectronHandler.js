// SharePointElectronHandler.js - Electron main process handler for SharePoint uploads
// This file should be included in main.js for production

const { ipcMain } = require('electron');
const ZipService = require('./ZipService');
const SharePointBrowserUploadService = require('./SharePointBrowserUploadService');

/**
 * Setup IPC handlers for SharePoint upload functionality
 * Call this function from main.js to register the handlers
 */
function setupSharePointHandlers() {
  
  // Handler for browser-based SharePoint upload
  ipcMain.handle('sharePointBrowserUpload', async (event, { projectPath, projectData, settings }) => {
    try {
      console.log('Main process: Starting SharePoint browser upload');
      
      const zipService = new ZipService();
      const uploadService = new SharePointBrowserUploadService();
      
      // Initialize upload service with settings
      uploadService.initialize(settings || {
        enabled: true,
        sharePointUrl: 'https://acuitybrandsinc.sharepoint.com/:f:/r/sites/CIDesignSolutions/Shared%20Documents/LnT?csf=1&web=1&e=kjeeMl'
      });
      
      // Progress callback to send updates to renderer
      const progressCallback = (progressData) => {
        event.sender.send('sharePointUploadProgress', progressData);
      };
      
      // Create ZIP file in project directory
      progressCallback({ phase: 'zipping', progress: 10, message: 'Creating zip archive...' });
      const zipPath = await zipService.zipProjectFolder(projectPath, projectData, progressCallback);
      
      // Upload via browser automation
      progressCallback({ phase: 'browser', progress: 40, message: 'Launching browser for upload...' });
      const sharePointUrl = await uploadService.performUpload(zipPath, progressCallback);
      
      console.log('Main process: SharePoint upload completed successfully');
      
      return {
        success: true,
        sharePointUrl: sharePointUrl,
        zipPath: zipPath
      };
      
    } catch (error) {
      console.error('Main process: SharePoint upload failed:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  // Handler for testing SharePoint access
  ipcMain.handle('testSharePointAccess', async (event, sharePointUrl) => {
    try {
      console.log('Main process: Testing SharePoint access');
      
      const uploadService = new SharePointBrowserUploadService();
      uploadService.initialize({
        enabled: true,
        sharePointUrl: sharePointUrl
      });
      
      // Parse URL to validate format
      const urlInfo = uploadService.parseSharePointUrl(sharePointUrl);
      
      return {
        success: true,
        method: 'browser',
        message: 'SharePoint URL parsed successfully - browser automation ready',
        siteUrl: urlInfo.siteUrl,
        siteName: urlInfo.siteName,
        folderPath: urlInfo.folderPath
      };
      
    } catch (error) {
      console.error('Main process: SharePoint access test failed:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  console.log('SharePoint IPC handlers registered');
}

module.exports = { setupSharePointHandlers };
