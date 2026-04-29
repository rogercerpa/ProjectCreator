export function buildSetupChecklist(settings = {}, setActiveTab = () => {}) {
  const hasUserName = Boolean(settings.workloadSettings?.userName?.trim());
  const hasUserEmail = Boolean(settings.workloadSettings?.userEmail?.trim());
  const hasUserRole = Boolean(settings.workloadSettings?.position?.trim());
  const hasProductKnowledge = Object.values(settings.workloadSettings?.productKnowledge || {}).some(level => Number(level) > 0);
  const hasFallbackTemplatePath = Boolean(settings.pathSettings?.templates?.fallbackPath?.trim()) && !settings.pathSettings?.templates?.fallbackPath?.includes('{userHome}');
  const hasTriagePath = Boolean(settings.pathSettings?.projectOutput?.triagePath?.trim()) && !settings.pathSettings?.projectOutput?.triagePath?.includes('{userHome}');
  const oneDriveEnabled = Boolean(settings.oneDriveSyncSettings?.enabled);
  const hasOneDrivePath = !oneDriveEnabled || Boolean(settings.oneDriveSyncSettings?.syncFolderPath?.trim());

  return [
    {
      id: 'user-profile',
      label: 'Complete your user profile',
      help: 'Add name, email, role, and at least one product knowledge rating.',
      done: hasUserName && hasUserEmail && hasUserRole && hasProductKnowledge,
      actionLabel: 'Open User Profile',
      action: () => setActiveTab('user-profile')
    },
    {
      id: 'fallback-template',
      label: 'Confirm local fallback template folder',
      help: 'Pick the fallback template folder on this computer.',
      done: hasFallbackTemplatePath,
      actionLabel: 'Open Advanced Settings',
      action: () => setActiveTab('advanced-settings')
    },
    {
      id: 'triage-folder',
      label: 'Confirm triage folder path',
      help: 'Set the folder where triage-based output should be saved.',
      done: hasTriagePath,
      actionLabel: 'Open Advanced Settings',
      action: () => setActiveTab('advanced-settings')
    },
    {
      id: 'onedrive-path',
      label: 'Set OneDrive sync folder (if enabled)',
      help: oneDriveEnabled
        ? 'OneDrive sync is enabled, so choose the local synced SharePoint folder.'
        : 'Optional. Only needed when OneDrive Sync Integration is enabled.',
      done: hasOneDrivePath,
      actionLabel: 'Open Advanced Settings',
      action: () => setActiveTab('advanced-settings')
    }
  ];
}
