// IPC handlers — DAS General workbook, machine identity, and personal time calendar.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog } = require('electron');
const os = require('os');

module.exports = function registerDasGeneralIpc(context) {
  const { dasGeneralService, userTimeCalendarService, getMainWindow } = context;
  // Load all DAS General data
  ipcMain.handle('das-general:load-all', async (event, filePath) => {
    try {
      const result = await dasGeneralService.loadAllData(filePath);
      return result;
    } catch (error) {
      console.error('Error loading DAS General data:', error);
      return { success: false, error: 'LOAD_ERROR', message: error.message };
    }
  });

  // Save all DAS General data
  ipcMain.handle('das-general:save-all', async (event, data, filePath) => {
    try {
      const result = await dasGeneralService.saveAllData(data, filePath);
      return result;
    } catch (error) {
      console.error('Error saving DAS General data:', error);
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  });

  ipcMain.handle('machine:get-identity', async () => ({
    hostname: os.hostname(),
    windowsUser: os.userInfo().username
  }));

  ipcMain.handle('time-calendar:load', async () => userTimeCalendarService.load());
  ipcMain.handle('time-calendar:upsert', async (event, entry) => {
    try {
      return await userTimeCalendarService.upsert(entry);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle('time-calendar:save-categories', async (event, categories) => {
    try {
      return await userTimeCalendarService.saveCategories(categories);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle('time-calendar:delete', async (event, entryId) => {
    try {
      return await userTimeCalendarService.remove(entryId);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Check file access
  ipcMain.handle('das-general:check-access', async (event, filePath) => {
    try {
      const result = await dasGeneralService.checkFileAccess(filePath);
      return result;
    } catch (error) {
      console.error('Error checking DAS General file access:', error);
      return { success: false, error: 'ACCESS_ERROR', message: error.message };
    }
  });

  // Create new file
  ipcMain.handle('das-general:create-file', async (event, filePath) => {
    try {
      const result = await dasGeneralService.createNewFile(filePath);
      return result;
    } catch (error) {
      console.error('Error creating DAS General file:', error);
      return { success: false, error: 'CREATE_ERROR', message: error.message };
    }
  });

  // Save team members
  ipcMain.handle('das-general:save-team-members', async (event, teamMembers, filePath) => {
    try {
      const result = await dasGeneralService.saveTeamMembers(teamMembers, filePath);
      return result;
    } catch (error) {
      console.error('Error saving team members:', error);
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  });

  // Save training material
  ipcMain.handle('das-general:save-training-material', async (event, trainingMaterial, filePath) => {
    try {
      const result = await dasGeneralService.saveTrainingMaterial(trainingMaterial, filePath);
      return result;
    } catch (error) {
      console.error('Error saving training material:', error);
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  });

  // Save products info
  ipcMain.handle('das-general:save-products-info', async (event, productsInfo, filePath) => {
    try {
      const result = await dasGeneralService.saveProductsInfo(productsInfo, filePath);
      return result;
    } catch (error) {
      console.error('Error saving products info:', error);
      return { success: false, error: 'SAVE_ERROR', message: error.message };
    }
  });

  // Add product
  ipcMain.handle('das-general:add-product', async (event, productName, filePath) => {
    try {
      const result = await dasGeneralService.addProduct(productName, filePath);
      return result;
    } catch (error) {
      console.error('Error adding product:', error);
      return { success: false, error: 'ADD_ERROR', message: error.message };
    }
  });

  // Remove product
  ipcMain.handle('das-general:remove-product', async (event, productName, filePath) => {
    try {
      const result = await dasGeneralService.removeProduct(productName, filePath);
      return result;
    } catch (error) {
      console.error('Error removing product:', error);
      return { success: false, error: 'REMOVE_ERROR', message: error.message };
    }
  });

  // Get DAS General settings
  ipcMain.handle('das-general:get-settings', async () => {
    try {
      const result = await dasGeneralService.getSettings();
      return result;
    } catch (error) {
      console.error('Error getting DAS General settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Update DAS General settings
  ipcMain.handle('das-general:update-settings', async (event, settings) => {
    try {
      const result = await dasGeneralService.updateSettings(settings);
      return result;
    } catch (error) {
      console.error('Error updating DAS General settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Select file dialog for DAS General
  ipcMain.handle('das-general:select-file', async () => {
    try {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        title: 'Select DAS General Excel File',
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, canceled: true };
      }

      return { success: true, filePath: result.filePaths[0] };
    } catch (error) {
      console.error('Error selecting file:', error);
      return { success: false, error: error.message };
    }
  });

  // ===== BOM ANALYTICS IPC HANDLERS =====
};
