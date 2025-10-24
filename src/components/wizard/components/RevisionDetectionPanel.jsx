import React, { useState, useEffect } from 'react';
import ErrorDialog, { useErrorDialog } from './ErrorDialog';

/**
 * RevisionDetectionPanel
 * Displays revision detection results and handles previous revision selection
 */
const RevisionDetectionPanel = ({
  projectData,
  onPreviousRevisionFound,
  onManualSelectionNeeded,
  onRevisionOptionsChange,
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
  
  // Error dialog state
  const { errorState, showError, showWarning, close: closeErrorDialog, retry: retryFromDialog } = useErrorDialog();

  // Auto-detect when project data changes
  useEffect(() => {
    if (projectData && projectData.projectName && projectData.projectContainer && projectData.isRevision) {
      detectPreviousRevision();
    }
  }, [projectData.projectName, projectData.projectContainer, projectData.isRevision]);

  // Detect previous revision automatically
  const detectPreviousRevision = async () => {
    try {
      setDetectionState('detecting');
      
      console.log('RevisionDetectionPanel: Starting automatic detection');
      
      const result = await window.electronAPI.revisionFindPrevious(projectData);
      
      setDetectionResult(result);
      
      if (result.success && result.revisionPath) {
        console.log('RevisionDetectionPanel: Previous revision found automatically');
        setDetectionState('found');
        setPreviousRevision({
          path: result.revisionPath,
          projectPath: result.projectPath,
          method: 'automatic'
        });
        
        // Analyze the found revision
        await analyzeRevisionContents(result.revisionPath);
        
        // Notify parent component
        if (onPreviousRevisionFound) {
          onPreviousRevisionFound({
            revisionPath: result.revisionPath,
            projectPath: result.projectPath,
            method: 'automatic'
          });
        }
        
      } else if (result.requiresManualSelection) {
        console.log('RevisionDetectionPanel: Manual selection required');
        setDetectionState('not-found');
        
        // Notify parent that manual selection is needed
        if (onManualSelectionNeeded) {
          onManualSelectionNeeded(result);
        }
      } else {
        console.log('RevisionDetectionPanel: No previous revision found');
        setDetectionState('not-found');
      }
      
    } catch (error) {
      console.error('RevisionDetectionPanel: Detection error:', error);
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
      
      console.log('RevisionDetectionPanel: Revision analysis completed');
      console.log('Available items:', analysis.available?.summary);
      console.log('Recommended options:', recommendedOptions);
      
    } catch (error) {
      console.error('RevisionDetectionPanel: Error analyzing revision contents:', error);
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
      console.log('RevisionDetectionPanel: Opening manual selection dialog');
      
      const result = await window.electronAPI.revisionSelectFolder(detectionResult?.projectPath);
      
      if (result.success && !result.canceled) {
        if (result.validation.isValid) {
          console.log('RevisionDetectionPanel: Manual selection successful');
          
          setPreviousRevision({
            path: result.selectedPath,
            method: 'manual',
            validation: result.validation
          });
          setDetectionState('found');
          
          // Analyze the manually selected revision
          await analyzeRevisionContents(result.selectedPath);
          
          // Notify parent component
          if (onPreviousRevisionFound) {
            onPreviousRevisionFound({
              revisionPath: result.selectedPath,
              method: 'manual',
              validation: result.validation
            });
          }
          
        } else {
          showError({
            title: 'Invalid Folder Selected',
            message: `The selected folder is not a valid RFA folder: ${result.validation.error}`,
            details: result.validation
          });
        }
      }
      
    } catch (error) {
      console.error('RevisionDetectionPanel: Manual selection error:', error);
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
    const newOptions = { ...copyOptions, [option]: value };
    setCopyOptions(newOptions);
    
    if (onRevisionOptionsChange) {
      onRevisionOptionsChange({
        copyOptions: newOptions,
        previousRevisionPath: previousRevision?.path
      });
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
              <button onClick={handleManualSelection} className="btn-primary mt-3">
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
                <button onClick={handleManualSelection} className="btn-primary">
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="m-0 mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">
          📋 Select Items to Copy from Previous Revision
        </h4>
        
        {isAnalyzing ? (
          <div className="flex flex-col items-center py-8">
            <div className="spinner mb-3"></div>
            <p className="text-gray-600 dark:text-gray-400">Analyzing revision contents...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Folder Options */}
            <div className="space-y-3">
              <h5 className="m-0 mb-3 text-base font-semibold text-gray-700 dark:text-gray-300">
                📁 Folders
              </h5>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyAEMarkups}
                  onChange={(e) => handleCopyOptionChange('copyAEMarkups', e.target.checked)}
                  disabled={!available.folders?.['AE Markups']?.exists}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  AE Markups {' '}
                  {available.folders?.['AE Markups']?.exists ? (
                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                      ({available.folders['AE Markups'].itemCount} items)
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyXREF}
                  onChange={(e) => handleCopyOptionChange('copyXREF', e.target.checked)}
                  disabled={!available.folders?.['XREF']?.exists}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  XREF {' '}
                  {available.folders?.['XREF']?.exists ? (
                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                      ({available.folders['XREF'].itemCount} items)
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyLCD}
                  onChange={(e) => handleCopyOptionChange('copyLCD', e.target.checked)}
                  disabled={!available.folders?.['LCD']?.exists}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  LCD {' '}
                  {available.folders?.['LCD']?.exists ? (
                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                      ({available.folders['LCD'].itemCount} items)
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">(not available)</span>
                  )}
                </span>
              </label>
            </div>
            
            {/* File Options */}
            <div className="space-y-3">
              <h5 className="m-0 mb-3 text-base font-semibold text-gray-700 dark:text-gray-300">
                📄 Files
              </h5>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyVSP}
                  onChange={(e) => handleCopyOptionChange('copyVSP', e.target.checked)}
                  disabled={!available.files?.['.vsp']?.count}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  VSP Files {' '}
                  {available.files?.['.vsp']?.count ? (
                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                      ({available.files['.vsp'].count} files)
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">(not available)</span>
                  )}
                </span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={copyOptions.copyDWG}
                  onChange={(e) => handleCopyOptionChange('copyDWG', e.target.checked)}
                  disabled={!available.files?.['.dwg']?.count}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  DWG Files {' '}
                  {available.files?.['.dwg']?.count ? (
                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                      ({available.files['.dwg'].count} files)
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">(not available)</span>
                  )}
                </span>
              </label>
            </div>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="m-0 text-sm text-gray-700 dark:text-gray-300">
            <strong>Total items to copy:</strong>{' '}
            <span className="text-primary-600 dark:text-primary-400 font-semibold">
              {Object.values(copyOptions).filter(Boolean).length} categories selected
            </span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5 my-5 ${className}`}>
      <div className="mb-5">
        <h3 className="m-0 mb-2 text-gray-700 dark:text-gray-300 text-xl font-semibold">
          🔄 Revision Configuration
        </h3>
        <p className="m-0 text-gray-600 dark:text-gray-400 text-sm">
          This project will be created as a revision. Configuring revision settings...
        </p>
      </div>
      
      {renderDetectionStatus()}
      {renderCopyOptions()}
      
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
  );
};

export default RevisionDetectionPanel;
