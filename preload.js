const { contextBridge, ipcRenderer } = require('electron');

// SECURITY: Only expose specific, validated APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations (with validation)
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  
  // Project operations
  projectCreate: (projectData) => ipcRenderer.invoke('project-create', projectData),
  projectLoad: (projectId) => ipcRenderer.invoke('project-load', projectId),
  projectLoadByRFA: (rfaNumber, projectContainer) => ipcRenderer.invoke('project-load-by-rfa', rfaNumber, projectContainer),
  projectSave: (projectData) => ipcRenderer.invoke('project-save', projectData),
  projectDelete: (projectId) => ipcRenderer.invoke('project-delete', projectId),
  projectSearch: (searchCriteria) => ipcRenderer.invoke('project-search', searchCriteria),
  projectStats: () => ipcRenderer.invoke('project-stats'),
  
  // Triage calculations
  triageCalculate: (triageData) => ipcRenderer.invoke('triage-calculate', triageData),
  
  // Export operations
  exportDASBoard: (projectData, triageData) => ipcRenderer.invoke('export-das-board', projectData, triageData),
  exportAgile: (projectData, triageData) => ipcRenderer.invoke('export-agile', projectData, triageData),
  
  // Word operations
  wordCreateDocument: () => ipcRenderer.invoke('word-create-document'),
  wordOpenDocument: (filePath) => ipcRenderer.invoke('word-open-document', filePath),
  wordSaveDocument: (document, filePath, options) => ipcRenderer.invoke('word-save-document', document, filePath, options),
  wordSearchReplace: (document, searchTerm, replaceTerm, options) => ipcRenderer.invoke('word-search-replace', document, searchTerm, replaceTerm, options),
  
  // Project management
  projectOpenFolder: (projectData) => ipcRenderer.invoke('project-open-folder', projectData),
  projectDownloadTemplate: (regionalTeam) => ipcRenderer.invoke('project-download-template', regionalTeam),
  projectUploadTriages: (regionalTeam) => ipcRenderer.invoke('project-upload-triages', regionalTeam),
  projectOpenDASBoard: (regionalTeam) => ipcRenderer.invoke('project-open-das-board', regionalTeam),
  
  // Settings and persistence
  settingsLoad: () => ipcRenderer.invoke('settings-load'),
  settingsSave: (settings) => ipcRenderer.invoke('settings-save', settings),
  templatesLoad: () => ipcRenderer.invoke('templates-load'),
  templatesSave: (templates) => ipcRenderer.invoke('templates-save', templates),
  
  // Import/export
  projectsExport: (exportPath, format) => ipcRenderer.invoke('projects-export', exportPath, format),
  projectsImport: (importPath, format) => ipcRenderer.invoke('projects-import', importPath, format),
  
  // Project creation
  projectCreateFolder: (projectData) => ipcRenderer.invoke('project-create-folder', projectData),
  projectCreateWithFolders: (projectData) => ipcRenderer.invoke('project-create-with-folders', projectData),
  projectExportDASBoard: (projectData) => ipcRenderer.invoke('project-export-das-board', projectData),
  projectExportAgile: (projectData) => ipcRenderer.invoke('project-export-agile', projectData),
  
  // Error handling
  onError: (callback) => ipcRenderer.on('error', callback),
  onNewProject: (callback) => ipcRenderer.on('new-project', callback),
  onOpenProject: (callback) => ipcRenderer.on('open-project', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// SECURITY: Prevent access to Node.js APIs
window.process = undefined;
window.require = undefined;
window.module = undefined;
window.global = undefined;
