// IPC handlers — App shell: wizard drafts, file/folder pickers, external links, settings, error log, templates.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog, shell } = require('electron');
const path = require('path');

module.exports = function registerAppIpc(context) {
  const { getMainWindow, projectPersistenceService, errorLogService } = context;
  // Wizard drafts (auto-save + recovery). Created on first use.
  const DRAFT_METHODS = new Set([
    'savePartialProject',
    'loadDraft',
    'getAllDrafts',
    'deleteDraft',
    'getDraftStatistics'
  ]);
  let projectDraftService = null;
  ipcMain.handle('drafts:call', async (event, method, ...args) => {
    if (!DRAFT_METHODS.has(method)) {
      throw new Error(`Unknown draft method: ${method}`);
    }
    if (!projectDraftService) {
      const ProjectDraftService = require('../services/ProjectDraftService');
      projectDraftService = new ProjectDraftService();
    }
    return projectDraftService[method](...args);
  });

  // IPC handlers for main process operations
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openDirectory'],
      title: 'Select Directory'
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openDirectory'],
      title: 'Select Folder'
    });
    return result; // Return full result object for UI compatibility
  });

  ipcMain.handle('select-file', async (event, options = {}) => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openFile'],
      title: options.title || 'Select File',
      filters: options.filters || []
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('save-file', async (event, options = {}) => {
    const result = await dialog.showSaveDialog(getMainWindow(), {
      title: options.title || 'Save File',
      filters: options.filters || []
    });
    return result.canceled ? null : result.filePath;
  });

  const EXTERNAL_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

  function parseExternalUrl(url, allowedProtocols = EXTERNAL_URL_PROTOCOLS) {
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      throw new Error('Invalid URL');
    }
    if (!allowedProtocols.has(parsed.protocol)) {
      throw new Error(`Blocked URL protocol: ${parsed.protocol}`);
    }
    return parsed.href;
  }

  const BLOCKED_LOCAL_EXTENSIONS = new Set([
    '.exe',
    '.com',
    '.bat',
    '.cmd',
    '.ps1',
    '.psm1',
    '.vbs',
    '.vbe',
    '.js',
    '.jse',
    '.wsf',
    '.wsh',
    '.msi',
    '.msp',
    '.scr',
    '.hta',
    '.cpl',
    '.lnk',
    '.pif',
    '.jar',
    '.reg',
    '.url'
  ]);

  // Links to documents on shared drives arrive as file:// URLs. Open them with the
  // default app, but never launch executables or scripts from a renderer request.
  async function openLocalFileUrl(url) {
    let filePath;
    try {
      filePath = require('url').fileURLToPath(new URL(url));
    } catch {
      filePath = url.replace(/^file:\/*/i, (prefix) => (prefix.length > 'file://'.length ? '\\\\' : ''));
    }
    if (BLOCKED_LOCAL_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      throw new Error(`Opening ${path.extname(filePath)} files is not allowed`);
    }
    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) throw new Error(errorMessage);
  }

  // Open external URLs/applications
  ipcMain.handle('open-external', async (event, url) => {
    try {
      if (/^file:/i.test(String(url))) {
        await openLocalFileUrl(String(url));
      } else {
        await shell.openExternal(parseExternalUrl(url));
      }
      return { success: true };
    } catch (error) {
      console.error('Error opening external URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Open URL specifically in Microsoft Edge (Windows)
  ipcMain.handle('open-in-edge', async (event, url) => {
    try {
      const href = parseExternalUrl(url, new Set(['http:', 'https:']));
      const { spawn } = require('child_process');
      // microsoft-edge: protocol launches Edge directly without a shell, so the URL
      // is never interpreted as command text.
      const child = spawn('explorer.exe', [`microsoft-edge:${href}`], { detached: true, stdio: 'ignore' });
      child.on('error', (error) => console.error('Error opening in Edge:', error));
      child.unref();
      return { success: true };
    } catch (error) {
      console.error('Error opening in Edge:', error);
      return { success: false, error: error.message };
    }
  });

  // Settings and persistence
  ipcMain.handle('settings-load', async () => {
    try {
      return await projectPersistenceService.loadSettings();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('settings-save', async (event, settings) => {
    try {
      return await projectPersistenceService.saveSettings(settings);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ===== ERROR LOGGING / DIAGNOSTICS APIs =====

  ipcMain.handle('error-log-capture', async (event, entry) => {
    try {
      const savedEntry = await errorLogService.logError(entry || {});
      return { success: !!savedEntry, entry: savedEntry };
    } catch (error) {
      console.error('Failed to capture error log:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('error-log-list', async (event, options) => {
    try {
      const errors = await errorLogService.listErrors(options || {});
      return { success: true, errors };
    } catch (error) {
      return { success: false, error: error.message, errors: [] };
    }
  });

  ipcMain.handle('error-log-get', async (event, id) => {
    try {
      const entry = await errorLogService.getError(id);
      return { success: true, entry };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('error-log-clear', async () => {
    try {
      return await errorLogService.clearErrors();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('error-log-environment', async () => {
    try {
      return { success: true, environment: errorLogService.buildEnvironmentSnapshot() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('error-log-export', async () => {
    try {
      const defaultFilename = errorLogService.getDefaultExportFilename();
      const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow() || undefined, {
        title: 'Save Error Report',
        defaultPath: defaultFilename,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });

      if (canceled || !filePath) {
        return { success: false, cancelled: true };
      }

      return await errorLogService.exportErrorsToFile(filePath);
    } catch (error) {
      console.error('Failed to export error report:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('templates-load', async () => {
    try {
      return await projectPersistenceService.loadTemplates();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('templates-save', async (event, templates) => {
    try {
      return await projectPersistenceService.saveTemplates(templates);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};
