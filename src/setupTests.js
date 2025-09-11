// Jest setup file for testing environment configuration

import '@testing-library/jest-dom';

// Mock Electron APIs
global.electronAPI = {
  // File system operations
  selectDirectory: jest.fn(),
  selectFolder: jest.fn(),
  selectFile: jest.fn(),
  saveFile: jest.fn(),
  
  // Project operations
  projectCreate: jest.fn(),
  projectLoad: jest.fn(),
  projectLoadByRFA: jest.fn(),
  projectSave: jest.fn(),
  projectDelete: jest.fn(),
  projectSearch: jest.fn(),
  projectStats: jest.fn(),
  
  // Triage calculations
  triageCalculate: jest.fn(),
  
  // Export operations
  exportDASBoard: jest.fn(),
  exportAgile: jest.fn(),
  
  // Word operations
  wordCreateDocument: jest.fn(),
  wordOpenDocument: jest.fn(),
  wordSaveDocument: jest.fn(),
  wordSearchReplace: jest.fn(),
  
  // Project management
  projectOpenFolder: jest.fn(),
  projectDownloadTemplate: jest.fn(),
  projectUploadTriages: jest.fn(),
  projectOpenDASBoard: jest.fn(),
  
  // Settings and persistence
  settingsLoad: jest.fn(),
  settingsSave: jest.fn(),
  templatesLoad: jest.fn(),
  templatesSave: jest.fn(),
  
  // Import/export
  projectsExport: jest.fn(),
  projectsImport: jest.fn(),
  
  // Project creation
  projectCreateFolder: jest.fn(),
  projectCreateWithFolders: jest.fn(),
  projectExportDASBoard: jest.fn(),
  projectExportAgile: jest.fn(),
  
  // Validation methods
  projectValidate: jest.fn(),
  projectValidateField: jest.fn(),
  projectValidationStatus: jest.fn(),
  projectClearValidationCaches: jest.fn(),
  
  // Form Settings methods
  formSettingsGetAll: jest.fn(),
  formSettingsGetRFATypes: jest.fn(),
  formSettingsGetNationalAccounts: jest.fn(),
  formSettingsAddCustomRFAType: jest.fn(),
  formSettingsAddCustomNationalAccount: jest.fn(),
  formSettingsValidateFormData: jest.fn(),
  
  // Error handling
  onError: jest.fn(),
  onNewProject: jest.fn(),
  onOpenProject: jest.fn(),
  
  // Remove listeners
  removeAllListeners: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.env
process.env.NODE_ENV = 'test';

// Suppress specific warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});


