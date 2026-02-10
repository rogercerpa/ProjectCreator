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
  
  // Status tracking operations
  projectBackfillStatus: (projectId, statusDates) => ipcRenderer.invoke('project-backfill-status', projectId, statusDates),
  projectGetAnalytics: (project) => ipcRenderer.invoke('project-get-analytics', project),
  projectNeedsBackfill: (project) => ipcRenderer.invoke('project-needs-backfill', project),
  
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
  openInEdge: (url) => ipcRenderer.invoke('open-in-edge', url),
  
  // Agile workqueue monitoring
  agileCheckEdge: () => ipcRenderer.invoke('agile-check-edge-connection'),
  agileLaunchEdge: (port) => ipcRenderer.invoke('agile-launch-edge-debug', port),
  agileStartMonitoring: (intervalMs) => ipcRenderer.invoke('agile-start-monitoring', intervalMs),
  agileStopMonitoring: () => ipcRenderer.invoke('agile-stop-monitoring'),
  agileScrapeNow: () => ipcRenderer.invoke('agile-scrape-now'),
  agileGetStatus: () => ipcRenderer.invoke('agile-get-status'),
  agileGetWorkqueue: () => ipcRenderer.invoke('agile-get-workqueue'),
  agileDiagnosePage: () => ipcRenderer.invoke('agile-diagnose-page'),
  agileFetchProjectDetails: (payload) => ipcRenderer.invoke('agile-fetch-project-details', payload),
  agileDiagnoseProjectPage: (payload) => ipcRenderer.invoke('agile-diagnose-project-page', payload),
  onAgileUpdate: (callback) => {
    ipcRenderer.on('agile-workqueue-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agile-workqueue-update');
  },
  onAgileNewRFA: (callback) => {
    ipcRenderer.on('agile-new-rfa', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('agile-new-rfa');
  },
  
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
  revisionAnalyzeAEMarkups: (revisionPath) => ipcRenderer.invoke('revision-analyze-ae-markups', revisionPath),
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
  
  // Agency Project operations
  agencyProjectsGetAll: (agencyName, agentNumber) => ipcRenderer.invoke('agency-projects-get-all', agencyName, agentNumber),
  agencyProjectsGetActive: (agencyName, agentNumber) => ipcRenderer.invoke('agency-projects-get-active', agencyName, agentNumber),
  agencyProjectsGetRecentlyCompleted: (agencyName, agentNumber, days) => ipcRenderer.invoke('agency-projects-get-recently-completed', agencyName, agentNumber, days),
  agencyProjectsGetStatistics: (agencyName, agentNumber) => ipcRenderer.invoke('agency-projects-get-statistics', agencyName, agentNumber),
  agencyProjectsGetPerformanceMetrics: (agencyName, agentNumber) => ipcRenderer.invoke('agency-projects-get-performance-metrics', agencyName, agentNumber),
  
  // Sync operations
  syncGetSettings: () => ipcRenderer.invoke('sync-get-settings'),
  syncUpdateSettings: (newSettings) => ipcRenderer.invoke('sync-update-settings', newSettings),
  syncTestFilePath: (filePath) => ipcRenderer.invoke('sync-test-file-path', filePath),
  syncStartAuto: (filePath) => ipcRenderer.invoke('sync-start-auto', filePath),
  syncStopAuto: () => ipcRenderer.invoke('sync-stop-auto'),
  syncManual: (filePath) => ipcRenderer.invoke('sync-manual', filePath),
  syncGetStatus: () => ipcRenderer.invoke('sync-get-status'),
  syncExportToExcel: (filePath, options) => ipcRenderer.invoke('sync-export-to-excel', filePath, options),
  
  // Email template operations
  emailTemplatesLoadAll: () => ipcRenderer.invoke('email-templates-load-all'),
  emailTemplatesCreate: (templateData) => ipcRenderer.invoke('email-templates-create', templateData),
  emailTemplatesUpdate: (templateId, updates) => ipcRenderer.invoke('email-templates-update', templateId, updates),
  emailTemplatesDelete: (templateId) => ipcRenderer.invoke('email-templates-delete', templateId),
  emailTemplatesGet: (templateId) => ipcRenderer.invoke('email-templates-get', templateId),
  emailTemplatesGetByCategory: (category) => ipcRenderer.invoke('email-templates-get-by-category', category),
  emailTemplatesGetCategories: () => ipcRenderer.invoke('email-templates-get-categories'),
  emailTemplatesGetVariables: () => ipcRenderer.invoke('email-templates-get-variables'),
  emailTemplatesGeneratePersonalized: (templateId, agencyData) => ipcRenderer.invoke('email-templates-generate-personalized', templateId, agencyData),
  emailTemplatesIncrementUsage: (templateId) => ipcRenderer.invoke('email-templates-increment-usage', templateId),
  emailTemplatesGetStatistics: () => ipcRenderer.invoke('email-templates-get-statistics'),
  emailTemplatesExport: (filePath) => ipcRenderer.invoke('email-templates-export', filePath),
  emailTemplatesImport: (filePath, options) => ipcRenderer.invoke('email-templates-import', filePath, options),
  
  // Enhanced email operations
  emailOpenOutlookWithTemplate: (emailData) => ipcRenderer.invoke('email-open-outlook-with-template', emailData),
  emailOpenOutlookBatch: (emailsData) => ipcRenderer.invoke('email-open-outlook-batch', emailsData),
  
  // Image processing for email templates
  emailConvertImageToBase64: (filePath) => ipcRenderer.invoke('email-convert-image-to-base64', filePath),
  
  // Error handling
  onError: (callback) => ipcRenderer.on('error', callback),
  onNewProject: (callback) => ipcRenderer.on('new-project', callback),
  onOpenProject: (callback) => ipcRenderer.on('open-project', callback),
  
  // SharePoint upload
  oneDriveSyncUpload: (data) => ipcRenderer.invoke('oneDriveSyncUpload', data),
  detectOneDriveSync: () => ipcRenderer.invoke('detectOneDriveSync'),
  testSyncFolder: (path) => ipcRenderer.invoke('testSyncFolder', path),
  browseForSyncFolder: () => ipcRenderer.invoke('browseForSyncFolder'),
  onOneDriveSyncProgress: (callback) => ipcRenderer.on('oneDriveSyncProgress', (event, data) => callback(data)),
  removeOneDriveSyncProgressListener: (callback) => ipcRenderer.removeListener('oneDriveSyncProgress', callback),
  
  // Ready for QC operations
  qcScanFolder: () => ipcRenderer.invoke('qc-scan-folder'),
  qcCheckProject: (projectId) => ipcRenderer.invoke('qc-check-project', projectId),
  qcGetMatchingZips: (project) => ipcRenderer.invoke('qc-get-matching-zips', project),
  qcDownloadZip: (zipFilePath, project) => ipcRenderer.invoke('qc-download-zip', zipFilePath, project),
  
  // DAS Upload operations
  dasCheckDriveAccess: () => ipcRenderer.invoke('das-check-drive-access'),
  dasUploadProject: (project, confirmed) => ipcRenderer.invoke('das-upload-project', project, confirmed),
  dasOpenFolder: (project) => ipcRenderer.invoke('das-open-folder', project),
  onDasUploadProgress: (callback) => {
    ipcRenderer.on('das-upload-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('das-upload-progress');
  },
  
  // DAS Drive Search operations
  dasSearch: (query, options) => ipcRenderer.invoke('das-search', query, options),
  dasSearchStatus: () => ipcRenderer.invoke('das-search-status'),
  dasSearchOpenPath: (folderPath) => ipcRenderer.invoke('das-search-open-path', folderPath),
  
  // Check active uploads (for preventing app close during uploads)
  checkActiveUploads: () => ipcRenderer.invoke('check-active-uploads'),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // ===== WORKLOAD DASHBOARD APIs =====
  
  // Workload data operations
  workloadLoadAll: () => ipcRenderer.invoke('workload:load-all'),
  workloadLoadUser: (userId) => ipcRenderer.invoke('workload:load-user', userId),
  workloadSave: (userId, workload) => ipcRenderer.invoke('workload:save', userId, workload),
  
  // User operations
  workloadUsersLoadAll: () => ipcRenderer.invoke('workload:users-load-all'),
  workloadUserSave: (user) => ipcRenderer.invoke('workload:user-save', user),
  workloadUserGet: (userId) => ipcRenderer.invoke('workload:user-get', userId),
  workloadUserDelete: (userId) => ipcRenderer.invoke('workload:user-delete', userId),
  
  // Assignment operations
  workloadAssignmentsLoadAll: () => ipcRenderer.invoke('workload:assignments-load-all'),
  workloadAssignmentSave: (assignment) => ipcRenderer.invoke('workload:assignment-save', assignment),
  workloadAssignmentDelete: (assignmentId) => ipcRenderer.invoke('workload:assignment-delete', assignmentId),
  workloadAssignmentsByDateRange: (startDate, endDate) => ipcRenderer.invoke('workload:assignments-by-date-range', startDate, endDate),
  
  // Statistics
  workloadStats: () => ipcRenderer.invoke('workload:stats'),
  
  // Configuration
  workloadConfigSave: (config) => ipcRenderer.invoke('workload:config-save', config),
  workloadConfigLoad: () => ipcRenderer.invoke('workload:config-load'),
  workloadSetDataDirectory: (directoryPath) => ipcRenderer.invoke('workload:set-data-directory', directoryPath),
  
  // File watcher operations
  workloadFileWatcherStart: (directoryPath) => ipcRenderer.invoke('workload:file-watcher-start', directoryPath),
  workloadFileWatcherStop: () => ipcRenderer.invoke('workload:file-watcher-stop'),
  workloadFileWatcherStatus: () => ipcRenderer.invoke('workload:file-watcher-status'),
  
  
  // Backup operations
  workloadBackupCreate: () => ipcRenderer.invoke('workload:backup-create'),
  
  // ===== WORKLOAD EXCEL SYNC APIs =====
  
  // Field Mapping operations
  workloadExcelFieldMappingGet: () => ipcRenderer.invoke('workload-excel:field-mapping-get'),
  workloadExcelFieldMappingSave: (mapping) => ipcRenderer.invoke('workload-excel:field-mapping-save', mapping),
  workloadExcelFieldMappingReset: () => ipcRenderer.invoke('workload-excel:field-mapping-reset'),
  workloadExcelFieldMappingValidate: (mapping) => ipcRenderer.invoke('workload-excel:field-mapping-validate', mapping),
  
  // Excel operations
  workloadExcelTestFilePath: (filePath) => ipcRenderer.invoke('workload-excel:test-file-path', filePath),
  workloadExcelInitializeWorkbook: (filePath) => ipcRenderer.invoke('workload-excel:initialize-workbook', filePath),
  workloadExcelGetHeaders: (filePath, sheetName) => ipcRenderer.invoke('workload-excel:get-headers', filePath, sheetName),
  workloadExcelBrowseFile: () => ipcRenderer.invoke('workload-excel:browse-file'),
  
  // Export operations
  workloadExcelExportProjects: (projects, filePath) => ipcRenderer.invoke('workload-excel:export-projects', projects, filePath),
  workloadExcelExportAssignments: (assignments, filePath) => ipcRenderer.invoke('workload-excel:export-assignments', assignments, filePath),
  workloadExcelExportUsers: (users, filePath) => ipcRenderer.invoke('workload-excel:export-users', users, filePath),
  workloadExcelExportAll: (data, filePath) => ipcRenderer.invoke('workload-excel:export-all', data, filePath),
  workloadExcelOptimizeFile: (filePath) => ipcRenderer.invoke('workload-excel:optimize-file', filePath),
  
  // Import operations
  workloadExcelImportProjects: (filePath) => ipcRenderer.invoke('workload-excel:import-projects', filePath),
  workloadExcelImportAssignments: (filePath) => ipcRenderer.invoke('workload-excel:import-assignments', filePath),
  workloadExcelImportUsers: (filePath) => ipcRenderer.invoke('workload-excel:import-users', filePath),
  workloadExcelImportAll: (filePath) => ipcRenderer.invoke('workload-excel:import-all', filePath),
  
  // Sync operations
  workloadExcelSyncSettingsGet: () => ipcRenderer.invoke('workload-excel:sync-settings-get'),
  workloadExcelSyncSettingsUpdate: (settings) => ipcRenderer.invoke('workload-excel:sync-settings-update', settings),
  workloadExcelSyncStartAuto: (filePath) => ipcRenderer.invoke('workload-excel:sync-start-auto', filePath),
  workloadExcelSyncStopAuto: () => ipcRenderer.invoke('workload-excel:sync-stop-auto'),
  workloadExcelSyncFromExcel: (filePath) => ipcRenderer.invoke('workload-excel:sync-from-excel', filePath),
  workloadExcelSyncToExcel: (data, filePath) => ipcRenderer.invoke('workload-excel:sync-to-excel', data, filePath),
  workloadExcelSyncBidirectional: (appData, filePath) => ipcRenderer.invoke('workload-excel:sync-bidirectional', appData, filePath),
  workloadExcelSyncStatus: () => ipcRenderer.invoke('workload-excel:sync-status'),
  
  // Event listeners for real-time updates
  onWorkloadFileChanged: (callback) => {
    ipcRenderer.on('workload:file-changed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workload:file-changed');
  },
  onWorkloadUsersFileChanged: (callback) => {
    ipcRenderer.on('workload:users-file-changed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workload:users-file-changed');
  },
  onWorkloadAssignmentsFileChanged: (callback) => {
    ipcRenderer.on('workload:assignments-file-changed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workload:assignments-file-changed');
  },
  
  // Workload Excel Sync Event Listeners
  onWorkloadExcelSyncStarted: (callback) => {
    ipcRenderer.on('workload-excel:sync-started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workload-excel:sync-started');
  },
  onWorkloadExcelSyncCompleted: (callback) => {
    ipcRenderer.on('workload-excel:sync-completed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workload-excel:sync-completed');
  },
  onWorkloadExcelAutoSyncStarted: (callback) => {
    ipcRenderer.on('workload-excel:auto-sync-started', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('workload-excel:auto-sync-started');
  },
  onWorkloadExcelAutoSyncStopped: (callback) => {
    ipcRenderer.on('workload-excel:auto-sync-stopped', (event) => callback());
    return () => ipcRenderer.removeAllListeners('workload-excel:auto-sync-stopped');
  },
  onWorkloadExcelSettingsUpdated: (callback) => {
    ipcRenderer.on('workload-excel:settings-updated', (event, settings) => callback(settings));
    return () => ipcRenderer.removeAllListeners('workload-excel:settings-updated');
  },
  
  
  // ===== DAS GENERAL APIs =====
  
  // DAS General data operations
  dasGeneralLoadAll: (filePath) => ipcRenderer.invoke('das-general:load-all', filePath),
  dasGeneralSaveAll: (data, filePath) => ipcRenderer.invoke('das-general:save-all', data, filePath),
  dasGeneralCheckAccess: (filePath) => ipcRenderer.invoke('das-general:check-access', filePath),
  dasGeneralCreateFile: (filePath) => ipcRenderer.invoke('das-general:create-file', filePath),
  
  // Team Members operations
  dasGeneralSaveTeamMembers: (teamMembers, filePath) => ipcRenderer.invoke('das-general:save-team-members', teamMembers, filePath),
  
  // Training Material operations
  dasGeneralSaveTrainingMaterial: (trainingMaterial, filePath) => ipcRenderer.invoke('das-general:save-training-material', trainingMaterial, filePath),
  
  // Products Info operations
  dasGeneralSaveProductsInfo: (productsInfo, filePath) => ipcRenderer.invoke('das-general:save-products-info', productsInfo, filePath),
  
  // Product management
  dasGeneralAddProduct: (productName, filePath) => ipcRenderer.invoke('das-general:add-product', productName, filePath),
  dasGeneralRemoveProduct: (productName, filePath) => ipcRenderer.invoke('das-general:remove-product', productName, filePath),
  
  // Settings operations
  dasGeneralGetSettings: () => ipcRenderer.invoke('das-general:get-settings'),
  dasGeneralUpdateSettings: (settings) => ipcRenderer.invoke('das-general:update-settings', settings),
  
  // File selection
  dasGeneralSelectFile: () => ipcRenderer.invoke('das-general:select-file'),
  
  // ===== BOM ANALYTICS APIs =====
  
  // BOM parsing and management
  bomParseFile: (filePath) => ipcRenderer.invoke('bom:parse-file', filePath),
  bomSaveToProject: (projectId, bomData) => ipcRenderer.invoke('bom:save-to-project', projectId, bomData),
  bomGetProjectData: (projectId) => ipcRenderer.invoke('bom:get-project-data', projectId),
  bomRemoveFromProject: (projectId) => ipcRenderer.invoke('bom:remove-from-project', projectId),
  
  // BOM analytics
  bomGetCoverage: () => ipcRenderer.invoke('bom:get-coverage'),
  bomGetCatalogStats: () => ipcRenderer.invoke('bom:get-catalog-stats'),
  bomGetTopCatalogNumbers: (limit) => ipcRenderer.invoke('bom:get-top-catalog-numbers', limit),
  bomGetCoOccurrence: (catalogNumber, limit) => ipcRenderer.invoke('bom:get-co-occurrence', catalogNumber, limit),
  bomFindProjectsByCatalog: (catalogNumber) => ipcRenderer.invoke('bom:find-projects-by-catalog', catalogNumber),
  bomGetDeprecatedProducts: (monthsThreshold) => ipcRenderer.invoke('bom:get-deprecated-products', monthsThreshold),
  bomGetStartupStats: () => ipcRenderer.invoke('bom:get-startup-stats'),
  bomRebuildCatalog: () => ipcRenderer.invoke('bom:rebuild-catalog'),
  
  // BOM bulk import
  bomBulkPreview: (rootFolder, options) => ipcRenderer.invoke('bom:bulk-preview', rootFolder, options),
  bomBulkImport: (rootFolder, options) => ipcRenderer.invoke('bom:bulk-import', rootFolder, options),
  bomBulkImportMatched: (bomLocations, options) => ipcRenderer.invoke('bom:bulk-import-matched', bomLocations, options),
  bomSelectBulkImportFolder: () => ipcRenderer.invoke('bom:select-bulk-import-folder'),
  bomSelectFile: () => ipcRenderer.invoke('bom:select-file'),
  
  // BOM auto-import (for Download Folder integration)
  bomCheckProjectFolder: (projectFolderPath) => ipcRenderer.invoke('bom:check-project-folder', projectFolderPath),
  bomAutoImportFromFolder: (projectFolderPath, projectId) => ipcRenderer.invoke('bom:auto-import-from-folder', projectFolderPath, projectId),
  
  // Smart BOM upload (auto-detects from DAS path, falls back to manual)
  bomSmartUpload: (project) => ipcRenderer.invoke('bom:smart-upload', project),
  bomOpenFolder: (folderPath) => ipcRenderer.invoke('bom:open-folder', folderPath),
  
  // BOM event listeners
  onBomBulkImportProgress: (callback) => {
    ipcRenderer.on('bom:bulk-import-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('bom:bulk-import-progress');
  },
  onBomBulkImportComplete: (callback) => {
    ipcRenderer.on('bom:bulk-import-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('bom:bulk-import-complete');
  },
  onBomAutoImportComplete: (callback) => {
    ipcRenderer.on('bom:auto-import-complete', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('bom:auto-import-complete');
  }
});

// SECURITY: Prevent access to Node.js APIs
window.process = undefined;
window.require = undefined;
window.module = undefined;
window.global = undefined;
