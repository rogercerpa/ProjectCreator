const { app, BrowserWindow, Menu, dialog, Notification, screen } = require('electron');
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
const ProjectPersistenceService = require('./main-process/services/ProjectPersistenceService');
const ProjectCreationService = require('./main-process/services/ProjectCreationService');
const DuplicateProjectDetectionService = require('./main-process/services/DuplicateProjectDetectionService');
const FormSettingsService = require('./main-process/services/FormSettingsService');
const ErrorLogService = require('./main-process/services/ErrorLogService');
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
const SharedCalendarService = require('./main-process/services/SharedCalendarService');
const FieldMappingService = require('./main-process/services/FieldMappingService');
const WorkloadExcelService = require('./main-process/services/WorkloadExcelService');
const WorkloadExcelSyncService = require('./main-process/services/WorkloadExcelSyncService');
const GoogleSheetSyncService = require('./main-process/services/GoogleSheetSyncService');
const DASGeneralService = require('./main-process/services/DASGeneralService');

// Import package.json for version info
const packageJson = require('./package.json');

// Keep a global reference of the window object
let mainWindow;

// Track active uploads to prevent closing during upload
let activeUploads = new Set();

// Initialize services
const projectService = new ProjectService();
const wordService = new WordService();
const projectPersistenceService = new ProjectPersistenceService();
const projectCreationService = new ProjectCreationService();
const duplicateProjectDetectionService = new DuplicateProjectDetectionService();
const formSettingsService = new FormSettingsService();
const errorLogService = new ErrorLogService({
  appName: packageJson.name === 'project-creator' ? 'Project Creator' : packageJson.name,
  appVersion: packageJson.version,
  buildDate: null,
  getVersions: () => process.versions
});
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
// Provides project persistence and settings access for Ready for QC scans.
readyForQCService.setProjectPersistenceService(projectPersistenceService);

// Initialize DAS Upload service
const DasUploadService = require('./main-process/services/DasUploadService');
const dasUploadService = new DasUploadService();

// Initialize DAS Search service
const DASSearchService = require('./main-process/services/DASSearchService');
const dasSearchService = new DASSearchService();

// Initialize workload services
const workloadPersistenceService = new WorkloadPersistenceService();
const sharedCalendarService = new SharedCalendarService({
  dataDirectory: 'Z:\\DAS References\\ProjectCreatorV5'
});
const fieldMappingService = new FieldMappingService();
const workloadExcelService = new WorkloadExcelService(fieldMappingService);
const workloadExcelSyncService = new WorkloadExcelSyncService(workloadExcelService, fieldMappingService, settingsService);
const googleSheetSyncService = new GoogleSheetSyncService(workloadPersistenceService, projectPersistenceService);

// Initialize DAS General service
const dasGeneralService = new DASGeneralService(settingsService);
const UserTimeCalendarService = require('./main-process/services/UserTimeCalendarService');
const userTimeCalendarService = new UserTimeCalendarService();

// Import BOM services
const BOMParserService = require('./main-process/services/BOMParserService');
const BOMPersistenceService = require('./main-process/services/BOMPersistenceService');
const BOMBulkImportService = require('./main-process/services/BOMBulkImportService');

// Initialize BOM services
const bomParserService = new BOMParserService();
const bomPersistenceService = new BOMPersistenceService(projectPersistenceService);
const bomBulkImportService = new BOMBulkImportService(bomPersistenceService, projectPersistenceService);

// Initialize Training Hub service
const TrainingHubService = require('./main-process/services/TrainingHubService');
const trainingHubService = new TrainingHubService(settingsService);

// Spec review uses the product knowledge base. Scanning is rule-based.
const ProductKnowledgeBaseService = require('./main-process/services/ProductKnowledgeBaseService');
const SpecReviewService = require('./main-process/services/SpecReviewService');
const SpecReviewPersistenceService = require('./main-process/services/SpecReviewPersistenceService');
const productKBService = new ProductKnowledgeBaseService(settingsService);
const specReviewService = new SpecReviewService(productKBService);
const specReviewPersistenceService = new SpecReviewPersistenceService();

// Agile workqueue scraping (Edge CDP + puppeteer-core)
const EdgeConnectionManager = require('./main-process/services/EdgeConnectionManager');
const AgileScrapingService = require('./main-process/services/AgileScrapingService');
const edgeConnectionManager = new EdgeConnectionManager({ debugPort: 9222 });
function showAgileNotification(title, body) {
  if (!Notification.isSupported()) return;
  try {
    const n = new Notification({ title: title || 'Project Creator', body: body || '' });
    n.show();
  } catch (e) {
    console.warn('Agile notification failed:', e.message);
  }
}

const ECD_NOTIFY_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6 hours per RFA
const lastECDNotifyByRfa = new Map();

const agileScrapingService = new AgileScrapingService(edgeConnectionManager, {
  onWorkqueueUpdate: (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agile-workqueue-update', data);
    }
  },
  onNewRFA: (rfa) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agile-new-rfa', rfa);
    }
    showAgileNotification('New RFA in workqueue', `${rfa.rfaNumber || 'RFA'}${rfa.projectName ? ` - ${rfa.projectName}` : ''}`);
  },
  onRFAChanged: (rfa) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agile-rfa-changed', rfa);
    }
    showAgileNotification('RFA updated', `${rfa.rfaNumber || 'RFA'}${rfa.status ? ` - ${rfa.status}` : ''}`);
  },
  onECDAAlert: (rfa) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agile-ecd-alert', rfa);
    }
    const key = rfa.rfaNumber || rfa.projectName || 'unknown';
    const now = Date.now();
    const last = lastECDNotifyByRfa.get(key);
    if (last == null || now - last > ECD_NOTIFY_THROTTLE_MS) {
      lastECDNotifyByRfa.set(key, now);
      showAgileNotification('ECD due soon or overdue', `${rfa.rfaNumber || 'RFA'}${rfa.ecd ? ` - ECD ${rfa.ecd}` : ''}`);
    }
  }
});
edgeConnectionManager.onDisconnect(() => {
  agileScrapingService.stopMonitoring();
});

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

