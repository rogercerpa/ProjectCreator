import React, { useState, useEffect } from 'react';
import ProjectDetails from './ProjectDetails';
import ProjectEditor from './ProjectEditor';
import { useUploadContext, UPLOAD_TYPES } from '../contexts/UploadContext';

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
  
  // Upload context for background uploads
  const { startUpload, completeUpload, failUpload, isProjectUploading, getProjectUploadStatus } = useUploadContext();
  
  // SharePoint upload state - using hybrid approach (context for active, local for persisted status)
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
  
  // Check if this project is currently uploading via context
  const isCurrentlyUploading = isProjectUploading(projectData.id);

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

  // OneDrive sync upload progress is now handled by UploadContext globally

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

  // Handle SharePoint upload - now uses global UploadContext for background uploads
  const handleUploadToSharePoint = async () => {
    try {
      console.log('Starting OneDrive sync upload for project:', projectData.projectName);

      // Check if OneDrive sync is configured BEFORE starting upload
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

      // Start upload in background via context
      startUpload(projectData.id, projectData.projectName, UPLOAD_TYPES.SHAREPOINT, {
        projectPath,
        settings: appSettings.oneDriveSyncSettings
      });

      // Reset local upload status for UI
      setUploadStatus(prev => ({
        ...prev,
        isUploading: true,
        progress: 0,
        phase: 'initializing',
        error: null
      }));

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
          completeUpload({ success: true, sharePointUrl: result.sharePointUrl });

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
        
        // Simulate upload process with shorter delays
        await new Promise(resolve => setTimeout(resolve, 2000));

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
        completeUpload({ success: true, sharePointUrl: uploadData.sharePointUrl });

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
      
      failUpload(error.message);

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
              
              {/* Delete Button - Visible in view mode, disabled during upload */}
              {currentMode === 'view' && onProjectDelete && (
                <button 
                  onClick={() => onProjectDelete(projectData.id, projectData.projectName)}
                  className={`btn btn-outline btn-small text-error-600 hover:text-error-700 hover:bg-error-50 dark:text-error-400 dark:hover:text-error-300 dark:hover:bg-error-900/20 border-error-300 dark:border-error-700 ${isCurrentlyUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isCurrentlyUploading ? 'Cannot delete while uploading' : 'Delete project'}
                  disabled={isCurrentlyUploading}
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
                      ? 'btn-outline-success opacity-75 cursor-not-allowed' 
                      : isCurrentlyUploading
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  disabled={isCurrentlyUploading || uploadStatus.isUploading || uploadStatus.isUploaded || !appSettings?.oneDriveSyncSettings?.enabled || !appSettings?.oneDriveSyncSettings?.syncFolderPath}
                  title={
                    isCurrentlyUploading
                      ? 'Upload in progress - check status bar'
                      : uploadStatus.isUploaded
                        ? `Uploaded on ${new Date(uploadStatus.lastUploadDate).toLocaleString()}`
                        : !appSettings?.oneDriveSyncSettings?.enabled
                          ? 'OneDrive sync not enabled - configure in Settings'
                          : !appSettings?.oneDriveSyncSettings?.syncFolderPath
                            ? 'OneDrive sync folder not configured - set up in Settings'
                            : 'Upload project to SharePoint via OneDrive sync'
                  }
                >
                  {isCurrentlyUploading || uploadStatus.isUploading ? (
                    <>
                      <span className="mr-2 animate-pulse">⏳</span>
                      Uploading...
                    </>
                  ) : uploadStatus.isUploaded ? (
                    <>
                      <span className="mr-2">✅</span>
                      Uploaded to Cloud
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

      {/* OneDrive Sync Upload Progress is now shown in the header status bar via UploadContext */}

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
