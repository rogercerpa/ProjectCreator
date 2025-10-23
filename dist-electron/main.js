"use strict";
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const os = require("os");
const localAppDataPath = path.join(os.homedir(), "AppData", "Local", "project-creator");
app.setPath("userData", localAppDataPath);
app.setPath("sessionData", path.join(localAppDataPath, "Session Storage"));
app.setPath("cache", path.join(localAppDataPath, "Cache"));
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-process-crash-limit");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
console.log("✅ Cache directories configured:");
console.log("   User Data:", app.getPath("userData"));
console.log("   Cache:", app.getPath("cache"));
console.log("   Session Data:", app.getPath("sessionData"));
const versionCheckService = require("./src/utils/versionCheck").default;
const ProjectService = require("./main-process/services/ProjectService");
const WordService = require("./main-process/services/WordService");
const FileService = require("./main-process/services/FileService");
const ProjectPersistenceService = require("./main-process/services/ProjectPersistenceService");
const ProjectCreationService = require("./main-process/services/ProjectCreationService");
const DuplicateProjectDetectionService = require("./main-process/services/DuplicateProjectDetectionService");
const FormSettingsService = require("./main-process/services/FormSettingsService");
const SecurityLoggingService = require("./main-process/services/SecurityLoggingService");
const AgencyService = require("./main-process/services/AgencyService");
const ExcelDiagnosticService = require("./main-process/services/ExcelDiagnosticService");
const SettingsService = require("./main-process/services/SettingsService");
const AgencySyncService = require("./main-process/services/AgencySyncService");
const EmailTemplateService = require("./main-process/services/EmailTemplateService");
const ZipService = require("./main-process/services/ZipService");
const OneDriveSyncService = require("./main-process/services/OneDriveSyncService");
const WorkloadPersistenceService = require("./main-process/services/WorkloadPersistenceService");
const FileWatcherService = require("./main-process/services/FileWatcherService");
const WebSocketService = require("./main-process/services/WebSocketService");
const packageJson = require("./package.json");
let mainWindow;
const projectService = new ProjectService();
const wordService = new WordService();
new FileService();
const projectPersistenceService = new ProjectPersistenceService();
const projectCreationService = new ProjectCreationService();
const duplicateProjectDetectionService = new DuplicateProjectDetectionService();
const formSettingsService = new FormSettingsService();
const securityLoggingService = new SecurityLoggingService();
const agencyService = new AgencyService();
const excelDiagnosticService = new ExcelDiagnosticService();
const settingsService = new SettingsService();
const agencySyncService = new AgencySyncService(agencyService, settingsService);
const emailTemplateService = new EmailTemplateService();
const zipService = new ZipService();
const oneDriveSyncService = new OneDriveSyncService();
const workloadPersistenceService = new WorkloadPersistenceService();
let fileWatcherService = null;
const webSocketService = new WebSocketService();
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1300,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      // SECURITY: Disable Node.js integration
      contextIsolation: true,
      // SECURITY: Enable context isolation
      enableRemoteModule: false,
      // SECURITY: Disable deprecated remote module
      webSecurity: true,
      // SECURITY: Enable web security
      sandbox: false,
      // Required for file system access in Electron
      preload: path.join(__dirname, "preload.js")
      // SECURITY: Use preload script for secure IPC
    },
    icon: path.join(__dirname, "assets/icons/favicon.ico"),
    title: "Project Creator",
    show: false
  });
  mainWindow.loadFile("dist/index.html");
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorCode, errorDescription);
  });
  mainWindow.webContents.on("dom-ready", () => {
    console.log("DOM is ready");
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(async () => {
  try {
    await versionCheckService.handlePostInstall();
  } catch (error) {
    console.error("Error during version check:", error);
  }
  try {
    await agencySyncService.initialize();
    console.log("✅ Agency sync service initialized");
  } catch (error) {
    console.error("Error initializing sync service:", error);
  }
  createWindow();
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("new-project");
          }
        },
        {
          label: "Open Project",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
              title: "Open Project Directory"
            });
            if (!result.canceled) {
              mainWindow.webContents.send("open-project", result.filePaths[0]);
            }
          }
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Project Creator",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About Project Creator",
              message: "Project Creator",
              detail: `Version ${packageJson.version}
Built with Electron and React
Acuity Brands, Inc.`
            });
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Directory"
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Folder"
  });
  return result;
});
ipcMain.handle("select-file", async (event, options = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    title: options.title || "Select File",
    filters: options.filters || []
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("save-file", async (event, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || "Save File",
    filters: options.filters || []
  });
  return result.canceled ? null : result.filePath;
});
ipcMain.handle("fs-read-file", async (event, filePath) => {
  try {
    await securityLoggingService.logFileAccess(filePath, process.env.USERNAME || "unknown", "READ");
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    await securityLoggingService.logSecurityEvent("FILE_ACCESS_FAILED", {
      filePath,
      error: error.message,
      user: process.env.USERNAME || "unknown"
    }, "WARNING");
    throw error;
  }
});
ipcMain.handle("fs-write-file", async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, "utf8");
    return true;
  } catch (error) {
    throw error;
  }
});
ipcMain.handle("fs-copy-file", async (event, src, dest) => {
  try {
    await fs.copy(src, dest);
    return true;
  } catch (error) {
    throw error;
  }
});
ipcMain.handle("fs-create-dir", async (event, dirPath) => {
  try {
    await fs.ensureDir(dirPath);
    return true;
  } catch (error) {
    throw error;
  }
});
ipcMain.handle("fs-exists", async (event, path2) => {
  try {
    return await fs.pathExists(path2);
  } catch (error) {
    return false;
  }
});
ipcMain.handle("project-create", async (event, projectData) => {
  try {
    const result = await projectService.createProjectFolder(projectData, projectData.saveLocation);
    if (result.success) {
      await projectPersistenceService.saveProject(projectData);
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-load", async (event, projectId) => {
  try {
    return await projectPersistenceService.loadProjectById(projectId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-load-by-rfa", async (event, rfaNumber, projectContainer) => {
  try {
    return await projectPersistenceService.loadProjectByRFA(rfaNumber, projectContainer);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-save", async (event, projectData) => {
  try {
    return await projectPersistenceService.saveProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-delete", async (event, projectId) => {
  try {
    return await projectPersistenceService.deleteProject(projectId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-search", async (event, searchCriteria) => {
  try {
    return await projectPersistenceService.searchProjects(searchCriteria);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-stats", async () => {
  try {
    return await projectPersistenceService.getProjectStats();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("projects-load-all", async () => {
  try {
    const projects = await projectPersistenceService.loadProjects();
    return {
      success: true,
      projects,
      count: projects.length,
      message: `${projects.length} projects loaded successfully`
    };
  } catch (error) {
    console.error("Error loading all projects:", error);
    return {
      success: false,
      error: error.message,
      projects: []
    };
  }
});
ipcMain.handle("triage-calculate", async (event, triageData) => {
  try {
    return await projectService.calculateTriageTime(triageData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("export-das-board", async (event, projectData, triageData) => {
  try {
    return await projectService.exportToDASBoard(projectData, triageData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("export-agile", async (event, projectData, triageData) => {
  try {
    return await projectService.exportToAgile(projectData, triageData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("word-create-document", async () => {
  try {
    return await wordService.createDocument();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("word-open-document", async (event, filePath) => {
  try {
    return await wordService.openDocument(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("word-save-document", async (event, document, filePath, options) => {
  try {
    return await wordService.saveDocument(document, filePath, options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("word-search-replace", async (event, document, searchTerm, replaceTerm, options) => {
  try {
    return await wordService.searchAndReplace(document, searchTerm, replaceTerm, options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-open-folder", async (event, projectData) => {
  try {
    return await projectService.openProjectFolder(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-download-template", async (event, regionalTeam) => {
  try {
    return await projectService.downloadRegionTemplate(regionalTeam);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-upload-triages", async (event, regionalTeam) => {
  try {
    return await projectService.uploadTriages(regionalTeam);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-open-das-board", async (event, regionalTeam) => {
  try {
    return await projectService.openDASBoard(regionalTeam);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("open-external", async (event, url) => {
  try {
    const { shell: shell2 } = require("electron");
    await shell2.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error("Error opening external URL:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("settings-load", async () => {
  try {
    return await projectPersistenceService.loadSettings();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("settings-save", async (event, settings) => {
  try {
    return await projectPersistenceService.saveSettings(settings);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("templates-load", async () => {
  try {
    return await projectPersistenceService.loadTemplates();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("templates-save", async (event, templates) => {
  try {
    return await projectPersistenceService.saveTemplates(templates);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("projects-export", async (event, exportPath, format) => {
  try {
    return await projectPersistenceService.exportProjects(exportPath, format);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("projects-import", async (event, importPath, format) => {
  try {
    return await projectPersistenceService.importProjects(importPath, format);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-create-folder", async (event, projectData) => {
  try {
    return await projectCreationService.createProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-create-with-folders", async (event, projectData) => {
  try {
    return await projectCreationService.createProjectWithFolders(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-detect-existing", async (event, projectData) => {
  try {
    return await projectCreationService.detectExistingProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-find-previous", async (event, projectData) => {
  try {
    return await projectCreationService.findPreviousRevision(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("duplicate-check-project", async (event, projectData) => {
  try {
    console.log("Duplicate detection request received for:", projectData.projectName);
    return await duplicateProjectDetectionService.checkForExistingProject(projectData);
  } catch (error) {
    console.error("Duplicate detection error:", error);
    return { isDuplicate: false, canProceed: true, error: error.message };
  }
});
ipcMain.handle("check-folder-exists", async (event, folderPath) => {
  try {
    console.log("Checking folder existence:", folderPath);
    const exists = await fs.pathExists(folderPath);
    console.log(`Folder ${exists ? "EXISTS" : "NOT FOUND"}:`, folderPath);
    return exists;
  } catch (error) {
    console.error("Error checking folder existence:", error);
    return false;
  }
});
ipcMain.handle("revision-validate-folder", async (event, folderPath) => {
  try {
    return await projectCreationService.validateRFAFolder(folderPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-create", async (event, projectData, revisionOptions) => {
  try {
    const progressCallback = (step, progress, details) => {
      event.sender.send("revision-progress-update", {
        step,
        progress,
        details,
        timestamp: Date.now()
      });
    };
    const optionsWithProgress = {
      ...revisionOptions,
      onProgress: progressCallback
    };
    const result = await projectCreationService.createRevisionProject(projectData, optionsWithProgress);
    if (result.success) {
      event.sender.send("revision-progress-complete", {
        message: result.message,
        timestamp: Date.now()
      });
    }
    return result;
  } catch (error) {
    event.sender.send("revision-progress-error", {
      error: error.message,
      timestamp: Date.now()
    });
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-analyze-contents", async (event, revisionPath) => {
  try {
    return await projectCreationService.analyzeRevisionContents(revisionPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-analyze-ae-markups", async (event, revisionPath) => {
  try {
    const revisionFileCopyService = new (require("./main-process/services/RevisionFileCopyService"))();
    return await revisionFileCopyService.analyzeAEMarkupsFolder(revisionPath);
  } catch (error) {
    console.error("Error analyzing AE Markups folder:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-get-copy-options", async (event, revisionPath) => {
  try {
    return await projectCreationService.getRecommendedCopyOptions(revisionPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-handle-folder-mismatch", async (event, selectedPath, expectedPath) => {
  try {
    return await projectCreationService.handleFolderNameMismatch(selectedPath, expectedPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-rename-folder", async (event, oldPath, newPath) => {
  try {
    return await projectCreationService.renameProjectFolder(oldPath, newPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("revision-select-folder", async (event, startingPath) => {
  try {
    console.log("revision-select-folder called with startingPath:", startingPath);
    const defaultNetworkPath = "\\\\10.3.10.30\\DAS";
    const explorerPath = startingPath || defaultNetworkPath;
    try {
      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      console.log("Using Windows Shell folder browser at:", explorerPath);
      let startPath = explorerPath;
      try {
        if (!await fs.pathExists(explorerPath)) {
          console.log("Network path not accessible, using My Computer as starting point");
          startPath = "";
        }
      } catch (err) {
        console.log("Cannot verify network path, using My Computer as starting point");
        startPath = "";
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
      const tempVbsPath = path.join(os.tmpdir(), "folder_browser_" + Date.now() + ".vbs");
      await fs.writeFile(tempVbsPath, vbScript);
      console.log("Executing VBScript folder browser...");
      const { stdout, stderr } = await execPromise(`cscript.exe //NoLogo "${tempVbsPath}"`, {
        windowsHide: false,
        timeout: 12e4,
        // 2 minutes
        encoding: "utf8"
      });
      try {
        await fs.unlink(tempVbsPath);
      } catch (cleanupError) {
        console.log("Could not clean up temp VBS file:", cleanupError.message);
      }
      console.log("VBScript browser stdout:", stdout);
      console.log("VBScript browser stderr:", stderr);
      if (!stderr && stdout && stdout.trim()) {
        const selectedPath2 = stdout.trim();
        if (selectedPath2 === "CANCELED") {
          console.log("VBScript folder selection canceled");
          return { success: false, canceled: true };
        }
        console.log("VBScript folder selected:", selectedPath2);
        if (!fs.existsSync(selectedPath2)) {
          return {
            success: false,
            error: `The specified path does not exist: ${selectedPath2}`
          };
        }
        const validationResult2 = await projectCreationService.validateRFAFolder(selectedPath2);
        return {
          success: true,
          selectedPath: selectedPath2,
          validation: validationResult2
        };
      } else {
        console.log("VBScript browser failed or returned empty result, using fallback");
        throw new Error("VBScript browser returned empty result");
      }
    } catch (vbsError) {
      console.log("Windows VBScript approach failed, using Electron fallback:", vbsError.message);
    }
    console.log("Using Electron dialog fallback...");
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select Previous RFA Folder",
      defaultPath: explorerPath,
      buttonLabel: "Select RFA Folder"
    });
    console.log("Electron dialog result:", result);
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    const selectedPath = result.filePaths[0];
    console.log("Electron dialog selected path:", selectedPath);
    const validationResult = await projectCreationService.validateRFAFolder(selectedPath);
    console.log("Validation result:", validationResult);
    return {
      success: true,
      selectedPath,
      validation: validationResult
    };
  } catch (error) {
    console.error("revision-select-folder error:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-validate", async (event, projectData) => {
  try {
    return await projectCreationService.validateProject(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-validate-field", async (event, fieldName, value, projectData) => {
  try {
    return await projectCreationService.validateField(fieldName, value, projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("form-settings-get-all", async (event) => {
  try {
    return { success: true, data: formSettingsService.getAllSettings() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("form-settings-get-rfa-types", async (event) => {
  try {
    return { success: true, data: formSettingsService.getRFATypes() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("form-settings-get-national-accounts", async (event) => {
  try {
    return { success: true, data: formSettingsService.getNationalAccounts() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("form-settings-add-custom-rfa-type", async (event, label, value) => {
  try {
    const result = formSettingsService.addCustomRFAType(label, value);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("form-settings-add-custom-national-account", async (event, label, value) => {
  try {
    const result = formSettingsService.addCustomNationalAccount(label, value);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("form-settings-validate-form-data", async (event, formData) => {
  try {
    const result = formSettingsService.validateFormData(formData);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-validation-status", async (event) => {
  try {
    return await projectCreationService.getValidationStatus();
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-clear-validation-caches", async (event) => {
  try {
    projectCreationService.clearValidationCaches();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-export-das-board", async (event, projectData) => {
  try {
    return await projectCreationService.exportToDASBoard(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("project-export-agile", async (event, projectData) => {
  try {
    return await projectCreationService.exportToAgile(projectData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-import-excel", async (event, filePath) => {
  try {
    return await agencyService.importFromExcel(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-load-all", async () => {
  try {
    const agencies = await agencyService.loadAgencies();
    return {
      success: true,
      agencies,
      count: agencies.length,
      message: `${agencies.length} agencies loaded successfully`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-search", async (event, searchTerm, filters) => {
  try {
    const agencies = await agencyService.searchAgencies(searchTerm, filters);
    return {
      success: true,
      agencies,
      count: agencies.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-get-filter-options", async () => {
  try {
    const options = await agencyService.getFilterOptions();
    return {
      success: true,
      options
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-add", async (event, agencyData) => {
  try {
    return await agencyService.addAgency(agencyData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-update", async (event, agencyId, updates) => {
  try {
    return await agencyService.updateAgency(agencyId, updates);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-delete", async (event, agencyId) => {
  try {
    return await agencyService.deleteAgency(agencyId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-get-statistics", async () => {
  try {
    const statistics = await agencyService.getStatistics();
    return {
      success: true,
      statistics
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("agencies-export-excel", async (event, outputPath) => {
  try {
    return await agencyService.exportToExcel(outputPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("select-excel-file", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      title: "Select Excel File",
      filters: [
        { name: "Excel Files", extensions: ["xlsx", "xls"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled) {
      return { success: false, message: "File selection cancelled" };
    }
    return {
      success: true,
      filePath: result.filePaths[0],
      message: "File selected successfully"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("excel-diagnose", async (event, filePath) => {
  try {
    return await excelDiagnosticService.diagnoseExcelFile(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-get-settings", async () => {
  try {
    return await agencySyncService.getSyncSettings();
  } catch (error) {
    console.error("Error in sync-get-settings handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-update-settings", async (event, newSettings) => {
  try {
    return await agencySyncService.updateSyncSettings(newSettings);
  } catch (error) {
    console.error("Error in sync-update-settings handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-test-file-path", async (event, filePath) => {
  try {
    return await agencySyncService.testFilePath(filePath);
  } catch (error) {
    console.error("Error in sync-test-file-path handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-start-auto", async (event, filePath) => {
  try {
    return await agencySyncService.startAutoSync(filePath);
  } catch (error) {
    console.error("Error in sync-start-auto handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-stop-auto", async () => {
  try {
    return await agencySyncService.stopAutoSync();
  } catch (error) {
    console.error("Error in sync-stop-auto handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-manual", async (event, filePath) => {
  try {
    return await agencySyncService.manualSync(filePath);
  } catch (error) {
    console.error("Error in sync-manual handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-get-status", async () => {
  try {
    const status = agencySyncService.getSyncStatus();
    return { success: true, status };
  } catch (error) {
    console.error("Error in sync-get-status handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("sync-export-to-excel", async (event, filePath, options = {}) => {
  try {
    return await agencySyncService.exportToExcel(filePath, options);
  } catch (error) {
    console.error("Error in sync-export-to-excel handler:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-load-all", async () => {
  try {
    const templates = await emailTemplateService.loadTemplates();
    return {
      success: true,
      templates,
      count: templates.length,
      message: `${templates.length} email templates loaded successfully`
    };
  } catch (error) {
    console.error("Error loading email templates:", error);
    return { success: false, error: error.message, templates: [] };
  }
});
ipcMain.handle("email-templates-create", async (event, templateData) => {
  try {
    return await emailTemplateService.createTemplate(templateData);
  } catch (error) {
    console.error("Error creating email template:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-update", async (event, templateId, updates) => {
  try {
    return await emailTemplateService.updateTemplate(templateId, updates);
  } catch (error) {
    console.error("Error updating email template:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-delete", async (event, templateId) => {
  try {
    return await emailTemplateService.deleteTemplate(templateId);
  } catch (error) {
    console.error("Error deleting email template:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-get", async (event, templateId) => {
  try {
    return await emailTemplateService.getTemplate(templateId);
  } catch (error) {
    console.error("Error getting email template:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-get-by-category", async (event, category) => {
  try {
    return await emailTemplateService.getTemplatesByCategory(category);
  } catch (error) {
    console.error("Error getting templates by category:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-get-categories", async () => {
  try {
    return await emailTemplateService.getTemplateCategories();
  } catch (error) {
    console.error("Error getting template categories:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-get-variables", async () => {
  try {
    const variables = emailTemplateService.getAvailableVariables();
    return { success: true, variables };
  } catch (error) {
    console.error("Error getting template variables:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-generate-personalized", async (event, templateId, agencyData) => {
  try {
    const templateResult = await emailTemplateService.getTemplate(templateId);
    if (!templateResult.success) {
      return templateResult;
    }
    return emailTemplateService.generatePersonalizedEmail(templateResult.template, agencyData);
  } catch (error) {
    console.error("Error generating personalized email:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-increment-usage", async (event, templateId) => {
  try {
    return await emailTemplateService.incrementUsageCount(templateId);
  } catch (error) {
    console.error("Error incrementing template usage:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-get-statistics", async () => {
  try {
    return await emailTemplateService.getTemplateStatistics();
  } catch (error) {
    console.error("Error getting template statistics:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-export", async (event, filePath) => {
  try {
    return await emailTemplateService.exportTemplates(filePath);
  } catch (error) {
    console.error("Error exporting email templates:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-templates-import", async (event, filePath, options = {}) => {
  try {
    return await emailTemplateService.importTemplates(filePath, options);
  } catch (error) {
    console.error("Error importing email templates:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-convert-image-to-base64", async (event, filePath) => {
  try {
    console.log("Converting image to base64:", filePath);
    const imageBuffer = await fs.readFile(filePath);
    const fileExtension = path.extname(filePath).toLowerCase().substring(1);
    const mimeType = getMimeTypeFromExtension(fileExtension);
    if (!mimeType) {
      throw new Error(`Unsupported image format: ${fileExtension}`);
    }
    const base64Data = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    console.log(`Image converted successfully: ${filePath} (${fileExtension}, ${Math.round(base64Data.length / 1024)}KB)`);
    return {
      success: true,
      dataUrl,
      mimeType,
      size: imageBuffer.length,
      fileName: path.basename(filePath)
    };
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return { success: false, error: error.message };
  }
});
function getMimeTypeFromExtension(extension) {
  const mimeTypes = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "ico": "image/x-icon"
  };
  return mimeTypes[extension.toLowerCase()] || null;
}
ipcMain.handle("email-open-outlook-with-template", async (event, emailData) => {
  try {
    const { subject, content, recipients } = emailData;
    const htmlContent = content.replace(/\n/g, "<br>");
    const recipientList = Array.isArray(recipients) ? recipients.join(";") : recipients;
    const encodedSubject = encodeURIComponent(subject);
    const encodedContent = encodeURIComponent(content);
    const mailtoUrl = `mailto:${recipientList}?subject=${encodedSubject}&body=${encodedContent}`;
    await shell.openExternal(mailtoUrl);
    return {
      success: true,
      message: "Email opened in Outlook",
      recipients: Array.isArray(recipients) ? recipients : [recipients]
    };
  } catch (error) {
    console.error("Error opening Outlook with template:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("email-open-outlook-batch", async (event, emailsData) => {
  try {
    console.log("=== DEBUG: Batch email handler called ===");
    console.log("Emails data received:", emailsData);
    console.log("Number of emails to process:", emailsData.length);
    const results = [];
    for (const emailData of emailsData) {
      try {
        console.log("Processing email data:", emailData);
        const { subject, content, recipient, agencyName } = emailData;
        if (!recipient) {
          console.error("No recipient found for email:", emailData);
          results.push({
            success: false,
            agencyName: agencyName || "Unknown",
            recipient: "None",
            error: "No recipient email address"
          });
          continue;
        }
        let processedContent = content || "";
        const hasImages = processedContent.includes("<img");
        if (hasImages) {
          processedContent = processedContent.replace(
            /<img[^>]*src="data:image\/[^"]*"[^>]*>/gi,
            "[IMAGE ATTACHMENT - Please attach images manually to this email]"
          );
          processedContent = processedContent.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<p>/gi, "").replace(/<[^>]*>/g, "");
          processedContent += "\n\n--- Note: This email template contained images that need to be attached manually ---";
        } else {
          processedContent = processedContent.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<p>/gi, "").replace(/<[^>]*>/g, "");
        }
        const encodedSubject = encodeURIComponent(subject || "");
        const encodedContent = encodeURIComponent(processedContent);
        const mailtoUrl = `mailto:${recipient}?subject=${encodedSubject}&body=${encodedContent}`;
        console.log("Generated mailto URL length:", mailtoUrl.length);
        console.log("Has images:", hasImages);
        if (mailtoUrl.length > 2e3) {
          console.warn("WARNING: mailto URL is very long (" + mailtoUrl.length + " chars), may cause issues");
        }
        if (mailtoUrl.length < 500) {
          console.log("Generated mailto URL:", mailtoUrl);
        } else {
          console.log("Generated mailto URL (truncated):", mailtoUrl.substring(0, 200) + "...");
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        await shell.openExternal(mailtoUrl);
        results.push({
          success: true,
          agencyName,
          recipient,
          message: `Email opened for ${agencyName}`
        });
        console.log("Email opened successfully for:", agencyName);
      } catch (emailError) {
        console.error("Error processing individual email:", emailError);
        results.push({
          success: false,
          agencyName: emailData.agencyName || "Unknown",
          recipient: emailData.recipient || "None",
          error: emailError.message
        });
      }
    }
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;
    console.log("Batch email results:", {
      total: results.length,
      successful: successCount,
      failed: failCount,
      results
    });
    return {
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount
      },
      message: `Opened ${successCount} emails successfully${failCount > 0 ? `, ${failCount} failed` : ""}`
    };
  } catch (error) {
    console.error("Error opening batch emails:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("oneDriveSyncUpload", async (event, { projectPath, projectData, settings }) => {
  try {
    console.log("Main process: Starting OneDrive sync upload");
    oneDriveSyncService.initialize(settings || {
      enabled: true,
      syncFolderPath: "",
      cleanupStrategy: "auto-delete"
    });
    const progressCallback = (progressData) => {
      console.log("Progress update:", progressData);
      event.sender.send("oneDriveSyncProgress", progressData);
    };
    progressCallback({ phase: "zipping", progress: 10, message: "Creating zip archive..." });
    const zipPath = await zipService.zipProjectFolder(projectPath, projectData, progressCallback);
    console.log("ZIP file created at:", zipPath);
    progressCallback({ phase: "syncing", progress: 40, message: "Copying to OneDrive sync folder..." });
    const uploadResult = await oneDriveSyncService.uploadToSync(
      zipPath,
      settings.syncFolderPath,
      {
        overwrite: true,
        waitForSync: true,
        syncTimeout: 12e4,
        // 2 minutes
        cleanupStrategy: settings.cleanupStrategy || "auto-delete",
        progressCallback
        // Pass through for sync status updates
      }
    );
    console.log("Main process: OneDrive sync upload completed");
    console.log("Sync status:", uploadResult.syncStatus);
    console.log("Sync message:", uploadResult.syncMessage);
    if (uploadResult.synced) {
      progressCallback({
        phase: "complete",
        progress: 100,
        message: "File synced to SharePoint successfully!",
        syncStatus: "synced"
      });
    } else {
      progressCallback({
        phase: "complete",
        progress: 95,
        message: uploadResult.syncMessage || "File copied to OneDrive - syncing in background",
        syncStatus: uploadResult.syncStatus || "pending"
      });
    }
    return {
      success: true,
      uploadResult,
      zipPath,
      syncStatus: uploadResult.syncStatus,
      synced: uploadResult.synced
    };
  } catch (error) {
    console.error("Main process: OneDrive sync upload failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
});
ipcMain.handle("detectOneDriveSync", async () => {
  try {
    console.log("Main process: Detecting OneDrive sync folders");
    const syncFolders = await oneDriveSyncService.findSharePointSyncFolders();
    return {
      success: true,
      syncFolders,
      message: `Found ${syncFolders.length} potential SharePoint sync folders`
    };
  } catch (error) {
    console.error("Main process: OneDrive sync detection failed:", error);
    return {
      success: false,
      error: error.message,
      syncFolders: []
    };
  }
});
ipcMain.handle("testSyncFolder", async (event, syncFolderPath) => {
  try {
    console.log("Main process: Testing sync folder:", syncFolderPath);
    const verification = await oneDriveSyncService.verifySyncFolder(syncFolderPath);
    return {
      success: verification.valid,
      writable: verification.writable,
      hasSyncIndicators: verification.hasSyncIndicators,
      message: verification.valid ? "Sync folder is valid and ready for uploads" : `Invalid sync folder: ${verification.error}`
    };
  } catch (error) {
    console.error("Main process: Sync folder test failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
});
ipcMain.handle("browseForSyncFolder", async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
      title: "Select OneDrive SharePoint Sync Folder",
      message: "Choose the OneDrive folder that syncs with your SharePoint site"
    });
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    const selectedPath = result.filePaths[0];
    console.log("User selected sync folder:", selectedPath);
    const verification = await oneDriveSyncService.verifySyncFolder(selectedPath);
    return {
      success: true,
      folderPath: selectedPath,
      verification
    };
  } catch (error) {
    console.error("Error browsing for sync folder:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:load-all", async () => {
  try {
    return await workloadPersistenceService.loadWorkloads();
  } catch (error) {
    console.error("Error loading workloads:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:load-user", async (event, userId) => {
  try {
    return await workloadPersistenceService.loadUserWorkload(userId);
  } catch (error) {
    console.error("Error loading user workload:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:save", async (event, userId, workload) => {
  try {
    return await workloadPersistenceService.saveUserWorkload(userId, workload);
  } catch (error) {
    console.error("Error saving workload:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:users-load-all", async () => {
  try {
    return await workloadPersistenceService.loadUsers();
  } catch (error) {
    console.error("Error loading users:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:user-save", async (event, user) => {
  try {
    return await workloadPersistenceService.saveUser(user);
  } catch (error) {
    console.error("Error saving user:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:user-get", async (event, userId) => {
  try {
    return await workloadPersistenceService.getUser(userId);
  } catch (error) {
    console.error("Error getting user:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:user-delete", async (event, userId) => {
  try {
    return await workloadPersistenceService.deleteUser(userId);
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:assignments-load-all", async () => {
  try {
    return await workloadPersistenceService.loadAssignments();
  } catch (error) {
    console.error("Error loading assignments:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:assignment-save", async (event, assignment) => {
  try {
    const result = await workloadPersistenceService.saveAssignment(assignment);
    if (webSocketService.isConnected) {
      webSocketService.sendNotification("ASSIGNMENT_CREATED", assignment);
    }
    return result;
  } catch (error) {
    console.error("Error saving assignment:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:assignment-delete", async (event, assignmentId) => {
  try {
    const result = await workloadPersistenceService.deleteAssignment(assignmentId);
    if (webSocketService.isConnected) {
      webSocketService.sendNotification("ASSIGNMENT_DELETED", { assignmentId });
    }
    return result;
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:assignments-by-date-range", async (event, startDate, endDate) => {
  try {
    return await workloadPersistenceService.getAssignmentsByDateRange(startDate, endDate);
  } catch (error) {
    console.error("Error getting assignments by date range:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:stats", async () => {
  try {
    return await workloadPersistenceService.getStats();
  } catch (error) {
    console.error("Error getting workload stats:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:config-save", async (event, config) => {
  try {
    return await workloadPersistenceService.saveConfig(config);
  } catch (error) {
    console.error("Error saving workload config:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:config-load", async () => {
  try {
    return await workloadPersistenceService.loadConfig();
  } catch (error) {
    console.error("Error loading workload config:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:set-data-directory", async (event, directoryPath) => {
  try {
    await workloadPersistenceService.setDataDirectory(directoryPath);
    if (fileWatcherService) {
      await fileWatcherService.stopWatching();
    }
    fileWatcherService = new FileWatcherService(directoryPath);
    await fileWatcherService.startWatching();
    fileWatcherService.on("workload:changed", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("workload:file-changed", data);
      }
    });
    fileWatcherService.on("users:changed", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("workload:users-file-changed", data);
      }
    });
    fileWatcherService.on("assignments:changed", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("workload:assignments-file-changed", data);
      }
    });
    return { success: true, message: "Data directory updated" };
  } catch (error) {
    console.error("Error setting data directory:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:file-watcher-start", async (event, directoryPath) => {
  try {
    if (!fileWatcherService) {
      fileWatcherService = new FileWatcherService(directoryPath);
    }
    const result = await fileWatcherService.startWatching();
    if (result.success) {
      fileWatcherService.removeAllListeners();
      fileWatcherService.on("workload:changed", (data) => {
        if (mainWindow) {
          mainWindow.webContents.send("workload:file-changed", data);
        }
      });
      fileWatcherService.on("users:changed", (data) => {
        if (mainWindow) {
          mainWindow.webContents.send("workload:users-file-changed", data);
        }
      });
      fileWatcherService.on("assignments:changed", (data) => {
        if (mainWindow) {
          mainWindow.webContents.send("workload:assignments-file-changed", data);
        }
      });
    }
    return result;
  } catch (error) {
    console.error("Error starting file watcher:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:file-watcher-stop", async () => {
  try {
    if (fileWatcherService) {
      return await fileWatcherService.stopWatching();
    }
    return { success: true, message: "File watcher not running" };
  } catch (error) {
    console.error("Error stopping file watcher:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:file-watcher-status", async () => {
  try {
    if (fileWatcherService) {
      return { success: true, status: fileWatcherService.getStatus() };
    }
    return { success: true, status: { isWatching: false } };
  } catch (error) {
    console.error("Error getting file watcher status:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:connect", async (event, serverUrl, userId, userName) => {
  try {
    const result = webSocketService.connect(serverUrl, userId, userName);
    webSocketService.removeAllListeners();
    webSocketService.on("connected", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:connected", data);
      }
    });
    webSocketService.on("disconnected", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:disconnected", data);
      }
    });
    webSocketService.on("error", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:error", data);
      }
    });
    webSocketService.on("user:presence", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:user-presence", data);
      }
    });
    webSocketService.on("project:assigned", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:project-assigned", data);
      }
    });
    webSocketService.on("project:status", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:project-status", data);
      }
    });
    webSocketService.on("workload:updated", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:workload-updated", data);
      }
    });
    webSocketService.on("assignment:changed", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:assignment-changed", data);
      }
    });
    webSocketService.on("conflict:detected", (data) => {
      if (mainWindow) {
        mainWindow.webContents.send("websocket:conflict-detected", data);
      }
    });
    return result;
  } catch (error) {
    console.error("Error connecting to WebSocket:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:disconnect", async () => {
  try {
    return webSocketService.disconnect();
  } catch (error) {
    console.error("Error disconnecting from WebSocket:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:send", async (event, message) => {
  try {
    return webSocketService.send(message);
  } catch (error) {
    console.error("Error sending WebSocket message:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:broadcast-assignment", async (event, assignment) => {
  try {
    return webSocketService.broadcastProjectAssignment(assignment);
  } catch (error) {
    console.error("Error broadcasting assignment:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:broadcast-status", async (event, projectId, oldStatus, newStatus) => {
  try {
    return webSocketService.broadcastProjectStatus(projectId, oldStatus, newStatus);
  } catch (error) {
    console.error("Error broadcasting status:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:update-presence", async (event, status) => {
  try {
    return webSocketService.updatePresence(status);
  } catch (error) {
    console.error("Error updating presence:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("websocket:status", async () => {
  try {
    return { success: true, status: webSocketService.getStatus() };
  } catch (error) {
    console.error("Error getting WebSocket status:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("workload:backup-create", async () => {
  try {
    return await workloadPersistenceService.createBackup();
  } catch (error) {
    console.error("Error creating backup:", error);
    return { success: false, error: error.message };
  }
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  if (mainWindow) {
    mainWindow.webContents.send("error", {
      type: "uncaught-exception",
      message: error.message,
      stack: error.stack
    });
  }
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  if (mainWindow) {
    mainWindow.webContents.send("error", {
      type: "unhandled-rejection",
      message: (reason == null ? void 0 : reason.message) || String(reason),
      stack: reason == null ? void 0 : reason.stack
    });
  }
});
