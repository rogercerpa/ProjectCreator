import React, { useState, useEffect } from 'react';
import ProjectDetails from './ProjectDetails';
import ProjectEditor from './ProjectEditor';

// Import services (will be available through electronAPI in production)
// const ZipService = require('../services/ZipService');
// const SharePointUploadService = require('../services/SharePointUploadService');

/**
 * ProjectManagement - Main project management interface
 * Handles viewing, editing, and managing individual projects after creation
 * This will replace ProjectForm.jsx as the primary project interface
 */
const ProjectManagement = ({ 
  project, 
  onProjectUpdated, 
  onProjectDelete,
  onBack,
  mode = 'view' // 'view' or 'edit'
}) => {
  const [currentMode, setCurrentMode] = useState(mode);
  const [projectData, setProjectData] = useState(project || {});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // App settings state
  const [appSettings, setAppSettings] = useState(null);
  
  // SharePoint upload state
  const [uploadStatus, setUploadStatus] = useState({
    isUploading: false,
    isUploaded: projectData.sharePointStatus?.isUploaded || false,
    lastUploadDate: projectData.sharePointStatus?.lastUploadDate || null,
    sharePointUrl: projectData.sharePointStatus?.sharePointUrl || null,
    progress: 0,
    phase: null,
    error: null,
    syncStatus: null // Track OneDrive sync status: 'pending', 'syncing', 'synced', 'timeout', 'error'
  });

  // Update project data when prop changes
  useEffect(() => {
    if (project) {
      console.log('🔄 ProjectManagement: project prop changed, updating projectData');
      console.log('🔄 ProjectManagement: New project ECD:', project.ecd);
      setProjectData(project);
      setHasUnsavedChanges(false);
      // Update upload status from project data
      if (project.sharePointStatus) {
        setUploadStatus(prev => ({
          ...prev,
          isUploaded: project.sharePointStatus.isUploaded || false,
          lastUploadDate: project.sharePointStatus.lastUploadDate || null,
          sharePointUrl: project.sharePointStatus.sharePointUrl || null
        }));
      }
    }
  }, [project]);

  // Load app settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.electronAPI && window.electronAPI.settingsLoad) {
          const settingsResult = await window.electronAPI.settingsLoad();
          if (settingsResult.success) {
            setAppSettings(settingsResult.data || {});
          }
        }
      } catch (error) {
        console.error('Failed to load app settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Listen for OneDrive sync upload progress (production)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onOneDriveSyncProgress) {
      const handleProgress = (progressData) => {
        setUploadStatus(prev => ({
          ...prev,
          progress: progressData.progress || 0,
          phase: progressData.phase || prev.phase,
          message: progressData.message || '',
          syncStatus: progressData.syncStatus || prev.syncStatus
        }));
      };

      window.electronAPI.onOneDriveSyncProgress(handleProgress);

      // Cleanup listener on unmount
      return () => {
        if (window.electronAPI.removeOneDriveSyncProgressListener) {
          window.electronAPI.removeOneDriveSyncProgressListener(handleProgress);
        }
      };
    }
  }, []);

  // Handle project data changes in edit mode
  const handleProjectDataChange = (newData) => {
    setProjectData(newData);
    setHasUnsavedChanges(true);
  };

  // Save project changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedProject = {
        ...projectData,
        updatedAt: new Date().toISOString()
      };
      
      console.log('💾 ProjectManagement: Saving project with ECD:', updatedProject.ecd);
      
      // Save directly to backend first to get the authoritative saved version
      const saveResult = await window.electronAPI.projectSave(updatedProject);
      
      if (saveResult.success) {
        const savedProject = saveResult.project;
        console.log('✅ ProjectManagement: Project saved successfully, ECD:', savedProject.ecd);
        
        // Update local state with saved data from backend (authoritative source)
        setProjectData(savedProject);
        
        // Also call the parent's update handler to sync parent state
        // Pass alreadySaved=true to prevent double-saving
        if (onProjectUpdated) {
          await onProjectUpdated(savedProject, true);
        }
        
        setHasUnsavedChanges(false);
        setCurrentMode('view');
        setNotification({
          type: 'success',
          message: 'Project updated successfully!'
        });
        
        // Clear notification after 3 seconds
        setTimeout(() => setNotification(null), 3000);
      } else {
        throw new Error(saveResult.error || 'Failed to save project');
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      setNotification({
        type: 'error',
        message: `Failed to save project: ${error.message}`
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing and revert changes
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmCancel) return;
    }
    
    setProjectData(project);
    setHasUnsavedChanges(false);
    setCurrentMode('view');
  };

  // Switch to edit mode
  const handleEdit = () => {
    setCurrentMode('edit');
  };

  // Handle SharePoint upload
  const handleUploadToSharePoint = async () => {
    try {
      console.log('Starting OneDrive sync upload for project:', projectData.projectName);

      // Reset upload status
      setUploadStatus({
        isUploading: true,
        isUploaded: false,
        progress: 0,
        phase: 'initializing',
        error: null,
        lastUploadDate: null,
        sharePointUrl: null
      });

      // Check if OneDrive sync is configured
      if (!appSettings?.oneDriveSyncSettings?.enabled) {
        throw new Error('OneDrive sync is not enabled. Please go to Settings and configure OneDrive sync integration.');
      }

      if (!appSettings?.oneDriveSyncSettings?.syncFolderPath) {
        throw new Error('OneDrive sync folder is not configured. Please go to Settings and select your SharePoint sync folder.');
      }

      // Check if project has a folder path
      if (!projectData.projectPath && !projectData.projectFolder) {
        throw new Error('Project folder path not found. Please ensure the project was created with folder structure.');
      }

      const projectPath = projectData.projectPath || projectData.projectFolder;

      // Progress callback function
      const progressCallback = (progressData) => {
        setUploadStatus(prev => ({
          ...prev,
          progress: progressData.progress || 0,
          phase: progressData.phase || prev.phase,
          message: progressData.message || ''
        }));
      };

      // Use electronAPI for production, mock for development
      if (window.electronAPI && window.electronAPI.oneDriveSyncUpload) {
        // Production: Call electron main process for OneDrive sync upload
        const result = await window.electronAPI.oneDriveSyncUpload({
          projectPath,
          projectData,
          settings: {
            enabled: appSettings.oneDriveSyncSettings.enabled,
            syncFolderPath: appSettings.oneDriveSyncSettings.syncFolderPath,
            cleanupStrategy: appSettings.oneDriveSyncSettings.cleanupStrategy || 'auto-delete'
          }
        });

        if (result.success) {
          const uploadData = {
            isUploading: false,
            isUploaded: true,
            lastUploadDate: new Date().toISOString(),
            sharePointUrl: result.sharePointUrl,
            progress: 100,
            phase: 'complete'
          };

          setUploadStatus(prev => ({ ...prev, ...uploadData }));

          // Save upload status to project data
          const updatedProjectData = {
            ...projectData,
            sharePointStatus: uploadData,
            updatedAt: new Date().toISOString()
          };

          setProjectData(updatedProjectData);

          // Call parent update handler to persist the upload status
          if (onProjectUpdated) {
            await onProjectUpdated(updatedProjectData);
          }

          // Show success notification
          setNotification({
            type: 'success',
            message: 'Project uploaded to SharePoint successfully!'
          });
          setTimeout(() => setNotification(null), 5000);

        } else {
          throw new Error(result.error || 'OneDrive sync upload failed');
        }

      } else {
        // Development mode: Simulate browser automation upload
        console.log('Development mode: Simulating browser automation upload');
        
        // Simulate zip creation
        progressCallback({ phase: 'zipping', progress: 10, message: 'Creating zip archive...' });
        await new Promise(resolve => setTimeout(resolve, 1000));

        progressCallback({ phase: 'zipping', progress: 30, message: 'Compressing project files...' });
        await new Promise(resolve => setTimeout(resolve, 800));

        // Simulate browser launch
        progressCallback({ phase: 'browser', progress: 50, message: 'Launching browser...' });
        await new Promise(resolve => setTimeout(resolve, 1200));

        progressCallback({ phase: 'browser', progress: 60, message: 'Navigating to SharePoint...' });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate upload process
        progressCallback({ phase: 'uploading', progress: 75, message: 'Uploading file to SharePoint...' });
        await new Promise(resolve => setTimeout(resolve, 1500));

        progressCallback({ phase: 'uploading', progress: 95, message: 'Finalizing upload...' });
        await new Promise(resolve => setTimeout(resolve, 800));

        // Simulate success
        const simulatedFileName = `${projectData.projectName || 'Project'}_${projectData.rfaNumber || 'RFA'}_${new Date().toISOString().split('T')[0]}.zip`;
        
        const uploadData = {
          isUploading: false,
          isUploaded: true,
          lastUploadDate: new Date().toISOString(),
          sharePointUrl: `https://acuitybrandsinc.sharepoint.com/sites/CIDesignSolutions/Shared%20Documents/LnT/${simulatedFileName}`,
          progress: 100,
          phase: 'complete'
        };

        setUploadStatus(prev => ({ ...prev, ...uploadData }));

        // Save upload status to project data
        const updatedProjectData = {
          ...projectData,
          sharePointStatus: uploadData,
          updatedAt: new Date().toISOString()
        };

        setProjectData(updatedProjectData);

        // Call parent update handler to persist the upload status
        if (onProjectUpdated) {
          await onProjectUpdated(updatedProjectData);
        }

        setNotification({
          type: 'success',
          message: 'Browser automation upload simulated successfully! (Real upload available in production)'
        });
        setTimeout(() => setNotification(null), 5000);
      }

    } catch (error) {
      console.error('SharePoint upload failed:', error);
      
      setUploadStatus(prev => ({
        ...prev,
        isUploading: false,
        error: error.message,
        phase: 'error'
      }));

      setNotification({
        type: 'error',
        message: `Upload failed: ${error.message}`
      });
      setTimeout(() => setNotification(null), 8000);
    }
  };

  console.log('🎯 ProjectManagement: Component rendered');
  console.log('🎯 ProjectManagement: Received project:', project);
  console.log('🎯 ProjectManagement: Project type:', typeof project);
  console.log('🎯 ProjectManagement: Project keys:', project ? Object.keys(project) : 'no project');
  
  if (!project) {
    console.error('❌ ProjectManagement: No project provided!');
    console.error('❌ ProjectManagement: onBack function:', typeof onBack);
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center max-w-md">
          <h2 className="text-3xl font-bold text-error-600 dark:text-error-400 mb-4">
            ⚠️ Project Not Found
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-2">
            The requested project could not be loaded.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            Debug: project = {JSON.stringify(project)}
          </p>
          <button onClick={onBack} className="btn-primary">
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }
  
  console.log('✅ ProjectManagement: Project validation passed, rendering main content');

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Responsive Header - Sticky */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4">
          {/* Project Title and Meta */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 
                className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate mb-2"
                title={projectData.projectName || 'Untitled Project'}
              >
                {projectData.projectName || 'Untitled Project'}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full font-medium">
                  RFA: {projectData.rfaNumber || 'N/A'}
                </span>
                <span className="px-3 py-1 bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300 rounded-full font-medium">
                  {projectData.status || 'Active'}
                </span>
                {projectData.totalTriage && (
                  <span className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full font-medium">
                    Triage: {projectData.totalTriage}h
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions Area */}
            <div className="flex flex-col gap-3">
              {notification && (
                <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  notification.type === 'success' ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300' :
                  notification.type === 'error' ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300' :
                  'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300'
                }`}>
                  {notification.message}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
              {currentMode === 'edit' && (
                <>
                  <button 
                    onClick={handleCancelEdit} 
                    className="btn-secondary"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    className="btn-primary"
                    disabled={isSaving || !hasUnsavedChanges}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
              
              {/* Edit Button - Always visible in view mode */}
              {currentMode === 'view' && (
                <button 
                  onClick={handleEdit} 
                  className="btn btn-outline btn-small"
                  title="Edit project"
                >
                  ✏️ Edit
                </button>
              )}
              
              {/* Delete Button - Visible in view mode */}
              {currentMode === 'view' && onProjectDelete && (
                <button 
                  onClick={() => onProjectDelete(projectData.id, projectData.projectName)}
                  className="btn btn-outline btn-small text-error-600 hover:text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:text-error-300 dark:hover:bg-error-900/20 border-error-300 dark:border-error-700"
                  title="Delete project"
                >
                  🗑️ Delete
                </button>
              )}
              
              {/* OneDrive Sync Upload Button */}
              {currentMode === 'view' && (
                <button
                  onClick={handleUploadToSharePoint}
                  className={`px-4 py-2 text-sm font-medium rounded shadow transition-all ${
                    uploadStatus.isUploaded 
                      ? 'bg-success-600 hover:bg-success-700 text-white cursor-default' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  disabled={uploadStatus.isUploading || uploadStatus.isUploaded || !appSettings?.oneDriveSyncSettings?.enabled || !appSettings?.oneDriveSyncSettings?.syncFolderPath}
                  title={
                    uploadStatus.isUploaded
                      ? `Uploaded on ${new Date(uploadStatus.lastUploadDate).toLocaleString()}`
                      : !appSettings?.oneDriveSyncSettings?.enabled
                        ? 'OneDrive sync not enabled - configure in Settings'
                        : !appSettings?.oneDriveSyncSettings?.syncFolderPath
                          ? 'OneDrive sync folder not configured - set up in Settings'
                          : 'Upload project to SharePoint via OneDrive sync'
                  }
                >
                  {uploadStatus.isUploading ? (
                    <>
                      <span className="mr-2 animate-pulse">⏳</span>
                      {uploadStatus.phase === 'zipping' ? 'Zipping...' : 'Uploading...'}
                    </>
                  ) : uploadStatus.isUploaded ? (
                    <>
                      <span className="mr-2">✅</span>
                      Uploaded
                    </>
                  ) : (
                    <>
                      <span className="mr-2">📤</span>
                      Upload to SharePoint
                    </>
                  )}
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="bg-warning-50 dark:bg-warning-900/20 border-b border-warning-200 dark:border-warning-700 px-6 py-3">
          <span className="text-warning-800 dark:text-warning-200 font-medium text-sm">
            ⚠️ You have unsaved changes
          </span>
        </div>
      )}

      {/* OneDrive Sync Upload Progress Modal */}
      {uploadStatus.isUploading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
            {/* Header with gradient */}
            <div className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-blue-700 dark:from-primary-800 dark:via-primary-900 dark:to-blue-900 px-6 py-8">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/10 to-transparent opacity-20" />
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                  <span className="text-3xl">☁️</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Uploading to SharePoint
                  </h3>
                  <p className="text-sm text-white/80">
                    via OneDrive Sync
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Progress Bar Section */}
              <div>
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {uploadStatus.progress}%
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                    {uploadStatus.message}
                  </span>
                </div>
                <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-primary-500 via-primary-600 to-blue-600 transition-all duration-500 ease-out rounded-full" 
                    style={{ width: `${uploadStatus.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="space-y-3">
                {uploadStatus.phase === 'zipping' && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-xl">📦</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        Compressing Files
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Creating archive for upload...
                      </p>
                    </div>
                  </div>
                )}
                
                {uploadStatus.phase === 'syncing' && (
                  <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary-500 dark:bg-primary-600 rounded-lg flex items-center justify-center animate-pulse">
                      <span className="text-xl">🔄</span>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {uploadStatus.message}
                      </p>
                      {uploadStatus.syncStatus && (
                        <div className="mt-2">
                          {uploadStatus.syncStatus === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium">
                              <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                              Waiting for sync...
                            </span>
                          )}
                          {uploadStatus.syncStatus === 'syncing' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300 rounded-lg text-xs font-medium">
                              <span className="w-2 h-2 bg-info-500 rounded-full animate-pulse" />
                              Syncing to SharePoint...
                            </span>
                          )}
                          {uploadStatus.syncStatus === 'synced' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-lg text-xs font-medium">
                              <span className="w-2 h-2 bg-success-500 rounded-full" />
                              Synced to cloud!
                            </span>
                          )}
                          {uploadStatus.syncStatus === 'timeout' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 rounded-lg text-xs font-medium">
                              <span className="w-2 h-2 bg-warning-500 rounded-full" />
                              Sync monitoring timeout
                            </span>
                          )}
                          {uploadStatus.syncStatus === 'error' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300 rounded-lg text-xs font-medium">
                              <span className="w-2 h-2 bg-error-500 rounded-full" />
                              Sync error
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {uploadStatus.phase === 'complete' && (
                  <>
                    <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-success-50 to-green-50 dark:from-success-900/20 dark:to-green-900/20 rounded-xl border-2 border-success-500 dark:border-success-700">
                      <div className="flex-shrink-0 w-10 h-10 bg-success-500 dark:bg-success-600 rounded-lg flex items-center justify-center">
                        <span className="text-xl">✅</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="font-semibold text-success-800 dark:text-success-200 text-sm">
                          {uploadStatus.message}
                        </p>
                        <p className="text-xs text-success-600 dark:text-success-400 mt-0.5">
                          Your project is now available on SharePoint
                        </p>
                      </div>
                    </div>
                    {uploadStatus.syncStatus && uploadStatus.syncStatus !== 'synced' && (
                      <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl border border-warning-200 dark:border-warning-700">
                        <div className="flex-shrink-0 w-8 h-8 bg-warning-500 dark:bg-warning-600 rounded-lg flex items-center justify-center">
                          <span className="text-lg">⚠️</span>
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className="text-xs text-warning-800 dark:text-warning-200 leading-relaxed">
                            File uploaded to OneDrive folder but cloud sync may still be in progress
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {currentMode === 'view' ? (
          <ProjectDetails 
            key={`view-${projectData.id}-${projectData.updatedAt}`}
            project={projectData}
            onEdit={handleEdit}
            onProjectUpdate={async (updatedData) => {
              console.log('🔄 ProjectManagement: onProjectUpdate called from ProjectDetails');
              console.log('🔄 ProjectManagement: Updated ECD:', updatedData.ecd);
              
              // Save to backend first
              const saveResult = await window.electronAPI.projectSave(updatedData);
              
              if (saveResult.success) {
                const savedData = saveResult.project;
                console.log('✅ ProjectManagement: Triage update saved, ECD:', savedData.ecd);
                
                // Update local state
                setProjectData(savedData);
                
                // Call parent's update handler with already-saved flag
                if (onProjectUpdated) {
                  await onProjectUpdated(savedData, true);
                }
              }
            }}
          />
        ) : (
          <ProjectEditor
            key={`edit-${projectData.id}`}
            project={projectData}
            onProjectDataChange={handleProjectDataChange}
            onSave={handleSave}
            onCancel={handleCancelEdit}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;
