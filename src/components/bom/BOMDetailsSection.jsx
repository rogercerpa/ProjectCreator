import React, { useState, useEffect } from 'react';
import CollapsibleSection from '../shared/CollapsibleSection';
import BOMQCReviewPanel from './BOMQCReviewPanel';

/**
 * BOMDetailsSection - Displays BOM (Bill of Materials) data for a project
 * Shows device breakdown, startup costs, and allows smart/manual upload
 * 
 * @param {Object} project - The project object
 * @param {Function} onProjectUpdate - Callback when project is updated
 * @param {boolean} isExpanded - Controlled expanded state (optional)
 * @param {Function} onToggle - Callback when section is toggled (optional)
 */
const BOMDetailsSection = ({ project, onProjectUpdate, isExpanded: controlledExpanded, onToggle }) => {
  const [bomData, setBomData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'searching', 'found', 'not-found', 'parsing', 'error'
  const [uploadMessage, setUploadMessage] = useState('');
  const [showDeviceTable, setShowDeviceTable] = useState(false);
  const [notification, setNotification] = useState(null);
  const [suggestedPath, setSuggestedPath] = useState(null);
  const [qcScore, setQcScore] = useState(null);

  // Load QC status for header indicator
  useEffect(() => {
    if (project?.qcAnalysis?.summary) {
      setQcScore(project.qcAnalysis.summary.score);
    } else {
      setQcScore(null);
    }
  }, [project?.qcAnalysis]);

  // Load BOM data when project changes
  useEffect(() => {
    const loadBOMData = async () => {
      if (!project?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await window.electronAPI.bomGetProjectData(project.id);
        if (result.success && result.hasBOM) {
          setBomData(result.bomData);
        } else {
          setBomData(null);
        }
      } catch (error) {
        console.error('Error loading BOM data:', error);
        setBomData(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadBOMData();
  }, [project?.id, project?.bomData]);

  // Smart BOM upload - auto-detects from DAS path, falls back to manual
  const handleSmartUpload = async () => {
    try {
      setIsUploading(true);
      setSuggestedPath(null);
      setUploadStatus('searching');
      setUploadMessage('Looking for BOM in project folder...');

      // Try smart upload (auto-detects from DAS path)
      const result = await window.electronAPI.bomSmartUpload(project);

      if (result.success) {
        // BOM was auto-imported successfully
        setUploadStatus('found');
        setUploadMessage(`Found and imported BOM: ${result.stats?.totalDevices || 0} devices`);
        
        setBomData(result.bomData);
        
        if (onProjectUpdate && result.project) {
          onProjectUpdate(result.project);
        }

        setNotification({
          type: 'success',
          message: `BOM auto-imported: ${result.stats?.totalDevices || 0} devices${result.stats?.startupCost ? `, $${result.stats.startupCost.toLocaleString()} startup cost` : ''}`
        });

        // Clear status after a moment
        setTimeout(() => {
          setUploadStatus(null);
          setUploadMessage('');
        }, 3000);

      } else if (result.requiresManualSelection) {
        // Auto-import failed, need manual selection
        setUploadStatus('not-found');
        setUploadMessage(result.reason || 'BOM file not found automatically');
        setSuggestedPath(result.suggestedPath || result.projectPath);

        // Show info about where to look
        setNotification({
          type: 'info',
          message: result.reason || 'Could not find BOM automatically. Please select the file manually.'
        });

      } else {
        throw new Error(result.error || 'Smart upload failed');
      }

    } catch (error) {
      console.error('Error in smart BOM upload:', error);
      setUploadStatus('error');
      setUploadMessage(error.message || 'Upload failed');
      setNotification({
        type: 'error',
        message: error.message || 'Failed to upload BOM'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Manual BOM file upload (with optional starting path)
  const handleManualUpload = async (startPath = null) => {
    try {
      setIsUploading(true);
      setUploadStatus('parsing');
      setUploadMessage('Select BOM file...');

      // If we have a suggested path, try to open it first
      if (startPath) {
        try {
          await window.electronAPI.bomOpenFolder(startPath);
          // Give user a moment to see the folder
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.log('Could not open suggested folder:', e);
        }
      }

      // Open file picker
      const fileResult = await window.electronAPI.bomSelectFile();
      if (!fileResult.success || fileResult.canceled) {
        setUploadStatus(null);
        setUploadMessage('');
        setIsUploading(false);
        return;
      }

      setUploadMessage('Parsing BOM file...');

      // Parse the selected file
      const parseResult = await window.electronAPI.bomParseFile(fileResult.filePath);
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse BOM file');
      }

      // Check for warnings
      if (parseResult.validation?.warnings?.length > 0) {
        console.warn('BOM parsing warnings:', parseResult.validation.warnings);
      }

      setUploadMessage('Saving BOM data...');

      // Save to project
      const saveResult = await window.electronAPI.bomSaveToProject(project.id, parseResult.bomData);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save BOM data');
      }

      // Update local state
      setBomData(parseResult.bomData);
      setSuggestedPath(null);
      setUploadStatus(null);
      setUploadMessage('');
      
      // Notify parent component
      if (onProjectUpdate && saveResult.project) {
        onProjectUpdate(saveResult.project);
      }

      setNotification({
        type: 'success',
        message: `BOM imported: ${parseResult.bomData.totalDevices} devices, ${parseResult.bomData.totalLineItems} line items`
      });

    } catch (error) {
      console.error('Error uploading BOM:', error);
      setUploadStatus('error');
      setUploadMessage(error.message);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to upload BOM file'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle BOM removal
  const handleRemoveBOM = async () => {
    if (!window.confirm('Are you sure you want to remove the BOM data from this project?')) {
      return;
    }

    try {
      const result = await window.electronAPI.bomRemoveFromProject(project.id);
      if (result.success) {
        setBomData(null);
        setNotification({
          type: 'success',
          message: 'BOM data removed'
        });
      } else {
        throw new Error(result.error || 'Failed to remove BOM data');
      }
    } catch (error) {
      console.error('Error removing BOM:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to remove BOM data'
      });
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    if (!value && value !== 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Clear notification after timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Render upload status message
  const renderUploadStatus = () => {
    if (!uploadStatus) return null;

    const statusConfig = {
      searching: { icon: '🔍', color: 'blue' },
      found: { icon: '✅', color: 'green' },
      'not-found': { icon: '⚠️', color: 'amber' },
      parsing: { icon: '⏳', color: 'blue' },
      error: { icon: '❌', color: 'red' }
    };

    const config = statusConfig[uploadStatus] || statusConfig.searching;

    return (
      <div className={`flex items-center gap-2 text-sm text-${config.color}-600 dark:text-${config.color}-400`}>
        <span>{config.icon}</span>
        <span>{uploadMessage}</span>
        {uploadStatus === 'searching' && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
      </div>
    );
  };

  // Build header extra content (device count + QC badge or "No BOM uploaded")
  const headerExtra = bomData ? (
    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
      <span>({bomData.totalDevices} devices)</span>
      {qcScore !== null && (
        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
          qcScore >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : qcScore >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          QC {qcScore}%
        </span>
      )}
    </span>
  ) : !isLoading ? (
    <span className="text-sm text-gray-400 dark:text-gray-500 italic">
      No BOM uploaded
    </span>
  ) : null;

  // Build header action buttons
  const headerActions = (
    <>
      {!bomData && !isLoading && (
        <button
          onClick={handleSmartUpload}
          disabled={isUploading}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Searching...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Auto Upload BOM</span>
            </>
          )}
        </button>
      )}
      {bomData && (
        <button
          onClick={handleManualUpload}
          disabled={isUploading}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <span>📤</span>
          <span>Replace BOM</span>
        </button>
      )}
    </>
  );

  return (
    <CollapsibleSection
      title="BOM Data"
      icon="📦"
      isExpanded={controlledExpanded}
      onToggle={onToggle}
      headerExtra={headerExtra}
      headerActions={headerActions}
    >
      {/* Notification Toast */}
      {notification && (
        <div className={`mb-4 mt-4 p-3 rounded-md ${
          notification.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : notification.type === 'info'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Content */}
      <div className="pt-4">
          {isLoading ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading BOM data...
            </div>
          ) : !bomData ? (
            <div className="py-6">
              {/* Upload Status */}
              {uploadStatus && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  {renderUploadStatus()}
                </div>
              )}

              {/* Not found - show manual upload option */}
              {uploadStatus === 'not-found' && suggestedPath && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📁</span>
                    <div className="flex-1">
                      <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                        BOM file not found automatically
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                        The BOM CHECK folder was not found in the expected location. You can manually select the BOM file.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleManualUpload(suggestedPath)}
                          className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 flex items-center gap-1"
                        >
                          <span>📂</span>
                          <span>Browse Project Folder</span>
                        </button>
                        <button
                          onClick={() => handleManualUpload()}
                          className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center gap-1"
                        >
                          <span>📤</span>
                          <span>Select Any File</span>
                        </button>
                        <button
                          onClick={() => {
                            setUploadStatus(null);
                            setSuggestedPath(null);
                          }}
                          className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Default empty state */}
              {!uploadStatus && (
                <div className="text-center">
                  <div className="text-4xl mb-3">📦</div>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No BOM data available for this project.
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                    Click "Auto Upload BOM" to automatically find and import the BOM file from the project's DAS folder,
                    or manually upload a CSV/XML file from Visual Controls.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleSmartUpload}
                      disabled={isUploading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>🔍</span>
                      <span>Auto Upload BOM</span>
                    </button>
                    <button
                      onClick={() => handleManualUpload()}
                      disabled={isUploading}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      <span>📤</span>
                      <span>Manual Upload</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-4 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {bomData.totalDevices?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-blue-600/70 dark:text-blue-400/70">Total Devices</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {bomData.totalLineItems?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-green-600/70 dark:text-green-400/70">Line Items</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {bomData.totalWireItems?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-purple-600/70 dark:text-purple-400/70">Wire Items</div>
                </div>
                {bomData.startupCosts?.total > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(bomData.startupCosts.total)}
                    </div>
                    <div className="text-sm text-amber-600/70 dark:text-amber-400/70">Startup Cost</div>
                  </div>
                )}
              </div>

              {/* Startup Cost Breakdown */}
              {bomData.startupCosts && bomData.startupCosts.total > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Startup Cost Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {bomData.startupCosts.systemStartup > 0 && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">System Startup</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(bomData.startupCosts.systemStartup)}
                        </div>
                      </div>
                    )}
                    {bomData.startupCosts.onsiteTraining > 0 && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Onsite Training</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(bomData.startupCosts.onsiteTraining)}
                        </div>
                      </div>
                    )}
                    {bomData.startupCosts.preconstructionMeeting > 0 && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Preconstruction</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(bomData.startupCosts.preconstructionMeeting)}
                        </div>
                      </div>
                    )}
                    {bomData.startupCosts.other > 0 && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Other Services</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(bomData.startupCosts.other)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Product Family Breakdown */}
              {bomData.productFamilySummary && Object.keys(bomData.productFamilySummary).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Product Family Breakdown</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(bomData.productFamilySummary)
                      .sort((a, b) => b[1].quantity - a[1].quantity)
                      .map(([family, data]) => (
                        <div key={family} className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                          <div className="font-medium text-gray-900 dark:text-white truncate" title={family}>
                            {family}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {data.quantity?.toLocaleString() || 0} devices • {data.lineItems || 0} items
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Device Table Toggle */}
              <div>
                <button
                  onClick={() => setShowDeviceTable(!showDeviceTable)}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <svg 
                    className={`w-4 h-4 transition-transform ${showDeviceTable ? 'rotate-90' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {showDeviceTable ? 'Hide' : 'Show'} Device Details ({bomData.devices?.length || 0} items)
                </button>

                {showDeviceTable && bomData.devices && (
                  <div className="mt-3 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Catalog #</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Family</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {bomData.devices.map((device, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-3 py-2 text-sm font-mono text-gray-900 dark:text-white whitespace-nowrap">
                              {device.catalogNumber}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={device.description}>
                              {device.description}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-right font-medium">
                              {device.quantity?.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {device.productFamily}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Import Info */}
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-600">
                <div>
                  <span className="font-medium">Source:</span> {bomData.sourceFile || 'Unknown'}
                  <span className="mx-2">•</span>
                  <span className="font-medium">Type:</span> {bomData.sourceType?.toUpperCase() || 'Unknown'}
                </div>
                <div className="flex items-center gap-4">
                  <span>Imported: {formatDate(bomData.importedAt)}</span>
                  <button
                    onClick={handleRemoveBOM}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Remove BOM data"
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>

              {/* QC Review Panel */}
              <BOMQCReviewPanel
                project={project}
                bomData={bomData}
                onProjectUpdate={(updatedProject) => {
                  if (updatedProject?.qcAnalysis?.summary) {
                    setQcScore(updatedProject.qcAnalysis.summary.score);
                  }
                  if (onProjectUpdate) onProjectUpdate(updatedProject);
                }}
              />
            </div>
          )}
        </div>
    </CollapsibleSection>
  );
};

export default BOMDetailsSection;
