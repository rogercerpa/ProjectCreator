import React, { useState, useEffect } from 'react';

/**
 * BOMDetailsSection - Displays BOM (Bill of Materials) data for a project
 * Shows device breakdown, startup costs, and allows manual upload
 */
const BOMDetailsSection = ({ project, onProjectUpdate }) => {
  const [bomData, setBomData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDeviceTable, setShowDeviceTable] = useState(false);
  const [notification, setNotification] = useState(null);

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

  // Handle manual BOM file upload
  const handleUploadBOM = async () => {
    try {
      // Open file picker
      const fileResult = await window.electronAPI.bomSelectFile();
      if (!fileResult.success || fileResult.canceled) {
        return;
      }

      setIsUploading(true);

      // Parse the selected file
      const parseResult = await window.electronAPI.bomParseFile(fileResult.filePath);
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Failed to parse BOM file');
      }

      // Check for warnings
      if (parseResult.validation?.warnings?.length > 0) {
        console.warn('BOM parsing warnings:', parseResult.validation.warnings);
      }

      // Save to project
      const saveResult = await window.electronAPI.bomSaveToProject(project.id, parseResult.bomData);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save BOM data');
      }

      // Update local state
      setBomData(parseResult.bomData);
      
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
      {/* Section Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">📦</span>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            BOM Data
          </h3>
          {bomData && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({bomData.totalDevices} devices)
            </span>
          )}
          {!bomData && !isLoading && (
            <span className="text-sm text-gray-400 dark:text-gray-500 italic">
              No BOM uploaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleUploadBOM();
            }}
            disabled={isUploading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isUploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <span>📤</span>
                <span>{bomData ? 'Replace BOM' : 'Upload BOM'}</span>
              </>
            )}
          </button>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`mx-4 mb-2 p-3 rounded-md ${
          notification.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          {isLoading ? (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading BOM data...
            </div>
          ) : !bomData ? (
            <div className="py-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No BOM data available for this project.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Upload a CSV or XML file from Visual Controls to add BOM data.
              </p>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BOMDetailsSection;
