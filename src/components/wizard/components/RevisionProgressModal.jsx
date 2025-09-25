import React, { useState, useEffect } from 'react';
import './RevisionProgressModal.css';

/**
 * AEMarkupsFileSelection - Embedded component for AE Markups file selection
 */
const AEMarkupsFileSelection = ({ files, onConfirm, onCancel }) => {
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectAll, setSelectAll] = useState(true);

  // Initialize selection state when files change
  useEffect(() => {
    if (files && files.length > 0) {
      console.log('🗂️ AE Markups embedded: Initializing with files:', files);
      
      // Start with all files selected by default
      const allFileNames = files.map(file => file.name);
      setSelectedFiles(new Set(allFileNames));
      setSelectAll(true);
    }
  }, [files]);

  // Find Design Notes and Assumptions document
  const findDesignNotesDocument = (fileList) => {
    if (!fileList) return null;
    
    return fileList.find(file => {
      const fileName = file.name.toLowerCase();
      return (
        (fileName.includes('design') && fileName.includes('notes')) ||
        (fileName.includes('design') && fileName.includes('assumptions')) ||
        fileName.includes('design notes and assumptions')
      ) && (fileName.endsWith('.docx') || fileName.endsWith('.doc'));
    });
  };

  // Handle individual file selection
  const handleFileToggle = (fileName) => {
    const newSelected = new Set(selectedFiles);
    
    if (newSelected.has(fileName)) {
      newSelected.delete(fileName);
    } else {
      newSelected.add(fileName);
    }
    
    setSelectedFiles(newSelected);
    setSelectAll(newSelected.size === files.length);
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedFiles(new Set());
      setSelectAll(false);
    } else {
      const allFileNames = files.map(file => file.name);
      setSelectedFiles(new Set(allFileNames));
      setSelectAll(true);
    }
  };

  // Quick action handlers
  const handleCopyAll = () => {
    const allFileNames = files.map(file => file.name);
    console.log('📋 Copy All: Selecting all files');
    onConfirm(allFileNames);
  };

  const handleCopySelected = () => {
    const selectedArray = Array.from(selectedFiles);
    console.log('📝 Copy Selected:', selectedArray);
    onConfirm(selectedArray);
  };

  const handleCopyNone = () => {
    console.log('❌ Skip AE Markups: Copying no files');
    onConfirm([]);
  };

  const handleCopyDesignNotesOnly = () => {
    const designNotesFile = findDesignNotesDocument(files);
    if (designNotesFile) {
      console.log('📄 Copy Design Notes Only:', designNotesFile.name);
      onConfirm([designNotesFile.name]);
    } else {
      console.log('⚠️ No Design Notes document found, copying nothing');
      onConfirm([]);
    }
  };

  if (!files || files.length === 0) {
    return null;
  }

  const designNotesFile = findDesignNotesDocument(files);
  const selectedCount = selectedFiles.size;
  const totalFiles = files.length;

  return (
    <div className="ae-markups-selection">
      <div className="ae-markups-header">
        <h4>📁 AE Markups File Selection</h4>
        <p>
          The AE Markups folder contains <strong>{totalFiles} files</strong>. 
          Choose which files to copy to speed up the revision process.
        </p>
        {designNotesFile && (
          <div className="design-notes-highlight">
            📝 <strong>Design Notes document found:</strong> {designNotesFile.name}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className="quick-action-btn copy-all"
          onClick={handleCopyAll}
          title="Copy all files (slowest)"
        >
          📋 Copy All ({totalFiles} files)
        </button>
        
        {designNotesFile && (
          <button 
            className="quick-action-btn copy-design-notes"
            onClick={handleCopyDesignNotesOnly}
            title="Copy only Design Notes document (recommended)"
          >
            📄 Copy Design Notes Only
          </button>
        )}
        
        <button 
          className="quick-action-btn copy-none"
          onClick={handleCopyNone}
          title="Skip AE Markups folder (fastest)"
        >
          ❌ Skip AE Markups
        </button>
      </div>

      {/* File List */}
      <div className="file-selection-section">
        <div className="file-list-header">
          <label className="select-all-label">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
            />
            <span>Select All / None</span>
          </label>
          <span className="selection-count">
            {selectedCount} of {totalFiles} selected
          </span>
        </div>

        <div className="file-list">
          {files.map((file, index) => {
            const isDesignNotes = designNotesFile && file.name === designNotesFile.name;
            const isSelected = selectedFiles.has(file.name);
            
            return (
              <div 
                key={index} 
                className={`file-item ${isDesignNotes ? 'design-notes' : ''} ${isSelected ? 'selected' : ''}`}
              >
                <label className="file-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleFileToggle(file.name)}
                  />
                  <div className="file-info">
                    <span className="file-name">
                      {isDesignNotes && '📝 '}
                      {file.name}
                    </span>
                    {file.size && (
                      <span className="file-size">
                        {formatFileSize(file.size)}
                      </span>
                    )}
                    {isDesignNotes && (
                      <span className="file-badge">Design Notes</span>
                    )}
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="ae-markups-actions">
        <button 
          className="btn btn-primary"
          onClick={handleCopySelected}
          disabled={selectedCount === 0}
        >
          ✅ Copy Selected ({selectedCount})
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={onCancel}
        >
          ❌ Cancel
        </button>
      </div>
    </div>
  );
};

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

/**
 * RevisionProgressModal
 * Shows progress during revision creation with detailed operation tracking
 */
const RevisionProgressModal = ({
  isOpen,
  progress = 0,
  currentStep = '',
  operationLog = [],
  onCancel,
  canCancel = false,
  title = 'Creating Revision',
  // AE Markups file selection props
  showAEMarkupsSelection = false,
  aeMarkupsFiles = [],
  onAEMarkupsConfirm,
  onAEMarkupsCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="revision-progress-modal-overlay">
      <div className="revision-progress-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          {canCancel && (
            <button onClick={onCancel} className="cancel-btn" title="Cancel Operation">
              ✕
            </button>
          )}
        </div>
        
        <div className="modal-content">
          {/* Progress Bar */}
          <div className="progress-section">
            <div className="progress-info">
              <span className="current-step">{currentStep}</span>
              <span className="progress-percentage">{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          
          {/* AE Markups File Selection */}
          {showAEMarkupsSelection && (
            <AEMarkupsFileSelection 
              files={aeMarkupsFiles}
              onConfirm={onAEMarkupsConfirm}
              onCancel={onAEMarkupsCancel}
            />
          )}
          
          {/* Operation Log */}
          <div className="operation-log">
            <h4>📋 Operation Details</h4>
            <div className="log-container">
              {operationLog.length === 0 ? (
                <div className="log-empty">
                  <p>Preparing revision operations...</p>
                </div>
              ) : (
                <ul className="log-list">
                  {operationLog.map((entry, index) => (
                    <li key={index} className={`log-entry ${entry.type || 'info'}`}>
                      <span className="log-timestamp">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
                      </span>
                      <span className="log-icon">
                        {entry.type === 'success' && '✅'}
                        {entry.type === 'warning' && '⚠️'}
                        {entry.type === 'error' && '❌'}
                        {entry.type === 'info' && 'ℹ️'}
                        {!entry.type && '•'}
                      </span>
                      <span className="log-message">{entry.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Status Information */}
          <div className="status-section">
            <div className="status-indicators">
              <div className="status-item">
                <span className="status-label">Files Processed:</span>
                <span className="status-value">
                  {operationLog.filter(log => log.type === 'success' && log.message.includes('Copied')).length}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Warnings:</span>
                <span className="status-value warning">
                  {operationLog.filter(log => log.type === 'warning').length}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Errors:</span>
                <span className="status-value error">
                  {operationLog.filter(log => log.type === 'error').length}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <div className="footer-info">
            {progress < 100 ? (
              <p>Please wait while the revision is being created...</p>
            ) : (
              <p>Revision creation completed!</p>
            )}
          </div>
          
          {canCancel && progress < 100 && (
            <button onClick={onCancel} className="btn btn-secondary">
              Cancel Operation
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Helper hook for managing revision progress
 */
export const useRevisionProgress = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [currentStep, setCurrentStep] = React.useState('');
  const [operationLog, setOperationLog] = React.useState([]);

  const addLogEntry = React.useCallback((message, type = 'info') => {
    const entry = {
      message,
      type,
      timestamp: new Date().toISOString()
    };
    
    setOperationLog(prev => [...prev, entry]);
  }, []);

  const updateProgress = React.useCallback((step, progressValue) => {
    setCurrentStep(step);
    setProgress(progressValue);
    addLogEntry(step, 'info');
  }, [addLogEntry]);

  const start = React.useCallback((title = 'Creating Revision') => {
    setIsOpen(true);
    setProgress(0);
    setCurrentStep('Initializing...');
    setOperationLog([]);
    addLogEntry('Starting revision creation process', 'info');
  }, [addLogEntry]);

  const complete = React.useCallback((message = 'Revision created successfully!') => {
    setProgress(100);
    setCurrentStep('Completed');
    addLogEntry(message, 'success');
    
    // Auto-close after a delay
    setTimeout(() => {
      setIsOpen(false);
    }, 2000);
  }, [addLogEntry]);

  const error = React.useCallback((message) => {
    addLogEntry(`Error: ${message}`, 'error');
    setCurrentStep('Error occurred');
  }, [addLogEntry]);

  const warning = React.useCallback((message) => {
    addLogEntry(`Warning: ${message}`, 'warning');
  }, [addLogEntry]);

  const close = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const reset = React.useCallback(() => {
    setProgress(0);
    setCurrentStep('');
    setOperationLog([]);
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    progress,
    currentStep,
    operationLog,
    start,
    updateProgress,
    addLogEntry,
    complete,
    error,
    warning,
    close,
    reset
  };
};

export default RevisionProgressModal;
