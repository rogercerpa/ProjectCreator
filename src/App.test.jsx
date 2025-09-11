import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock the electronAPI
const mockElectronAPI = {
  projectCreate: jest.fn(),
  projectLoad: jest.fn(),
  projectSave: jest.fn(),
  projectDelete: jest.fn(),
  projectSearch: jest.fn(),
  projectStats: jest.fn(),
  settingsLoad: jest.fn(),
  settingsSave: jest.fn(),
  onError: jest.fn(),
  onNewProject: jest.fn(),
  onOpenProject: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock the ProjectDraftService
jest.mock('./services/ProjectDraftService', () => {
  return jest.fn().mockImplementation(() => ({
    getAllDrafts: jest.fn().mockResolvedValue([])
  }));
});

// Mock the FeatureFlagService
jest.mock('./services/FeatureFlagService', () => ({
  shouldShowMigrationAssistant: jest.fn().mockReturnValue(false),
  isWizardForced: jest.fn().mockReturnValue(false),
  isWizardEnabled: jest.fn().mockReturnValue(true),
  isWizardDefault: jest.fn().mockReturnValue(true)
}));

describe('App Component', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
    
    // Mock electronAPI
    global.electronAPI = mockElectronAPI;
  });

  test('renders loading screen initially', () => {
    render(<App />);
    expect(screen.getByText('Project Creator')).toBeInTheDocument();
    expect(screen.getByText('Loading modern application...')).toBeInTheDocument();
  });

  test('renders welcome screen after loading', async () => {
    render(<App />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('Professional Project Management & Document Automation Tool')).toBeInTheDocument();
  });

  test('displays version information', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Version/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('shows feature highlights', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('🚀 Key Features')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('Project Management')).toBeInTheDocument();
    expect(screen.getByText('Triage Calculations')).toBeInTheDocument();
    expect(screen.getByText('Document Automation')).toBeInTheDocument();
  });

  test('shows project types', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('🎯 Supported Project Types')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('Reloc')).toBeInTheDocument();
    expect(screen.getByText('Photometrics')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();
  });

  test('shows quick action buttons', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('🚀 Get Started')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Check for main action buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  test('handles view changes correctly', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Test navigation to settings
    const settingsButton = screen.getByText('⚙️ Application Settings');
    fireEvent.click(settingsButton);
    
    // Should navigate to settings view
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  test('handles project creation', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Mock successful project creation
    mockElectronAPI.projectCreate.mockResolvedValue({
      success: true,
      project: { id: '1', projectName: 'Test Project' }
    });
    
    // Test project creation flow
    const createButton = screen.getByText(/Start Project/);
    fireEvent.click(createButton);
    
    // Should navigate to project creation
    await waitFor(() => {
      expect(screen.getByText('Project Wizard')).toBeInTheDocument();
    });
  });

  test('handles errors gracefully', async () => {
    // Mock console.error to avoid noise in tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<App />);
    
    // Simulate an error
    const errorEvent = new Error('Test error');
    fireEvent.error(window, errorEvent);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    consoleSpy.mockRestore();
  });

  test('displays application status', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('📊 Application Status')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('Components:')).toBeInTheDocument();
    expect(screen.getByText('Database:')).toBeInTheDocument();
    expect(screen.getByText('Templates:')).toBeInTheDocument();
    expect(screen.getByText('File System:')).toBeInTheDocument();
  });

  test('shows pro tips and help information', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText(/Pro Tip:/)).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('🔧 Need Help?')).toBeInTheDocument();
  });
});

