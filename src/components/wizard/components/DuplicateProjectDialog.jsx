import React from 'react';
import './DuplicateProjectDialog.css';

/**
 * DuplicateProjectDialog - Warning dialog for duplicate project detection
 * Shows when an existing project is found and guides user toward correct workflow
 */
const DuplicateProjectDialog = ({ 
  isOpen, 
  warningData, 
  onCreateRevision, 
  onProceedAnyway, 
  onCancel 
}) => {
  if (!isOpen || !warningData) {
    return null;
  }

  const handleCreateRevision = () => {
    console.log('🔄 User chose to create revision');
    onCreateRevision(warningData);
  };

  const handleProceedAnyway = () => {
    console.log('⚠️ User chose to proceed with new project anyway');
    onProceedAnyway();
  };

  const handleCancel = () => {
    console.log('❌ User cancelled - will ask agent to resubmit');
    onCancel();
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString.length !== 8) return dateString;
    
    const month = dateString.substring(0, 2);
    const day = dateString.substring(2, 4);
    const year = dateString.substring(4, 8);
    
    return `${month}/${day}/${year}`;
  };

  return (
    <div className="duplicate-dialog-overlay">
      <div className="duplicate-dialog">
        {/* Header */}
        <div className="duplicate-dialog-header">
          <div className="duplicate-dialog-icon">⚠️</div>
          <h2 className="duplicate-dialog-title">DUPLICATE PROJECT DETECTED</h2>
        </div>

        {/* Content */}
        <div className="duplicate-dialog-content">
          {/* Project Info */}
          <div className="duplicate-project-info">
            <h3>Project: <span className="project-name">{warningData.projectName || 'Unknown Project'}</span></h3>
            <p className="found-location">A project folder already exists for this project.</p>
          </div>

          {/* Simple Message */}
          <div className="simple-message-section">
            <div className="message-box">
              <p>
                🚨 <strong>An existing project folder was found.</strong>
              </p>
              <p>
                The agent may have intended to submit a <strong>revision request</strong> instead of a new project.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="duplicate-dialog-actions">
          <button 
            className="duplicate-btn duplicate-btn-warning"
            onClick={handleProceedAnyway}
            title="Continue with new project creation"
          >
            ⚠️ Proceed with New Project
          </button>
          
          <button 
            className="duplicate-btn duplicate-btn-secondary"
            onClick={handleCancel}
            title="Cancel and clear form - agent will resubmit"
          >
            ❌ Cancel - Agent Will Resubmit
          </button>
        </div>

        {/* Footer Note */}
        <div className="duplicate-dialog-footer">
          <p>
            💡 <strong>Tip:</strong> If unsure, cancel and ask the agent to clarify whether this should be a new project or a revision.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DuplicateProjectDialog;
