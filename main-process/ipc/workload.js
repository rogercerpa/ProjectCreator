// IPC handlers — Workload dashboard, Excel sync, and Google Sheets sync.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog } = require('electron');
const FileWatcherService = require('../services/FileWatcherService');

module.exports = function registerWorkloadIpc(context) {
  const {
    workloadPersistenceService,
    getMainWindow,
    fieldMappingService,
    settingsService,
    workloadExcelService,
    projectPersistenceService,
    workloadExcelSyncService,
    googleSheetSyncService
  } = context;
  let fileWatcherService = null; // Initialized when user configures shared folder

  // Workload data operations
  ipcMain.handle('workload:load-all', async () => {
    try {
      return await workloadPersistenceService.loadWorkloads();
    } catch (error) {
      console.error('Error loading workloads:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:load-user', async (event, userId) => {
    try {
      return await workloadPersistenceService.loadUserWorkload(userId);
    } catch (error) {
      console.error('Error loading user workload:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:save', async (event, userId, workload) => {
    try {
      return await workloadPersistenceService.saveUserWorkload(userId, workload);
    } catch (error) {
      console.error('Error saving workload:', error);
      return { success: false, error: error.message };
    }
  });

  // User operations
  ipcMain.handle('workload:users-load-all', async () => {
    try {
      return await workloadPersistenceService.loadUsers();
    } catch (error) {
      console.error('Error loading users:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:user-save', async (event, user) => {
    try {
      return await workloadPersistenceService.saveUser(user);
    } catch (error) {
      console.error('Error saving user:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:user-get', async (event, userId) => {
    try {
      return await workloadPersistenceService.getUser(userId);
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:user-delete', async (event, userId) => {
    try {
      return await workloadPersistenceService.deleteUser(userId);
    } catch (error) {
      console.error('Error deleting user:', error);
      return { success: false, error: error.message };
    }
  });

  // Assignment operations
  ipcMain.handle('workload:assignments-load-all', async () => {
    try {
      return await workloadPersistenceService.loadAssignments();
    } catch (error) {
      console.error('Error loading assignments:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:assignment-save', async (event, assignment) => {
    try {
      const result = await workloadPersistenceService.saveAssignment(assignment);
      return result;
    } catch (error) {
      console.error('Error saving assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:assignment-delete', async (event, assignmentId) => {
    try {
      const result = await workloadPersistenceService.deleteAssignment(assignmentId);
      return result;
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:assignments-by-date-range', async (event, startDate, endDate) => {
    try {
      return await workloadPersistenceService.getAssignmentsByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Error getting assignments by date range:', error);
      return { success: false, error: error.message };
    }
  });

  // Statistics
  ipcMain.handle('workload:stats', async () => {
    try {
      return await workloadPersistenceService.getStats();
    } catch (error) {
      console.error('Error getting workload stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Configuration
  ipcMain.handle('workload:config-save', async (event, config) => {
    try {
      return await workloadPersistenceService.saveConfig(config);
    } catch (error) {
      console.error('Error saving workload config:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:config-load', async () => {
    try {
      return await workloadPersistenceService.loadConfig();
    } catch (error) {
      console.error('Error loading workload config:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:set-data-directory', async (event, directoryPath) => {
    try {
      await workloadPersistenceService.setDataDirectory(directoryPath);

      // Restart file watcher with new directory
      if (fileWatcherService) {
        await fileWatcherService.stopWatching();
      }

      fileWatcherService = new FileWatcherService(directoryPath);
      await fileWatcherService.startWatching();

      // Setup file watcher event handlers
      fileWatcherService.on('workload:changed', (data) => {
        if (getMainWindow()) {
          getMainWindow().webContents.send('workload:file-changed', data);
        }
      });

      fileWatcherService.on('users:changed', (data) => {
        if (getMainWindow()) {
          getMainWindow().webContents.send('workload:users-file-changed', data);
        }
      });

      fileWatcherService.on('assignments:changed', (data) => {
        if (getMainWindow()) {
          getMainWindow().webContents.send('workload:assignments-file-changed', data);
        }
      });

      return { success: true, message: 'Data directory updated' };
    } catch (error) {
      console.error('Error setting data directory:', error);
      return { success: false, error: error.message };
    }
  });

  // File watcher operations
  ipcMain.handle('workload:file-watcher-start', async (event, directoryPath) => {
    try {
      if (!fileWatcherService) {
        fileWatcherService = new FileWatcherService(directoryPath);
      }

      const result = await fileWatcherService.startWatching();

      // Setup event handlers if not already set
      if (result.success) {
        fileWatcherService.removeAllListeners(); // Remove any old listeners

        fileWatcherService.on('workload:changed', (data) => {
          if (getMainWindow()) {
            getMainWindow().webContents.send('workload:file-changed', data);
          }
        });

        fileWatcherService.on('users:changed', (data) => {
          if (getMainWindow()) {
            getMainWindow().webContents.send('workload:users-file-changed', data);
          }
        });

        fileWatcherService.on('assignments:changed', (data) => {
          if (getMainWindow()) {
            getMainWindow().webContents.send('workload:assignments-file-changed', data);
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Error starting file watcher:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:file-watcher-stop', async () => {
    try {
      if (fileWatcherService) {
        return await fileWatcherService.stopWatching();
      }
      return { success: true, message: 'File watcher not running' };
    } catch (error) {
      console.error('Error stopping file watcher:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload:file-watcher-status', async () => {
    try {
      if (fileWatcherService) {
        return { success: true, status: fileWatcherService.getStatus() };
      }
      return { success: true, status: { isWatching: false } };
    } catch (error) {
      console.error('Error getting file watcher status:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== WORKLOAD EXCEL SYNC IPC HANDLERS =====

  // Field Mapping operations
  ipcMain.handle('workload-excel:field-mapping-get', async () => {
    try {
      const result = await fieldMappingService.getFieldMapping(settingsService);
      return result;
    } catch (error) {
      console.error('Error getting field mapping:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:field-mapping-save', async (event, mapping) => {
    try {
      const result = await fieldMappingService.saveFieldMapping(settingsService, mapping);
      return result;
    } catch (error) {
      console.error('Error saving field mapping:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:field-mapping-reset', async () => {
    try {
      const result = await fieldMappingService.resetToDefault(settingsService);
      return result;
    } catch (error) {
      console.error('Error resetting field mapping:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:field-mapping-validate', async (event, mapping) => {
    try {
      const validation = fieldMappingService.validateMapping(mapping);
      return { success: true, validation };
    } catch (error) {
      console.error('Error validating field mapping:', error);
      return { success: false, error: error.message };
    }
  });

  // Excel file operations
  ipcMain.handle('workload-excel:test-file-path', async (event, filePath) => {
    try {
      const result = await workloadExcelService.testFilePath(filePath);
      return result;
    } catch (error) {
      console.error('Error testing file path:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:browse-file', async () => {
    try {
      // Use save dialog to allow creating a new file
      const result = await dialog.showSaveDialog(getMainWindow(), {
        title: 'Select or Create Excel Workload File',
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        defaultPath: 'ProjectWorkload.xlsx'
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'No file selected', canceled: true };
      }

      let filePath = result.filePath;

      // Ensure file path ends with .xlsx
      const path = require('path');
      if (!filePath.toLowerCase().endsWith('.xlsx')) {
        filePath = filePath + '.xlsx';
      }

      // Validate the path using the service
      const pathInfo = await workloadExcelService.validateFilePath(filePath);
      if (!pathInfo.isValid) {
        return { success: false, error: pathInfo.error };
      }

      const normalizedPath = pathInfo.path;

      // Check if we can write to the directory
      const fs = require('fs-extra');
      const dir = path.dirname(normalizedPath);

      try {
        await fs.ensureDir(dir);
        await fs.access(dir, fs.constants.W_OK);
        return { success: true, filePath: normalizedPath, isNew: !(await fs.pathExists(normalizedPath)) };
      } catch (error) {
        return { success: false, error: `Cannot access directory: ${error.message}` };
      }
    } catch (error) {
      console.error('Error browsing for Excel file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:initialize-workbook', async (event, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.initializeWorkbook(filePath, fieldMappingResult.mapping);
      return result;
    } catch (error) {
      console.error('Error initializing workbook:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:get-headers', async (event, filePath, sheetName) => {
    try {
      const result = await workloadExcelService.getExcelHeaders(filePath, sheetName);
      return result;
    } catch (error) {
      console.error('Error getting Excel headers:', error);
      return { success: false, error: error.message };
    }
  });

  // Export operations
  ipcMain.handle('workload-excel:export-projects', async (event, projects, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.exportProjectsToExcel(projects, filePath, fieldMappingResult.mapping);
      return result;
    } catch (error) {
      console.error('Error exporting projects:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:export-assignments', async (event, assignments, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.exportAssignmentsToExcel(
        assignments,
        filePath,
        fieldMappingResult.mapping
      );
      return result;
    } catch (error) {
      console.error('Error exporting assignments:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:export-users', async (event, users, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.exportUsersToExcel(users, filePath, fieldMappingResult.mapping);
      return result;
    } catch (error) {
      console.error('Error exporting users:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:export-all', async (event, data, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.exportAllToExcel(data, filePath, fieldMappingResult.mapping);
      return result;
    } catch (error) {
      console.error('Error exporting all data:', error);
      return { success: false, error: error.message };
    }
  });

  // Optimize/repair Excel file (removes styles to fix file bloat)
  ipcMain.handle('workload-excel:optimize-file', async (event, filePath) => {
    try {
      const result = await workloadExcelService.optimizeExcelFile(filePath);
      return result;
    } catch (error) {
      console.error('Error optimizing Excel file:', error);
      return { success: false, error: error.message };
    }
  });

  // Import operations
  ipcMain.handle('workload-excel:import-projects', async (event, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.importProjectsFromExcel(filePath, fieldMappingResult.mapping);

      // If import successful, update local persistence
      if (result.success && result.projects) {
        for (const project of result.projects) {
          // Update project in persistence if it exists, or create new
          await projectPersistenceService.saveProject(project);
        }
      }

      return result;
    } catch (error) {
      console.error('Error importing projects:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:import-assignments', async (event, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.importAssignmentsFromExcel(filePath, fieldMappingResult.mapping);

      // If import successful, update local persistence
      if (result.success && result.assignments) {
        for (const assignment of result.assignments) {
          await workloadPersistenceService.saveAssignment(assignment);
        }
      }

      return result;
    } catch (error) {
      console.error('Error importing assignments:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:import-users', async (event, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.importUsersFromExcel(filePath, fieldMappingResult.mapping);

      // If import successful, update local persistence
      if (result.success && result.users) {
        for (const user of result.users) {
          await workloadPersistenceService.saveUser(user);
        }
      }

      return result;
    } catch (error) {
      console.error('Error importing users:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:import-all', async (event, filePath) => {
    try {
      const fieldMappingResult = await fieldMappingService.getFieldMapping(settingsService);
      if (!fieldMappingResult.success) {
        return { success: false, error: 'Failed to load field mapping' };
      }

      const result = await workloadExcelService.importAllFromExcel(filePath, fieldMappingResult.mapping);

      // If import successful, update local persistence for all data types
      if (result.success && result.data) {
        // Update projects
        if (result.data.projects) {
          for (const project of result.data.projects) {
            await projectPersistenceService.saveProject(project);
          }
        }

        // Update assignments
        if (result.data.assignments) {
          for (const assignment of result.data.assignments) {
            await workloadPersistenceService.saveAssignment(assignment);
          }
        }

        // Update users
        if (result.data.users) {
          for (const user of result.data.users) {
            await workloadPersistenceService.saveUser(user);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error importing all data:', error);
      return { success: false, error: error.message };
    }
  });

  // Sync settings operations
  ipcMain.handle('workload-excel:sync-settings-get', async () => {
    try {
      const result = await workloadExcelSyncService.getSyncSettings();
      return result;
    } catch (error) {
      console.error('Error getting sync settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:sync-settings-update', async (event, newSettings) => {
    try {
      const result = await workloadExcelSyncService.updateSyncSettings(newSettings);
      return result;
    } catch (error) {
      console.error('Error updating sync settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Sync operations
  ipcMain.handle('workload-excel:sync-start-auto', async (event, filePath) => {
    try {
      const result = await workloadExcelSyncService.startAutoSync(filePath);
      return result;
    } catch (error) {
      console.error('Error starting auto-sync:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:sync-stop-auto', async () => {
    try {
      const result = await workloadExcelSyncService.stopAutoSync();
      return result;
    } catch (error) {
      console.error('Error stopping auto-sync:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:sync-from-excel', async (event, filePath) => {
    try {
      const result = await workloadExcelSyncService.syncFromExcel(filePath);

      // If sync import successful, update local persistence for all data types
      if (result.success && result.data) {
        // Update projects
        if (result.data.projects) {
          for (const project of result.data.projects) {
            await projectPersistenceService.saveProject(project);
          }
        }

        // Update assignments
        if (result.data.assignments) {
          for (const assignment of result.data.assignments) {
            await workloadPersistenceService.saveAssignment(assignment);
          }
        }

        // Update users
        if (result.data.users) {
          for (const user of result.data.users) {
            await workloadPersistenceService.saveUser(user);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error syncing from Excel:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:sync-to-excel', async (event, data, filePath) => {
    try {
      const result = await workloadExcelSyncService.syncToExcel(data, filePath);
      return result;
    } catch (error) {
      console.error('Error syncing to Excel:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:sync-bidirectional', async (event, appData, filePath) => {
    try {
      const result = await workloadExcelSyncService.performBidirectionalSync(appData, filePath);
      return result;
    } catch (error) {
      console.error('Error performing bidirectional sync:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-excel:sync-status', async () => {
    try {
      const status = workloadExcelSyncService.getSyncStatus();
      return { success: true, status };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== WORKLOAD GOOGLE SHEETS SYNC IPC HANDLERS =====
  ipcMain.handle('workload-google:sync-contract-get', async () => {
    try {
      return {
        success: true,
        contract: googleSheetSyncService.getSyncContract()
      };
    } catch (error) {
      console.error('Error getting Google sync contract:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-settings-get', async () => {
    try {
      return await googleSheetSyncService.getSyncSettings();
    } catch (error) {
      console.error('Error getting Google sync settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-settings-update', async (event, settings) => {
    try {
      return await googleSheetSyncService.updateSyncSettings(settings);
    } catch (error) {
      console.error('Error updating Google sync settings:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-push', async (event, options = {}) => {
    try {
      return await googleSheetSyncService.pushAssignments(options);
    } catch (error) {
      console.error('Error pushing to Google Sheets:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-pull', async (event, options = {}) => {
    try {
      return await googleSheetSyncService.pullAssignmentUpdates(options);
    } catch (error) {
      console.error('Error pulling from Google Sheets:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-bidirectional', async (event, options = {}) => {
    try {
      return await googleSheetSyncService.performBidirectionalSync(options);
    } catch (error) {
      console.error('Error running bidirectional Google sync:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-status', async () => {
    try {
      return await googleSheetSyncService.getSyncStatus();
    } catch (error) {
      console.error('Error getting Google sync status:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('workload-google:sync-audit-get', async (event, limit = 100) => {
    try {
      return await workloadPersistenceService.loadGoogleSyncAudit(limit);
    } catch (error) {
      console.error('Error loading Google sync audit:', error);
      return { success: false, error: error.message };
    }
  });

  // Backup operations
  ipcMain.handle('workload:backup-create', async () => {
    try {
      return await workloadPersistenceService.createBackup();
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== DAS GENERAL IPC HANDLERS =====
};
