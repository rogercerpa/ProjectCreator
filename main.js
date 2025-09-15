const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Import version check service
const versionCheckService = require('./src/utils/versionCheck').default;

// Import services
const ProjectService = require('./src/services/ProjectService');
const WordService = require('./src/services/WordService');
const FileService = require('./src/services/FileService');
const ProjectPersistenceService = require('./src/services/ProjectPersistenceService');
const ProjectCreationService = require('./src/services/ProjectCreationService');
const FormSettingsService = require('./src/services/FormSettingsService');
const SecurityLoggingService = require('./src/services/SecurityLoggingService');
const AgencyService = require('./src/services/AgencyService');
const ExcelDiagnosticService = require('./src/services/ExcelDiagnosticService');
const SettingsService = require('./src/services/SettingsService');
const AgencySyncService = require('./src/services/AgencySyncService');

// Import package.json for version info
const packageJson = require('./package.json');

// Keep a global reference of the window object
let mainWindow;

// Initialize services
const projectService = new ProjectService();
const wordService = new WordService();
const fileService = new FileService();
const projectPersistenceService = new ProjectPersistenceService();
const projectCreationService = new ProjectCreationService();
const formSettingsService = new FormSettingsService();
const securityLoggingService = new SecurityLoggingService();
const agencyService = new AgencyService();
const excelDiagnosticService = new ExcelDiagnosticService();
const settingsService = new SettingsService();
const agencySyncService = new AgencySyncService(agencyService, settingsService);

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 1300,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false, // SECURITY: Disable Node.js integration
      contextIsolation: true, // SECURITY: Enable context isolation
      enableRemoteModule: false, // SECURITY: Disable deprecated remote module
      webSecurity: true, // SECURITY: Enable web security
      sandbox: false, // Required for file system access in Electron
      preload: path.join(__dirname, 'preload.js') // SECURITY: Use preload script for secure IPC
    },
    icon: path.join(__dirname, 'assets/icons/favicon.ico'),
    title: 'Project Creator',
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
app.whenReady().then(async () => {
  // Handle version checking and upgrades
  try {
    await versionCheckService.handlePostInstall();
  } catch (error) {
    console.error('Error during version check:', error);
  }
  
  // Initialize sync service
  try {
    await agencySyncService.initialize();
    console.log('✅ Agency sync service initialized');
  } catch (error) {
    console.error('Error initializing sync service:', error);
  }
  
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
               message: 'Project Creator',
               detail: `Version ${packageJson.version}\nBuilt with Electron and React\nAcuity Brands, Inc.`
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

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder'
  });
  return result; // Return full result object for UI compatibility
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
    // SECURITY: Log file access
    await securityLoggingService.logFileAccess(filePath, process.env.USERNAME || 'unknown', 'READ');
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    // SECURITY: Log failed file access
    await securityLoggingService.logSecurityEvent('FILE_ACCESS_FAILED', {
      filePath,
      error: error.message,
      user: process.env.USERNAME || 'unknown'
    }, 'WARNING');
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

