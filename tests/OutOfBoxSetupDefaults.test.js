const fs = require('fs-extra');
const ProjectPersistenceService = require('../main-process/services/ProjectPersistenceService');
const AgencySyncService = require('../main-process/services/AgencySyncService');

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn()
}));

describe('Out-of-box defaults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ProjectPersistenceService returns company defaults when no settings file exists', async () => {
    fs.pathExists.mockResolvedValue(false);

    const service = new ProjectPersistenceService();
    const result = await service.loadSettings();

    expect(result.success).toBe(true);
    expect(result.data.pathSettings.templates.primaryPath).toBe('Z:\\DAS References\\!!!Templates For Project Creator');
    expect(result.data.pathSettings.templates.agentRequirementsPath).toBe('Z:\\Agent Requirements');
    expect(result.data.dasGeneralSettings.filePath).toBe('Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx');
  });

  test('ProjectPersistenceService merges saved settings with new defaults', async () => {
    fs.pathExists.mockResolvedValue(true);
    fs.readFile.mockResolvedValue(JSON.stringify({
      pathSettings: {
        templates: {
          fallbackPath: 'C:\\Temp\\Templates'
        }
      }
    }));

    const service = new ProjectPersistenceService();
    const result = await service.loadSettings();

    expect(result.success).toBe(true);
    expect(result.data.pathSettings.templates.primaryPath).toBe('Z:\\DAS References\\!!!Templates For Project Creator');
    expect(result.data.pathSettings.templates.fallbackPath).toBe('C:\\Temp\\Templates');
  });

  test('AgencySyncService defaults agency workbook path', async () => {
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue({})
    };
    const service = new AgencySyncService({}, settingsService);

    const result = await service.getSyncSettings();

    expect(result.success).toBe(true);
    expect(result.settings.filePath).toBe('Z:\\DAS References\\ProjectCreatorV5\\CnI-DAS-Agents.xlsx');
  });
});
