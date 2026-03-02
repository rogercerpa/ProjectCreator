import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';

const WorkloadTab = forwardRef(({ settings, setSettings }, ref) => {
  const [excelSettings, setExcelSettings] = useState({
    enabled: false,
    mode: 'manual',
    filePath: '',
    msListsUrl: '',
    lastSync: null,
    lastExport: null
  });
  const [syncStatus, setSyncStatus] = useState(null);
  const [filePathValid, setFilePathValid] = useState(null);
  
  // Use a ref to always have access to the latest excelSettings
  const excelSettingsRef = useRef(excelSettings);
  
  // Keep ref in sync with state
  useEffect(() => {
    excelSettingsRef.current = excelSettings;
  }, [excelSettings]);

  // Expose current settings and save function to parent via ref
  useImperativeHandle(ref, () => ({
    getCurrentSettings: () => excelSettingsRef.current,
    saveSettings: async () => {
      // Always use the latest settings from ref
      return await handleExcelSettingsUpdate(excelSettingsRef.current);
    }
  }));

  // Load Excel sync settings on mount
  useEffect(() => {
    loadExcelSyncSettings();
  }, []);

  const loadExcelSyncSettings = async () => {
    try {
      if (window.electronAPI?.workloadExcelSyncSettingsGet) {
        const result = await window.electronAPI.workloadExcelSyncSettingsGet();
        if (result.success) {
          setExcelSettings(result.settings);
        }
      }
    } catch (error) {
      console.error('Error loading Excel sync settings:', error);
    }
  };

  const handleExcelSettingsUpdate = async (newSettings) => {
    try {
      if (window.electronAPI?.workloadExcelSyncSettingsUpdate) {
        const result = await window.electronAPI.workloadExcelSyncSettingsUpdate(newSettings);
        if (result.success) {
          setExcelSettings(result.settings);
          setSyncStatus({ type: 'success', message: 'Settings saved successfully' });
          setTimeout(() => setSyncStatus(null), 3000);
          return result;
        } else {
          setSyncStatus({ type: 'error', message: result.error || 'Failed to save settings' });
          return result;
        }
      }
      return { success: false, error: 'API not available' };
    } catch (error) {
      console.error('Error updating Excel sync settings:', error);
      setSyncStatus({ type: 'error', message: error.message });
      return { success: false, error: error.message };
    }
  };

  const handleBrowseExcelFile = async () => {
    try {
      if (window.electronAPI?.workloadExcelBrowseFile) {
        const result = await window.electronAPI.workloadExcelBrowseFile();
        if (result.success && result.filePath) {
          setExcelSettings(prev => ({ ...prev, filePath: result.filePath }));
          setFilePathValid(null);
        }
      }
    } catch (error) {
      console.error('Error browsing for Excel file:', error);
    }
  };

  const handleTestFilePath = async (filePath) => {
    try {
      if (window.electronAPI?.workloadExcelTestFilePath) {
        const result = await window.electronAPI.workloadExcelTestFilePath(filePath);
        setFilePathValid(result.success);
        if (result.success) {
          setSyncStatus({ type: 'success', message: 'File path is valid and accessible' });
        } else {
          setSyncStatus({ type: 'error', message: result.error });
        }
        setTimeout(() => setSyncStatus(null), 3000);
      }
    } catch (error) {
      console.error('Error testing file path:', error);
      setFilePathValid(false);
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  const handleManualSync = async () => {
    try {
      if (window.electronAPI?.workloadExcelSyncFromExcel) {
        setSyncStatus({ type: 'loading', message: 'Syncing from Excel...' });
        const result = await window.electronAPI.workloadExcelSyncFromExcel(excelSettings.filePath);
        if (result.success) {
          const data = result.data || {};
          setSyncStatus({
            type: 'success',
            message: `Successfully synced: ${(data.projects || []).length} projects, ${(data.assignments || []).length} assignments, ${(data.users || []).length} users`
          });
          await loadExcelSyncSettings(); // Reload settings to get updated lastSync time
        } else {
          setSyncStatus({ type: 'error', message: result.error || 'Sync failed' });
        }
        setTimeout(() => setSyncStatus(null), 5000);
      }
    } catch (error) {
      console.error('Error syncing from Excel:', error);
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  const handleInitializeWorkbook = async () => {
    try {
      if (window.electronAPI?.workloadExcelInitializeWorkbook) {
        if (!excelSettings.filePath) {
          setSyncStatus({ type: 'error', message: 'Please specify an Excel file path first' });
          setTimeout(() => setSyncStatus(null), 3000);
          return;
        }
        
        setSyncStatus({ type: 'loading', message: 'Creating Excel template...' });
        const result = await window.electronAPI.workloadExcelInitializeWorkbook(excelSettings.filePath);
        
        if (result.success) {
          setSyncStatus({ type: 'success', message: 'Excel template created successfully with all required sheets!' });
          setFilePathValid(true);
          await loadExcelSyncSettings();
        } else {
          setSyncStatus({ type: 'error', message: result.error || 'Failed to create template' });
        }
        setTimeout(() => setSyncStatus(null), 5000);
      }
    } catch (error) {
      console.error('Error initializing workbook:', error);
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  const handleExportToExcel = async () => {
    try {
      if (window.electronAPI?.workloadExcelExportAll) {
        setSyncStatus({ type: 'loading', message: 'Exporting to Excel...' });
        
        // Load all data to export
        const projects = await window.electronAPI.projectsLoadAll();
        const assignments = await window.electronAPI.workloadAssignmentsLoadAll();
        const users = await window.electronAPI.workloadUsersLoadAll();
        
        const data = {
          projects: projects.success ? projects.projects : [],
          assignments: assignments.success ? assignments.assignments : [],
          users: users.success ? users.users : []
        };
        
        const result = await window.electronAPI.workloadExcelExportAll(data, excelSettings.filePath);
        if (result.success) {
          setSyncStatus({ type: 'success', message: `Successfully exported: ${result.results.projects} projects, ${result.results.assignments} assignments, ${result.results.users} users` });
          await loadExcelSyncSettings(); // Reload settings to get updated lastExport time
        } else {
          setSyncStatus({ type: 'error', message: result.error || 'Export failed' });
        }
        setTimeout(() => setSyncStatus(null), 5000);
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setSyncStatus({ type: 'error', message: error.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* MS 365 Excel Integration */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span>📊</span>
          <span>MS 365 Excel Integration</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Sync workload data with Excel and MS Lists for enhanced collaboration
        </p>

        <div className="space-y-6">
          {/* Enable Excel Sync */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>⚙️</span>
              <span>Excel Sync Feature</span>
            </h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excelSettings.enabled}
                  onChange={(e) => {
                    const newSettings = { ...excelSettings, enabled: e.target.checked };
                    setExcelSettings(newSettings);
                    handleExcelSettingsUpdate(newSettings);
                  }}
                  className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Excel Sync</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                Enable synchronization between this app and an Excel workload file
              </p>
            </div>
          </div>

          {/* Excel File Path */}
          {excelSettings.enabled && (
            <>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>📁</span>
                  <span>Excel File Configuration</span>
                </h4>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Excel File Path:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={excelSettings.filePath}
                      onChange={(e) => {
                        setExcelSettings(prev => ({ ...prev, filePath: e.target.value }));
                        setFilePathValid(null);
                      }}
                      placeholder="C:\Users\...\Workload.xlsx"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                        filePathValid === false ? 'border-red-500 dark:border-red-500' :
                        filePathValid === true ? 'border-green-500 dark:border-green-500' :
                        'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    <button
                      onClick={handleBrowseExcelFile}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all whitespace-nowrap"
                      title="Browse to select an existing file or create a new one"
                    >
                      Browse / Create
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {excelSettings.filePath ? (
                      <>
                        <button
                          onClick={handleInitializeWorkbook}
                          className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all font-medium shadow-md"
                          title="Create Excel file with proper structure (Projects, Assignments, Users, TimeTracking sheets)"
                        >
                          ✨ Create Template
                        </button>
                        <button
                          onClick={() => handleTestFilePath(excelSettings.filePath)}
                          className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all"
                        >
                          Test Path
                        </button>
                        <button
                          onClick={() => handleExcelSettingsUpdate(excelSettings)}
                          className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded-lg transition-all"
                        >
                          Save Path
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Enter a file path above, then click "Create Template" to generate the Excel file with proper structure
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Path to the Excel file for workload data synchronization. Use "Browse / Create" to select an existing file or create a new one. Then click "Create Template" to generate the file with all required sheets (Projects, Assignments, Users, TimeTracking).
                  </p>
                </div>
              </div>

              {/* MS Lists Integration */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>📋</span>
                  <span>MS Lists Integration</span>
                </h4>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">MS Lists URL:</label>
                  <input
                    type="text"
                    value={excelSettings.msListsUrl}
                    onChange={(e) => {
                      const newSettings = { ...excelSettings, msListsUrl: e.target.value };
                      setExcelSettings(newSettings);
                    }}
                    onBlur={() => handleExcelSettingsUpdate(excelSettings)}
                    placeholder="https://yourcompany.sharepoint.com/sites/..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    URL to your MS Lists workload list (engineers will use this to view and update assignments)
                  </p>
                  {excelSettings.msListsUrl && (
                    <button
                      onClick={() => window.electronAPI?.openExternal(excelSettings.msListsUrl)}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                    >
                      Open in MS Lists
                    </button>
                  )}
                </div>
              </div>

              {/* Sync Mode */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>🔄</span>
                  <span>Sync Mode</span>
                </h4>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 border-gray-200 dark:border-gray-600">
                    <input
                      type="radio"
                      name="syncMode"
                      value="manual"
                      checked={excelSettings.mode === 'manual'}
                      onChange={(e) => {
                        const newSettings = { ...excelSettings, mode: e.target.value };
                        setExcelSettings(newSettings);
                        handleExcelSettingsUpdate(newSettings);
                      }}
                      className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div>
                      <span className="block font-medium text-gray-900 dark:text-white">Manual Trigger</span>
                      <span className="block text-sm text-gray-600 dark:text-gray-400">Click "Sync Now" button to import when ready</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 border-gray-200 dark:border-gray-600">
                    <input
                      type="radio"
                      name="syncMode"
                      value="auto"
                      checked={excelSettings.mode === 'auto'}
                      onChange={(e) => {
                        const newSettings = { ...excelSettings, mode: e.target.value };
                        setExcelSettings(newSettings);
                        handleExcelSettingsUpdate(newSettings);
                      }}
                      className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div>
                      <span className="block font-medium text-gray-900 dark:text-white">Automatic Monitoring</span>
                      <span className="block text-sm text-gray-600 dark:text-gray-400">Automatically detect and sync when Excel file changes</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sync Actions */}
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <span>⚡</span>
                  <span>Sync Actions</span>
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleManualSync}
                      disabled={!excelSettings.filePath || filePathValid === false}
                      className="flex-1 px-6 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sync Now (Import from Excel)
                    </button>
                    <button
                      onClick={handleExportToExcel}
                      disabled={!excelSettings.filePath || filePathValid === false}
                      className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Export to Excel
                    </button>
                  </div>
                  {excelSettings.lastSync && (
                    <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                      Last import: {new Date(excelSettings.lastSync).toLocaleString()}
                    </p>
                  )}
                  {excelSettings.lastExport && (
                    <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                      Last export: {new Date(excelSettings.lastExport).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Sync Status */}
              {syncStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  syncStatus.type === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
                  syncStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800' :
                  syncStatus.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' :
                  'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                }`}>
                  {syncStatus.type === 'loading' && <span className="inline-block animate-spin mr-2">⏳</span>}
                  {syncStatus.message}
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-200 dark:border-info-800">
                <h4 className="text-sm font-semibold text-info-900 dark:text-info-100 mb-2">💡 How It Works</h4>
                <ul className="text-xs text-info-700 dark:text-info-300 space-y-1 list-disc list-inside">
                  <li>Create projects in this app → Click "Export to Excel" to push data</li>
                  <li>Set up Power Automate flow to sync Excel ↔ MS Lists</li>
                  <li>Engineers use MS Lists to view workload and update status</li>
                  <li>Click "Sync Now" to pull updates from Excel back to app</li>
                  <li>Or enable "Automatic Monitoring" for hands-free sync</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span>⚙️</span>
          <span>Data Management</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Manage your workload data and backups</p>
        
        <div className="space-y-6">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>💾</span>
              <span>Backup Operations</span>
            </h4>
            <div className="flex items-center gap-3">
              <button 
                onClick={async () => {
                  try {
                    if (window.electronAPI && window.electronAPI.workloadBackupCreate) {
                      const result = await window.electronAPI.workloadBackupCreate();
                      if (result.success) {
                        alert('✅ Backup created successfully!\n\nPath: ' + result.backupPath);
                      } else {
                        alert('❌ Backup failed: ' + result.error);
                      }
                    } else {
                      alert('⚠️ Backup API not available. Make sure the app is fully loaded.');
                    }
                  } catch (error) {
                    alert('❌ Backup failed: ' + error.message);
                  }
                }}
                className="px-6 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg shadow transition-all"
              >
                Create Backup
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Create a backup of all workload data
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

WorkloadTab.displayName = 'WorkloadTab';

export default WorkloadTab;
