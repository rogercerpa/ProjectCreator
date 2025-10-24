import React, { useState, useEffect } from 'react';

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
    <div className="mb-6 p-5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="mb-4">
        <h4 className="m-0 mb-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
          📁 AE Markups File Selection
        </h4>
        <p className="my-2 text-sm text-gray-600 dark:text-gray-400">
          The AE Markups folder contains <strong>{totalFiles} files</strong>. 
          Choose which files to copy to speed up the revision process.
        </p>
        {designNotesFile && (
          <div className="mt-3 p-3 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700 rounded text-sm text-gray-700 dark:text-gray-300">
            📝 <strong>Design Notes document found:</strong> {designNotesFile.name}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded shadow hover:shadow-md transition-all"
          onClick={handleCopyAll}
          title="Copy all files (slowest)"
        >
          📋 Copy All ({totalFiles} files)
        </button>
        
        {designNotesFile && (
          <button 
            className="px-4 py-2 text-sm font-medium bg-info-600 hover:bg-info-700 text-white rounded shadow hover:shadow-md transition-all"
            onClick={handleCopyDesignNotesOnly}
            title="Copy only Design Notes document (recommended)"
          >
            📄 Copy Design Notes Only
          </button>
        )}
        
        <button 
          className="px-4 py-2 text-sm font-medium bg-gray-500 hover:bg-gray-600 text-white rounded shadow hover:shadow-md transition-all"
          onClick={handleCopyNone}
          title="Skip AE Markups folder (fastest)"
        >
          ❌ Skip AE Markups
        </button>
      </div>

      {/* File List */}
      <div className="border border-gray-300 dark:border-gray-600 rounded">
        <div className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select All / None</span>
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedCount} of {totalFiles} selected
          </span>
        </div>

        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          {files.map((file, index) => {
            const isDesignNotes = designNotesFile && file.name === designNotesFile.name;
            const isSelected = selectedFiles.has(file.name);
            
            return (
              <div 
                key={index} 
                className={`p-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  isDesignNotes ? 'bg-info-50 dark:bg-info-900/20' : ''
                } ${
                  isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-white dark:bg-gray-800'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleFileToggle(file.name)}
                    className="w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-700 dark:text-gray-300 break-words">
                      {isDesignNotes && '📝 '}
                      {file.name}
                    </span>
                    {file.size && (
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatFileSize(file.size)}
                      </span>
                    )}
                    {isDesignNotes && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-info-600 text-white rounded">
                        Design Notes
                      </span>
                    )}
                  </div>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-4">
        <button 
          className="btn-secondary"
          onClick={onCancel}
        >
          ❌ Cancel
        </button>
        
        <button 
          className="btn-primary"
          onClick={handleCopySelected}
          disabled={selectedCount === 0}
        >
          ✅ Copy Selected ({selectedCount})
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
    <div className="modal-overlay backdrop-blur-sm">
      <div className="modal-content max-w-3xl w-[90%] max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 relative">
          <h3 className="m-0 text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
          {canCancel && (
            <button 
              onClick={onCancel} 
              className="absolute top-4 right-4 bg-transparent border-none text-2xl font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
              title="Cancel Operation"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="px-6 py-5 max-h-[calc(85vh-200px)] overflow-y-auto custom-scrollbar">
          {/* Progress Bar */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentStep}</span>
              <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300 ease-out" 
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
          <div className="mb-5">
            <h4 className="m-0 mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">
              📋 Operation Details
            </h4>
            <div className="border border-gray-300 dark:border-gray-600 rounded max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900">
              {operationLog.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">Preparing revision operations...</p>
                </div>
              ) : (
                <ul className="list-none m-0 p-0">
                  {operationLog.map((entry, index) => (
                    <li 
                      key={index} 
                      className={`px-3 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0 flex items-start gap-2 text-sm ${
                        entry.type === 'success' ? 'bg-success-50 dark:bg-success-900/10' :
                        entry.type === 'warning' ? 'bg-warning-50 dark:bg-warning-900/10' :
                        entry.type === 'error' ? 'bg-error-50 dark:bg-error-900/10' :
                        'bg-white dark:bg-gray-900'
                      }`}
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 min-w-[60px]">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
                      </span>
                      <span className="flex-shrink-0">
                        {entry.type === 'success' && '✅'}
                        {entry.type === 'warning' && '⚠️'}
                        {entry.type === 'error' && '❌'}
                        {entry.type === 'info' && 'ℹ️'}
                        {!entry.type && '•'}
                      </span>
                      <span className="flex-1 text-gray-700 dark:text-gray-300">{entry.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Status Information */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Files Processed:</span>
                <span className="block text-lg font-semibold text-success-600 dark:text-success-400">
                  {operationLog.filter(log => log.type === 'success' && log.message.includes('Copied')).length}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Warnings:</span>
                <span className="block text-lg font-semibold text-warning-600 dark:text-warning-400">
                  {operationLog.filter(log => log.type === 'warning').length}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Errors:</span>
                <span className="block text-lg font-semibold text-error-600 dark:text-error-400">
                  {operationLog.filter(log => log.type === 'error').length}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {progress < 100 ? (
              <p className="m-0">Please wait while the revision is being created...</p>
            ) : (
              <p className="m-0">Revision creation completed!</p>
            )}
          </div>
          
          {canCancel && progress < 100 && (
            <button onClick={onCancel} className="btn-secondary">
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
