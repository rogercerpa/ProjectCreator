import React from 'react';

const WorkloadTab = ({ settings, setSettings }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span>📊</span>
          <span>Workload Dashboard Settings</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Configure settings for the real-time workload dashboard</p>
        
        <div className="space-y-6">
          {/* Real-Time Sync */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🟢</span>
              <span>Real-Time Sync</span>
            </h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.workloadSettings?.enableRealTimeSync !== false}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    workloadSettings: {
                      ...prev.workloadSettings,
                      enableRealTimeSync: e.target.checked
                    }
                  }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Real-Time Sync</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                Enables WebSocket connections for instant updates
              </p>
            </div>
          </div>

          {/* Shared Folder Path */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📁</span>
              <span>Shared Folder Path</span>
            </h4>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Directory:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.workloadSettings?.dataDirectory || ''}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    workloadSettings: {
                      ...prev.workloadSettings,
                      dataDirectory: e.target.value
                    }
                  }))}
                  placeholder="C:\Users\...\OneDrive\ProjectCreator\Shared"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={async () => {
                    try {
                      if (window.electronAPI && window.electronAPI.selectDirectory) {
                        const result = await window.electronAPI.selectDirectory();
                        if (result) {
                          setSettings(prev => ({
                            ...prev,
                            workloadSettings: {
                              ...prev.workloadSettings,
                              dataDirectory: result
                            }
                          }));
                        }
                      }
                    } catch (error) {
                      console.error('Error selecting directory:', error);
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all whitespace-nowrap"
                >
                  Browse
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Path to shared OneDrive folder for multi-user collaboration
              </p>
            </div>
          </div>

          {/* WebSocket Server */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🔌</span>
              <span>WebSocket Server</span>
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Server URL:</label>
                <input
                  type="text"
                  value={settings.workloadSettings?.websocketServer || 'wss://projectcreatorv5.fly.dev'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    workloadSettings: {
                      ...prev.workloadSettings,
                      websocketServer: e.target.value
                    }
                  }))}
                  placeholder="wss://projectcreatorv5.fly.dev"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="mt-2 p-3 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-200 dark:border-info-800">
                  <p className="text-xs text-info-700 dark:text-info-300">
                    <strong>Important:</strong> Use <code className="px-1 py-0.5 bg-info-100 dark:bg-info-900/40 rounded">wss://</code> for Fly.io (not https://) or <code className="px-1 py-0.5 bg-info-100 dark:bg-info-900/40 rounded">ws://</code> for localhost<br/>
                    <strong>Example:</strong> <code className="px-1 py-0.5 bg-info-100 dark:bg-info-900/40 rounded">wss://projectcreatorv5.fly.dev</code>
                  </p>
                </div>
              </div>
              <div>
                <button
                  onClick={async () => {
                    try {
                      if (window.electronAPI && window.electronAPI.websocketConnect) {
                        let serverUrl = settings.workloadSettings?.websocketServer || 'wss://projectcreatorv5.fly.dev';
                        serverUrl = serverUrl.trim();
                        
                        // Auto-correct common URL mistakes
                        let corrected = false;
                        let correctionMsg = '';
                        
                        if (serverUrl.startsWith('https://')) {
                          const oldUrl = serverUrl;
                          serverUrl = serverUrl.replace('https://', 'wss://');
                          corrected = true;
                          correctionMsg = `Auto-corrected:\n${oldUrl}\n→ ${serverUrl}\n\n`;
                        } else if (serverUrl.startsWith('http://') && !serverUrl.includes('localhost')) {
                          const oldUrl = serverUrl;
                          serverUrl = serverUrl.replace('http://', 'wss://');
                          corrected = true;
                          correctionMsg = `Auto-corrected:\n${oldUrl}\n→ ${serverUrl}\n\n`;
                        }
                        
                        // Update settings with corrected URL
                        if (corrected) {
                          setSettings(prev => ({
                            ...prev,
                            workloadSettings: {
                              ...prev.workloadSettings,
                              websocketServer: serverUrl
                            }
                          }));
                        }
                        
                        const currentUser = JSON.parse(localStorage.getItem('workload-current-user') || '{}');
                        const result = await window.electronAPI.websocketConnect(
                          serverUrl,
                          currentUser.id || 'test-user',
                          currentUser.name || 'Test User'
                        );
                        
                        if (result.success) {
                          alert(correctionMsg + '✅ Connection successful!\n\nServer: ' + serverUrl + '\n\nReal-time features are now active.');
                        } else {
                          alert(correctionMsg + '❌ Connection failed\n\nError: ' + (result.message || result.error || 'Unknown error') + '\n\nTroubleshooting:\n• Verify URL starts with wss:// (not https://)\n• Check server is running\n• Test internet connection');
                        }
                      } else {
                        alert('⚠️ WebSocket API not available. Make sure the app is fully loaded.');
                      }
                    } catch (error) {
                      alert('❌ Connection failed: ' + error.message);
                    }
                  }}
                  className="w-full sm:w-auto px-6 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg shadow transition-all"
                >
                  Test Connection
                </button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🔔</span>
              <span>Notifications</span>
            </h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.workloadSettings?.showNotifications !== false}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    workloadSettings: {
                      ...prev.workloadSettings,
                      showNotifications: e.target.checked
                    }
                  }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Notifications</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.workloadSettings?.onlyMyAssignments === true}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    workloadSettings: {
                      ...prev.workloadSettings,
                      onlyMyAssignments: e.target.checked
                    }
                  }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Only Notify for My Assignments</span>
              </label>
            </div>
          </div>

          {/* Data Management */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🔄</span>
              <span>Data Management</span>
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
};

export default WorkloadTab;
