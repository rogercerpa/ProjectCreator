// IPC handlers — BOM parsing, analytics, and bulk import.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');

module.exports = function registerBomIpc(context) {
  const { bomParserService, bomPersistenceService, bomBulkImportService, getMainWindow } = context;
  // Parse BOM file (manual upload)
  ipcMain.handle('bom:parse-file', async (event, filePath) => {
    try {
      const fileType = filePath.toLowerCase().endsWith('.csv') ? 'csv' : 'xml';
      const bomData = await bomParserService.parse({ path: filePath, type: fileType });
      const validation = bomParserService.validateBOMData(bomData);

      return {
        success: true,
        bomData: bomData,
        validation: validation
      };
    } catch (error) {
      console.error('Error parsing BOM file:', error);
      return { success: false, error: error.message };
    }
  });

  // Save BOM data to project
  ipcMain.handle('bom:save-to-project', async (event, projectId, bomData) => {
    try {
      const result = await bomPersistenceService.saveBOMToProject(projectId, bomData);
      return result;
    } catch (error) {
      console.error('Error saving BOM to project:', error);
      return { success: false, error: error.message };
    }
  });

  // Get BOM data for a project
  ipcMain.handle('bom:get-project-data', async (event, projectId) => {
    try {
      const bomData = await bomPersistenceService.getProjectBOMData(projectId);
      return {
        success: true,
        hasBOM: bomData !== null,
        bomData: bomData
      };
    } catch (error) {
      console.error('Error getting project BOM data:', error);
      return { success: false, error: error.message };
    }
  });

  // Remove BOM data from project
  ipcMain.handle('bom:remove-from-project', async (event, projectId) => {
    try {
      const result = await bomPersistenceService.removeBOMFromProject(projectId);
      return result;
    } catch (error) {
      console.error('Error removing BOM from project:', error);
      return { success: false, error: error.message };
    }
  });

  // Get BOM coverage statistics
  ipcMain.handle('bom:get-coverage', async () => {
    try {
      const coverage = await bomPersistenceService.getBOMCoverage();
      return { success: true, coverage };
    } catch (error) {
      console.error('Error getting BOM coverage:', error);
      return { success: false, error: error.message };
    }
  });

  // Get catalog statistics
  ipcMain.handle('bom:get-catalog-stats', async () => {
    try {
      const stats = await bomPersistenceService.getCatalogStats();
      return { success: true, stats };
    } catch (error) {
      console.error('Error getting catalog stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Get top catalog numbers
  ipcMain.handle('bom:get-top-catalog-numbers', async (event, limit = 20) => {
    try {
      const topNumbers = await bomPersistenceService.getTopCatalogNumbers(limit);
      return { success: true, topNumbers };
    } catch (error) {
      console.error('Error getting top catalog numbers:', error);
      return { success: false, error: error.message };
    }
  });

  // Get product co-occurrence (cross-sell analysis)
  ipcMain.handle('bom:get-co-occurrence', async (event, catalogNumber, limit = 10) => {
    try {
      const coOccurrence = await bomPersistenceService.getProductCoOccurrence(catalogNumber, limit);
      return { success: true, coOccurrence };
    } catch (error) {
      console.error('Error getting product co-occurrence:', error);
      return { success: false, error: error.message };
    }
  });

  // Find projects by catalog number (for recalls/issues)
  ipcMain.handle('bom:find-projects-by-catalog', async (event, catalogNumber) => {
    try {
      const projectIds = await bomPersistenceService.findProjectsByCatalogNumber(catalogNumber);
      return { success: true, projectIds, count: projectIds.length };
    } catch (error) {
      console.error('Error finding projects by catalog number:', error);
      return { success: false, error: error.message };
    }
  });

  // Get deprecated products
  ipcMain.handle('bom:get-deprecated-products', async (event, monthsThreshold = 6) => {
    try {
      const deprecated = await bomPersistenceService.getDeprecatedProducts(monthsThreshold);
      return { success: true, deprecated };
    } catch (error) {
      console.error('Error getting deprecated products:', error);
      return { success: false, error: error.message };
    }
  });

  // Get startup cost statistics
  ipcMain.handle('bom:get-startup-stats', async () => {
    try {
      const stats = await bomPersistenceService.loadStartupStats();
      return { success: true, stats };
    } catch (error) {
      console.error('Error getting startup stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Rebuild catalog from all projects
  ipcMain.handle('bom:rebuild-catalog', async () => {
    try {
      const result = await bomPersistenceService.rebuildCatalog();
      return result;
    } catch (error) {
      console.error('Error rebuilding catalog:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== BOM BULK IMPORT HANDLERS =====

  // Preview bulk import (scan folder and match projects)
  ipcMain.handle('bom:bulk-preview', async (event, rootFolder, options = {}) => {
    try {
      const result = await bomBulkImportService.previewBulkImport(rootFolder, options);
      return result;
    } catch (error) {
      console.error('Error previewing bulk import:', error);
      return { success: false, error: error.message };
    }
  });

  // Execute bulk import
  ipcMain.handle('bom:bulk-import', async (event, rootFolder, options = {}) => {
    try {
      // Create progress callback
      const progressCallback = (current, total, status) => {
        if (getMainWindow() && !getMainWindow().isDestroyed()) {
          getMainWindow().webContents.send('bom:bulk-import-progress', { current, total, status });
        }
      };

      const result = await bomBulkImportService.executeBulkImport(rootFolder, {
        ...options,
        onProgress: progressCallback
      });

      // Send completion event
      if (getMainWindow() && !getMainWindow().isDestroyed()) {
        getMainWindow().webContents.send('bom:bulk-import-complete', result);
      }

      return result;
    } catch (error) {
      console.error('Error executing bulk import:', error);
      return { success: false, error: error.message };
    }
  });

  // Import matched BOMs (after preview)
  ipcMain.handle('bom:bulk-import-matched', async (event, bomLocations, options = {}) => {
    try {
      const progressCallback = (current, total, status) => {
        if (getMainWindow() && !getMainWindow().isDestroyed()) {
          getMainWindow().webContents.send('bom:bulk-import-progress', { current, total, status });
        }
      };

      const result = await bomBulkImportService.importMatchedBOMs(bomLocations, {
        ...options,
        onProgress: progressCallback
      });

      return { success: true, ...result };
    } catch (error) {
      console.error('Error importing matched BOMs:', error);
      return { success: false, error: error.message };
    }
  });

  // Select folder for bulk import
  ipcMain.handle('bom:select-bulk-import-folder', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        properties: ['openDirectory'],
        title: 'Select Folder Containing Projects with BOM CHECK Folders'
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, folderPath: result.filePaths[0] };
    } catch (error) {
      console.error('Error selecting bulk import folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Select BOM file for manual upload
  ipcMain.handle('bom:select-file', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        properties: ['openFile'],
        title: 'Select BOM File (CSV or XML)',
        filters: [
          { name: 'BOM Files', extensions: ['csv', 'xml'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'XML Files', extensions: ['xml'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      console.error('Error selecting BOM file:', error);
      return { success: false, error: error.message };
    }
  });

  // Check for BOM in project folder (for Download Folder integration)
  ipcMain.handle('bom:check-project-folder', async (event, projectFolderPath) => {
    try {
      const bomCheckPath = path.join(projectFolderPath, 'BOM CHECK');

      if (!(await fs.pathExists(bomCheckPath))) {
        return { success: true, hasBOM: false, message: 'No BOM CHECK folder found' };
      }

      const bomFile = await bomParserService.selectBOMFile(bomCheckPath);

      if (!bomFile) {
        return { success: true, hasBOM: false, message: 'No BOM files in BOM CHECK folder' };
      }

      return {
        success: true,
        hasBOM: true,
        bomFile: bomFile,
        bomCheckPath: bomCheckPath
      };
    } catch (error) {
      console.error('Error checking project folder for BOM:', error);
      return { success: false, error: error.message };
    }
  });

  // Auto-import BOM from project folder (recursively searches for BOM CHECK)
  ipcMain.handle('bom:auto-import-from-folder', async (event, projectFolderPath, projectId) => {
    try {
      const bomCheckResult = await bomParserService.findBOMCheckInProject(projectFolderPath);

      if (!bomCheckResult.found) {
        return { success: false, error: bomCheckResult.reason || 'No BOM CHECK folder found' };
      }

      const bomData = await bomParserService.parse(bomCheckResult.bomFile);
      const result = await bomPersistenceService.saveBOMToProject(projectId, bomData);

      if (result.success && getMainWindow() && !getMainWindow().isDestroyed()) {
        getMainWindow().webContents.send('bom:auto-import-complete', {
          projectId,
          totalDevices: bomData.totalDevices,
          startupCost: bomData.startupCosts?.total || 0
        });
      }

      return result;
    } catch (error) {
      console.error('Error auto-importing BOM from folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Smart BOM upload - auto-detects BOM from project's DAS path
  ipcMain.handle('bom:smart-upload', async (event, project) => {
    try {
      console.log(`📦 Smart BOM Upload requested for: ${project.projectName}`);

      // Use the smart upload function that handles path resolution
      const smartResult = await bomParserService.smartBOMUpload(project);

      if (smartResult.success) {
        // BOM was found and parsed, save it to the project
        const saveResult = await bomPersistenceService.saveBOMToProject(project.id, smartResult.bomData);

        if (saveResult.success) {
          console.log(`✅ Smart BOM Upload successful: ${smartResult.bomData.totalDevices} devices`);
          return {
            success: true,
            autoImported: true,
            bomData: smartResult.bomData,
            bomFile: smartResult.bomFile,
            projectPath: smartResult.projectPath,
            bomCheckPath: smartResult.bomCheckPath,
            project: saveResult.project,
            stats: {
              totalDevices: smartResult.bomData.totalDevices,
              startupCost: smartResult.bomData.startupCosts?.total || 0
            }
          };
        } else {
          return {
            success: false,
            error: saveResult.error || 'Failed to save BOM data',
            bomData: smartResult.bomData
          };
        }
      } else {
        // Auto-import failed, return info for manual selection
        console.log(`⚠️ Smart BOM Upload requires manual selection: ${smartResult.reason}`);
        return {
          success: false,
          autoImportFailed: true,
          reason: smartResult.reason,
          suggestedPath: smartResult.suggestedPath,
          projectPath: smartResult.projectPath,
          bomCheckPath: smartResult.bomCheckPath,
          searchedFolders: smartResult.searchedFolders,
          requiresManualSelection: smartResult.requiresManualSelection
        };
      }
    } catch (error) {
      console.error('Error in smart BOM upload:', error);
      return {
        success: false,
        error: error.message,
        requiresManualSelection: true
      };
    }
  });

  // Open folder in file explorer (for manual BOM selection fallback)
  ipcMain.handle('bom:open-folder', async (event, folderPath) => {
    try {
      const { shell } = require('electron');
      const result = await shell.openPath(folderPath);

      // shell.openPath returns empty string on success
      if (result === '') {
        return { success: true, path: folderPath };
      } else {
        return { success: false, error: result || 'Failed to open folder' };
      }
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== TRAINING HUB IPC HANDLERS =====
};
