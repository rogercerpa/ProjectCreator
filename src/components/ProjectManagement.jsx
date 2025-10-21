import React, { useState, useEffect } from 'react';
import ProjectDetails from './ProjectDetails';
import ProjectEditor from './ProjectEditor';
import './ProjectManagement.css';

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
      // Call the parent's update handler
      if (onProjectUpdated) {
        await onProjectUpdated({
          ...projectData,
          updatedAt: new Date().toISOString()
        });
      }
      
      setHasUnsavedChanges(false);
      setCurrentMode('view');
      setNotification({
        type: 'success',
        message: 'Project updated successfully!'
      });
      
      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Failed to save project:', error);
      setNotification({
        type: 'error',
        message: 'Failed to save project. Please try again.'
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
      <div className="project-management">
        <div className="error-state">
          <h2>⚠️ Project Not Found</h2>
          <p>The requested project could not be loaded.</p>
          <p><small>Debug: project = {JSON.stringify(project)}</small></p>
          <button onClick={onBack} className="btn btn-primary">
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }
  
  console.log('✅ ProjectManagement: Project validation passed, rendering main content');

  return (
    <div className="project-management">
      {/* Responsive Header */}
      <div className="project-management-header">
        <div className="header-container">
          {/* Project Title and Meta */}
          <div className="header-title">
            <div className="project-title">
              <h1 title={projectData.projectName || 'Untitled Project'}>
                {projectData.projectName || 'Untitled Project'}
              </h1>
              <div className="project-meta">
                <span className="project-rfa">RFA: {projectData.rfaNumber || 'N/A'}</span>
                <span className="project-status">{projectData.status || 'Active'}</span>
                {projectData.totalTriage && (
                  <span className="project-triage">Triage: {projectData.totalTriage}h</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions Area */}
          <div className="header-actions">
            {notification && (
              <div className={`notification ${notification.type}`}>
                {notification.message}
              </div>
            )}
            
            <div className="action-buttons">
              {currentMode === 'edit' && (
                <div className="edit-actions">
                  <button 
                    onClick={handleCancelEdit} 
                    className="btn btn-secondary"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave} 
                    className="btn btn-primary"
                    disabled={isSaving || !hasUnsavedChanges}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
              
              {/* OneDrive Sync Upload Button */}
              {currentMode === 'view' && (
                <button
                  onClick={handleUploadToSharePoint}
                  className={`btn btn-sharepoint ${uploadStatus.isUploaded ? 'btn-uploaded' : ''}`}
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
                      <span className="upload-spinner">⏳</span>
                      {uploadStatus.phase === 'zipping' ? 'Zipping...' : 'Uploading...'}
                    </>
                  ) : uploadStatus.isUploaded ? (
                    <>
                      <span className="upload-success">✅</span>
                      Uploaded
                    </>
                  ) : (
                    <>
                      <span className="upload-icon">📤</span>
                      Upload to SharePoint
                    </>
                  )}
                </button>
              )}
            </div>
            
            {/* Overflow Menu for Additional Buttons (if needed) */}
            <div className="action-overflow">
              <button className="overflow-toggle" title="More actions">
                ⋮
              </button>
              <div className="overflow-menu" style={{ display: 'none' }}>
                {/* Additional buttons will go here when needed */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="unsaved-changes-banner">
          <span>⚠️ You have unsaved changes</span>
        </div>
      )}

      {/* OneDrive Sync Upload Progress Modal */}
      {uploadStatus.isUploading && (
        <div className="upload-progress-modal">
          <div className="upload-progress-content">
            <h3>Uploading to SharePoint via OneDrive Sync</h3>
            <div className="progress-info">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadStatus.progress}%` }}
                />
              </div>
              <div className="progress-text">
                <span className="progress-percentage">{uploadStatus.progress}%</span>
                <span className="progress-message">{uploadStatus.message}</span>
              </div>
            </div>
            <div className="progress-phase">
              {uploadStatus.phase === 'zipping' && (
                <span>📦 Compressing project files...</span>
              )}
              {uploadStatus.phase === 'syncing' && (
                <>
                  <span>🔄 {uploadStatus.message}</span>
                  {uploadStatus.syncStatus && (
                    <div className="sync-status">
                      {uploadStatus.syncStatus === 'pending' && <span className="status-badge status-pending">⏳ Waiting for sync...</span>}
                      {uploadStatus.syncStatus === 'syncing' && <span className="status-badge status-syncing">📤 Syncing to SharePoint...</span>}
                      {uploadStatus.syncStatus === 'synced' && <span className="status-badge status-synced">✅ Synced to cloud!</span>}
                      {uploadStatus.syncStatus === 'timeout' && <span className="status-badge status-timeout">⚠️ Sync monitoring timeout</span>}
                      {uploadStatus.syncStatus === 'error' && <span className="status-badge status-error">❌ Sync error</span>}
                    </div>
                  )}
                </>
              )}
              {uploadStatus.phase === 'complete' && (
                <>
                  <span>✅ {uploadStatus.message}</span>
                  {uploadStatus.syncStatus && uploadStatus.syncStatus !== 'synced' && (
                    <div className="sync-warning">
                      <span>⚠️ File uploaded to OneDrive folder but cloud sync may still be in progress</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="project-management-content">
        {currentMode === 'view' ? (
          <ProjectDetails 
            project={projectData}
            onEdit={handleEdit}
            onProjectUpdate={async (updatedData) => {
              // Update local state
              setProjectData(updatedData);
              // Call parent's update handler to persist changes
              if (onProjectUpdated) {
                await onProjectUpdated(updatedData);
              }
            }}
          />
        ) : (
          <ProjectEditor
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
