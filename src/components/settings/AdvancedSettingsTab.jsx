import React, { useState } from 'react';

// Access secure electron API through contextBridge
const { electronAPI } = window;

export const COMPANY_DEFAULTS = {
  primaryTemplatePath: 'Z:\DAS References\!!!Templates For Project Creator',
  agentRequirementsPath: 'Z:\Agent Requirements',
  dasGeneralFilePath: 'Z:\DAS References\ProjectCreatorV5\DASGeneral.xlsx'
};

export const getPathStatus = (value, { companyDefault } = {}) => {
  const pathValue = String(value || '').trim();

  if (!pathValue) {
    return { label: 'Needs setup', tone: 'warning' };
  }

  if (companyDefault && pathValue === companyDefault) {
    return { label: 'Company default', tone: 'info' };
  }

  if (pathValue.includes('{userHome}')) {
    return { label: 'Uses variable', tone: 'neutral' };
  }

  return { label: 'Local path selected', tone: 'success' };
};

const mergePathSettings = (setSettings, updater) => {
  setSettings(prev => ({
    ...prev,
    pathSettings: updater(prev.pathSettings || {})
  }));
};

const browseForFolder = async (onFolderSelected) => {
  if (!electronAPI?.selectFolder) return;

  const result = await electronAPI.selectFolder();
  if (result && !result.canceled && result.filePaths?.[0]) {
    onFolderSelected(result.filePaths[0]);
  }
};

const StatusChip = ({ status }) => {
  const toneClass = {
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-800',
    error: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300 border-error-200 dark:border-error-800',
    info: 'bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300 border-info-200 dark:border-info-800',
    neutral: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
  }[status?.tone || 'neutral'];

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {status?.label || 'Not set'}
    </span>
  );
};

const Section = ({ title, description, children }) => (
  <section className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="mb-5">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{title}</h2>
      {description && <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>}
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const Card = ({ title, description, status, children, actions }) => (
  <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {status && <StatusChip status={status} />}
        {actions}
      </div>
    </div>
    {children}
  </div>
);

const HelperText = ({ children, tone = 'info' }) => {
  const toneClass = tone === 'warning'
    ? 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800'
    : 'bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800';

  return (
    <div className={`p-3 rounded-lg border text-xs text-gray-700 dark:text-gray-300 ${toneClass}`}>
      {children}
    </div>
  );
};

const PathField = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  browseTitle = 'Browse for folder',
  showBrowse = true,
  actions,
  help
}) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
    {help}
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {showBrowse && (
        <button
          type="button"
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => browseForFolder(onChange)}
          title={browseTitle}
          disabled={disabled}
        >
          Browse
        </button>
      )}
      {actions}
    </div>
  </div>
);

const ToggleRow = ({ title, description, checked, onChange, disabled = false }) => (
  <div className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div>
      <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>}
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
    </label>
  </div>
);

