import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { ThemeProvider } from '../../src/contexts/ThemeContext';
import { ErrorNotificationProvider } from '../../src/contexts/ErrorNotificationContext';
import { UploadProvider } from '../../src/contexts/UploadContext';

jest.mock('../../src/services/ProjectDraftClient', () => ({
  createDraftClient: () => ({
    getAllDrafts: () => Promise.resolve([]),
    savePartialProject: () => Promise.resolve({ success: true }),
    loadDraft: () => Promise.resolve(null),
    deleteDraft: () => Promise.resolve({ success: true })
  })
}));

jest.mock('../../src/services/FeatureFlagService', () => ({
  __esModule: true,
  default: {
    isEnabled: () => false,
    isAutoSaveEnabled: () => false,
    isDraftRecoveryEnabled: () => true,
    isWizardEnabled: () => true,
    isWizardDefault: () => true,
    isWizardForced: () => false,
    shouldShowMigrationAssistant: () => false
  }
}));

const createElectronAPI = (overrides = {}) =>
  new Proxy(overrides, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop !== 'string') return undefined;
      if (/^on[A-Z]/.test(prop)) return jest.fn(() => () => {});
      if (prop === 'removeAllListeners') return jest.fn();
      return jest.fn().mockResolvedValue({ success: true, data: {}, projects: [] });
    }
  });

const renderApp = () =>
  render(
    <ThemeProvider>
      <ErrorNotificationProvider>
        <UploadProvider>
          <App />
        </UploadProvider>
      </ErrorNotificationProvider>
    </ThemeProvider>
  );

describe('Project Creation Integration Tests', () => {
  let originalElectronAPI;

  beforeEach(() => {
    originalElectronAPI = window.electronAPI;
    window.localStorage.setItem('app-visited', 'true');
    window.localStorage.setItem('onboarding-completed', 'true');
    window.electronAPI = createElectronAPI({
      settingsLoad: jest.fn().mockResolvedValue({ success: true, data: {} }),
      projectsLoadAll: jest.fn().mockResolvedValue({ success: true, projects: [] })
    });
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    window.localStorage.clear();
  });

  const openWizard = async () => {
    renderApp();
    await screen.findByText('Platform Capabilities', {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole('heading', { name: 'New Project' }).closest('button'));
    return screen.findByLabelText(/Project Name/, {}, { timeout: 5000 });
  };

  const fillRequiredStep1Fields = () => {
    const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set(/Project Name/, 'Test Project');
    set(/RFA Number/, '12345-1');
    set(/Agency Number/, '123');
    set(/Project Container/, '26-12345');
    set(/RFA Type/, 'BUDGET');
    set(/Region/, 'C&I');
  };

  const nextButton = () => screen.getByRole('button', { name: /Next/ });

  // Step validation is debounced, so Next only enables a moment after the fields change.
  const clickNextWhenEnabled = async () => {
    await waitFor(() => expect(nextButton()).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(nextButton());
  };

  test('New Project opens the wizard on step 1 with the required fields', async () => {
    await openWizard();

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    for (const label of [/Project Name/, /RFA Number/, /Agency Number/, /Project Container/, /RFA Type/, /Region/]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  test('Next stays disabled until the required fields are valid', async () => {
    window.electronAPI.projectCreateWithFolders = jest.fn();
    await openWizard();

    expect(nextButton()).toBeDisabled();
    fireEvent.click(nextButton());
    fireEvent.change(screen.getByLabelText(/Project Container/), { target: { value: 'not-a-container' } });

    expect(nextButton()).toBeDisabled();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(window.electronAPI.projectCreateWithFolders).not.toHaveBeenCalled();
  });

  test('a valid step 1 creates the project folders and moves to step 2', async () => {
    window.electronAPI.projectCreateWithFolders = jest.fn().mockResolvedValue({
      success: true,
      projectPath: 'C:\\Projects\\Test Project',
      rfaPath: 'C:\\Projects\\Test Project\\RFA#12345-1',
      agentFilesPath: 'C:\\Projects\\Test Project\\RFA#12345-1\\Agent Files'
    });
    await openWizard();
    fillRequiredStep1Fields();

    await clickNextWhenEnabled();

    await waitFor(() => expect(window.electronAPI.projectCreateWithFolders).toHaveBeenCalled(), { timeout: 5000 });
    expect(window.electronAPI.projectCreateWithFolders).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: 'Test Project', rfaNumber: '12345-1', projectContainer: '26-12345' })
    );
    expect(await screen.findByText('Step 2', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  test('a folder-creation failure keeps the user on step 1 with an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    window.electronAPI.projectCreateWithFolders = jest
      .fn()
      .mockResolvedValue({ success: false, error: 'Failed to create project folder' });
    await openWizard();
    fillRequiredStep1Fields();

    await clickNextWhenEnabled();

    expect(
      await screen.findByText(/Failed to save project basics or create folders/i, {}, { timeout: 5000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    console.error.mockRestore();
  });
});
