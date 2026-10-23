// IPC handlers — Agile workqueue monitoring through Edge DevTools.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog } = require('electron');

module.exports = function registerAgileIpc(context) {
  const { edgeConnectionManager, agileScrapingService, getMainWindow } = context;
  // Agile workqueue monitoring (Edge CDP)
  ipcMain.handle('agile-check-edge-connection', async () => {
    try {
      return await edgeConnectionManager.checkConnection();
    } catch (e) {
      return { connected: false, error: e.message };
    }
  });
  ipcMain.handle('agile-launch-edge-debug', async (event, port) => {
    try {
      return await edgeConnectionManager.launchEdgeWithDebug(port ?? 9222);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('agile-start-monitoring', async (event, intervalMs) => {
    try {
      agileScrapingService.startMonitoring(intervalMs ?? 5 * 60 * 1000);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('agile-stop-monitoring', async () => {
    try {
      agileScrapingService.stopMonitoring();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('agile-scrape-now', async () => {
    try {
      return await agileScrapingService.scrapeWorkqueue();
    } catch (e) {
      return { entries: [], scrapedAt: new Date().toISOString(), error: e.message };
    }
  });
  ipcMain.handle('agile-get-status', async () => {
    try {
      const edgeStatus = await edgeConnectionManager.checkConnection();
      const agileStatus = agileScrapingService.getStatus();
      return { edge: edgeStatus, ...agileStatus };
    } catch (e) {
      return { edge: { connected: false, error: e.message }, isMonitoring: false, lastError: e.message };
    }
  });
  ipcMain.handle('agile-get-workqueue', async () => {
    try {
      return agileScrapingService.getWorkqueue();
    } catch (e) {
      return [];
    }
  });
  ipcMain.handle('agile-diagnose-page', async () => {
    try {
      return await agileScrapingService.diagnosePage();
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('agile-fetch-project-details', async (event, { rfaNumber, rfaDetailUrlPattern }) => {
    try {
      return await agileScrapingService.scrapeRfaProjectPage(rfaNumber || '', { rfaDetailUrlPattern });
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('agile-diagnose-project-page', async (event, { rfaNumber, rfaDetailUrlPattern }) => {
    try {
      return await agileScrapingService.diagnoseProjectPage(rfaNumber || '', { rfaDetailUrlPattern });
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('agile-download-document', async (event, { url, filename }) => {
    try {
      const { filePath } = await dialog.showSaveDialog(getMainWindow() || undefined, {
        defaultPath: filename || 'document',
        title: 'Save document'
      });
      if (!filePath) return { cancelled: true };
      return await agileScrapingService.downloadProjectDocument(url, filePath);
    } catch (e) {
      return { error: e.message };
    }
  });
};
