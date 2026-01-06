import React from 'react';

const AgenciesTab = ({
  syncSettings,
  setSyncSettings,
  handleSyncSettingsUpdate,
  filePathValid,
  setFilePathValid,
  handleBrowseFilePath,
  handleFilePathTest,
  handleManualSync,
  handleExcelImport,
  handleExcelDiagnose,
  importStatus,
  syncStatus,
  handleExportToExcel,
  exportStatus,
  showAgencyForm,
  setShowAgencyForm,
  editingAgency,
  setEditingAgency,
  agencyFormData,
  setAgencyFormData,
  handleAgencyFormSubmit,
  agencies,
  agencySearchTerm,
  setAgencySearchTerm,
  agencyFilters,
  handleAgencyFilterChange,
  agencyFilterOptions,
  filteredAgencies,
  getPaginatedAgencies,
  handleEditAgency,
  handleDeleteAgency,
  renderPagination,
  getPaginationInfo,
  isEditModalOpen,
  handleModalClose,
  editingAgencyModal,
  handleModalSave,
  AgencyEditModal,
  regionalTeams,
  assignedToOptions
}) => {
  return (
    <div className="space-y-6">
      {/* Auto-Sync Configuration Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Auto-Sync Configuration</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Configure automatic sync with your Excel file</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Excel Sync Feature Card */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">⚙️</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Excel Sync Feature</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable Excel synchronization for agency data</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncSettings.enabled}
                  onChange={(e) => {
                    const newSettings = { ...syncSettings, enabled: e.target.checked };
                    setSyncSettings(newSettings);
                    handleSyncSettingsUpdate(newSettings);
                  }}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Excel Sync</span>
              </label>
              <div className={`p-3 rounded-lg text-sm ${
                syncSettings.enabled 
                  ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
              }`}>
                {syncSettings.enabled 
                  ? '✅ Sync feature is active - Configure sync mode below'
                  : '❌ Sync feature is disabled - Manual import available'
                }
              </div>
            </div>
          </div>

          {/* Manual Import Card */}
          <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${
            syncSettings.enabled ? 'opacity-50' : ''
          }`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">📥</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Manual Import</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {syncSettings.enabled 
                    ? 'Disabled when Excel Sync is enabled - Use sync mode instead'
                    : 'One-time import of agency data from Excel file'
                  }
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <button 
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExcelImport}
                  disabled={syncSettings.enabled}
                >
                  📂 Import Excel
                </button>
                <button 
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExcelDiagnose}
                  disabled={syncSettings.enabled}
                >
                  🔍 Diagnose Excel
                </button>
              </div>
              
              {/* Import Status */}
              {importStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  importStatus.type === 'loading' ? 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800' :
                  importStatus.type === 'success' ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800' :
                  importStatus.type === 'error' ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 border border-error-200 dark:border-error-800' :
                  'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                }`}>
                  {importStatus.type === 'loading' && <span className="inline-block animate-spin mr-2">⏳</span>}
                  {importStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sync Mode Card - Only visible when sync is enabled */}
        {syncSettings.enabled && (
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-primary-200 dark:border-primary-800 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">🔄</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Sync Trigger Mode</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Choose when to sync data from Excel file</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 border-gray-200 dark:border-gray-600">
                  <input
                    type="radio"
                    name="syncMode"
                    value="manual"
                    checked={syncSettings.mode === 'manual'}
                    onChange={(e) => {
                      const newSettings = { ...syncSettings, mode: e.target.value };
                      setSyncSettings(newSettings);
                      handleSyncSettingsUpdate(newSettings);
                    }}
                    className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <span className="block font-medium text-gray-900 dark:text-white">Manual Trigger</span>
                    <span className="block text-sm text-gray-600 dark:text-gray-400">Click "Sync Now" button to import when you're ready</span>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-900/20 border-gray-200 dark:border-gray-600">
                  <input
                    type="radio"
                    name="syncMode"
                    value="auto"
                    checked={syncSettings.mode === 'auto'}
                    onChange={(e) => {
                      const newSettings = { ...syncSettings, mode: e.target.value };
                      setSyncSettings(newSettings);
                      handleSyncSettingsUpdate(newSettings);
                    }}
                    className="mt-0.5 w-4 h-4 text-primary-600 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <span className="block font-medium text-gray-900 dark:text-white">Automatic Monitoring</span>
                    <span className="block text-sm text-gray-600 dark:text-gray-400">Automatically detect and sync when Excel file changes</span>
                  </div>
                </label>
              </div>
              <div className="p-3 bg-info-50 dark:bg-info-900/20 rounded-lg border border-info-200 dark:border-info-800 text-sm text-info-700 dark:text-info-300">
                💡 {syncSettings.mode === 'manual' 
                  ? 'With manual trigger, the Excel file path is configured, but syncing only happens when you click the "Sync Now" button below.'
                  : 'With automatic monitoring, the app watches your Excel file and syncs data automatically whenever changes are detected.'
                }
              </div>
            </div>
          </div>
        )}

        {/* Excel File Path Card */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-2xl">📁</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Excel File Path</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Select the Excel file to sync with</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">File Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={syncSettings.filePath}
                onChange={(e) => {
                  const newSettings = { ...syncSettings, filePath: e.target.value };
                  setSyncSettings(newSettings);
                  setFilePathValid(null);
                }}
                placeholder="Enter or browse to select Excel file path..."
                className={`flex-1 px-3 py-2 border rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  filePathValid === false ? 'border-error-500 dark:border-error-500' :
                  filePathValid === true ? 'border-success-500 dark:border-success-500' :
                  'border-gray-300 dark:border-gray-600'
                }`}
              />
              <button 
                type="button"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all whitespace-nowrap"
                onClick={handleBrowseFilePath}
              >
                📁 Browse
              </button>
            </div>
            {syncSettings.filePath && (
              <div className="flex gap-2">
                <button 
                  type="button"
                  className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all"
                  onClick={() => handleFilePathTest(syncSettings.filePath)}
                >
                  🔍 Test Path
                </button>
                <button 
                  type="button"
                  className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all"
                  onClick={() => {
                    const newSettings = { ...syncSettings, filePath: syncSettings.filePath };
                    handleSyncSettingsUpdate(newSettings);
                  }}
                >
                  💾 Save Path
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sync Now Button */}
        {syncSettings.filePath && (
          <div className="flex flex-col items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <button 
              type="button"
              className="w-full sm:w-auto px-8 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleManualSync}
              disabled={!syncSettings.filePath || filePathValid === false}
            >
              🔄 Sync Now
            </button>
            {syncSettings.lastSync && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Last sync: {new Date(syncSettings.lastSync).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Sync Status */}
        {syncStatus && (
          <div className={`p-3 rounded-lg text-sm mt-4 ${
            syncStatus.type === 'loading' ? 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800' :
            syncStatus.type === 'success' ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800' :
            syncStatus.type === 'error' ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 border border-error-200 dark:border-error-800' :
            'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
          }`}>
            {syncStatus.type === 'loading' && <span className="inline-block animate-spin mr-2">⏳</span>}
            {syncStatus.message}
          </div>
        )}
      </div>

      {/* Agency Management Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6 flex items-start gap-3">
          <div className="text-3xl">🏢</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Agency Management</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Export agency data to Excel or manually add new agencies to the system</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Export to Excel Card */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">📊</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Export to Excel</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Export all agency data to the configured Excel file</p>
              </div>
            </div>
            <div className="space-y-3">
              {syncSettings.filePath ? (
                <>
                  <button 
                    type="button"
                    className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleExportToExcel}
                    disabled={!syncSettings.filePath || filePathValid === false}
                  >
                    📊 Export to Excel
                  </button>
                  {syncSettings.lastExport && (
                    <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                      Last export: {new Date(syncSettings.lastExport).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800 text-center">
                  <span className="text-2xl block mb-2">⚠️</span>
                  <p className="text-sm text-warning-700 dark:text-warning-300">Configure Excel file path above to enable export</p>
                </div>
              )}
            </div>
          </div>

          {/* Add New Agency Card */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">➕</div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Add New Agency</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manually add a new agency to the system database</p>
              </div>
            </div>
            <div className="space-y-3">
              <button 
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all"
                onClick={() => {
                  setShowAgencyForm(true);
                  setEditingAgency(null);
                  setAgencyFormData({
                    agencyNumber: '',
                    agencyName: '',
                    contactName: '',
                    contactEmail: '',
                    phoneNumber: '',
                    role: '',
                    region: '',
                    mainContact: '',
                    sae: 'No'
                  });
                }}
              >
                ➕ Add New Agency
              </button>
              <p className="text-xs text-center text-gray-600 dark:text-gray-400">
                💡 Add agencies manually when not syncing from Excel
              </p>
            </div>
          </div>
        </div>

        {/* Export Status */}
        {exportStatus && (
          <div className={`p-3 rounded-lg text-sm ${
            exportStatus.type === 'loading' ? 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800' :
            exportStatus.type === 'success' ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800' :
            exportStatus.type === 'error' ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300 border border-error-200 dark:border-error-800' :
            'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
          }`}>
            {exportStatus.type === 'loading' && <span className="inline-block animate-spin mr-2">⏳</span>}
            {exportStatus.message}
          </div>
        )}
      </div>

      {/* Agency Form */}
      {showAgencyForm && (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-primary-200 dark:border-primary-800 shadow-lg">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingAgency ? 'Edit Agency' : 'Add New Agency'}
            </h4>
            <button 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all"
              onClick={() => {
                setShowAgencyForm(false);
                setEditingAgency(null);
              }}
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleAgencyFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Agency Number</label>
                <input
                  type="text"
                  value={agencyFormData.agencyNumber}
                  onChange={(e) => setAgencyFormData({...agencyFormData, agencyNumber: e.target.value})}
                  placeholder="Enter agency number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Agency Name <span className="text-error-600 dark:text-error-400">*</span>
                </label>
                <input
                  type="text"
                  value={agencyFormData.agencyName}
                  onChange={(e) => setAgencyFormData({...agencyFormData, agencyName: e.target.value})}
                  placeholder="Enter agency name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Contact Name</label>
                <input
                  type="text"
                  value={agencyFormData.contactName}
                  onChange={(e) => setAgencyFormData({...agencyFormData, contactName: e.target.value})}
                  placeholder="Enter contact name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Contact Email</label>
                <input
                  type="email"
                  value={agencyFormData.contactEmail}
                  onChange={(e) => setAgencyFormData({...agencyFormData, contactEmail: e.target.value})}
                  placeholder="Enter contact email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Contact Number</label>
                <input
                  type="tel"
                  value={agencyFormData.phoneNumber}
                  onChange={(e) => setAgencyFormData({...agencyFormData, phoneNumber: e.target.value})}
                  placeholder="Enter contact number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <input
                  type="text"
                  value={agencyFormData.role}
                  onChange={(e) => setAgencyFormData({...agencyFormData, role: e.target.value})}
                  placeholder="Enter role"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Region</label>
                <select
                  value={agencyFormData.region}
                  onChange={(e) => setAgencyFormData({...agencyFormData, region: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select region</option>
                  {regionalTeams && regionalTeams.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Main Contact</label>
                <select
                  value={agencyFormData.mainContact}
                  onChange={(e) => setAgencyFormData({...agencyFormData, mainContact: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select main contact</option>
                  {assignedToOptions && assignedToOptions.map(contact => (
                    <option key={contact} value={contact}>{contact}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">SAE</label>
                <select
                  value={agencyFormData.sae}
                  onChange={(e) => setAgencyFormData({...agencyFormData, sae: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                type="button" 
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all" 
                onClick={() => {
                  setShowAgencyForm(false);
                  setEditingAgency(null);
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-medium rounded-lg transition-all"
              >
                {editingAgency ? 'Update Agency' : 'Add Agency'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Agencies List */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
          Existing Agencies ({agencies.length})
        </h3>
        
        {agencies.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No agencies found. Import from Excel or add manually.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search agencies, contacts, regions..."
                    value={agencySearchTerm}
                    onChange={(e) => setAgencySearchTerm(e.target.value)}
                    className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  {agencySearchTerm && (
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-all"
                      onClick={() => setAgencySearchTerm('')}
                      title="Clear search"
                    >
                      ✗
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={agencyFilters.region}
                    onChange={(e) => handleAgencyFilterChange('region', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All Regions</option>
                    {agencyFilterOptions.regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  
                </div>
              </div>
              
              {/* Results Summary */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredAgencies.length !== agencies.length && (
                  <span className="font-medium">{filteredAgencies.length} of {agencies.length} agencies</span>
                )}
                {filteredAgencies.length === agencies.length && (
                  <span>{agencies.length} total agencies</span>
                )}
              </div>
            </div>

            {/* Agencies Table */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-900 text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <span>Agency Name</span>
                <span>Contact</span>
                <span>Region</span>
                <span>Role</span>
                <span>Actions</span>
              </div>
              
              {filteredAgencies.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">No agencies found matching your search criteria.</p>
                  <button 
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-all text-sm"
                    onClick={() => {
                      setAgencySearchTerm('');
                      setAgencyFilters({ region: 'all', role: 'all' });
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {getPaginatedAgencies().map(agency => (
                    <div key={agency.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-white" title={agency.agencyName}>
                        {agency.agencyName}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        <div className="truncate">{agency.contactName}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">{agency.contactEmail}</div>
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{agency.region}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{agency.role}</span>
                      <span className="flex gap-2">
                        <button 
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                          onClick={() => handleEditAgency(agency)}
                          title="Edit agency"
                        >
                          ✏️
                        </button>
                        <button 
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error-50 dark:hover:bg-error-900/20 text-gray-600 dark:text-gray-400 hover:text-error-600 dark:hover:text-error-400 transition-all"
                          onClick={() => handleDeleteAgency(agency)}
                          title="Delete agency"
                        >
                          🗑️
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredAgencies.length > 0 && renderPagination(getPaginationInfo())}
          </div>
        )}
      </div>

      {/* Agency Edit Modal */}
      <AgencyEditModal
        isOpen={isEditModalOpen}
        onClose={handleModalClose}
        agency={editingAgencyModal}
        onSave={handleModalSave}
        regionalTeams={regionalTeams}
        assignedToOptions={assignedToOptions}
      />
    </div>
  );
};

export default AgenciesTab;