// Load all projects - CRITICAL FIX for data persistence
ipcMain.handle('projects-load-all', async () => {
  try {
    const projects = await projectPersistenceService.loadProjects();
    return {
      success: true,
      projects: projects,
      count: projects.length,
      message: `${projects.length} projects loaded successfully`
    };
  } catch (error) {
    console.error('Error loading all projects:', error);
    return { 
      success: false, 
      error: error.message,
      projects: []
    };
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

// Project creation with folders (NEW - for wizard integration)
ipcMain.handle('project-create-with-folders', async (event, projectData) => {
  try {
    return await projectCreationService.createProjectWithFolders(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Validation handlers
ipcMain.handle('project-validate', async (event, projectData) => {
  try {
    return await projectCreationService.validateProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-validate-field', async (event, fieldName, value, projectData) => {
  try {
    return await projectCreationService.validateField(fieldName, value, projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Form Settings handlers
ipcMain.handle('form-settings-get-all', async (event) => {
  try {
    return { success: true, data: formSettingsService.getAllSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('form-settings-get-rfa-types', async (event) => {
  try {
    return { success: true, data: formSettingsService.getRFATypes() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('form-settings-get-national-accounts', async (event) => {
  try {
    return { success: true, data: formSettingsService.getNationalAccounts() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('form-settings-add-custom-rfa-type', async (event, label, value) => {
  try {
    const result = formSettingsService.addCustomRFAType(label, value);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('form-settings-add-custom-national-account', async (event, label, value) => {
  try {
    const result = formSettingsService.addCustomNationalAccount(label, value);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('form-settings-validate-form-data', async (event, formData) => {
  try {
    const result = formSettingsService.validateFormData(formData);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-validation-status', async (event) => {
  try {
    return await projectCreationService.getValidationStatus();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('project-clear-validation-caches', async (event) => {
  try {
    projectCreationService.clearValidationCaches();
    return { success: true };
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

// Agency operations
ipcMain.handle('agencies-import-excel', async (event, filePath) => {
  try {
    return await agencyService.importFromExcel(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-load-all', async () => {
  try {
    const agencies = await agencyService.loadAgencies();
    return {
      success: true,
      agencies: agencies,
      count: agencies.length,
      message: `${agencies.length} agencies loaded successfully`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-search', async (event, searchTerm, filters) => {
  try {
    const agencies = await agencyService.searchAgencies(searchTerm, filters);
    return {
      success: true,
      agencies: agencies,
      count: agencies.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-get-filter-options', async () => {
  try {
    const options = await agencyService.getFilterOptions();
    return {
      success: true,
      options: options
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-add', async (event, agencyData) => {
  try {
    return await agencyService.addAgency(agencyData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-update', async (event, agencyId, updates) => {
  try {
    return await agencyService.updateAgency(agencyId, updates);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-delete', async (event, agencyId) => {
  try {
    return await agencyService.deleteAgency(agencyId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-get-statistics', async () => {
  try {
    const statistics = await agencyService.getStatistics();
    return {
      success: true,
      statistics: statistics
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agencies-export-excel', async (event, outputPath) => {
  try {
    return await agencyService.exportToExcel(outputPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Excel file selection for agency import
ipcMain.handle('select-excel-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: 'Select Excel File',
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, message: 'File selection cancelled' };
    }
    
    return {
      success: true,
      filePath: result.filePaths[0],
      message: 'File selected successfully'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Excel diagnostic endpoint
ipcMain.handle('excel-diagnose', async (event, filePath) => {
  try {
    return await excelDiagnosticService.diagnoseExcelFile(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Sync operations
ipcMain.handle('sync-get-settings', async () => {
  try {
    return await agencySyncService.getSyncSettings();
  } catch (error) {
    console.error('Error in sync-get-settings handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-update-settings', async (event, newSettings) => {
  try {
    return await agencySyncService.updateSyncSettings(newSettings);
  } catch (error) {
    console.error('Error in sync-update-settings handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-test-file-path', async (event, filePath) => {
  try {
    return await agencySyncService.testFilePath(filePath);
  } catch (error) {
    console.error('Error in sync-test-file-path handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-start-auto', async (event, filePath) => {
  try {
    return await agencySyncService.startAutoSync(filePath);
  } catch (error) {
    console.error('Error in sync-start-auto handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-stop-auto', async () => {
  try {
    return await agencySyncService.stopAutoSync();
  } catch (error) {
    console.error('Error in sync-stop-auto handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-manual', async (event, filePath) => {
  try {
    return await agencySyncService.manualSync(filePath);
  } catch (error) {
    console.error('Error in sync-manual handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-get-status', async () => {
  try {
    const status = agencySyncService.getSyncStatus();
    return { success: true, status };
  } catch (error) {
    console.error('Error in sync-get-status handler:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sync-export-to-excel', async (event, filePath, options = {}) => {
  try {
    return await agencySyncService.exportToExcel(filePath, options);
  } catch (error) {
    console.error('Error in sync-export-to-excel handler:', error);
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
