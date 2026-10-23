// IPC handlers — OneDrive/SharePoint sync uploads.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog } = require('electron');

module.exports = function registerOneDriveIpc(context) {
  const { activeUploads, oneDriveSyncService, zipService, getMainWindow } = context;
  // OneDrive sync upload handlers
  ipcMain.handle('oneDriveSyncUpload', async (event, { projectPath, projectData, settings }) => {
    const uploadId = `onedrive-${projectData?.id || 'unknown'}-${Date.now()}`;

    try {
      // Track active upload
      activeUploads.add(uploadId);

      console.log('Main process: Starting OneDrive sync upload');

      // Initialize sync service with settings
      oneDriveSyncService.initialize(
        settings || {
          enabled: true,
          syncFolderPath: '',
          cleanupStrategy: 'auto-delete'
        }
      );

      // Progress callback to send updates to renderer
      const progressCallback = (progressData) => {
        console.log('Progress update:', progressData);
        event.sender.send('oneDriveSyncProgress', progressData);
      };

      // Create ZIP file in project directory
      progressCallback({ phase: 'zipping', progress: 10, message: 'Creating zip archive...' });
      const zipPath = await zipService.zipProjectFolder(projectPath, projectData, progressCallback);

      console.log('ZIP file created at:', zipPath);

      // Upload via OneDrive sync with progress monitoring
      progressCallback({ phase: 'syncing', progress: 40, message: 'Copying to OneDrive sync folder...' });
      const uploadResult = await oneDriveSyncService.uploadToSync(zipPath, settings.syncFolderPath, {
        overwrite: true,
        waitForSync: true,
        syncTimeout: 120000, // 2 minutes
        cleanupStrategy: settings.cleanupStrategy || 'auto-delete',
        progressCallback: progressCallback // Pass through for sync status updates
      });

      console.log('Main process: OneDrive sync upload completed');
      console.log('Sync status:', uploadResult.syncStatus);
      console.log('Sync message:', uploadResult.syncMessage);

      // Final progress update based on sync status
      if (uploadResult.synced) {
        progressCallback({
          phase: 'complete',
          progress: 100,
          message: 'File synced to SharePoint successfully!',
          syncStatus: 'synced'
        });
      } else {
        progressCallback({
          phase: 'complete',
          progress: 95,
          message: uploadResult.syncMessage || 'File copied to OneDrive - syncing in background',
          syncStatus: uploadResult.syncStatus || 'pending'
        });
      }

      // Remove from active uploads
      activeUploads.delete(uploadId);

      return {
        success: true,
        uploadResult: uploadResult,
        zipPath: zipPath,
        syncStatus: uploadResult.syncStatus,
        synced: uploadResult.synced
      };
    } catch (error) {
      // Remove from active uploads on error
      activeUploads.delete(uploadId);

      console.error('Main process: OneDrive sync upload failed:', error);

      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler to check active uploads (for renderer to query)
  ipcMain.handle('check-active-uploads', async () => {
    return {
      hasActiveUploads: activeUploads.size > 0,
      count: activeUploads.size
    };
  });

  // Handler for detecting OneDrive sync folders
  ipcMain.handle('detectOneDriveSync', async () => {
    try {
      console.log('Main process: Detecting OneDrive sync folders');

      const syncFolders = await oneDriveSyncService.findSharePointSyncFolders();

      return {
        success: true,
        syncFolders: syncFolders,
        message: `Found ${syncFolders.length} potential SharePoint sync folders`
      };
    } catch (error) {
      console.error('Main process: OneDrive sync detection failed:', error);

      return {
        success: false,
        error: error.message,
        syncFolders: []
      };
    }
  });

  // Handler for testing sync folder
  ipcMain.handle('testSyncFolder', async (event, syncFolderPath) => {
    try {
      console.log('Main process: Testing sync folder:', syncFolderPath);

      const verification = await oneDriveSyncService.verifySyncFolder(syncFolderPath);

      return {
        success: verification.valid,
        writable: verification.writable,
        hasSyncIndicators: verification.hasSyncIndicators,
        message: verification.valid
          ? 'Sync folder is valid and ready for uploads'
          : `Invalid sync folder: ${verification.error}`
      };
    } catch (error) {
      console.error('Main process: Sync folder test failed:', error);

      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handler for browsing sync folder
  ipcMain.handle('browseForSyncFolder', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        properties: ['openDirectory'],
        title: 'Select OneDrive SharePoint Sync Folder',
        message: 'Choose the OneDrive folder that syncs with your SharePoint site'
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      const selectedPath = result.filePaths[0];
      console.log('User selected sync folder:', selectedPath);

      // Test the selected folder
      const verification = await oneDriveSyncService.verifySyncFolder(selectedPath);

      return {
        success: true,
        folderPath: selectedPath,
        verification: verification
      };
    } catch (error) {
      console.error('Error browsing for sync folder:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== WORKLOAD DASHBOARD IPC HANDLERS =====
};
