import React from 'react';

// Access secure electron API through contextBridge
const { electronAPI } = window;

const AdvancedSettingsTab = ({ settings, setSettings }) => {
  return (
    <div className="space-y-6">
      {/* File Paths Configuration Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">File Path Configuration</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Configure where the application looks for template files and saves created projects.</p>
        
        <div className="space-y-6">
          {/* Template Paths */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <span>📁</span>
              <span>Template Source Locations</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Where the application finds template files for project creation</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Primary Template Path:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.pathSettings.templates.primaryPath}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      pathSettings: {
                        ...prev.pathSettings,
                        templates: {
                          ...prev.pathSettings.templates,
                          primaryPath: e.target.value
                        }
                      }
                    }))}
                    placeholder="Network path to templates"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button 
                    type="button" 
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                    onClick={async () => {
                      if (electronAPI && electronAPI.selectFolder) {
                        const result = await electronAPI.selectFolder();
                        if (result && !result.canceled && result.filePaths[0]) {
                          setSettings(prev => ({
                            ...prev,
                            pathSettings: {
                              ...prev.pathSettings,
                              templates: {
                                ...prev.pathSettings.templates,
                                primaryPath: result.filePaths[0]
                              }
                            }
                          }));
                        }
                      }
                    }}
                    title="Browse for folder"
                  >
                    📂
                  </button>
                </div>
              </div>
            
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fallback Template Path:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.pathSettings.templates.fallbackPath}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      pathSettings: {
                        ...prev.pathSettings,
                        templates: {
                          ...prev.pathSettings.templates,
                          fallbackPath: e.target.value
                        }
                      }
                    }))}
                    placeholder="Local fallback path (use {userHome} for user directory)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button 
                    type="button" 
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                    onClick={async () => {
                      if (electronAPI && electronAPI.selectFolder) {
                        const result = await electronAPI.selectFolder();
                        if (result && !result.canceled && result.filePaths[0]) {
                          setSettings(prev => ({
                            ...prev,
                            pathSettings: {
                              ...prev.pathSettings,
                              templates: {
                                ...prev.pathSettings.templates,
                                fallbackPath: result.filePaths[0]
                              }
                            }
                          }));
                        }
                      }
                    }}
                    title="Browse for folder"
                  >
                    📂
                  </button>
                </div>
              </div>
            
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Agent Requirements Path:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.pathSettings.templates.agentRequirementsPath}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      pathSettings: {
                        ...prev.pathSettings,
                        templates: {
                          ...prev.pathSettings.templates,
                          agentRequirementsPath: e.target.value
                        }
                      }
                    }))}
                    placeholder="Path to agent requirements files"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button 
                    type="button" 
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                    onClick={async () => {
                      if (electronAPI && electronAPI.selectFolder) {
                        const result = await electronAPI.selectFolder();
                        if (result && !result.canceled && result.filePaths[0]) {
                          setSettings(prev => ({
                            ...prev,
                            pathSettings: {
                              ...prev.pathSettings,
                              templates: {
                                ...prev.pathSettings.templates,
                                agentRequirementsPath: result.filePaths[0]
                              }
                            }
                          }));
                        }
                      }
                    }}
                    title="Browse for folder"
                  >
                    📂
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Project Output Paths */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <span>💾</span>
              <span>Project Output Locations</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Where created project folders are saved</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Output Location:</label>
                <select
                  value={settings.pathSettings.projectOutput.defaultLocation}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    pathSettings: {
                      ...prev.pathSettings,
                      projectOutput: {
                        ...prev.pathSettings.projectOutput,
                        defaultLocation: e.target.value
                      }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="desktop">Desktop</option>
                  <option value="triage">Triage Folder</option>
                  <option value="custom">Custom Path</option>
                </select>
              </div>
            
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Output Path:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.pathSettings.projectOutput.customPath}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      pathSettings: {
                        ...prev.pathSettings,
                        projectOutput: {
                          ...prev.pathSettings.projectOutput,
                          customPath: e.target.value
                        }
                      }
                    }))}
                    placeholder="Custom project output path (use {userHome} for user directory)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={settings.pathSettings.projectOutput.defaultLocation !== 'custom'}
                  />
                  <button 
                    type="button" 
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (electronAPI && electronAPI.selectFolder) {
                        const result = await electronAPI.selectFolder();
                        if (result && !result.canceled && result.filePaths[0]) {
                          setSettings(prev => ({
                            ...prev,
                            pathSettings: {
                              ...prev.pathSettings,
                              projectOutput: {
                                ...prev.pathSettings.projectOutput,
                                customPath: result.filePaths[0]
                              }
                            }
                          }));
                        }
                      }
                    }}
                    title="Browse for folder"
                    disabled={settings.pathSettings.projectOutput.defaultLocation !== 'custom'}
                  >
                    📂
                  </button>
                </div>
              </div>
            
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Triage Folder Path:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.pathSettings.projectOutput.triagePath}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      pathSettings: {
                        ...prev.pathSettings,
                        projectOutput: {
                          ...prev.pathSettings.projectOutput,
                          triagePath: e.target.value
                        }
                      }
                    }))}
                    placeholder="Path to triage folder (use {userHome} for user directory)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button 
                    type="button" 
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
                    onClick={async () => {
                      if (electronAPI && electronAPI.selectFolder) {
                        const result = await electronAPI.selectFolder();
                        if (result && !result.canceled && result.filePaths[0]) {
                          setSettings(prev => ({
                            ...prev,
                            pathSettings: {
                              ...prev.pathSettings,
                              projectOutput: {
                                ...prev.pathSettings.projectOutput,
                                triagePath: result.filePaths[0]
                              }
                            }
                          }));
                        }
                      }
                    }}
                    title="Browse for folder"
                  >
                    📂
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Path Variables Info */}
          <div className="p-4 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-200 dark:border-info-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>ℹ️</span>
              <span>Path Variables</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <p><strong className="text-info-700 dark:text-info-400">{'{userHome}'}</strong> - Automatically replaced with the current user's home directory</p>
              <p className="text-xs text-gray-600 dark:text-gray-400"><strong>Example:</strong> {'{userHome}\\Desktop'} becomes 'C:\\Users\\YourName\\Desktop'</p>
            </div>
          </div>
        </div>
      </div>

      {/* SharePoint Integration Section - TEMPORARILY HIDDEN */}
      {/* TODO: Re-enable after fixing navigation and verification issues */}
      {false && <div className="sharepoint-section">
        {/* SharePoint content omitted for brevity - it's hidden anyway */}
      </div>}

      {/* OneDrive Sync Integration Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📂</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">OneDrive Sync Integration</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Upload projects to SharePoint via OneDrive sync folder. No authentication required!</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Enable OneDrive Sync */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">🔗</span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Enable OneDrive Sync Upload</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">Use your local OneDrive sync folder to upload projects to SharePoint</p>
              </div>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.oneDriveSyncSettings.enabled}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  oneDriveSyncSettings: {
                    ...prev.oneDriveSyncSettings,
                    enabled: e.target.checked
                  }
                }))}
                className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable OneDrive Sync Integration</span>
            </label>
          </div>

          {/* OneDrive Sync Folder Configuration */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">📁</span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Sync Folder Configuration</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">Select the local OneDrive folder that syncs to your SharePoint library</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">OneDrive Sync Folder Path</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={settings.oneDriveSyncSettings.syncFolderPath}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    oneDriveSyncSettings: {
                      ...prev.oneDriveSyncSettings,
                      syncFolderPath: e.target.value
                    }
                  }))}
                  placeholder="C:\\Users\\...\\OneDrive - Acuity Brands, Inc\\CIDesignSolutions - Shared Documents\\LnT"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!settings.oneDriveSyncSettings.enabled}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (electronAPI && electronAPI.detectOneDriveSync) {
                        const result = await electronAPI.detectOneDriveSync();
                        if (result.success && result.folders && result.folders.length > 0) {
                          const selectedFolder = result.folders[0].path;
                          if (selectedFolder) {
                            setSettings(prev => ({
                              ...prev,
                              oneDriveSyncSettings: {
                                ...prev.oneDriveSyncSettings,
                                syncFolderPath: selectedFolder
                              }
                            }));
                          }
                        } else {
                          alert('No OneDrive sync folders detected. Please manually enter the path or sync your SharePoint library.');
                        }
                      }
                    }}
                    disabled={!settings.oneDriveSyncSettings.enabled}
                  >
                    🔍 Detect
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (electronAPI && electronAPI.browseForSyncFolder) {
                        const result = await electronAPI.browseForSyncFolder();
                        if (result.success && result.folderPath) {
                          setSettings(prev => ({
                            ...prev,
                            oneDriveSyncSettings: {
                              ...prev.oneDriveSyncSettings,
                              syncFolderPath: result.folderPath
                            }
                          }));

                          if (result.verification && result.verification.valid) {
                            alert(`✅ Folder selected successfully!\n\n${result.folderPath}`);
                          }
                        }
                      }
                    }}
                    disabled={!settings.oneDriveSyncSettings.enabled}
                  >
                    📂 Browse
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (electronAPI && electronAPI.testSyncFolder) {
                        const result = await electronAPI.testSyncFolder(settings.oneDriveSyncSettings.syncFolderPath);
                        if (result.success) {
                          alert(`✅ Sync folder test successful!\n\n${result.message}`);
                        } else {
                          alert(`❌ Sync folder test failed!\n\n${result.error}\n\nPlease check the folder path and OneDrive sync status.`);
                        }
                      }
                    }}
                    disabled={!settings.oneDriveSyncSettings.enabled || !settings.oneDriveSyncSettings.syncFolderPath}
                  >
                    ✓ Test
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* File Cleanup Strategy */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">File Cleanup</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Choose how to handle uploaded files in your local OneDrive folder</p>
            </div>

            <div className="space-y-3">
              {/* Auto-delete Option */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="cleanup"
                    value="auto-delete"
                    checked={settings.oneDriveSyncSettings.cleanupStrategy === 'auto-delete'}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      oneDriveSyncSettings: {
                        ...prev.oneDriveSyncSettings,
                        cleanupStrategy: e.target.value
                      }
                    }))}
                    disabled={!settings.oneDriveSyncSettings.enabled}
                    className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Auto-delete after sync verification</span>
                    <span className="block text-xs text-warning-600 dark:text-warning-400">⚠️ Files are removed from OneDrive ONLY after confirmed SharePoint sync (uses PowerShell verification)</span>
                  </div>
                </label>
              </div>

              {/* Keep Recent Option */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="flex items-start gap-3 cursor-pointer mb-3">
                  <input
                    type="radio"
                    name="cleanup"
                    value="keep-recent"
                    checked={settings.oneDriveSyncSettings.cleanupStrategy === 'keep-recent'}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      oneDriveSyncSettings: {
                        ...prev.oneDriveSyncSettings,
                        cleanupStrategy: e.target.value
                      }
                    }))}
                    disabled={!settings.oneDriveSyncSettings.enabled}
                    className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">Keep recent files</span>
                  </div>
                </label>
                <div className="ml-7 flex items-center gap-2">
                  <label className="text-xs text-gray-600 dark:text-gray-400">Keep last</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={settings.oneDriveSyncSettings.keepRecentCount}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      oneDriveSyncSettings: {
                        ...prev.oneDriveSyncSettings,
                        keepRecentCount: parseInt(e.target.value) || 10
                      }
                    }))}
                    className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    disabled={!settings.oneDriveSyncSettings.enabled || settings.oneDriveSyncSettings.cleanupStrategy !== 'keep-recent'}
                  />
                  <label className="text-xs text-gray-600 dark:text-gray-400">files</label>
                </div>
              </div>

              {/* Manual Cleanup Option */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="cleanup"
                    value="manual"
                    checked={settings.oneDriveSyncSettings.cleanupStrategy === 'manual'}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      oneDriveSyncSettings: {
                        ...prev.oneDriveSyncSettings,
                        cleanupStrategy: e.target.value
                      }
                    }))}
                    disabled={!settings.oneDriveSyncSettings.enabled}
                    className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white mb-1">Manual cleanup only (recommended for safety)</span>
                    <span className="block text-xs text-success-600 dark:text-success-400">✅ Files stay in OneDrive - you manage cleanup manually. Safest option.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="p-4 bg-gradient-to-r from-info-50 to-blue-50 dark:from-info-900/20 dark:to-blue-900/20 rounded-lg border border-info-200 dark:border-info-800">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Setup Instructions</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Follow these steps to configure OneDrive sync for SharePoint integration</p>
            </div>
            
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full font-bold text-sm">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Sync SharePoint Library to OneDrive</h3>
                  <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Open your SharePoint site in a browser</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Navigate to the document library (e.g., "Shared Documents")</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Click the "Sync" button in the toolbar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>OneDrive will create a local folder that automatically syncs to SharePoint</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="flex gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full font-bold text-sm">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Configure App to Use Sync Folder</h3>
                  <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Click "Detect" to automatically find your OneDrive sync folder</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Or use "Browse" to manually select the folder</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Click "Test" to verify the folder is syncing properly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>The folder path will look like: <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">C:\Users\YourName\OneDrive - Acuity Brands, Inc\...</code></span>
                    </li>
                  </ul>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="flex gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full font-bold text-sm">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Upload Projects</h3>
                  <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Create a project in the app</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Go to Project Management page</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>Click "Upload to SharePoint" button</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>App will zip the project and copy it to OneDrive</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary-600 dark:text-primary-400 mt-0.5">•</span>
                      <span>OneDrive automatically syncs the file to SharePoint</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DAS General Data Settings Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📖</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">DAS General Data Settings</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure the Excel file path for DAS General team and product data</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* DAS General File Path */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">📁</span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">DAS General Excel File Path</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">The Excel file that stores team members, training materials, and product information</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">File Path</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={settings.dasGeneralSettings?.filePath || 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx'}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    dasGeneralSettings: {
                      ...prev.dasGeneralSettings,
                      filePath: e.target.value
                    }
                  }))}
                  placeholder="Z:\DAS References\ProjectCreatorV5\DASGeneral.xlsx"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all"
                    onClick={async () => {
                      if (electronAPI && electronAPI.dasGeneralSelectFile) {
                        const result = await electronAPI.dasGeneralSelectFile();
                        if (result.success && result.filePath) {
                          setSettings(prev => ({
                            ...prev,
                            dasGeneralSettings: {
                              ...prev.dasGeneralSettings,
                              filePath: result.filePath
                            }
                          }));
                        }
                      }
                    }}
                  >
                    📂 Browse
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all"
                    onClick={async () => {
                      const filePath = settings.dasGeneralSettings?.filePath || 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx';
                      if (electronAPI && electronAPI.dasGeneralCheckAccess) {
                        const result = await electronAPI.dasGeneralCheckAccess(filePath);
                        if (result.success) {
                          alert(`✅ File is accessible!\n\nPath: ${filePath}\nSheets: ${result.sheetNames?.join(', ') || 'Unknown'}`);
                        } else {
                          alert(`❌ ${result.message || 'File is not accessible'}\n\nPath: ${filePath}`);
                        }
                      }
                    }}
                  >
                    ✓ Test
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 rounded-lg transition-all"
                    onClick={async () => {
                      const filePath = settings.dasGeneralSettings?.filePath || 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx';
                      if (window.confirm(`Create a new DAS General file at:\n\n${filePath}\n\nThis will create a new file with default structure. Continue?`)) {
                        if (electronAPI && electronAPI.dasGeneralCreateFile) {
                          const result = await electronAPI.dasGeneralCreateFile(filePath);
                          if (result.success) {
                            alert(`✅ File created successfully!\n\nPath: ${result.filePath}`);
                          } else {
                            alert(`❌ Failed to create file\n\n${result.error || result.message}`);
                          }
                        }
                      }
                    }}
                  >
                    ➕ Create New
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="p-4 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-200 dark:border-info-800">
            <div className="flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p className="font-semibold mb-2">About DAS General Data</p>
                <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <li>• The Excel file contains team member information, training materials, and product details</li>
                  <li>• All users share the same file - changes are immediately visible to everyone</li>
                  <li>• Changes must be saved to the Excel file - if the save fails, changes are not persisted</li>
                  <li>• The default path is on the Z: drive for shared access across the team</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsTab;

