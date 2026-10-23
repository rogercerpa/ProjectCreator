import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorNotificationProvider } from './contexts/ErrorNotificationContext';
import { UploadProvider } from './contexts/UploadContext';
import { getVersionDisplay } from './utils/version';

jest.mock('./services/ProjectDraftClient', () => ({
  createDraftClient: () => ({
    getAllDrafts: () => Promise.resolve([])
  })
}));

// The real service reads import.meta, which Jest's CommonJS transform cannot parse.
// Plain functions, not jest.fn(): jest.config sets resetMocks.
jest.mock('./services/FeatureFlagService', () => ({
  __esModule: true,
  default: {
    isEnabled: () => false,
    isAutoSaveEnabled: () => true,
    isDraftRecoveryEnabled: () => true,
    isWizardEnabled: () => true,
    isWizardDefault: () => true,
    isWizardForced: () => false,
    shouldShowMigrationAssistant: () => false
  }
}));

// App and its children call dozens of bridge methods. Event subscriptions (`onX`) return an
// unsubscribe function; everything else resolves to a generic success payload unless overridden.
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

const waitForWelcome = () => screen.findByText('Platform Capabilities', {}, { timeout: 5000 });

describe('App Component', () => {
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

  test('renders the loading screen first', async () => {
    renderApp();
    expect(screen.getByText('Loading modern application...')).toBeInTheDocument();
    await waitForWelcome();
  });

  test('renders the welcome screen once settings and projects load', async () => {
    renderApp();
    await waitForWelcome();

    expect(screen.getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeInTheDocument();
    expect(window.electronAPI.settingsLoad).toHaveBeenCalled();
    expect(window.electronAPI.projectsLoadAll).toHaveBeenCalled();
  });

  test('greets the user by first name from settings', async () => {
    window.electronAPI.settingsLoad.mockResolvedValue({
      success: true,
      data: { workloadSettings: { userName: 'Jordan Smith' } }
    });
    renderApp();
    await waitForWelcome();

    expect(screen.getByRole('heading', { level: 1, name: /, Jordan$/ })).toBeInTheDocument();
  });

  test('shows the app version', async () => {
    renderApp();
    await waitForWelcome();

    expect(screen.getAllByText(getVersionDisplay()).length).toBeGreaterThan(0);
  });

  test('shows feature highlights and quick actions', async () => {
    renderApp();
    await waitForWelcome();

    expect(screen.getByRole('heading', { name: 'Triage Calculations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New Project' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All Projects' })).toBeInTheDocument();
  });

  test('navigates away from the welcome screen from a quick action', async () => {
    renderApp();
    await waitForWelcome();

    fireEvent.click(screen.getByRole('heading', { name: 'Settings' }).closest('button'));

    await waitFor(() => expect(screen.queryByText('Platform Capabilities')).not.toBeInTheDocument());
  });

  test('warns instead of silently showing an empty list when projects fail to load', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    window.electronAPI.projectsLoadAll.mockResolvedValue({ success: false, error: 'DATA_FILE_CORRUPT' });
    renderApp();
    await waitForWelcome();

    expect(await screen.findByText(/saved projects could not be loaded/i)).toBeInTheDocument();
    console.error.mockRestore();
  });
});
