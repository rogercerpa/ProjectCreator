import React, { useState, useEffect } from 'react';
import './AEMarkupsSelectionDialog.css';

/**
 * AEMarkupsSelectionDialog - File selection modal for AE Markups folder
 * Shows when AE Markups has more than 3 files, allows user to select which files to copy
 */
const AEMarkupsSelectionDialog = ({ 
  isOpen, 
  files, 
  onConfirm, 
  onCancel 
}) => {
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [selectAll, setSelectAll] = useState(true);

  // Initialize selection state when dialog opens
  useEffect(() => {
    if (isOpen && files) {
      console.log('🗂️ AE Markups Dialog: Initializing with files:', files);
      
      // Start with all files selected by default
      const allFileNames = files.map(file => file.name);
      setSelectedFiles(new Set(allFileNames));
      setSelectAll(true);
      
      // Auto-select Design Notes document if found
      const designNotesFile = findDesignNotesDocument(files);
      if (designNotesFile) {
        console.log('📝 Auto-selected Design Notes document:', designNotesFile.name);
      }
    }
  }, [isOpen, files]);

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
    
    console.log(`🔄 File toggle: ${fileName}, Selected count: ${newSelected.size}`);
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectAll) {
      // Deselect all
      setSelectedFiles(new Set());
      setSelectAll(false);
      console.log('❌ Deselected all files');
    } else {
      // Select all
      const allFileNames = files.map(file => file.name);
      setSelectedFiles(new Set(allFileNames));
      setSelectAll(true);
      console.log('✅ Selected all files');
    }
  };

  // Handle quick actions
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

  if (!isOpen || !files) {
    return null;
  }

  const designNotesFile = findDesignNotesDocument(files);
  const selectedCount = selectedFiles.size;
  const totalFiles = files.length;

  return (
    <div className="ae-markups-dialog-overlay">
      <div className="ae-markups-dialog">
        {/* Header */}
        <div className="ae-markups-dialog-header">
          <div className="ae-markups-dialog-icon">📁</div>
          <h2 className="ae-markups-dialog-title">AE Markups File Selection</h2>
        </div>

        {/* Content */}
        <div className="ae-markups-dialog-content">
          {/* Info */}
          <div className="ae-markups-info">
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
        </div>

        {/* Actions */}
        <div className="ae-markups-dialog-actions">
          <button 
            className="ae-markups-btn ae-markups-btn-primary"
            onClick={handleCopySelected}
            disabled={selectedCount === 0}
            title={selectedCount === 0 ? 'No files selected' : `Copy ${selectedCount} selected files`}
          >
            ✅ Copy Selected ({selectedCount})
          </button>
          
          <button 
            className="ae-markups-btn ae-markups-btn-secondary"
            onClick={onCancel}
            title="Cancel and use default copying behavior"
          >
            ❌ Cancel
          </button>
        </div>

        {/* Footer Note */}
        <div className="ae-markups-dialog-footer">
          <p>
            💡 <strong>Tip:</strong> Selecting fewer files will make the revision creation process faster.
            {designNotesFile && ' The Design Notes document is usually the most important file to copy.'}
          </p>
        </div>
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

export default AEMarkupsSelectionDialog;
