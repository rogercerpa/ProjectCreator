import React, { useState, useEffect } from 'react';
import ErrorDialog, { useErrorDialog } from './ErrorDialog';

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
      console.log('Starting path:', detectionResult?.projectPath);
      
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
      
      const result = await window.electronAPI.revisionSelectFolder(detectionResult?.projectPath);
      
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
          <div className="flex items-start p-4 rounded-lg mb-5 gap-3 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700">
            <div className="text-2xl flex-shrink-0">🔍</div>
            <div className="flex-1">
              <h4 className="m-0 mb-2 text-lg text-gray-800 dark:text-gray-200 font-semibold">
                Searching for Previous Revision
              </h4>
              <p className="my-1 text-gray-600 dark:text-gray-400 text-sm">
                Checking current year, previous year, and two years ago folders...
              </p>
              <div className="spinner mt-2"></div>
            </div>
          </div>
        );
        
      case 'found':
        return (
          <div className="flex items-start p-4 rounded-lg mb-5 gap-3 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-700">
            <div className="text-2xl flex-shrink-0">✅</div>
            <div className="flex-1">
              <h4 className="m-0 mb-2 text-lg text-gray-800 dark:text-gray-200 font-semibold">
                Previous Revision Found
              </h4>
              <p className="my-1 text-gray-600 dark:text-gray-400 text-sm">
                <strong>Path:</strong> {previousRevision?.path}
              </p>
              <p className="my-1 text-gray-600 dark:text-gray-400 text-sm">
                <strong>Method:</strong> {previousRevision?.method === 'automatic' ? 'Found automatically' : 'Selected manually'}
              </p>
              {previousRevision?.validation?.hasStandardStructure && (
                <p className="text-success-600 dark:text-success-400 font-medium text-sm my-1">
                  📁 Standard RFA folder structure detected
                </p>
              )}
            </div>
          </div>
        );
        
      case 'not-found':
        return (
          <div className="flex items-start p-4 rounded-lg mb-5 gap-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-700">
            <div className="text-2xl flex-shrink-0">⚠️</div>
            <div className="flex-1">
              <h4 className="m-0 mb-2 text-lg text-gray-800 dark:text-gray-200 font-semibold">
                Previous Revision Not Found
              </h4>
              <p className="my-1 text-gray-600 dark:text-gray-400 text-sm">
                No previous revision was found automatically in the expected locations.
              </p>
              {detectionResult?.searchedPaths && (
                <details className="mt-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                    Searched Locations
                  </summary>
                  <ul className="mt-2 ml-4 list-disc text-xs text-gray-600 dark:text-gray-400 space-y-1">
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
                className="btn-primary mt-3"
              >
                📂 Select Previous RFA Folder
              </button>
            </div>
          </div>
        );
        
      case 'error':
        return (
          <div className="flex items-start p-4 rounded-lg mb-5 gap-3 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-700">
            <div className="text-2xl flex-shrink-0">❌</div>
            <div className="flex-1">
              <h4 className="m-0 mb-2 text-lg text-gray-800 dark:text-gray-200 font-semibold">
                Detection Error
              </h4>
              <p className="my-1 mb-3 text-gray-600 dark:text-gray-400 text-sm">
                An error occurred during automatic detection. Please try again or select manually.
              </p>
              <div className="flex gap-2">
                <button onClick={detectPreviousRevision} className="btn-secondary">
                  🔄 Retry Detection
                </button>
                <button 
                  onClick={() => {
                    console.log('RevisionConfigurationDialog: Manual selection button clicked (error state)');
                    handleManualSelection();
                  }} 
                  className="btn-primary"
                >
                  📂 Select Manually
                </button>
              </div>
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
      <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <h4 className="m-0 mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
          📋 Select Items to Copy from Previous Revision
        </h4>
        
        {isAnalyzing ? (
          <div className="flex flex-col items-center gap-3 p-8">
            <div className="spinner"></div>
            <p className="text-gray-600 dark:text-gray-400">Analyzing revision contents...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Folder Options */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
              <h5 className="m-0 mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">
                📁 Folders
              </h5>
              
              <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyAEMarkups}
                  onChange={(e) => handleCopyOptionChange('copyAEMarkups', e.target.checked)}
                  disabled={!available.folders?.['AE Markups']?.exists}
                  className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  AE Markups 
                  {available.folders?.['AE Markups']?.exists ? (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({available.folders['AE Markups'].itemCount} items)</span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyXREF}
                  onChange={(e) => handleCopyOptionChange('copyXREF', e.target.checked)}
                  disabled={!available.folders?.['XREF']?.exists}
                  className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  XREF 
                  {available.folders?.['XREF']?.exists ? (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({available.folders['XREF'].itemCount} items)</span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyLCD}
                  onChange={(e) => handleCopyOptionChange('copyLCD', e.target.checked)}
                  disabled={!available.folders?.['LCD']?.exists}
                  className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  LCD 
                  {available.folders?.['LCD']?.exists ? (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({available.folders['LCD'].itemCount} items)</span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(not available)</span>
                  )}
                </span>
              </label>
            </div>
            
            {/* File Options */}
            <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded">
              <h5 className="m-0 mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">
                📄 Files
              </h5>
              
              <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyVSP}
                  onChange={(e) => handleCopyOptionChange('copyVSP', e.target.checked)}
                  disabled={!available.files?.['.vsp']?.count}
                  className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  VSP Files 
                  {available.files?.['.vsp']?.count ? (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({available.files['.vsp'].count} files)</span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center gap-2 mb-3 cursor-pointer group">
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
    <div className="modal-overlay backdrop-blur-sm" onClick={handleBackdropClick}>
      <div className={`modal-content max-w-4xl w-[90%] max-h-[90vh] ${className}`}>
        {/* Header */}
        <div className="px-6 py-5 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 relative">
          <h3 className="m-0 mb-2 text-2xl font-semibold text-gray-800 dark:text-gray-100">
            🔄 Configure Revision Settings
          </h3>
          <p className="m-0 text-sm text-gray-600 dark:text-gray-400">
            Set up your revision project by selecting the previous revision and copy options.
          </p>
          <button 
            className="absolute top-5 right-5 bg-transparent border-none text-2xl font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
            onClick={handleCancel}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Project Info */}
          <div className="mb-5 p-4 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700 rounded-lg">
            <h4 className="m-0 mb-3 text-lg font-semibold text-gray-800 dark:text-gray-100">
              📝 Project Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="text-sm">
                <strong className="text-gray-700 dark:text-gray-300">Project Name:</strong>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{projectData?.projectName}</span>
              </div>
              <div className="text-sm">
                <strong className="text-gray-700 dark:text-gray-300">Project Container:</strong>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{projectData?.projectContainer}</span>
              </div>
              <div className="text-sm">
                <strong className="text-gray-700 dark:text-gray-300">RFA Number:</strong>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{projectData?.rfaNumber}</span>
              </div>
            </div>
          </div>
          
          {renderDetectionStatus()}
          {renderCopyOptions()}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-end gap-3">
            <button 
              className="btn-secondary" 
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleConfirm}
              disabled={!canProceed}
            >
              {canProceed ? '✓ Configure Revision' : 'Select Previous Revision First'}
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
