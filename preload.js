const { contextBridge, ipcRenderer } = require('electron');

// SECURITY: Only expose specific, validated APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations (with validation)
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
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
  projectsLoadAll: () => ipcRenderer.invoke('projects-load-all'), // CRITICAL FIX for data persistence
  
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
  
  // External applications
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Project creation
  projectCreateFolder: (projectData) => ipcRenderer.invoke('project-create-folder', projectData),
  projectCreateWithFolders: (projectData) => ipcRenderer.invoke('project-create-with-folders', projectData),
  projectExportDASBoard: (projectData) => ipcRenderer.invoke('project-export-das-board', projectData),
  projectExportAgile: (projectData) => ipcRenderer.invoke('project-export-agile', projectData),
  
  // Revision workflow operations
  revisionDetectExisting: (projectData) => ipcRenderer.invoke('revision-detect-existing', projectData),
  revisionFindPrevious: (projectData) => ipcRenderer.invoke('revision-find-previous', projectData),
  revisionValidateFolder: (folderPath) => ipcRenderer.invoke('revision-validate-folder', folderPath),
  revisionCreate: (projectData, revisionOptions) => ipcRenderer.invoke('revision-create', projectData, revisionOptions),
  revisionAnalyzeContents: (revisionPath) => ipcRenderer.invoke('revision-analyze-contents', revisionPath),
  revisionGetCopyOptions: (revisionPath) => ipcRenderer.invoke('revision-get-copy-options', revisionPath),
  revisionHandleFolderMismatch: (selectedPath, expectedPath) => ipcRenderer.invoke('revision-handle-folder-mismatch', selectedPath, expectedPath),
  revisionRenameFolder: (oldPath, newPath) => ipcRenderer.invoke('revision-rename-folder', oldPath, newPath),
  revisionSelectFolder: (startingPath) => ipcRenderer.invoke('revision-select-folder', startingPath),
  
  // Duplicate project detection
  duplicateCheckProject: (projectData) => ipcRenderer.invoke('duplicate-check-project', projectData),
  
  // Simple folder existence check
  checkFolderExists: (folderPath) => ipcRenderer.invoke('check-folder-exists', folderPath),

  // Progress tracking events
  onRevisionProgress: (callback) => {
    ipcRenderer.on('revision-progress-update', (event, data) => callback(data));
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners('revision-progress-update');
  },
  onRevisionComplete: (callback) => {
    ipcRenderer.on('revision-progress-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('revision-progress-complete');
  },
  onRevisionError: (callback) => {
    ipcRenderer.on('revision-progress-error', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('revision-progress-error');
  },
  
  // Validation methods
  projectValidate: (projectData) => ipcRenderer.invoke('project-validate', projectData),
  projectValidateField: (fieldName, value, projectData) => ipcRenderer.invoke('project-validate-field', fieldName, value, projectData),
  projectValidationStatus: () => ipcRenderer.invoke('project-validation-status'),
  projectClearValidationCaches: () => ipcRenderer.invoke('project-clear-validation-caches'),
  
  // Form Settings methods
  formSettingsGetAll: () => ipcRenderer.invoke('form-settings-get-all'),
  formSettingsGetRFATypes: () => ipcRenderer.invoke('form-settings-get-rfa-types'),
  formSettingsGetNationalAccounts: () => ipcRenderer.invoke('form-settings-get-national-accounts'),
  formSettingsAddCustomRFAType: (label, value) => ipcRenderer.invoke('form-settings-add-custom-rfa-type', label, value),
  formSettingsAddCustomNationalAccount: (label, value) => ipcRenderer.invoke('form-settings-add-custom-national-account', label, value),
  formSettingsValidateFormData: (formData) => ipcRenderer.invoke('form-settings-validate-form-data', formData),
  
  // Agency operations
  agenciesImportExcel: (filePath) => ipcRenderer.invoke('agencies-import-excel', filePath),
  agenciesLoadAll: () => ipcRenderer.invoke('agencies-load-all'),
  agenciesSearch: (searchTerm, filters) => ipcRenderer.invoke('agencies-search', searchTerm, filters),
  agenciesGetFilterOptions: () => ipcRenderer.invoke('agencies-get-filter-options'),
  agenciesAdd: (agencyData) => ipcRenderer.invoke('agencies-add', agencyData),
  agenciesUpdate: (agencyId, updates) => ipcRenderer.invoke('agencies-update', agencyId, updates),
  agenciesDelete: (agencyId) => ipcRenderer.invoke('agencies-delete', agencyId),
  agenciesGetStatistics: () => ipcRenderer.invoke('agencies-get-statistics'),
  agenciesExportExcel: (outputPath) => ipcRenderer.invoke('agencies-export-excel', outputPath),
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  excelDiagnose: (filePath) => ipcRenderer.invoke('excel-diagnose', filePath),
  
  // Sync operations
  syncGetSettings: () => ipcRenderer.invoke('sync-get-settings'),
  syncUpdateSettings: (newSettings) => ipcRenderer.invoke('sync-update-settings', newSettings),
  syncTestFilePath: (filePath) => ipcRenderer.invoke('sync-test-file-path', filePath),
  syncStartAuto: (filePath) => ipcRenderer.invoke('sync-start-auto', filePath),
  syncStopAuto: () => ipcRenderer.invoke('sync-stop-auto'),
  syncManual: (filePath) => ipcRenderer.invoke('sync-manual', filePath),
  syncGetStatus: () => ipcRenderer.invoke('sync-get-status'),
  syncExportToExcel: (filePath, options) => ipcRenderer.invoke('sync-export-to-excel', filePath, options),
  
  // Error handling
  onError: (callback) => ipcRenderer.on('error', callback),
  onNewProject: (callback) => ipcRenderer.on('new-project', callback),
  onOpenProject: (callback) => ipcRenderer.on('open-project', callback),
  
  // SharePoint upload
  sharePointBrowserUpload: (data) => ipcRenderer.invoke('sharePointBrowserUpload', data),
  testSharePointAccess: (url) => ipcRenderer.invoke('testSharePointAccess', url),
  onSharePointUploadProgress: (callback) => ipcRenderer.on('sharePointUploadProgress', (event, data) => callback(data)),
  removeSharePointUploadProgressListener: (callback) => ipcRenderer.removeListener('sharePointUploadProgress', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// SECURITY: Prevent access to Node.js APIs
window.process = undefined;
window.require = undefined;
window.module = undefined;
window.global = undefined;