sharedCalendarService.on('changed', (data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shared-calendar:changed', data);
  }
});

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  const { workArea } = screen.getPrimaryDisplay();
  const defaults = {
    width: Math.min(1400, workArea.width),
    height: Math.min(1000, workArea.height),
    isMaximized: false
  };

  try {
    const saved = fs.readJsonSync(windowStatePath);
    const visible = screen.getAllDisplays().some(({ workArea: area }) =>
      saved.x >= area.x - 50 && saved.y >= area.y - 50 &&
      saved.x < area.x + area.width - 100 && saved.y < area.y + area.height - 100
    );
    // Ignore saved positions on a monitor that is no longer connected.
    return visible ? { ...defaults, ...saved } : { ...defaults, isMaximized: Boolean(saved.isMaximized) };
  } catch {
    return defaults;
  }
}

function trackWindowState(win) {
  let saveTimer = null;
  const save = () => {
    if (win.isDestroyed()) return;
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    fs.outputJson(windowStatePath, { ...bounds, isMaximized: win.isMaximized() }).catch(() => {});
  };
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  };
  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('close', save);
}

function createWindow() {
  const windowState = loadWindowState();

  // Create the browser window
  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false, // SECURITY: Disable Node.js integration
      contextIsolation: true, // SECURITY: Enable context isolation
      enableRemoteModule: false, // SECURITY: Disable deprecated remote module
      webSecurity: true, // SECURITY: Enable web security
      sandbox: false, // Required for file system access in Electron
      backgroundThrottling: false, // Prevent IPC/timer throttling during idle periods
      preload: path.join(__dirname, 'preload.js') // SECURITY: Use preload script for secure IPC
    },
    icon: path.join(__dirname, 'assets/icons/favicon.ico'),
    title: 'Project Creator',
    show: false
  });

  // Load the app from the dist folder
  mainWindow.loadFile('dist/index.html');

  trackWindowState(mainWindow);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) mainWindow.maximize();
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

  // Prevent closing if uploads are in progress
  mainWindow.on('close', async (event) => {
    if (activeUploads.size > 0) {
      event.preventDefault();
      
      const uploadCount = activeUploads.size;
      const response = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Force Quit'],
        defaultId: 0,
        cancelId: 0,
        title: 'Upload in Progress',
        message: `${uploadCount} upload${uploadCount > 1 ? 's are' : ' is'} currently in progress.`,
        detail: 'Closing the application will interrupt the upload. Are you sure you want to quit?'
      });
      
      if (response.response === 1) {
        // User clicked "Force Quit" - clear uploads and close
        activeUploads.clear();
        mainWindow.destroy();
      }
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// These touch network drives (Z:, OneDrive), so they run after the window is up
// and in parallel; a slow or disconnected drive must not delay startup.
async function runBackgroundStartupTasks() {
  const tasks = [
    ['Version check', () => versionCheckService.handlePostInstall()],
    ['Agency sync service', () => agencySyncService.initialize()],
    ['Workload Excel sync service', () => workloadExcelSyncService.initialize()],
    ['Shared calendar watcher', () => sharedCalendarService.startWatching()]
  ];

  const results = await Promise.allSettled(tasks.map(([, run]) => run()));
  results.forEach((outcome, index) => {
    const [name] = tasks[index];
    if (outcome.status === 'rejected') {
      console.error(`❌ ${name} failed:`, outcome.reason);
    } else if (outcome.value && outcome.value.success === false) {
      console.warn(`⚠️ ${name} initialization failed:`, outcome.value.error);
    } else {
      console.log(`✅ ${name} initialized`);
    }
  });
}

// Create window when Electron is ready
app.whenReady().then(async () => {
  createWindow();
  runBackgroundStartupTasks();

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

app.on('before-quit', async () => {
  try {
    await sharedCalendarService.stopWatching();
  } catch (error) {
    console.warn('Failed to stop shared calendar watcher:', error?.message || error);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers live in main-process/ipc/, one module per feature area.
const ipcContext = {
  getMainWindow: () => mainWindow,
  activeUploads,
  agencyProjectService,
  agencyService,
  agencySyncService,
  agileScrapingService,
  bomBulkImportService,
  bomParserService,
  bomPersistenceService,
  dasGeneralService,
  dasSearchService,
  dasUploadService,
  duplicateProjectDetectionService,
  edgeConnectionManager,
  emailTemplateService,
  errorLogService,
  excelDiagnosticService,
  fieldMappingService,
  formSettingsService,
  googleSheetSyncService,
  oneDriveSyncService,
  productKBService,
  projectCreationService,
  projectPersistenceService,
  projectService,
  readyForQCService,
  settingsService,
  sharedCalendarService,
  specReviewPersistenceService,
  specReviewService,
  trainingHubService,
  userTimeCalendarService,
  wordService,
  workloadExcelService,
  workloadExcelSyncService,
  workloadPersistenceService,
  zipService,
};
require('./main-process/ipc/app')(ipcContext);
require('./main-process/ipc/projects')(ipcContext);
require('./main-process/ipc/agile')(ipcContext);
require('./main-process/ipc/agencies')(ipcContext);
require('./main-process/ipc/oneDrive')(ipcContext);
require('./main-process/ipc/workload')(ipcContext);
require('./main-process/ipc/dasGeneral')(ipcContext);
require('./main-process/ipc/bom')(ipcContext);
require('./main-process/ipc/knowledge')(ipcContext);

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
