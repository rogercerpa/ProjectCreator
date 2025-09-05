import React, { useState, useEffect } from 'react';
import ProjectDetails from './ProjectDetails';
import ProjectEditor from './ProjectEditor';
import './ProjectManagement.css';

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

  // Update project data when prop changes
  useEffect(() => {
    if (project) {
      setProjectData(project);
      setHasUnsavedChanges(false);
    }
  }, [project]);

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

  console.log('ProjectManagement received project:', project);
  
  if (!project) {
    console.error('ProjectManagement: No project provided!');
    return (
      <div className="project-management">
        <div className="error-state">
          <h2>⚠️ Project Not Found</h2>
          <p>The requested project could not be loaded.</p>
          <button onClick={onBack} className="btn btn-primary">
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-management">
      {/* Header */}
      <div className="project-management-header">
        <div className="header-left">
          <button onClick={onBack} className="btn btn-secondary btn-back">
            ← Back to Projects
          </button>
          <div className="project-title">
            <h1>{projectData.projectName || 'Untitled Project'}</h1>
            <div className="project-meta">
              <span className="project-rfa">RFA: {projectData.rfaNumber || 'N/A'}</span>
              <span className="project-status">{projectData.status || 'Active'}</span>
              {projectData.totalTriage && (
                <span className="project-triage">Triage: {projectData.totalTriage}h</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="header-right">
          {notification && (
            <div className={`notification ${notification.type}`}>
              {notification.message}
            </div>
          )}
          
          {currentMode === 'view' ? (
            <button onClick={handleEdit} className="btn btn-primary">
              ✏️ Edit Project
            </button>
          ) : (
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
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="unsaved-changes-banner">
          <span>⚠️ You have unsaved changes</span>
        </div>
      )}

      {/* Main content */}
      <div className="project-management-content">
        {currentMode === 'view' ? (
          <ProjectDetails 
            project={projectData}
            onEdit={handleEdit}
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
