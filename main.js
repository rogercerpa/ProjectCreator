const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Import services
const ProjectService = require('./src/services/ProjectService');
const WordService = require('./src/services/WordService');
const FileService = require('./src/services/FileService');
const ProjectPersistenceService = require('./src/services/ProjectPersistenceService');
const ProjectCreationService = require('./src/services/ProjectCreationService');

// Keep a global reference of the window object
let mainWindow;

// Initialize services
const projectService = new ProjectService();
const wordService = new WordService();
const fileService = new FileService();
const projectPersistenceService = new ProjectPersistenceService();
const projectCreationService = new ProjectCreationService();

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    },
    icon: path.join(__dirname, 'acuity_brands.ico'),
    title: 'Project Creator 2024 - Electron',
    show: false
  });

  // Load the app from the dist folder
  mainWindow.loadFile('dist/index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools for debugging (commented out to prevent auto-opening)
  // mainWindow.webContents.openDevTools();
  
  // Add debugging for loading issues
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM is ready');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-project');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Open Project Directory'
            });
            if (!result.canceled) {
              mainWindow.webContents.send('open-project', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Project Creator',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Project Creator',
              message: 'Project Creator 2024',
              detail: 'Version 5.0.0\nBuilt with Electron and React\nAcuity Brands, Inc.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for main process operations
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Directory'
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-file', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: options.title || 'Select File',
    filters: options.filters || []
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('save-file', async (event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    filters: options.filters || []
  });
  return result.canceled ? null : result.filePath;
});

// File system operations
ipcMain.handle('fs-read-file', async (event, filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs-write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs-copy-file', async (event, src, dest) => {
  try {
    await fs.copy(src, dest);
    return true;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs-create-dir', async (event, dirPath) => {
  try {
    await fs.ensureDir(dirPath);
    return true;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs-exists', async (event, path) => {
  try {
    return await fs.pathExists(path);
  } catch (error) {
    return false;
  }
});

// Project operations
ipcMain.handle('project-create', async (event, projectData) => {
  try {
    const result = await projectService.createProjectFolder(projectData, projectData.saveLocation);
    if (result.success) {
      // Save project to persistence
      await projectPersistenceService.saveProject(projectData);
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-load', async (event, projectId) => {
  try {
    return await projectPersistenceService.loadProjectById(projectId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-load-by-rfa', async (event, rfaNumber, projectContainer) => {
  try {
    return await projectPersistenceService.loadProjectByRFA(rfaNumber, projectContainer);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-save', async (event, projectData) => {
  try {
    return await projectPersistenceService.saveProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-delete', async (event, projectId) => {
  try {
    return await projectPersistenceService.deleteProject(projectId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-search', async (event, searchCriteria) => {
  try {
    return await projectPersistenceService.searchProjects(searchCriteria);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-stats', async () => {
  try {
    return await projectPersistenceService.getProjectStats();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Triage calculations
ipcMain.handle('triage-calculate', async (event, triageData) => {
  try {
    return await projectService.calculateTriageTime(triageData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export operations
ipcMain.handle('export-das-board', async (event, projectData, triageData) => {
  try {
    return await projectService.exportToDASBoard(projectData, triageData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-agile', async (event, projectData, triageData) => {
  try {
    return await projectService.exportToAgile(projectData, triageData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Word operations
ipcMain.handle('word-create-document', async () => {
  try {
    return await wordService.createDocument();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('word-open-document', async (event, filePath) => {
  try {
    return await wordService.openDocument(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('word-save-document', async (event, document, filePath, options) => {
  try {
    return await wordService.saveDocument(document, filePath, options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('word-search-replace', async (event, document, searchTerm, replaceTerm, options) => {
  try {
    return await wordService.searchAndReplace(document, searchTerm, replaceTerm, options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Project management
ipcMain.handle('project-open-folder', async (event, projectData) => {
  try {
    return await projectService.openProjectFolder(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-download-template', async (event, regionalTeam) => {
  try {
    return await projectService.downloadRegionTemplate(regionalTeam);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-upload-triages', async (event, regionalTeam) => {
  try {
    return await projectService.uploadTriages(regionalTeam);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-open-das-board', async (event, regionalTeam) => {
  try {
    return await projectService.openDASBoard(regionalTeam);
  } catch (error) {
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

// Import/export
ipcMain.handle('projects-export', async (event, exportPath, format) => {
  try {
    return await projectPersistenceService.exportProjects(exportPath, format);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('projects-import', async (event, importPath, format) => {
  try {
    return await projectPersistenceService.importProjects(importPath, format);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Project creation
ipcMain.handle('project-create-folder', async (event, projectData) => {
  try {
    return await projectCreationService.createProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-export-das-board', async (event, projectData) => {
  try {
    return await projectCreationService.exportToDASBoard(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-export-agile', async (event, projectData) => {
  try {
    return await projectCreationService.exportToAgile(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (mainWindow) {
    mainWindow.webContents.send('error', {
      type: 'uncaught-exception',
      message: error.message,
      stack: error.stack
    });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (mainWindow) {
    mainWindow.webContents.send('error', {
      type: 'unhandled-rejection',
      message: reason?.message || String(reason),
      stack: reason?.stack
    });
  }
});
