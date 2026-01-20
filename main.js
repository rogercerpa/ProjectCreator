const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// ===== CACHE AND PERFORMANCE CONFIGURATION =====
// Set user data directory to avoid OneDrive sync conflicts
// Use local AppData instead of OneDrive-synced locations
const localAppDataPath = path.join(os.homedir(), 'AppData', 'Local', 'project-creator');
app.setPath('userData', localAppDataPath);
app.setPath('sessionData', path.join(localAppDataPath, 'Session Storage'));
app.setPath('cache', path.join(localAppDataPath, 'Cache'));

// Disable GPU cache errors by using command line switches
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');

// Improve performance
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

console.log('✅ Cache directories configured:');
console.log('   User Data:', app.getPath('userData'));
console.log('   Cache:', app.getPath('cache'));
console.log('   Session Data:', app.getPath('sessionData'));

// Import version check service
const versionCheckService = require('./main-process/services/VersionCheckService');

// Import services
const ProjectService = require('./main-process/services/ProjectService');
const WordService = require('./main-process/services/WordService');
const FileService = require('./main-process/services/FileService');
const ProjectPersistenceService = require('./main-process/services/ProjectPersistenceService');
const ProjectCreationService = require('./main-process/services/ProjectCreationService');
const DuplicateProjectDetectionService = require('./main-process/services/DuplicateProjectDetectionService');
const FormSettingsService = require('./main-process/services/FormSettingsService');
const SecurityLoggingService = require('./main-process/services/SecurityLoggingService');
const AgencyService = require('./main-process/services/AgencyService');
const AgencyProjectService = require('./main-process/services/AgencyProjectService');
const ExcelDiagnosticService = require('./main-process/services/ExcelDiagnosticService');
const SettingsService = require('./main-process/services/SettingsService');
const AgencySyncService = require('./main-process/services/AgencySyncService');
const EmailTemplateService = require('./main-process/services/EmailTemplateService');

// Import SharePoint services
const ZipService = require('./main-process/services/ZipService');
const OneDriveSyncService = require('./main-process/services/OneDriveSyncService');

// Import workload services
const WorkloadPersistenceService = require('./main-process/services/WorkloadPersistenceService');
const FileWatcherService = require('./main-process/services/FileWatcherService');
const FieldMappingService = require('./main-process/services/FieldMappingService');
const WorkloadExcelService = require('./main-process/services/WorkloadExcelService');
const WorkloadExcelSyncService = require('./main-process/services/WorkloadExcelSyncService');
const DASGeneralService = require('./main-process/services/DASGeneralService');

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
const duplicateProjectDetectionService = new DuplicateProjectDetectionService();
const formSettingsService = new FormSettingsService();
const securityLoggingService = new SecurityLoggingService();
const agencyService = new AgencyService();
const agencyProjectService = new AgencyProjectService();
const excelDiagnosticService = new ExcelDiagnosticService();
const settingsService = new SettingsService();
const agencySyncService = new AgencySyncService(agencyService, settingsService);
const emailTemplateService = new EmailTemplateService();

// Initialize SharePoint services
const zipService = new ZipService();
const oneDriveSyncService = new OneDriveSyncService();

// Initialize Ready for QC service
const ReadyForQCService = require('./main-process/services/ReadyForQCService');
const readyForQCService = new ReadyForQCService();
readyForQCService.setProjectPersistenceService(projectPersistenceService);

// Initialize DAS Upload service
const DasUploadService = require('./main-process/services/DasUploadService');
const dasUploadService = new DasUploadService();

// Initialize workload services
const workloadPersistenceService = new WorkloadPersistenceService();
let fileWatcherService = null; // Initialized when user configures shared folder
const fieldMappingService = new FieldMappingService();
const workloadExcelService = new WorkloadExcelService(fieldMappingService);
const workloadExcelSyncService = new WorkloadExcelSyncService(workloadExcelService, fieldMappingService, settingsService);

// Initialize DAS General service
const dasGeneralService = new DASGeneralService(settingsService);

// Setup workload Excel sync event listeners
workloadExcelSyncService.on('syncStarted', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('workload-excel:sync-started', data);
  }
});

workloadExcelSyncService.on('syncCompleted', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('workload-excel:sync-completed', data);
  }
});

workloadExcelSyncService.on('autoSyncStarted', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('workload-excel:auto-sync-started', data);
  }
});

