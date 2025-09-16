import React from 'react';
import './RevisionProgressModal.css';

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
  title = 'Creating Revision'
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
