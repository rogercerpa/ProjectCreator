import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdvancedSettingsTab, { COMPANY_DEFAULTS, getPathStatus } from './AdvancedSettingsTab';

const createSettings = (overrides = {}) => ({
  pathSettings: {
    templates: {
      primaryPath: COMPANY_DEFAULTS.primaryTemplatePath,
      fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
      agentRequirementsPath: COMPANY_DEFAULTS.agentRequirementsPath
    },
    projectOutput: {
      defaultLocation: 'desktop',
      customPath: '{userHome}\\Desktop',
      triagePath: '{userHome}\\Desktop\\1) Triage'
    },
    readyForQC: {
      folderPath: '{userHome}\\OneDrive - Acuity Brands, Inc\\C&I Design Solutions - LnT\\Ready for QC'
    }
  },
  oneDriveSyncSettings: {
    enabled: false,
    syncFolderPath: '',
    cleanupStrategy: 'manual',
    keepRecentCount: 10
  },
  dasGeneralSettings: {
    filePath: COMPANY_DEFAULTS.dasGeneralFilePath
  },
  bomSettings: {
    autoImportOnDownload: true,
    showImportNotification: true,
    includeInReports: true
  },
  ...overrides
});

const StatefulAdvancedSettings = ({ initialSettings }) => {
  const [settings, setSettings] = useState(initialSettings);
  return <AdvancedSettingsTab settings={settings} setSettings={setSettings} />;
};

describe('AdvancedSettingsTab UX helpers', () => {
  test('describes empty, variable, local, and company-default paths', () => {
    expect(getPathStatus('').label).toBe('Needs setup');
    expect(getPathStatus('{userHome}\\Desktop').label).toBe('Uses variable');
    expect(getPathStatus('C:\\Users\\Test\\Desktop').label).toBe('Local path selected');
    expect(getPathStatus(COMPANY_DEFAULTS.primaryTemplatePath, {
      companyDefault: COMPANY_DEFAULTS.primaryTemplatePath
    }).label).toBe('Company default');
  });
});

describe('AdvancedSettingsTab UX behavior', () => {
  test('only shows custom output path when custom output is selected', () => {
    render(<StatefulAdvancedSettings initialSettings={createSettings()} />);

    expect(screen.queryByText('Custom Output Path')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });

    expect(screen.getByText('Custom Output Path')).toBeInTheDocument();
  });

  test('disables OneDrive folder configuration until OneDrive uploads are enabled', () => {
    render(<StatefulAdvancedSettings initialSettings={createSettings()} />);

    expect(screen.getByPlaceholderText('C:\\Users\\...\\OneDrive - Acuity Brands, Inc\\CIDesignSolutions - Shared Documents\\LnT')).toBeDisabled();

    fireEvent.click(screen.getByText('Enable OneDrive Sync Integration'));

    expect(screen.getByPlaceholderText('C:\\Users\\...\\OneDrive - Acuity Brands, Inc\\CIDesignSolutions - Shared Documents\\LnT')).not.toBeDisabled();
  });

  test('resets company-managed paths without changing user-specific paths', () => {
    render(<StatefulAdvancedSettings initialSettings={createSettings({
      pathSettings: {
        templates: {
          primaryPath: 'C:\\Wrong\\Templates',
          fallbackPath: 'C:\\Users\\Test\\Fallback Templates',
          agentRequirementsPath: 'C:\\Wrong\\Agent Requirements'
        },
        projectOutput: {
          defaultLocation: 'desktop',
          customPath: 'C:\\Users\\Test\\Custom Output',
          triagePath: 'C:\\Users\\Test\\Triage'
        },
        readyForQC: {
          folderPath: 'C:\\Users\\Test\\Ready for QC'
        }
      },
      dasGeneralSettings: {
        filePath: 'C:\\Wrong\\DASGeneral.xlsx'
      }
    })} />);

    fireEvent.click(screen.getByText('Reset Company Defaults'));

    expect(screen.getByDisplayValue(COMPANY_DEFAULTS.primaryTemplatePath)).toBeInTheDocument();
    expect(screen.getByDisplayValue(COMPANY_DEFAULTS.agentRequirementsPath)).toBeInTheDocument();
    expect(screen.getByDisplayValue(COMPANY_DEFAULTS.dasGeneralFilePath)).toBeInTheDocument();
    expect(screen.getByDisplayValue('C:\\Users\\Test\\Fallback Templates')).toBeInTheDocument();
  });
});
