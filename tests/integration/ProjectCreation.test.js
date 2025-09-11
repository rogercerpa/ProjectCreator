import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../src/App';

// Mock services
jest.mock('../../src/services/ProjectDraftService', () => {
  return jest.fn().mockImplementation(() => ({
    getAllDrafts: jest.fn().mockResolvedValue([])
  }));
});

jest.mock('../../src/services/FeatureFlagService', () => ({
  shouldShowMigrationAssistant: jest.fn().mockReturnValue(false),
  isWizardForced: jest.fn().mockReturnValue(false),
  isWizardEnabled: jest.fn().mockReturnValue(true),
  isWizardDefault: jest.fn().mockReturnValue(true)
}));

describe('Project Creation Integration Tests', () => {
  const mockElectronAPI = {
    projectCreate: jest.fn(),
    projectCreateWithFolders: jest.fn(),
    projectValidate: jest.fn(),
    projectValidateField: jest.fn(),
    formSettingsGetAll: jest.fn(),
    formSettingsGetRFATypes: jest.fn(),
    formSettingsGetNationalAccounts: jest.fn(),
    onError: jest.fn(),
    onNewProject: jest.fn(),
    onOpenProject: jest.fn(),
    removeAllListeners: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.electronAPI = mockElectronAPI;
    
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
  });

  test('complete project creation flow', async () => {
    // Mock successful responses
    mockElectronAPI.formSettingsGetAll.mockResolvedValue({
      success: true,
      data: {
        rfaTypes: ['Standard', 'Reloc', 'Photometrics'],
        nationalAccounts: ['Default', 'Custom Account'],
        regionalTeams: ['Team A', 'Team B']
      }
    });

    mockElectronAPI.projectValidate.mockResolvedValue({
      success: true,
      data: { isValid: true, errors: [] }
    });

    mockElectronAPI.projectCreateWithFolders.mockResolvedValue({
      success: true,
      data: {
        id: 'project-123',
        projectName: 'Test Project',
        rfaNumber: 'RFA-123',
        status: 'Created'
      }
    });

    render(<App />);

    // Wait for app to load
    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Click on project creation button
    const createButton = screen.getByText(/Start Project/);
    fireEvent.click(createButton);

    // Should navigate to project wizard
    await waitFor(() => {
      expect(screen.getByText('Project Wizard')).toBeInTheDocument();
    });

    // Fill in project details
    const projectNameInput = screen.getByLabelText(/Project Name/i);
    const rfaNumberInput = screen.getByLabelText(/RFA Number/i);

    await userEvent.type(projectNameInput, 'Test Project');
    await userEvent.type(rfaNumberInput, 'RFA-123');

    // Submit the form
    const submitButton = screen.getByText(/Create Project/i);
    fireEvent.click(submitButton);

    // Wait for project creation
    await waitFor(() => {
      expect(mockElectronAPI.projectCreateWithFolders).toHaveBeenCalledWith(
        expect.objectContaining({
          projectName: 'Test Project',
          rfaNumber: 'RFA-123'
        })
      );
    });

    // Should show success message or navigate to project management
    await waitFor(() => {
      expect(screen.getByText(/Project created successfully/i)).toBeInTheDocument();
    });
  });

  test('handles project creation validation errors', async () => {
    // Mock validation failure
    mockElectronAPI.projectValidate.mockResolvedValue({
      success: true,
      data: {
        isValid: false,
        errors: [
          { field: 'projectName', message: 'Project name is required' },
          { field: 'rfaNumber', message: 'RFA number is required' }
        ]
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });

    const createButton = screen.getByText(/Start Project/);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Project Wizard')).toBeInTheDocument();
    });

    // Try to submit without filling required fields
    const submitButton = screen.getByText(/Create Project/i);
    fireEvent.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/Project name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/RFA number is required/i)).toBeInTheDocument();
    });
  });

  test('handles project creation API errors', async () => {
    // Mock API error
    mockElectronAPI.projectCreateWithFolders.mockResolvedValue({
      success: false,
      error: 'Failed to create project folder'
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });

    const createButton = screen.getByText(/Start Project/);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Project Wizard')).toBeInTheDocument();
    });

    // Fill in project details
    const projectNameInput = screen.getByLabelText(/Project Name/i);
    const rfaNumberInput = screen.getByLabelText(/RFA Number/i);

    await userEvent.type(projectNameInput, 'Test Project');
    await userEvent.type(rfaNumberInput, 'RFA-123');

    // Submit the form
    const submitButton = screen.getByText(/Create Project/i);
    fireEvent.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  test('handles network errors gracefully', async () => {
    // Mock network error
    mockElectronAPI.projectCreateWithFolders.mockRejectedValue(
      new Error('Network error')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Project Creator')).toBeInTheDocument();
    }, { timeout: 3000 });

    const createButton = screen.getByText(/Start Project/);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Project Wizard')).toBeInTheDocument();
    });

    // Fill in project details
    const projectNameInput = screen.getByLabelText(/Project Name/i);
    const rfaNumberInput = screen.getByLabelText(/RFA Number/i);

    await userEvent.type(projectNameInput, 'Test Project');
    await userEvent.type(rfaNumberInput, 'RFA-123');

    // Submit the form
    const submitButton = screen.getByText(/Create Project/i);
    fireEvent.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});