workloadExcelSyncService.on('autoSyncStopped', () => {
  if (mainWindow) {
    mainWindow.webContents.send('workload-excel:auto-sync-stopped');
  }
});

workloadExcelSyncService.on('settingsUpdated', (settings) => {
  if (mainWindow) {
    mainWindow.webContents.send('workload-excel:settings-updated', settings);
  }
});

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
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
  
  // Initialize workload Excel sync service
  try {
    const result = await workloadExcelSyncService.initialize();
    if (result.success) {
      console.log('✅ Workload Excel sync service initialized');
    } else {
      console.warn('⚠️ Workload Excel sync service initialization failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error initializing workload Excel sync service:', error);
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

// Ready for QC handlers
ipcMain.handle('qc-scan-folder', async () => {
  try {
    const projects = await projectPersistenceService.loadProjects();
    const result = await readyForQCService.scanAndUpdateProjects(projects);
    return result;
  } catch (error) {
    console.error('Error scanning Ready for QC folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('qc-check-project', async (event, projectId) => {
  try {
    const project = await projectPersistenceService.loadProjectById(projectId);
    if (!project.success || !project.project) {
      return { success: false, error: 'Project not found', zipFiles: [] };
    }
    const zipFiles = await readyForQCService.getMatchingZipFiles(project.project);
    return {
      success: true,
      hasZip: zipFiles.length > 0,
      zipFiles: zipFiles
    };
  } catch (error) {
    console.error('Error checking project for QC zip:', error);
    return { success: false, error: error.message, zipFiles: [] };
  }
});

ipcMain.handle('qc-get-matching-zips', async (event, project) => {
  try {
    const zipFiles = await readyForQCService.getMatchingZipFiles(project);
    return {
      success: true,
      zipFiles: zipFiles
    };
  } catch (error) {
    console.error('Error getting matching zip files:', error);
    return { success: false, error: error.message, zipFiles: [] };
  }
});

ipcMain.handle('qc-download-zip', async (event, zipFilePath, project) => {
  try {
    const result = await readyForQCService.downloadAndExtractZip(zipFilePath, project);
    return result;
  } catch (error) {
    console.error('Error downloading and extracting zip:', error);
    return { success: false, error: error.message };
  }
});

// DAS Upload handlers
ipcMain.handle('das-check-drive-access', async () => {
  try {
    return await dasUploadService.checkDriveAccess();
  } catch (error) {
    console.error('Error checking DAS drive access:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('das-upload-project', async (event, project, confirmed) => {
  try {
    // Create a progress callback that sends updates to the renderer
    const progressCallback = (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('das-upload-progress', progress);
      }
    };
    
    const result = await dasUploadService.uploadProject(project, confirmed, progressCallback);
    
    // If upload was successful, update the project with upload status
    if (result.success && !result.needsConfirmation) {
      const updatedProject = {
        ...project,
        dasUploadStatus: {
          uploadedAt: new Date().toISOString(),
          uploadedPath: result.uploadedPath,
          isRevision: result.isRevision || false
        }
      };
      
      // Save the updated project
      await projectPersistenceService.saveProject(updatedProject);
      
      return {
        ...result,
        updatedProject: updatedProject
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error uploading project to DAS:', error);
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

// Open external URLs/applications
ipcMain.handle('open-external', async (event, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
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

// ===== REVISION WORKFLOW IPC HANDLERS =====

// Detect existing project for revision suggestions
ipcMain.handle('revision-detect-existing', async (event, projectData) => {
  try {
    return await projectCreationService.detectExistingProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Find previous revision automatically
ipcMain.handle('revision-find-previous', async (event, projectData) => {
  try {
    return await projectCreationService.findPreviousRevision(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check for duplicate projects
ipcMain.handle('duplicate-check-project', async (event, projectData) => {
  try {
    console.log('Duplicate detection request received for:', projectData.projectName);
    return await duplicateProjectDetectionService.checkForExistingProject(projectData);
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return { isDuplicate: false, canProceed: true, error: error.message };
  }
});

// Simple folder existence check for -0 version duplicate detection
ipcMain.handle('check-folder-exists', async (event, folderPath) => {
  try {
    console.log('Checking folder existence:', folderPath);
    const exists = await fs.pathExists(folderPath);
    console.log(`Folder ${exists ? 'EXISTS' : 'NOT FOUND'}:`, folderPath);
    return exists;
  } catch (error) {
    console.error('Error checking folder existence:', error);
    return false;
  }
});

// Validate manually selected RFA folder
ipcMain.handle('revision-validate-folder', async (event, folderPath) => {
  try {
    return await projectCreationService.validateRFAFolder(folderPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Create revision project with file copying and progress tracking
ipcMain.handle('revision-create', async (event, projectData, revisionOptions) => {
  try {
    // Create progress callback that sends updates to renderer
    const progressCallback = (step, progress, details) => {
      event.sender.send('revision-progress-update', {
        step,
        progress,
        details,
        timestamp: Date.now()
      });
    };

    // Add progress callback to options
    const optionsWithProgress = {
      ...revisionOptions,
      onProgress: progressCallback
    };

    const result = await projectCreationService.createRevisionProject(projectData, optionsWithProgress);
    
    // Send completion event
    if (result.success) {
      event.sender.send('revision-progress-complete', {
        message: result.message,
        timestamp: Date.now()
      });
    }
    
    return result;
  } catch (error) {
    // Send error event
    event.sender.send('revision-progress-error', {
      error: error.message,
      timestamp: Date.now()
    });
    return { success: false, error: error.message };
  }
});

// Analyze revision contents for copy options
ipcMain.handle('revision-analyze-contents', async (event, revisionPath) => {
  try {
    return await projectCreationService.analyzeRevisionContents(revisionPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Analyze AE Markups folder for file selection
ipcMain.handle('revision-analyze-ae-markups', async (event, revisionPath) => {
  try {
    const revisionFileCopyService = new (require('./main-process/services/RevisionFileCopyService'))();
    return await revisionFileCopyService.analyzeAEMarkupsFolder(revisionPath);
  } catch (error) {
    console.error('Error analyzing AE Markups folder:', error);
    return { success: false, error: error.message };
  }
});

// Get recommended copy options for revision
ipcMain.handle('revision-get-copy-options', async (event, revisionPath) => {
  try {
    return await projectCreationService.getRecommendedCopyOptions(revisionPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle folder name mismatch
ipcMain.handle('revision-handle-folder-mismatch', async (event, selectedPath, expectedPath) => {
  try {
    return await projectCreationService.handleFolderNameMismatch(selectedPath, expectedPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Rename project folder for mismatch resolution
ipcMain.handle('revision-rename-folder', async (event, oldPath, newPath) => {
  try {
    return await projectCreationService.renameProjectFolder(oldPath, newPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Manual selection of previous RFA folder using proper folder browser
ipcMain.handle('revision-select-folder', async (event, startingPath) => {
  try {
    console.log('revision-select-folder called with startingPath:', startingPath);
    
    // Default to network path if no starting path provided
    const defaultNetworkPath = '\\\\10.3.10.30\\DAS';
    const explorerPath = startingPath || defaultNetworkPath;
    
    // Try Windows Shell folder browser first (the classic tree view browser)
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      console.log('Using Windows Shell folder browser at:', explorerPath);
      
      // Use classic Windows folder browser via VBScript (more reliable than PowerShell COM)
      // First ensure the network path is accessible
      let startPath = explorerPath;
      try {
        // Test if network path exists, if not use local fallback
        if (!await fs.pathExists(explorerPath)) {
          console.log('Network path not accessible, using My Computer as starting point');
          startPath = '';
        }
      } catch (err) {
        console.log('Cannot verify network path, using My Computer as starting point');
        startPath = '';
      }
      
      const vbScript = `
        Set shell = CreateObject("Shell.Application")
        Set folder = shell.BrowseForFolder(0, "Choose previous RFA Folder - Navigate to ${explorerPath}", &H0200 + &H0040, "${startPath}")
        If Not folder Is Nothing Then
          WScript.Echo folder.Self.Path
        Else
          WScript.Echo "CANCELED"
        End If
      `;
      
      // Create temporary VBScript file
      const tempVbsPath = path.join(os.tmpdir(), 'folder_browser_' + Date.now() + '.vbs');
      await fs.writeFile(tempVbsPath, vbScript);
      
      console.log('Executing VBScript folder browser...');
      const { stdout, stderr } = await execPromise(`cscript.exe //NoLogo "${tempVbsPath}"`, {
        windowsHide: false,
        timeout: 120000, // 2 minutes
        encoding: 'utf8'
      });
      
      // Clean up temp file
      try {
        await fs.unlink(tempVbsPath);
      } catch (cleanupError) {
        console.log('Could not clean up temp VBS file:', cleanupError.message);
      }
      
      console.log('VBScript browser stdout:', stdout);
      console.log('VBScript browser stderr:', stderr);
      
      if (!stderr && stdout && stdout.trim()) {
        const selectedPath = stdout.trim();
        
        if (selectedPath === 'CANCELED') {
          console.log('VBScript folder selection canceled');
          return { success: false, canceled: true };
        }
        
        console.log('VBScript folder selected:', selectedPath);
        
        // Validate the entered path exists
        if (!fs.existsSync(selectedPath)) {
          return {
            success: false,
            error: `The specified path does not exist: ${selectedPath}`
          };
        }
        
        // Validate the selected folder
        const validationResult = await projectCreationService.validateRFAFolder(selectedPath);
        
        return {
          success: true,
          selectedPath: selectedPath,
          validation: validationResult
        };
      } else {
        console.log('VBScript browser failed or returned empty result, using fallback');
        throw new Error('VBScript browser returned empty result');
      }
    } catch (vbsError) {
      console.log('Windows VBScript approach failed, using Electron fallback:', vbsError.message);
    }
    
    // Fallback to Electron dialog (always works)
    console.log('Using Electron dialog fallback...');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Previous RFA Folder',
      defaultPath: explorerPath,
      buttonLabel: 'Select RFA Folder'
    });
    
    console.log('Electron dialog result:', result);
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    const selectedPath = result.filePaths[0];
    console.log('Electron dialog selected path:', selectedPath);
    
    // Validate the selected folder
    const validationResult = await projectCreationService.validateRFAFolder(selectedPath);
    console.log('Validation result:', validationResult);
    
    return {
      success: true,
      selectedPath: selectedPath,
      validation: validationResult
    };
    
  } catch (error) {
    console.error('revision-select-folder error:', error);
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

// Agency Project operations
ipcMain.handle('agency-projects-get-all', async (event, agencyName, agentNumber) => {
  try {
    return await agencyProjectService.getProjectsByAgency(agencyName, agentNumber);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agency-projects-get-active', async (event, agencyName, agentNumber) => {
  try {
    return await agencyProjectService.getActiveProjectsByAgency(agencyName, agentNumber);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agency-projects-get-recently-completed', async (event, agencyName, agentNumber, days) => {
  try {
    return await agencyProjectService.getRecentlyCompletedProjects(agencyName, agentNumber, days);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agency-projects-get-statistics', async (event, agencyName, agentNumber) => {
  try {
    return await agencyProjectService.getAgencyProjectStatistics(agencyName, agentNumber);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agency-projects-get-performance-metrics', async (event, agencyName, agentNumber) => {
  try {
    return await agencyProjectService.getAgencyPerformanceMetrics(agencyName, agentNumber);
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

// Email template operations
ipcMain.handle('email-templates-load-all', async () => {
  try {
    const templates = await emailTemplateService.loadTemplates();
    return {
      success: true,
      templates: templates,
      count: templates.length,
      message: `${templates.length} email templates loaded successfully`
    };
  } catch (error) {
    console.error('Error loading email templates:', error);
    return { success: false, error: error.message, templates: [] };
  }
});

ipcMain.handle('email-templates-create', async (event, templateData) => {
  try {
    return await emailTemplateService.createTemplate(templateData);
  } catch (error) {
    console.error('Error creating email template:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-update', async (event, templateId, updates) => {
  try {
    return await emailTemplateService.updateTemplate(templateId, updates);
  } catch (error) {
    console.error('Error updating email template:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-delete', async (event, templateId) => {
  try {
    return await emailTemplateService.deleteTemplate(templateId);
  } catch (error) {
    console.error('Error deleting email template:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-get', async (event, templateId) => {
  try {
    return await emailTemplateService.getTemplate(templateId);
  } catch (error) {
    console.error('Error getting email template:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-get-by-category', async (event, category) => {
  try {
    return await emailTemplateService.getTemplatesByCategory(category);
  } catch (error) {
    console.error('Error getting templates by category:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-get-categories', async () => {
  try {
    return await emailTemplateService.getTemplateCategories();
  } catch (error) {
    console.error('Error getting template categories:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-get-variables', async () => {
  try {
    const variables = emailTemplateService.getAvailableVariables();
    return { success: true, variables };
  } catch (error) {
    console.error('Error getting template variables:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-generate-personalized', async (event, templateId, agencyData) => {
  try {
    const templateResult = await emailTemplateService.getTemplate(templateId);
    if (!templateResult.success) {
      return templateResult;
    }

    return emailTemplateService.generatePersonalizedEmail(templateResult.template, agencyData);
  } catch (error) {
    console.error('Error generating personalized email:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-increment-usage', async (event, templateId) => {
  try {
    return await emailTemplateService.incrementUsageCount(templateId);
  } catch (error) {
    console.error('Error incrementing template usage:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-get-statistics', async () => {
  try {
    return await emailTemplateService.getTemplateStatistics();
  } catch (error) {
    console.error('Error getting template statistics:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-export', async (event, filePath) => {
  try {
    return await emailTemplateService.exportTemplates(filePath);
  } catch (error) {
    console.error('Error exporting email templates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('email-templates-import', async (event, filePath, options = {}) => {
  try {
    return await emailTemplateService.importTemplates(filePath, options);
  } catch (error) {
    console.error('Error importing email templates:', error);
    return { success: false, error: error.message };
  }
});

// Image processing for email templates
ipcMain.handle('email-convert-image-to-base64', async (event, filePath) => {
  try {
    console.log('Converting image to base64:', filePath);
    
    // Read the image file as binary
    const imageBuffer = await fs.readFile(filePath);
    
    // Get file extension to determine MIME type
    const fileExtension = path.extname(filePath).toLowerCase().substring(1);
    const mimeType = getMimeTypeFromExtension(fileExtension);
    
    if (!mimeType) {
      throw new Error(`Unsupported image format: ${fileExtension}`);
    }
    
    // Convert to base64
    const base64Data = imageBuffer.toString('base64');
    
    // Create data URL
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    console.log(`Image converted successfully: ${filePath} (${fileExtension}, ${Math.round(base64Data.length / 1024)}KB)`);
    
    return {
      success: true,
      dataUrl: dataUrl,
      mimeType: mimeType,
      size: imageBuffer.length,
      fileName: path.basename(filePath)
    };
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to get MIME type from file extension
function getMimeTypeFromExtension(extension) {
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon'
  };
  
  return mimeTypes[extension.toLowerCase()] || null;
}

// Enhanced Outlook integration for template emails
ipcMain.handle('email-open-outlook-with-template', async (event, emailData) => {
  try {
    const { subject, content, recipients } = emailData;
    
    // Create HTML formatted email content
    const htmlContent = content.replace(/\n/g, '<br>');
    
    // For template emails, we'll create a more sophisticated mailto URL
    // that includes HTML content if supported by the email client
    const recipientList = Array.isArray(recipients) ? recipients.join(';') : recipients;
    const encodedSubject = encodeURIComponent(subject);
    const encodedContent = encodeURIComponent(content); // Keep as plain text for mailto compatibility
    
    const mailtoUrl = `mailto:${recipientList}?subject=${encodedSubject}&body=${encodedContent}`;
    
    // Open in default email client
    await shell.openExternal(mailtoUrl);
    
    return { 
      success: true, 
      message: 'Email opened in Outlook',
      recipients: Array.isArray(recipients) ? recipients : [recipients]
    };
  } catch (error) {
    console.error('Error opening Outlook with template:', error);
    return { success: false, error: error.message };
  }
});

// Batch email opening for multiple agencies
ipcMain.handle('email-open-outlook-batch', async (event, emailsData) => {
  try {
    console.log('=== DEBUG: Batch email handler called ===');
    console.log('Emails data received:', emailsData);
    console.log('Number of emails to process:', emailsData.length);
    
    const results = [];
    
    // Open each email individually to allow for personalization
    for (const emailData of emailsData) {
      try {
        console.log('Processing email data:', emailData);
        const { subject, content, recipient, agencyName } = emailData;
        
        if (!recipient) {
          console.error('No recipient found for email:', emailData);
          results.push({ 
            success: false, 
            agencyName: agencyName || 'Unknown', 
            recipient: 'None',
            error: 'No recipient email address' 
          });
          continue;
        }
        
        // Handle images in email content for mailto URLs
        let processedContent = content || '';
        const hasImages = processedContent.includes('<img');
        
        if (hasImages) {
          // Remove img tags and replace with image placeholders for mailto compatibility
          processedContent = processedContent.replace(
            /<img[^>]*src="data:image\/[^"]*"[^>]*>/gi, 
            '[IMAGE ATTACHMENT - Please attach images manually to this email]'
          );
          
          // Convert HTML to plain text for mailto
          processedContent = processedContent
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<p>/gi, '')
            .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
          
          // Add note about images
          processedContent += '\n\n--- Note: This email template contained images that need to be attached manually ---';
        } else {
          // Convert HTML to plain text for mailto
          processedContent = processedContent
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<p>/gi, '')
            .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
        }
        
        const encodedSubject = encodeURIComponent(subject || '');
        const encodedContent = encodeURIComponent(processedContent);
        const mailtoUrl = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedContent}`;
        
        console.log('Generated mailto URL length:', mailtoUrl.length);
        console.log('Has images:', hasImages);
        if (mailtoUrl.length > 2000) {
          console.warn('WARNING: mailto URL is very long (' + mailtoUrl.length + ' chars), may cause issues');
        }
        // Only log full URL if it's not too long to avoid console spam
        if (mailtoUrl.length < 500) {
          console.log('Generated mailto URL:', mailtoUrl);
        } else {
          console.log('Generated mailto URL (truncated):', mailtoUrl.substring(0, 200) + '...');
        }
        
        // Small delay between emails to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await shell.openExternal(mailtoUrl);
        
        results.push({ 
          success: true, 
          agencyName, 
          recipient,
          message: `Email opened for ${agencyName}` 
        });
        
        console.log('Email opened successfully for:', agencyName);
      } catch (emailError) {
        console.error('Error processing individual email:', emailError);
        results.push({ 
          success: false, 
          agencyName: emailData.agencyName || 'Unknown', 
          recipient: emailData.recipient || 'None',
          error: emailError.message 
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    console.log('Batch email results:', {
      total: results.length,
      successful: successCount,
      failed: failCount,
      results: results
    });
    
    return { 
      success: true, 
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      },
      message: `Opened ${successCount} emails successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
    };
  } catch (error) {
    console.error('Error opening batch emails:', error);
    return { success: false, error: error.message };
  }
});

// OneDrive sync upload handlers
ipcMain.handle('oneDriveSyncUpload', async (event, { projectPath, projectData, settings }) => {
  try {
    console.log('Main process: Starting OneDrive sync upload');

    // Initialize sync service with settings
    oneDriveSyncService.initialize(settings || {
      enabled: true,
      syncFolderPath: '',
      cleanupStrategy: 'auto-delete'
    });

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
    const uploadResult = await oneDriveSyncService.uploadToSync(
      zipPath,
      settings.syncFolderPath,
      {
        overwrite: true,
        waitForSync: true,
        syncTimeout: 120000, // 2 minutes
        cleanupStrategy: settings.cleanupStrategy || 'auto-delete',
        progressCallback: progressCallback // Pass through for sync status updates
      }
    );

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

    return {
      success: true,
      uploadResult: uploadResult,
      zipPath: zipPath,
      syncStatus: uploadResult.syncStatus,
      synced: uploadResult.synced
    };

  } catch (error) {
    console.error('Main process: OneDrive sync upload failed:', error);

    return {
      success: false,
      error: error.message
    };
  }
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
      message: verification.valid ?
        'Sync folder is valid and ready for uploads' :
        `Invalid sync folder: ${verification.error}`
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
    const result = await dialog.showOpenDialog(mainWindow, {
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
      if (mainWindow) {
        mainWindow.webContents.send('workload:file-changed', data);
      }
    });
    
    fileWatcherService.on('users:changed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('workload:users-file-changed', data);
      }
    });
    
    fileWatcherService.on('assignments:changed', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('workload:assignments-file-changed', data);
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
        if (mainWindow) {
          mainWindow.webContents.send('workload:file-changed', data);
        }
      });
      
      fileWatcherService.on('users:changed', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('workload:users-file-changed', data);
        }
      });
      
      fileWatcherService.on('assignments:changed', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('workload:assignments-file-changed', data);
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
    const result = await dialog.showSaveDialog(mainWindow, {
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
      return { success: true, filePath: normalizedPath, isNew: !await fs.pathExists(normalizedPath) };
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
    
    const result = await workloadExcelService.exportAssignmentsToExcel(assignments, filePath, fieldMappingResult.mapping);
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
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select DAS General Excel File',
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] }
      ],
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
