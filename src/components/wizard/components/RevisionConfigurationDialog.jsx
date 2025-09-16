import React, { useState, useEffect } from 'react';
import ErrorDialog, { useErrorDialog } from './ErrorDialog';
import './RevisionConfigurationDialog.css';

/**
 * RevisionConfigurationDialog
 * A dedicated dialog for configuring revision settings
 */
const RevisionConfigurationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  projectData,
  className = ''
}) => {
  const [detectionState, setDetectionState] = useState('idle'); // idle, detecting, found, not-found, error
  const [detectionResult, setDetectionResult] = useState(null);
  const [previousRevision, setPreviousRevision] = useState(null);
  const [revisionAnalysis, setRevisionAnalysis] = useState(null);
  const [copyOptions, setCopyOptions] = useState({
    copyAEMarkups: true,
    copyXREF: true,
    copyLCD: true,
    copyVSP: true,
    copyDWG: true
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [canProceed, setCanProceed] = useState(false);

  // Error dialog state
  const { errorState, showError, showWarning, close: closeErrorDialog, retry: retryFromDialog } = useErrorDialog();

  // Auto-detect when dialog opens
  useEffect(() => {
    if (isOpen && projectData && projectData.projectName && projectData.projectContainer) {
      detectPreviousRevision();
    }
  }, [isOpen, projectData?.projectName, projectData?.projectContainer]);

  // Update proceed state
  useEffect(() => {
    setCanProceed(detectionState === 'found' && previousRevision !== null);
  }, [detectionState, previousRevision]);

  // Detect previous revision automatically
  const detectPreviousRevision = async () => {
    try {
      setDetectionState('detecting');
      setPreviousRevision(null);
      setRevisionAnalysis(null);
      
      console.log('RevisionConfigurationDialog: Starting automatic detection');
      
      const result = await window.electronAPI.revisionFindPrevious(projectData);
      
      setDetectionResult(result);
      
      if (result.success && result.revisionPath) {
        console.log('RevisionConfigurationDialog: Previous revision found automatically');
        setDetectionState('found');
        const revisionInfo = {
          path: result.revisionPath,
          projectPath: result.projectPath,
          method: 'automatic'
        };
        setPreviousRevision(revisionInfo);
        
        // Analyze the found revision
        await analyzeRevisionContents(result.revisionPath);
        
      } else if (result.requiresManualSelection) {
        console.log('RevisionConfigurationDialog: Manual selection required');
        setDetectionState('not-found');
      } else {
        console.log('RevisionConfigurationDialog: No previous revision found');
        setDetectionState('not-found');
      }
      
    } catch (error) {
      console.error('RevisionConfigurationDialog: Detection error:', error);
      setDetectionState('error');
      setDetectionResult({ error: error.message });
      
      // Show error in dialog
      showError({
        title: 'Revision Detection Error',
        message: 'Failed to detect previous revision automatically.',
        details: error.message,
        showRetry: true,
        onRetry: () => detectPreviousRevision()
      });
    }
  };

  // Analyze revision contents for copy options
  const analyzeRevisionContents = async (revisionPath) => {
    try {
      setIsAnalyzing(true);
      
      const analysis = await window.electronAPI.revisionAnalyzeContents(revisionPath);
      const recommendedOptions = await window.electronAPI.revisionGetCopyOptions(revisionPath);
      
      setRevisionAnalysis(analysis);
      setCopyOptions(recommendedOptions);
      
      console.log('RevisionConfigurationDialog: Revision analysis completed');
      console.log('Available items:', analysis.available?.summary);
      console.log('Recommended options:', recommendedOptions);
      
    } catch (error) {
      console.error('RevisionConfigurationDialog: Error analyzing revision contents:', error);
      showWarning(
        'Content Analysis Error',
        'Failed to analyze the revision contents. Default copy options will be used.',
        error.message
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle manual folder selection
  const handleManualSelection = async () => {
    try {
      console.log('RevisionConfigurationDialog: Opening manual selection dialog');
      console.log('Starting path:', detectionResult?.searchResult?.projectPath);
      
      // Check if the API exists
      if (!window.electronAPI || !window.electronAPI.revisionSelectFolder) {
        console.error('RevisionConfigurationDialog: revisionSelectFolder API not available');
        showError({
          title: 'API Error',
          message: 'Folder selection API is not available. Please restart the application.',
          details: 'window.electronAPI.revisionSelectFolder is not defined'
        });
        return;
      }
      
      const result = await window.electronAPI.revisionSelectFolder(detectionResult?.searchResult?.projectPath);
      
      console.log('RevisionConfigurationDialog: Folder selection result:', result);
      
      if (result.success && !result.canceled) {
        if (result.validation && result.validation.isValid) {
          console.log('RevisionConfigurationDialog: Manual selection successful');
          
          const revisionInfo = {
            path: result.selectedPath,
            method: 'manual',
            validation: result.validation
          };
          setPreviousRevision(revisionInfo);
          setDetectionState('found');
          
          // Analyze the manually selected revision
          await analyzeRevisionContents(result.selectedPath);
          
        } else {
          showError({
            title: 'Invalid Folder Selected',
            message: `The selected folder is not a valid RFA folder: ${result.validation?.error || 'Unknown validation error'}`,
            details: result.validation
          });
        }
      } else if (result.canceled) {
        console.log('RevisionConfigurationDialog: Folder selection canceled by user');
      } else {
        console.error('RevisionConfigurationDialog: Folder selection failed:', result);
        showError({
          title: 'Folder Selection Failed',
          message: result.error || 'Unknown error occurred during folder selection',
          details: result
        });
      }
      
    } catch (error) {
      console.error('RevisionConfigurationDialog: Manual selection error:', error);
      showError({
        title: 'Folder Selection Error',
        message: 'Failed to select revision folder.',
        details: error.message,
        showRetry: true,
        onRetry: () => handleManualSelection()
      });
    }
  };

  // Handle copy option changes
  const handleCopyOptionChange = (option, value) => {
    setCopyOptions(prev => ({ ...prev, [option]: value }));
  };

  // Handle dialog confirmation
  const handleConfirm = () => {
    if (!canProceed) return;
    
    const revisionConfig = {
      previousRevisionPath: previousRevision.path,
      copyOptions: copyOptions,
      detectionMethod: previousRevision.method,
      analysis: revisionAnalysis
    };
    
    onConfirm(revisionConfig);
    onClose();
  };

  // Handle dialog cancellation
  const handleCancel = () => {
    onClose();
  };

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  // Render detection status
  const renderDetectionStatus = () => {
    switch (detectionState) {
      case 'detecting':
        return (
          <div className="detection-status detecting">
            <div className="status-icon">🔍</div>
            <div className="status-content">
              <h4>Searching for Previous Revision</h4>
              <p>Checking current year, previous year, and two years ago folders...</p>
              <div className="loading-spinner"></div>
            </div>
          </div>
        );
        
      case 'found':
        return (
          <div className="detection-status found">
            <div className="status-icon">✅</div>
            <div className="status-content">
              <h4>Previous Revision Found</h4>
              <p><strong>Path:</strong> {previousRevision?.path}</p>
              <p><strong>Method:</strong> {previousRevision?.method === 'automatic' ? 'Found automatically' : 'Selected manually'}</p>
              {previousRevision?.validation?.hasStandardStructure && (
                <p className="validation-info">📁 Standard RFA folder structure detected</p>
              )}
            </div>
          </div>
        );
        
      case 'not-found':
        return (
          <div className="detection-status not-found">
            <div className="status-icon">⚠️</div>
            <div className="status-content">
              <h4>Previous Revision Not Found</h4>
              <p>No previous revision was found automatically in the expected locations.</p>
              {detectionResult?.searchedPaths && (
                <details className="searched-paths">
                  <summary>Searched Locations</summary>
                  <ul>
                    {detectionResult.searchedPaths.map((path, index) => (
                      <li key={index}>{path}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button 
                onClick={() => {
                  console.log('RevisionConfigurationDialog: Manual selection button clicked');
                  handleManualSelection();
                }} 
                className="btn btn-primary"
              >
                📂 Select Previous RFA Folder
              </button>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div className="detection-status error">
            <div className="status-icon">❌</div>
            <div className="status-content">
              <h4>Detection Error</h4>
              <p>An error occurred during automatic detection. Please try again or select manually.</p>
              <button onClick={detectPreviousRevision} className="btn btn-secondary">
                🔄 Retry Detection
              </button>
              <button 
                onClick={() => {
                  console.log('RevisionConfigurationDialog: Manual selection button clicked (error state)');
                  handleManualSelection();
                }} 
                className="btn btn-primary"
              >
                📂 Select Manually
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // Render copy options
  const renderCopyOptions = () => {
    if (detectionState !== 'found' || !revisionAnalysis) {
      return null;
    }

    const available = revisionAnalysis.available;
    
    return (
      <div className="copy-options">
        <h4>📋 Select Items to Copy from Previous Revision</h4>
        
        {isAnalyzing ? (
          <div className="analyzing">
            <div className="loading-spinner"></div>
            <p>Analyzing revision contents...</p>
          </div>
        ) : (
          <div className="copy-options-grid">
            
            {/* Folder Options */}
            <div className="copy-section">
              <h5>📁 Folders</h5>
              
              <label className="copy-option">
                <input
                  type="checkbox"
                  checked={copyOptions.copyAEMarkups}
                  onChange={(e) => handleCopyOptionChange('copyAEMarkups', e.target.checked)}
                  disabled={!available.folders?.['AE Markups']?.exists}
                />
                <span className="option-label">
                  AE Markups 
                  {available.folders?.['AE Markups']?.exists ? (
                    <span className="item-count">({available.folders['AE Markups'].itemCount} items)</span>
                  ) : (
                    <span className="not-available">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="copy-option">
                <input
                  type="checkbox"
                  checked={copyOptions.copyXREF}
                  onChange={(e) => handleCopyOptionChange('copyXREF', e.target.checked)}
                  disabled={!available.folders?.['XREF']?.exists}
                />
                <span className="option-label">
                  XREF 
                  {available.folders?.['XREF']?.exists ? (
                    <span className="item-count">({available.folders['XREF'].itemCount} items)</span>
                  ) : (
                    <span className="not-available">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="copy-option">
                <input
                  type="checkbox"
                  checked={copyOptions.copyLCD}
                  onChange={(e) => handleCopyOptionChange('copyLCD', e.target.checked)}
                  disabled={!available.folders?.['LCD']?.exists}
                />
                <span className="option-label">
                  LCD 
                  {available.folders?.['LCD']?.exists ? (
                    <span className="item-count">({available.folders['LCD'].itemCount} items)</span>
                  ) : (
                    <span className="not-available">(not available)</span>
                  )}
                </span>
              </label>
            </div>
            
            {/* File Options */}
            <div className="copy-section">
              <h5>📄 Files</h5>
              
              <label className="copy-option">
                <input
                  type="checkbox"
                  checked={copyOptions.copyVSP}
                  onChange={(e) => handleCopyOptionChange('copyVSP', e.target.checked)}
                  disabled={!available.files?.['.vsp']?.count}
                />
                <span className="option-label">
                  VSP Files 
                  {available.files?.['.vsp']?.count ? (
                    <span className="item-count">({available.files['.vsp'].count} files)</span>
                  ) : (
                    <span className="not-available">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="copy-option">
                <input
                  type="checkbox"
                  checked={copyOptions.copyDWG}
                  onChange={(e) => handleCopyOptionChange('copyDWG', e.target.checked)}
                  disabled={!available.files?.['.dwg']?.count}
                />
                <span className="option-label">
                  DWG Files 
                  {available.files?.['.dwg']?.count ? (
                    <span className="item-count">({available.files['.dwg'].count} files)</span>
                  ) : (
                    <span className="not-available">(not available)</span>
                  )}
                </span>
              </label>
            </div>
          </div>
        )}
        
        <div className="copy-summary">
          <p>
            <strong>Total items to copy:</strong> {
              Object.values(copyOptions).filter(Boolean).length
            } categories selected
          </p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="revision-config-dialog-overlay" onClick={handleBackdropClick}>
      <div className={`revision-config-dialog ${className}`}>
        <div className="dialog-header">
          <h3>🔄 Configure Revision Settings</h3>
          <p>Set up your revision project by selecting the previous revision and copy options.</p>
          <button 
            className="close-btn" 
            onClick={handleCancel}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        
        <div className="dialog-content">
          <div className="project-info">
            <h4>📝 Project Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <strong>Project Name:</strong> {projectData?.projectName}
              </div>
              <div className="info-item">
                <strong>Project Container:</strong> {projectData?.projectContainer}
              </div>
              <div className="info-item">
                <strong>RFA Number:</strong> {projectData?.rfaNumber}
              </div>
            </div>
          </div>
          
          {renderDetectionStatus()}
          {renderCopyOptions()}
        </div>
        
        <div className="dialog-footer">
          <div className="footer-actions">
            <button 
              className="btn btn-secondary" 
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleConfirm}
              disabled={!canProceed}
            >
              {canProceed ? 'Configure Revision' : 'Select Previous Revision First'}
            </button>
          </div>
        </div>
        
        {/* Error Dialog */}
        <ErrorDialog
          isOpen={errorState.isOpen}
          title={errorState.title}
          message={errorState.message}
          details={errorState.details}
          type={errorState.type}
          showRetry={errorState.showRetry}
          onClose={closeErrorDialog}
          onRetry={retryFromDialog}
        />
      </div>
    </div>
  );
};

export default RevisionConfigurationDialog;