const AdvancedSettingsTab = ({ settings, setSettings }) => {
  const [syncFolderStatus, setSyncFolderStatus] = useState(null);
  const [dasGeneralStatus, setDasGeneralStatus] = useState(null);

  const pathSettings = settings.pathSettings || {};
  const templates = pathSettings.templates || {};
  const projectOutput = pathSettings.projectOutput || {};
  const readyForQC = pathSettings.readyForQC || {};
  const oneDrive = settings.oneDriveSyncSettings || {};
  const dasGeneral = settings.dasGeneralSettings || {};
  const bomSettings = settings.bomSettings || {};

  const updateTemplates = (key, value) => {
    mergePathSettings(setSettings, current => ({
      ...current,
      templates: {
        ...(current.templates || {}),
        [key]: value
      }
    }));
  };

  const updateProjectOutput = (key, value) => {
    mergePathSettings(setSettings, current => ({
      ...current,
      projectOutput: {
        ...(current.projectOutput || {}),
        [key]: value
      }
    }));
  };

  const updateReadyForQCPath = (folderPath) => {
    mergePathSettings(setSettings, current => ({
      ...current,
      readyForQC: {
        ...(current.readyForQC || {}),
        folderPath
      }
    }));
  };

  const updateOneDrive = (key, value) => {
    setSettings(prev => ({
      ...prev,
      oneDriveSyncSettings: {
        ...prev.oneDriveSyncSettings,
        [key]: value
      }
    }));
  };

  const updateDasGeneral = (key, value) => {
    setSettings(prev => ({
      ...prev,
      dasGeneralSettings: {
        ...prev.dasGeneralSettings,
        [key]: value
      }
    }));
  };

  const updateBomSettings = (key, value) => {
    setSettings(prev => ({
      ...prev,
      bomSettings: {
        ...prev.bomSettings,
        [key]: value
      }
    }));
  };

  const resetCompanyDefaults = () => {
    setSettings(prev => ({
      ...prev,
      pathSettings: {
        ...prev.pathSettings,
        templates: {
          ...prev.pathSettings?.templates,
          primaryPath: COMPANY_DEFAULTS.primaryTemplatePath,
          agentRequirementsPath: COMPANY_DEFAULTS.agentRequirementsPath
        }
      },
      dasGeneralSettings: {
        ...prev.dasGeneralSettings,
        filePath: COMPANY_DEFAULTS.dasGeneralFilePath
      }
    }));
    setDasGeneralStatus(null);
  };

  const handleDetectOneDrive = async () => {
    if (!electronAPI?.detectOneDriveSync) return;
    const result = await electronAPI.detectOneDriveSync();
    if (result.success && result.folders?.length > 0) {
      updateOneDrive('syncFolderPath', result.folders[0].path);
      setSyncFolderStatus({ label: 'Detected', tone: 'success' });
    } else {
      setSyncFolderStatus({ label: 'Not detected', tone: 'warning' });
    }
  };

  const handleBrowseOneDrive = async () => {
    if (!electronAPI?.browseForSyncFolder) return;
    const result = await electronAPI.browseForSyncFolder();
    if (result.success && result.folderPath) {
      updateOneDrive('syncFolderPath', result.folderPath);
      setSyncFolderStatus(result.verification?.valid
        ? { label: 'Accessible', tone: 'success' }
        : { label: 'Selected', tone: 'info' });
    }
  };

  const handleTestSyncFolder = async () => {
    if (!electronAPI?.testSyncFolder) return;
    const result = await electronAPI.testSyncFolder(oneDrive.syncFolderPath);
    setSyncFolderStatus(result.success
      ? { label: 'Accessible', tone: 'success' }
      : { label: 'Test failed', tone: 'error' });
  };

  const handleBrowseDasGeneral = async () => {
    if (!electronAPI?.dasGeneralSelectFile) return;
    const result = await electronAPI.dasGeneralSelectFile();
    if (result.success && result.filePath) {
      updateDasGeneral('filePath', result.filePath);
      setDasGeneralStatus({ label: 'Selected', tone: 'info' });
    }
  };

  const handleTestDasGeneral = async () => {
    if (!electronAPI?.dasGeneralCheckAccess) return;
    const filePath = dasGeneral.filePath || COMPANY_DEFAULTS.dasGeneralFilePath;
    const result = await electronAPI.dasGeneralCheckAccess(filePath);
    setDasGeneralStatus(result.success
      ? { label: 'Accessible', tone: 'success' }
      : { label: 'Test failed', tone: 'error' });
  };

  const handleCreateDasGeneral = async () => {
    const filePath = dasGeneral.filePath || COMPANY_DEFAULTS.dasGeneralFilePath;
    if (!window.confirm(`Create a new DAS General file at:\n\n${filePath}\n\nOnly do this if the shared workbook is missing. Continue?`)) return;
    if (electronAPI?.dasGeneralCreateFile) {
      const result = await electronAPI.dasGeneralCreateFile(filePath);
      setDasGeneralStatus(result.success
        ? { label: 'Created', tone: 'success' }
        : { label: 'Create failed', tone: 'error' });
    }
  };

  const handleRebuildCatalog = async () => {
    if (!window.confirm('Rebuild the BOM catalog from all projects? This may take a moment.')) return;
    try {
      const result = await electronAPI.bomRebuildCatalog();
      window.alert(result.success
        ? `Catalog rebuilt successfully.\n\nProcessed ${result.processedProjects} projects.`
        : `Failed to rebuild catalog: ${result.error}`);
    } catch (error) {
      window.alert(`Error: ${error.message}`);
    }
  };

  const dasGeneralPath = dasGeneral.filePath || COMPANY_DEFAULTS.dasGeneralFilePath;

  return (
    <div className="space-y-6">
      <Section title="Required Local Setup" description="These paths are specific to the current computer and are most likely to need first-run adjustment.">
        <Card title="Fallback Template Folder" description="Used when the primary shared template folder is unavailable." status={getPathStatus(templates.fallbackPath)}>
          <PathField
            label="Fallback Template Path"
            value={templates.fallbackPath}
            onChange={(value) => updateTemplates('fallbackPath', value)}
            placeholder="Local fallback path, for example {userHome}\Desktop\1) Triage\!!!Templates For Project Creator"
            help={<HelperText>Supports <strong>{'{userHome}'}</strong>, which is replaced with the current user's home folder.</HelperText>}
          />
        </Card>

        <Card title="Project Output" description="Controls where newly created project folders are saved." status={getPathStatus(projectOutput.triagePath)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Output Location</label>
              <select
                value={projectOutput.defaultLocation || 'desktop'}
                onChange={(e) => updateProjectOutput('defaultLocation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              >
                <option value="desktop">Desktop</option>
                <option value="triage">Triage Folder</option>
                <option value="custom">Custom Path</option>
              </select>
            </div>
            <PathField label="Triage Folder Path" value={projectOutput.triagePath} onChange={(value) => updateProjectOutput('triagePath', value)} placeholder="Path to triage folder, for example {userHome}\Desktop\1) Triage" />
            {projectOutput.defaultLocation === 'custom' && (
              <PathField label="Custom Output Path" value={projectOutput.customPath} onChange={(value) => updateProjectOutput('customPath', value)} placeholder="Custom project output path" />
            )}
          </div>
        </Card>

        <Card title="Ready for QC Scan Folder" description="Scanned by the Projects page to find QC zip files and update matching projects." status={getPathStatus(readyForQC.folderPath)}>
          <PathField
            label="Ready for QC Folder Path"
            value={readyForQC.folderPath}
            onChange={updateReadyForQCPath}
            placeholder="C:\Users\...\OneDrive - Acuity Brands, Inc\...\Ready for QC"
            help={<HelperText tone="warning">Use the local synced OneDrive/SharePoint folder path, not a SharePoint web URL.</HelperText>}
            browseTitle="Browse for Ready for QC folder"
          />
        </Card>
      </Section>

      <Section title="Company Defaults" description="These values are prefilled for the team. Most users should not need to change them.">
        <div className="flex justify-end">
          <button type="button" onClick={resetCompanyDefaults} className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 rounded-lg transition-all">
            Reset Company Defaults
          </button>
        </div>

        <Card title="Primary Template Folder" description="Main shared template source used when creating project folders." status={getPathStatus(templates.primaryPath, { companyDefault: COMPANY_DEFAULTS.primaryTemplatePath })}>
          <PathField label="Primary Template Path" value={templates.primaryPath} onChange={(value) => updateTemplates('primaryPath', value)} placeholder={COMPANY_DEFAULTS.primaryTemplatePath} />
        </Card>

        <Card title="Agent Requirements Folder" description="Shared folder for agency requirement files." status={getPathStatus(templates.agentRequirementsPath, { companyDefault: COMPANY_DEFAULTS.agentRequirementsPath })}>
          <PathField label="Agent Requirements Path" value={templates.agentRequirementsPath} onChange={(value) => updateTemplates('agentRequirementsPath', value)} placeholder={COMPANY_DEFAULTS.agentRequirementsPath} />
        </Card>

        <Card title="DAS General Workbook" description="Shared Excel workbook for team members, training materials, and product information." status={dasGeneralStatus || getPathStatus(dasGeneralPath, { companyDefault: COMPANY_DEFAULTS.dasGeneralFilePath })}>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input type="text" value={dasGeneralPath} onChange={(e) => updateDasGeneral('filePath', e.target.value)} placeholder={COMPANY_DEFAULTS.dasGeneralFilePath} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
              <button type="button" className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all" onClick={handleBrowseDasGeneral}>Browse</button>
              <button type="button" className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all" onClick={handleTestDasGeneral}>Test</button>
            </div>
            <details className="rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">Admin action: create a new DAS General workbook</summary>
              <p className="mt-2 text-xs text-gray-700 dark:text-gray-300">Use this only if the shared workbook is missing. Creating a separate workbook can split team data.</p>
              <button type="button" className="mt-3 px-3 py-1.5 text-sm bg-warning-100 dark:bg-warning-900/40 hover:bg-warning-200 dark:hover:bg-warning-900/60 border border-warning-300 dark:border-warning-700 text-warning-800 dark:text-warning-200 rounded-lg transition-all" onClick={handleCreateDasGeneral}>Create New Workbook</button>
            </details>
          </div>
        </Card>
      </Section>

      <Section title="OneDrive Uploads" description="Optional SharePoint upload support through a local OneDrive sync folder.">
        <Card title="Enable OneDrive Uploads" description="When enabled, project uploads are copied to your local OneDrive folder and then synced to SharePoint." status={oneDrive.enabled ? { label: 'Enabled', tone: 'success' } : { label: 'Optional', tone: 'neutral' }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={Boolean(oneDrive.enabled)} onChange={(e) => updateOneDrive('enabled', e.target.checked)} className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable OneDrive Sync Integration</span>
          </label>
        </Card>

        <Card title="OneDrive Sync Folder" description={oneDrive.enabled ? 'Select the local folder that syncs to the SharePoint library.' : 'Enable OneDrive uploads to configure this folder.'} status={oneDrive.enabled ? (syncFolderStatus || getPathStatus(oneDrive.syncFolderPath)) : { label: 'Disabled', tone: 'neutral' }}>
          <div className="space-y-3">
            <PathField
              label="OneDrive Sync Folder Path"
              value={oneDrive.syncFolderPath}
              onChange={(value) => {
                updateOneDrive('syncFolderPath', value);
                setSyncFolderStatus(null);
              }}
              placeholder="C:\Users\...\OneDrive - Acuity Brands, Inc\CIDesignSolutions - Shared Documents\LnT"
              disabled={!oneDrive.enabled}
              showBrowse={false}
              help={<HelperText tone="warning">Use the local synced folder path, not a SharePoint web URL. It usually starts with <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">C:\Users\...</code>.</HelperText>}
              actions={(
                <>
                  <button type="button" className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleDetectOneDrive} disabled={!oneDrive.enabled}>Detect</button>
                  <button type="button" className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleBrowseOneDrive} disabled={!oneDrive.enabled}>Browse</button>
                  <button type="button" className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleTestSyncFolder} disabled={!oneDrive.enabled || !oneDrive.syncFolderPath}>Test</button>
                </>
              )}
            />
            <details className="rounded-lg border border-info-200 dark:border-info-800 bg-info-50 dark:bg-info-900/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-900 dark:text-white">How do I find this folder?</summary>
              <ol className="mt-3 list-decimal pl-5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
                <li>Open the SharePoint document library in a browser.</li>
                <li>Click Sync in the SharePoint toolbar.</li>
                <li>Wait for OneDrive to create the local folder on your PC.</li>
                <li>Use Detect, or Browse to the folder under <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">C:\Users\...\OneDrive - Acuity Brands, Inc\...</code>.</li>
                <li>Do not paste a <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">https://...sharepoint.com/...</code> link here.</li>
              </ol>
            </details>
          </div>
        </Card>

        <Card title="File Cleanup" description="Choose how uploaded files are handled in the local OneDrive folder." status={{ label: oneDrive.cleanupStrategy === 'manual' ? 'Recommended' : 'Custom', tone: oneDrive.cleanupStrategy === 'manual' ? 'success' : 'info' }}>
          <div className="space-y-3">
            {[
              { value: 'manual', title: 'Manual cleanup only', description: 'Files stay in OneDrive. This is the safest option.' },
              { value: 'keep-recent', title: 'Keep recent files', description: 'Automatically keep only a limited number of recent files.' },
              { value: 'auto-delete', title: 'Auto-delete after sync verification', description: 'Files are removed only after confirmed SharePoint sync.' }
            ].map(option => (
              <label key={option.value} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer">
                <input type="radio" name="cleanup" value={option.value} checked={(oneDrive.cleanupStrategy || 'manual') === option.value} onChange={(e) => updateOneDrive('cleanupStrategy', e.target.value)} disabled={!oneDrive.enabled} className="mt-0.5 w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 focus:ring-primary-500 disabled:opacity-50" />
                <div className="flex-1"><span className="block text-sm font-medium text-gray-900 dark:text-white">{option.title}</span><span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">{option.description}</span></div>
              </label>
            ))}
            {(oneDrive.cleanupStrategy || 'manual') === 'keep-recent' && (
              <div className="ml-7 flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400">Keep last</label>
                <input type="number" min="1" max="100" value={oneDrive.keepRecentCount || 10} onChange={(e) => updateOneDrive('keepRecentCount', parseInt(e.target.value, 10) || 10)} className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50" disabled={!oneDrive.enabled} />
                <label className="text-xs text-gray-600 dark:text-gray-400">files</label>
              </div>
            )}
          </div>
        </Card>
      </Section>

      <Section title="BOM Analytics" description="Controls how BOM data is imported, reported, and maintained.">
        <ToggleRow title="Auto-import BOM on Download" description="Automatically import BOM data when downloading a project folder from Ready for QC." checked={bomSettings.autoImportOnDownload ?? true} onChange={(checked) => updateBomSettings('autoImportOnDownload', checked)} />
        <ToggleRow title="Show BOM Import Notifications" description="Display a notification when BOM data is automatically imported." checked={bomSettings.showImportNotification ?? true} onChange={(checked) => updateBomSettings('showImportNotification', checked)} />
        <ToggleRow title="Include BOM in Analytics Reports" description="Show BOM statistics in the Monthly Analytics report." checked={bomSettings.includeInReports ?? true} onChange={(checked) => updateBomSettings('includeInReports', checked)} />
        <details className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <summary className="cursor-pointer text-base font-semibold text-gray-900 dark:text-white">Catalog Maintenance</summary>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">Rebuild the aggregated product catalog from all projects. Use this only when catalog analytics look stale or incomplete.</p>
            <button type="button" onClick={handleRebuildCatalog} className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg text-sm font-medium transition-all">Rebuild Catalog</button>
          </div>
        </details>
      </Section>
    </div>
  );
};

export default AdvancedSettingsTab;
