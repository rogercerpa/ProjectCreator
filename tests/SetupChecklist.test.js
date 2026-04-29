const { buildSetupChecklist } = require('../src/utils/setupChecklist');

describe('setup checklist', () => {
  test('flags all required items when user setup is missing', () => {
    const items = buildSetupChecklist({
      workloadSettings: {},
      pathSettings: {
        templates: { fallbackPath: '{userHome}\\Desktop\\Templates' },
        projectOutput: { triagePath: '{userHome}\\Desktop\\1) Triage' }
      },
      oneDriveSyncSettings: { enabled: true, syncFolderPath: '' }
    }, jest.fn());

    const doneMap = Object.fromEntries(items.map(item => [item.id, item.done]));
    expect(doneMap['user-profile']).toBe(false);
    expect(doneMap['fallback-template']).toBe(false);
    expect(doneMap['triage-folder']).toBe(false);
    expect(doneMap['onedrive-path']).toBe(false);
  });

  test('marks items complete when required settings are configured', () => {
    const items = buildSetupChecklist({
      workloadSettings: {
        userName: 'Test User',
        userEmail: 'test@acuity.com',
        position: 'L&T Senior Design Application Analyst',
        productKnowledge: { Fresco: 3 }
      },
      pathSettings: {
        templates: { fallbackPath: 'C:\\Users\\Test\\Desktop\\Templates' },
        projectOutput: { triagePath: 'C:\\Users\\Test\\Desktop\\1) Triage' }
      },
      oneDriveSyncSettings: { enabled: false, syncFolderPath: '' }
    }, jest.fn());

    expect(items.every(item => item.done)).toBe(true);
  });
});
