// IPC handlers — Projects: create/load/save, shared calendar, Ready for QC, DAS upload/search, revisions, form settings.
// Registered from main.js; shared services arrive through the context object.
const { ipcMain, dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = function registerProjectsIpc(context) {
  const {
    projectService,
    projectPersistenceService,
    sharedCalendarService,
    readyForQCService,
    errorLogService,
    dasUploadService,
    activeUploads,
    getMainWindow,
    bomPersistenceService,
    dasSearchService,
    wordService,
    projectCreationService,
    duplicateProjectDetectionService,
    formSettingsService
  } = context;
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

  // Shared calendar JSON handlers (multi-user calendar overlay)
  ipcMain.handle('shared-calendar:load', async () => {
    try {
      return await sharedCalendarService.loadCalendar();
    } catch (error) {
      return { success: false, error: error.message, entries: {} };
    }
  });

  ipcMain.handle('shared-calendar:upsert', async (event, project, actor) => {
    try {
      return await sharedCalendarService.upsertProjectEntry(project, actor);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('shared-calendar:set-directory', async (event, directoryPath) => {
    try {
      return await sharedCalendarService.setDataDirectory(directoryPath);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Status tracking handlers
  ipcMain.handle('project-backfill-status', async (event, projectId, statusDates) => {
    try {
      return await projectPersistenceService.backfillProjectStatusHistory(projectId, statusDates);
    } catch (error) {
      console.error('Error backfilling status history:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('project-get-analytics', async (event, project) => {
    try {
      const analytics = projectPersistenceService.getProjectAnalytics(project);
      return { success: true, analytics };
    } catch (error) {
      console.error('Error getting project analytics:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('project-needs-backfill', async (event, project) => {
    try {
      const needsBackfill = projectPersistenceService.needsStatusHistoryBackfill(project);
      return { success: true, needsBackfill };
    } catch (error) {
      console.error('Error checking backfill status:', error);
      return { success: false, error: error.message };
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
      if (!result?.success) {
        await errorLogService.logError({
          category: 'das-download',
          userMessage: `Failed to download folder: ${result?.error || 'Unknown error'}`,
          technicalMessage: result?.error,
          context: { projectId: project?.id, projectName: project?.projectName, zipFilePath }
        });
      }
      return result;
    } catch (error) {
      console.error('Error downloading and extracting zip:', error);
      await errorLogService.logError({
        category: 'das-download',
        userMessage: `Failed to download folder: ${error.message}`,
        technicalMessage: error.message,
        stack: error.stack,
        context: { projectId: project?.id, projectName: project?.projectName, zipFilePath }
      });
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
    const uploadId = `das-${project.id}-${Date.now()}`;

    try {
      // Track active upload
      activeUploads.add(uploadId);

      // Create a progress callback that sends updates to the renderer
      const progressCallback = (progress) => {
        if (getMainWindow() && !getMainWindow().isDestroyed()) {
          getMainWindow().webContents.send('das-upload-progress', progress);
        }
      };

      const result = await dasUploadService.uploadProject(project, confirmed, progressCallback);

      // If upload was successful, update the project with upload status and set RFA Status to Completed
      if (result.success && !result.needsConfirmation) {
        const updatedProject = {
          ...project,
          rfaStatus: 'Completed', // Auto-set to Completed after successful upload
          dasUploadStatus: {
            uploadedAt: new Date().toISOString(),
            uploadedPath: result.uploadedPath,
            isRevision: result.isRevision || false
          }
        };

        // Save the updated project (status first)
        await projectPersistenceService.saveProject(updatedProject);

        // If the upload step auto-imported a BOM (project had none), persist it now.
        // saveBOMToProject reloads the project from disk, so this must run after the
        // status save to avoid clobbering the Completed status / dasUploadStatus.
        let finalProject = updatedProject;
        let bomImported = false;
        let bomStats = null;
        if (result.pendingBom) {
          try {
            const bomSaveResult = await bomPersistenceService.saveBOMToProject(project.id, result.pendingBom);
            if (bomSaveResult.success) {
              bomImported = true;
              bomStats = bomSaveResult.stats || null;
              if (bomSaveResult.project) {
                finalProject = bomSaveResult.project;
              }
              // Notify renderer so BOM analytics refresh in real time
              if (getMainWindow() && !getMainWindow().isDestroyed()) {
                getMainWindow().webContents.send('bom:auto-import-complete', {
                  projectId: project.id,
                  totalDevices: result.pendingBom.totalDevices,
                  startupCost: result.pendingBom.startupCosts?.total || 0
                });
              }
            } else {
              console.warn(`[DasUpload] Failed to persist auto-imported BOM: ${bomSaveResult.error}`);
            }
          } catch (bomError) {
            console.warn(`[DasUpload] Error persisting auto-imported BOM (non-fatal): ${bomError.message}`);
          }
        }

        // Remove from active uploads
        activeUploads.delete(uploadId);

        return {
          ...result,
          updatedProject: finalProject,
          bomImported,
          bomStats
        };
      }

      // Remove from active uploads (for confirmation dialogs or non-upload results)
      activeUploads.delete(uploadId);

      if (!result.success && !result.needsConfirmation) {
        await errorLogService.logError({
          category: 'das-upload',
          userMessage: `Upload to DAS Drive failed: ${result.error || 'Unknown error'}`,
          technicalMessage: result.error,
          context: { projectId: project?.id, projectName: project?.projectName }
        });
      }

      return result;
    } catch (error) {
      // Remove from active uploads on error
      activeUploads.delete(uploadId);
      console.error('Error uploading project to DAS:', error);
      await errorLogService.logError({
        category: 'das-upload',
        userMessage: `Upload to DAS Drive failed: ${error.message}`,
        technicalMessage: error.message,
        stack: error.stack,
        context: { projectId: project?.id, projectName: project?.projectName }
      });
      return { success: false, error: error.message };
    }
  });

  // Open DAS Drive folder in File Explorer
  ipcMain.handle('das-open-folder', async (event, project) => {
    try {
      const targetPath = dasUploadService.buildDasTargetPath(project);
      const { shell } = require('electron');
      const result = await shell.openPath(targetPath);

      // shell.openPath returns empty string on success, error message on failure
      if (result === '') {
        return { success: true, path: targetPath };
      } else {
        return { success: false, error: result || 'Failed to open folder' };
      }
    } catch (error) {
      console.error('Error opening DAS folder:', error);
      return { success: false, error: error.message };
    }
  });

  // DAS Drive Search handlers
  ipcMain.handle('das-search', async (event, query, options) => {
    try {
      return await dasSearchService.search(query, options);
    } catch (error) {
      console.error('Error searching DAS Drive:', error);
      return { success: false, error: error.message, results: [] };
    }
  });

  ipcMain.handle('das-search-status', async () => {
    try {
      return await dasSearchService.checkDriveStatus();
    } catch (error) {
      console.error('Error checking DAS Drive status:', error);
      return { accessible: false, error: error.message };
    }
  });

  ipcMain.handle('das-search-open-path', async (event, folderPath) => {
    try {
      const { shell } = require('electron');
      const result = await shell.openPath(folderPath);
      if (result === '') {
        return { success: true, path: folderPath };
      } else {
        return { success: false, error: result || 'Failed to open folder' };
      }
    } catch (error) {
      console.error('Error opening folder:', error);
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
      const revisionFileCopyService = new (require('../services/RevisionFileCopyService'))();
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
          if (!(await fs.pathExists(explorerPath))) {
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
      const result = await dialog.showOpenDialog(getMainWindow(), {
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
};
