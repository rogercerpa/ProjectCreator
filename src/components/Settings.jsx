import React, { useState, useEffect } from 'react';
import './Settings.css';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';
import { getFullVersionInfo, getVersionDisplay, BUILD_INFO } from '../utils/version';

// Access secure electron API through contextBridge
const { electronAPI } = window;

function Settings({ initialTab = 'app-info' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [settings, setSettings] = useState({
    rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE', 'GRAPHICS', 'PHOTOMETRICS', 'Consultation'],
    regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
    nationalAccounts: ['Default', 'ARBYS', 'MCDONALDS', 'WALMART', 'TARGET', 'HOMEDEPOT', 'LOWES', 'KROGER', 'CVS', 'WALGREENS'],
    saveLocations: ['Triage', 'Desktop', 'Server'],
    complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
    statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
    productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
    assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger'],
    calculationSettings: {
      lmpMultipliers: { small: 15, medium: 30, large: 45 },
      arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
      roomMultiplier: 2,
      riserMultiplier: 1,
      esheetsMultiplier: 2,
      defaultReviewSetup: 0.5,
      defaultSOO: 0.5,
      defaultNumOfPages: 1,
      pageBonusThreshold: 3,
      pageBonusMultiplier: 3,
      selfQCHigh: 12,
      selfQCLow: 4,
      selfQCDefault: 0.5,
      fluffPercentage: 10
    },
    pathSettings: {
      templates: {
        primaryPath: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
        fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
        agentRequirementsPath: '\\\\10.3.10.30\\DAS\\Agent Requirements'
      },
      projectOutput: {
        defaultLocation: 'desktop', // 'desktop', 'triage', 'custom'
        customPath: '{userHome}\\Desktop',
        triagePath: '{userHome}\\Desktop\\1) Triage'
      }
    }
  });

  const [editingField, setEditingField] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Agency management state
  const [agencies, setAgencies] = useState([]);
  const [agencyStats, setAgencyStats] = useState(null);
  const [showAgencyForm, setShowAgencyForm] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [agencyFormData, setAgencyFormData] = useState({
    agencyNumber: '',
    agencyName: '',
    contactName: '',
    contactEmail: '',
    phoneNumber: '',
    role: '',
    region: '',
    mainContact: '',
    sae: 'No'
  });
  const [importStatus, setImportStatus] = useState(null);

  useEffect(() => {
    loadSettings();
    loadAgencies();
    loadAgencyStats();
    // Scroll to top when settings page loads - ensure DOM is ready
    const scrollToTop = () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        console.log('Scrolling main-content to top, current scroll:', mainContent.scrollTop);
        mainContent.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        console.log('Main content not found, using window scroll');
        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToTop();
      // Try again after CSS animation completes (300ms + buffer)
      setTimeout(scrollToTop, 400);
      // Final attempt after component is fully rendered
      setTimeout(scrollToTop, 600);
    });
  }, []);

  // Reset editing state when tab changes and scroll to top
  useEffect(() => {
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
    // Scroll to top when tab changes - ensure DOM is ready
    const scrollToTop = () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        // Fallback to window scroll
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToTop();
      // Try again after CSS animation completes (300ms + buffer)
      setTimeout(scrollToTop, 400);
      // Final attempt after component is fully rendered
      setTimeout(scrollToTop, 600);
    });
  }, [activeTab]);



  // Effect to handle component focus and reset state when returning to page
  useEffect(() => {
    const handleFocus = () => {
      // Reset any stale editing state when returning to the page
      // Only reset if we're editing an existing item (index >= 0), not when adding new (index = -1)
      if (editingField && editingIndex >= 0) {
        setEditingField(null);
        setEditingIndex(-1);
        setNewValue('');
      }
      
      // Also scroll to top when returning to the page
      const scrollToTop = () => {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
          mainContent.scrollTo({ top: 0, behavior: 'auto' });
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      };
      
      requestAnimationFrame(scrollToTop);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset state when tab becomes visible again
        handleFocus();
      }
    };

    const handleWindowFocus = () => {
      handleFocus();
    };

    const handleWindowBlur = () => {
      // Reset editing state when window loses focus
      setEditingField(null);
      setEditingIndex(-1);
      setNewValue('');
    };

    // Listen for various focus and visibility events
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also reset state when component mounts
    handleFocus();

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [editingField, editingIndex]);

  // Fix input field interactivity issue - ensure fields are properly initialized and interactive
  useEffect(() => {
    // Force input fields to be interactive after component mounts
    const timer = setTimeout(() => {
      // Find any input fields and ensure they're interactive
      const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
      inputs.forEach(input => {
        // Force the input to be interactive by triggering focus/blur
        input.focus();
        input.blur();
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array - only run once on mount

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      if (electronAPI && electronAPI.settingsLoad) {
        const savedSettings = await electronAPI.settingsLoad();
        if (savedSettings && savedSettings.success) {
          setSettings(prev => ({ ...prev, ...savedSettings.data }));
        }
      } else {
        console.log('electronAPI not available, using default settings');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Agency management functions
  const loadAgencies = async () => {
    try {
      const result = await window.electronAPI.agenciesLoadAll();
      if (result && result.success) {
        setAgencies(result.agencies || []);
      }
    } catch (error) {
      console.error('Error loading agencies:', error);
      setAgencies([]);
    }
  };

  const loadAgencyStats = async () => {
    try {
      const result = await window.electronAPI.agenciesGetStatistics();
      if (result && result.success) {
        setAgencyStats(result.statistics);
      }
    } catch (error) {
      console.error('Error loading agency statistics:', error);
    }
  };

  const handleAgencyFormSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let result;
      if (editingAgency) {
        // Update existing agency
        result = await window.electronAPI.agenciesUpdate(editingAgency.id, agencyFormData);
      } else {
        // Add new agency
        result = await window.electronAPI.agenciesAdd(agencyFormData);
      }

      if (result && result.success) {
        // Reload agencies and stats
        await loadAgencies();
        await loadAgencyStats();
        
        // Reset form
        setAgencyFormData({
          agencyNumber: '',
          agencyName: '',
          contactName: '',
          contactEmail: '',
          phoneNumber: '',
          role: '',
          region: '',
          mainContact: '',
          sae: 'No'
        });
        setShowAgencyForm(false);
        setEditingAgency(null);
        
        alert(editingAgency ? 'Agency updated successfully!' : 'Agency added successfully!');
      } else {
        alert('Failed to save agency: ' + (result?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving agency:', error);
      alert('Error saving agency: ' + error.message);
    }
  };

  const handleEditAgency = (agency) => {
    setAgencyFormData({
      agencyNumber: agency.agencyNumber || '',
      agencyName: agency.agencyName || '',
      contactName: agency.contactName || '',
      contactEmail: agency.contactEmail || '',
      phoneNumber: agency.phoneNumber || '',
      role: agency.role || '',
      region: agency.region || '',
      mainContact: agency.mainContact || '',
      sae: agency.sae || 'No'
    });
    setEditingAgency(agency);
    setShowAgencyForm(true);
  };

  const handleDeleteAgency = async (agency) => {
    if (window.confirm(`Are you sure you want to delete "${agency.agencyName}"? This action cannot be undone.`)) {
      try {
        const result = await window.electronAPI.agenciesDelete(agency.id);
        if (result && result.success) {
          await loadAgencies();
          await loadAgencyStats();
          alert('Agency deleted successfully!');
        } else {
          alert('Failed to delete agency: ' + (result?.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error deleting agency:', error);
        alert('Error deleting agency: ' + error.message);
      }
    }
  };

  const handleExcelImport = async () => {
    try {
      const result = await window.electronAPI.selectExcelFile();
      if (result && result.success && result.filePath) {
        setImportStatus({ type: 'loading', message: 'Importing Excel file...' });
        
        const importResult = await window.electronAPI.agenciesImportExcel(result.filePath);
        
        if (importResult && importResult.success) {
          setImportStatus({ 
            type: 'success', 
            message: `Successfully imported ${importResult.imported} agencies` 
          });
          
          // Reload data
          await loadAgencies();
          await loadAgencyStats();
          
          // Clear status after delay
          setTimeout(() => {
            setImportStatus(null);
          }, 3000);
        } else {
          console.error('Import failed:', importResult);
          
          let errorMessage = importResult?.error || 'Failed to import Excel file';
          
          // Show debug info if available
          if (importResult?.debugInfo) {
            console.log('Debug info:', importResult.debugInfo);
            
            if (importResult.debugInfo.columnHeaders) {
              errorMessage += `\n\nFound columns: ${importResult.debugInfo.columnHeaders.join(', ')}`;
            }
            
            if (importResult.debugInfo.totalRows !== undefined) {
              errorMessage += `\nTotal rows: ${importResult.debugInfo.totalRows}`;
            }
          }
          
          setImportStatus({ 
            type: 'error', 
            message: errorMessage
          });
        }
      }
    } catch (error) {
      console.error('Error importing Excel:', error);
      setImportStatus({ 
        type: 'error', 
        message: 'Error importing Excel file: ' + error.message 
      });
    }
  };

  const handleExcelDiagnose = async () => {
    try {
      const result = await window.electronAPI.selectExcelFile();
      if (result && result.success && result.filePath) {
        setImportStatus({ type: 'loading', message: 'Analyzing Excel file structure...' });
        
        const diagnosisResult = await window.electronAPI.excelDiagnose(result.filePath);
        
        if (diagnosisResult && diagnosisResult.success) {
          const diag = diagnosisResult.diagnosis;
          const recs = diagnosisResult.recommendations;
          
          let message = `📊 EXCEL FILE ANALYSIS\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
          message += `📁 File: ${diag.fileName}\n`;
          message += `📚 Total Sheets: ${diag.totalSheets}\n`;
          message += `📋 All Sheets: ${diag.allSheets.join(', ')}\n\n`;
          
          // Show sheet analysis
          message += `🔍 SHEET ANALYSIS:\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          diag.sheetAnalysis.forEach(sheet => {
            const scoreIcon = sheet.agencyScore > 50 ? '🎯' : sheet.agencyScore > 0 ? '📋' : '❌';
            message += `${scoreIcon} ${sheet.sheetName}: ${sheet.totalRows}x${sheet.totalCols} (Score: ${sheet.agencyScore})\n`;
            if (sheet.hasAgencyLikeData) {
              message += `   ✅ Contains agency-like data\n`;
            }
            if (sheet.possibleHeaderRow > 0) {
              message += `   📍 Possible headers at row ${sheet.possibleHeaderRow}\n`;
            }
          });
          
          if (diag.recommendedSheet) {
            message += `\n🎯 RECOMMENDED SHEET: ${diag.recommendedSheet}\n`;
            if (diag.recommendedHeaderRow > 0) {
              message += `📍 Recommended header row: ${diag.recommendedHeaderRow}\n`;
            }
          } else {
            message += `\n⚠️ NO SUITABLE SHEET FOUND FOR AGENCY DATA\n`;
          }
          
          // Show detailed analysis if we have a recommended sheet
          if (diag.detailedAnalysis) {
            message += `\n🔍 DETAILED ANALYSIS (${diag.detailedAnalysis.sheetName}):\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            
            diag.detailedAnalysis.rowAnalysis.slice(0, 10).forEach(row => {
              const preview = row.values.join(' | ');
              const indicator = row.possibleHeader ? ' ⭐ HEADER?' : '';
              message += `Row ${row.rowNumber}: [${row.contentCount} cells] ${preview}${indicator}\n`;
            });
            
            if (diag.detailedAnalysis.parsingAttempts) {
              message += `\n🧩 PARSING ATTEMPTS:\n`;
              message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              diag.detailedAnalysis.parsingAttempts.forEach(attempt => {
                if (attempt.success) {
                  message += `✅ ${attempt.method}: ${attempt.rowCount} rows, ${attempt.columns.length} cols\n`;
                  if (attempt.columns.length > 0) {
                    message += `   Headers: ${attempt.columns.slice(0, 5).join(', ')}${attempt.columns.length > 5 ? '...' : ''}\n`;
                  }
                } else {
                  message += `❌ ${attempt.method}: ${attempt.error}\n`;
                }
              });
            }
          }
          
          message += `\n💡 RECOMMENDATIONS:\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          recs.forEach(rec => {
            const icon = rec.type === 'warning' ? '⚠️' : rec.type === 'header' ? '🎯' : '📋';
            message += `${icon} ${rec.message}\n`;
          });
          
          // Check for potential data in the detailed analysis
          if (diag.detailedAnalysis && diag.detailedAnalysis.rowAnalysis) {
            const dataRows = diag.detailedAnalysis.rowAnalysis.filter(row => 
              row.contentCount >= 3 && !row.possibleHeader
            );
            
            if (dataRows.length > 0) {
              message += `\n📊 POTENTIAL DATA ROWS FOUND: ${dataRows.length}\n`;
              message += `Sample data from row ${dataRows[0].rowNumber}:\n`;
              dataRows[0].values.slice(0, 5).forEach((value, index) => {
                message += `  Column ${index + 1}: ${value}\n`;
              });
            }
          }
          
          setImportStatus({ 
            type: 'success', 
            message: message
          });
        } else {
          setImportStatus({ 
            type: 'error', 
            message: 'Failed to analyze Excel file: ' + (diagnosisResult?.error || 'Unknown error')
          });
        }
      }
    } catch (error) {
      console.error('Error diagnosing Excel:', error);
      setImportStatus({ 
        type: 'error', 
        message: 'Error analyzing Excel file: ' + error.message 
      });
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      if (electronAPI && electronAPI.settingsSave) {
        const result = await electronAPI.settingsSave(settings);
        if (result && result.success) {
          // Update the dropdown options service with new settings
          dropdownOptionsService.updateOptions(settings);
          // Update the triage calculation service with new settings
          triageCalculationService.updateSettings(settings);
          alert('Settings saved successfully!');
        } else {
          alert('Failed to save settings. Please try again.');
        }
      } else {
        // In development mode, just update the services
        dropdownOptionsService.updateOptions(settings);
        triageCalculationService.updateSettings(settings);
        alert('Settings updated (development mode - not persisted)');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (field, index = -1) => {
    // Set the editing state immediately
    setEditingField(field);
    setEditingIndex(index);
    setNewValue(index >= 0 ? settings[field][index] : '');
    
    // Focus on the input field after DOM update
    setTimeout(() => {
      const selector = `input[data-key="${index >= 0 ? `edit-${field}-${index}` : `add-new-${field}`}"]`;
      const inputElement = document.querySelector(selector);
      
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      }
    }, 100);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
  };

  const forceRefreshInput = () => {
    // Force a complete re-render by temporarily setting state to null
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
  };

  const saveEdit = () => {
    if (!newValue.trim()) {
      alert('Value cannot be empty');
      return;
    }

    setSettings(prev => {
      const newSettings = { ...prev };
      if (editingIndex >= 0) {
        // Editing existing value
        newSettings[editingField] = [...prev[editingField]];
        newSettings[editingField][editingIndex] = newValue.trim();
      } else {
        // Adding new value
        newSettings[editingField] = [...prev[editingField], newValue.trim()];
      }
      
      // Update the dropdown options service immediately
      dropdownOptionsService.updateOptions(newSettings);
      
      return newSettings;
    });

    cancelEditing();
  };

  const deleteItem = (field, index) => {
    if (confirm('Are you sure you want to delete this item?')) {
      setSettings(prev => {
        const newSettings = {
          ...prev,
          [field]: prev[field].filter((_, i) => i !== index)
        };
        
        // Update the dropdown options service immediately
        dropdownOptionsService.updateOptions(newSettings);
        
        return newSettings;
      });
    }
  };

  const moveItem = (field, fromIndex, direction) => {
    const newIndex = fromIndex + direction;
    if (newIndex < 0 || newIndex >= settings[field].length) return;

    setSettings(prev => {
      const newArray = [...prev[field]];
      const temp = newArray[fromIndex];
      newArray[fromIndex] = newArray[newIndex];
      newArray[newIndex] = temp;
      const newSettings = { ...prev, [field]: newArray };
      
      // Update the dropdown options service immediately
      dropdownOptionsService.updateOptions(newSettings);
      
      return newSettings;
    });
  };

  const renderFieldEditor = (field, label, items) => (
    <div className="settings-field">
      <div className="field-header">
        <h3>{label}</h3>
                 <button
           type="button"
           className="btn btn-primary btn-sm"
           onClick={() => startEditing(field)}
         >
           + Add New
         </button>
      </div>
      
      <div className="field-items">
        {/* Show add new item input when editing this field with index -1 */}
        {editingField === field && editingIndex === -1 && (
          <div className="field-item new-item">
            <div className="item-content">
              <div className="edit-mode">
                                 <input
                   key={`add-new-${field}`}
                   data-key={`add-new-${field}`}
                   type="text"
                   value={newValue}
                                       onChange={(e) => setNewValue(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                       onFocus={(e) => e.target.select()}
                    onBlur={() => {}}
                   placeholder="Enter new value..."
                   autoFocus
                   style={{ minWidth: '200px' }}
                   data-testid="add-new-input"
                   tabIndex={0}
                 />
                <div className="edit-actions">
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={saveEdit}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={cancelEditing}
                  >
                    ✗
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {items.map((item, index) => (
          <div key={index} className="field-item">
            <div className="item-controls">
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => moveItem(field, index, -1)}
                disabled={index === 0}
                title="Move Up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                onClick={() => moveItem(field, index, 1)}
                disabled={index === items.length - 1}
                title="Move Down"
              >
                ↓
              </button>
            </div>
            
            <div className="item-content">
              {editingField === field && editingIndex === index ? (
                <div className="edit-mode">
                                     <input
                     key={`edit-${field}-${index}`}
                     data-key={`edit-${field}-${index}`}
                     type="text"
                     value={newValue}
                     onChange={(e) => setNewValue(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                           onFocus={(e) => e.target.select()}
                      onBlur={() => {}}
                     autoFocus
                     style={{ minWidth: '200px' }}
                     tabIndex={0}
                   />
                  <div className="edit-actions">
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={saveEdit}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={cancelEditing}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ) : (
                <span className="item-text">{item}</span>
              )}
            </div>
            
            <div className="item-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => startEditing(field, index)}
                title="Edit"
              >
                ✏️
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => deleteItem(field, index)}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="settings-loading">
        <div className="spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  const tabs = [
    {
      id: 'app-info',
      label: 'App Settings',
      icon: 'ℹ️',
      fullLabel: 'Application Info & Settings'
    },
    {
      id: 'project-form',
      label: 'Form Settings',
      icon: '📝',
      fullLabel: 'Project Form Settings'
    },
    {
      id: 'agencies',
      label: 'Agencies',
      icon: '🏢',
      fullLabel: 'Agency Management'
    },
    {
      id: 'triage-calc',
      label: 'Triage Calc',
      icon: '🧮',
      fullLabel: 'Triage Calculation Settings'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'app-info':
        return (
          <div className="tab-content">
            <div className="app-info-section">
              <h2>Application Information</h2>
              <div className="app-info-grid">
                <div className="app-info-item">
                  <span className="app-info-label">Version:</span>
                  <span className="app-info-value">{getVersionDisplay()}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">Full Version:</span>
                  <span className="app-info-value">{getFullVersionInfo()}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">Build Date:</span>
                  <span className="app-info-value">{new Date(BUILD_INFO.buildDate).toLocaleDateString()}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">Environment:</span>
                  <span className="app-info-value">{BUILD_INFO.environment}</span>
                </div>
              </div>
            </div>

            {/* File Paths Configuration Section */}
            <div className="file-paths-section">
              <h2>File Path Configuration</h2>
              <p className="section-description">Configure where the application looks for template files and saves created projects.</p>
              
              <div className="path-settings">
                {/* Template Paths */}
                <div className="setting-group">
                  <h3>📁 Template Source Locations</h3>
                  <p className="group-description">Where the application finds template files for project creation</p>
                  
                  <div className="setting-row">
                    <label>Primary Template Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.templates.primaryPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            templates: {
                              ...prev.pathSettings.templates,
                              primaryPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Network path to templates"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  templates: {
                                    ...prev.pathSettings.templates,
                                    primaryPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>Fallback Template Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.templates.fallbackPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            templates: {
                              ...prev.pathSettings.templates,
                              fallbackPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Local fallback path (use {userHome} for user directory)"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  templates: {
                                    ...prev.pathSettings.templates,
                                    fallbackPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>Agent Requirements Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.templates.agentRequirementsPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            templates: {
                              ...prev.pathSettings.templates,
                              agentRequirementsPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Path to agent requirements files"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  templates: {
                                    ...prev.pathSettings.templates,
                                    agentRequirementsPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                </div>

                {/* Project Output Paths */}
                <div className="setting-group">
                  <h3>💾 Project Output Locations</h3>
                  <p className="group-description">Where created project folders are saved</p>
                  
                  <div className="setting-row">
                    <label>Default Output Location:</label>
                    <select
                      value={settings.pathSettings.projectOutput.defaultLocation}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        pathSettings: {
                          ...prev.pathSettings,
                          projectOutput: {
                            ...prev.pathSettings.projectOutput,
                            defaultLocation: e.target.value
                          }
                        }
                      }))}
                      className="path-select"
                    >
                      <option value="desktop">Desktop</option>
                      <option value="triage">Triage Folder</option>
                      <option value="custom">Custom Path</option>
                    </select>
                  </div>
                  
                  <div className="setting-row">
                    <label>Custom Output Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.projectOutput.customPath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            projectOutput: {
                              ...prev.pathSettings.projectOutput,
                              customPath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Custom project output path (use {userHome} for user directory)"
                        className="path-input"
                        disabled={settings.pathSettings.projectOutput.defaultLocation !== 'custom'}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  projectOutput: {
                                    ...prev.pathSettings.projectOutput,
                                    customPath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                        disabled={settings.pathSettings.projectOutput.defaultLocation !== 'custom'}
                      >
                        📂
                      </button>
                    </div>
                  </div>
                  
                  <div className="setting-row">
                    <label>Triage Folder Path:</label>
                    <div className="path-input-group">
                      <input
                        type="text"
                        value={settings.pathSettings.projectOutput.triagePath}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          pathSettings: {
                            ...prev.pathSettings,
                            projectOutput: {
                              ...prev.pathSettings.projectOutput,
                              triagePath: e.target.value
                            }
                          }
                        }))}
                        placeholder="Path to triage folder (use {userHome} for user directory)"
                        className="path-input"
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          if (electronAPI && electronAPI.selectFolder) {
                            const result = await electronAPI.selectFolder();
                            if (result && !result.canceled && result.filePaths[0]) {
                              setSettings(prev => ({
                                ...prev,
                                pathSettings: {
                                  ...prev.pathSettings,
                                  projectOutput: {
                                    ...prev.pathSettings.projectOutput,
                                    triagePath: result.filePaths[0]
                                  }
                                }
                              }));
                            }
                          }
                        }}
                        title="Browse for folder"
                      >
                        📂
                      </button>
                    </div>
                  </div>
                </div>

                {/* Path Variables Info */}
                <div className="setting-group">
                  <h3>ℹ️ Path Variables</h3>
                  <div className="path-variables-info">
                    <p><strong>{'{userHome}'}</strong> - Automatically replaced with the current user's home directory</p>
                    <p><strong>Example:</strong> {'{userHome}\\Desktop'} becomes 'C:\\Users\\YourName\\Desktop'</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'project-form':
        return (
          <div className="tab-content">
            <div className="settings-content">
              {renderFieldEditor('rfaTypes', 'RFA Type Options', settings.rfaTypes)}
              {renderFieldEditor('regionalTeams', 'Regional Team Options', settings.regionalTeams)}
              {renderFieldEditor('nationalAccounts', 'National Account Options', settings.nationalAccounts)}
              {renderFieldEditor('saveLocations', 'Save Location Options', settings.saveLocations)}
              {renderFieldEditor('complexityLevels', 'Complexity Level Options', settings.complexityLevels)}
              {renderFieldEditor('statusOptions', 'Status Options', settings.statusOptions)}
              {renderFieldEditor('productOptions', 'Product Options', settings.productOptions)}
              {renderFieldEditor('assignedToOptions', 'Assigned To Options', settings.assignedToOptions)}
            </div>
          </div>
        );

      case 'agencies':
        return (
          <div className="tab-content">
            <div className="agencies-management">
              <h2>Agency Management</h2>
              <p className="section-description">Import agencies from Excel or add them manually</p>

              {/* Statistics */}
              {agencyStats && (
                <div className="agency-stats">
                  <div className="stat-card">
                    <span className="stat-number">{agencyStats.totalAgencies}</span>
                    <span className="stat-label">Total Agencies</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">{Object.keys(agencyStats.byRegion || {}).length}</span>
                    <span className="stat-label">Regions</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-number">{Object.keys(agencyStats.byRole || {}).length}</span>
                    <span className="stat-label">Roles</span>
                  </div>
                </div>
              )}

              {/* Import Section */}
              <div className="settings-section">
                <h3>Import from Excel</h3>
                <p className="field-description">
                  Import agency data from an Excel file with columns: Agency Number, Agency Name, Contact Name, 
                  Contact email, Contact Number, Role, Region, Main Contact, SAE
                </p>
                
                <div className="import-section">
                  <div className="import-buttons">
                    <button 
                      className="btn btn-primary"
                      onClick={handleExcelImport}
                      disabled={importStatus?.type === 'loading'}
                    >
                      {importStatus?.type === 'loading' ? '⏳ Importing...' : '📂 Import Excel File'}
                    </button>
                    
                    <button 
                      className="btn btn-secondary"
                      onClick={handleExcelDiagnose}
                      disabled={importStatus?.type === 'loading'}
                    >
                      🔍 Diagnose Excel File
                    </button>
                  </div>
                  
                  {importStatus && (
                    <div className={`import-status ${importStatus.type}`}>
                      <div className="status-message">
                        {importStatus.type === 'loading' && <div className="spinner"></div>}
                        <pre>{importStatus.message}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Entry Section */}
              <div className="settings-section">
                <div className="section-header">
                  <h3>Manual Entry</h3>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAgencyForm(true);
                      setEditingAgency(null);
                      setAgencyFormData({
                        agencyNumber: '',
                        agencyName: '',
                        contactName: '',
                        contactEmail: '',
                        phoneNumber: '',
                        role: '',
                        region: '',
                        mainContact: '',
                        sae: 'No'
                      });
                    }}
                  >
                    ➕ Add New Agency
                  </button>
                </div>

                {showAgencyForm && (
                  <div className="agency-form-container">
                    <div className="agency-form-header">
                      <h4>{editingAgency ? 'Edit Agency' : 'Add New Agency'}</h4>
                      <button 
                        className="close-btn"
                        onClick={() => {
                          setShowAgencyForm(false);
                          setEditingAgency(null);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                    
                    <form onSubmit={handleAgencyFormSubmit} className="agency-form">
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Agency Number</label>
                          <input
                            type="text"
                            value={agencyFormData.agencyNumber}
                            onChange={(e) => setAgencyFormData({...agencyFormData, agencyNumber: e.target.value})}
                            placeholder="Enter agency number"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Agency Name *</label>
                          <input
                            type="text"
                            value={agencyFormData.agencyName}
                            onChange={(e) => setAgencyFormData({...agencyFormData, agencyName: e.target.value})}
                            placeholder="Enter agency name"
                            required
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Contact Name</label>
                          <input
                            type="text"
                            value={agencyFormData.contactName}
                            onChange={(e) => setAgencyFormData({...agencyFormData, contactName: e.target.value})}
                            placeholder="Enter contact name"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Contact Email</label>
                          <input
                            type="email"
                            value={agencyFormData.contactEmail}
                            onChange={(e) => setAgencyFormData({...agencyFormData, contactEmail: e.target.value})}
                            placeholder="Enter contact email"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Contact Number</label>
                          <input
                            type="tel"
                            value={agencyFormData.phoneNumber}
                            onChange={(e) => setAgencyFormData({...agencyFormData, phoneNumber: e.target.value})}
                            placeholder="Enter contact number"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Role</label>
                          <input
                            type="text"
                            value={agencyFormData.role}
                            onChange={(e) => setAgencyFormData({...agencyFormData, role: e.target.value})}
                            placeholder="Enter role"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>Region</label>
                          <select
                            value={agencyFormData.region}
                            onChange={(e) => setAgencyFormData({...agencyFormData, region: e.target.value})}
                          >
                            <option value="">Select region</option>
                            <option value="Region 1">Region 1</option>
                            <option value="Region 2">Region 2</option>
                            <option value="Region 3">Region 3</option>
                            <option value="Region 4">Region 4</option>
                            <option value="Region 5">Region 5</option>
                            <option value="International">International</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>
                        
                        <div className="form-group">
                          <label>Main Contact</label>
                          <input
                            type="text"
                            value={agencyFormData.mainContact}
                            onChange={(e) => setAgencyFormData({...agencyFormData, mainContact: e.target.value})}
                            placeholder="Enter main contact"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>SAE</label>
                          <select
                            value={agencyFormData.sae}
                            onChange={(e) => setAgencyFormData({...agencyFormData, sae: e.target.value})}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => {
                          setShowAgencyForm(false);
                          setEditingAgency(null);
                        }}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                          {editingAgency ? 'Update Agency' : 'Add Agency'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* Existing Agencies List */}
              <div className="settings-section">
                <h3>Existing Agencies ({agencies.length})</h3>
                
                {agencies.length === 0 ? (
                  <div className="no-agencies">
                    <p>No agencies found. Import from Excel or add manually.</p>
                  </div>
                ) : (
                  <div className="agencies-list">
                    <div className="agencies-table">
                      <div className="table-header">
                        <span>Agency Name</span>
                        <span>Contact</span>
                        <span>Region</span>
                        <span>Role</span>
                        <span>Actions</span>
                      </div>
                      
                      {agencies.slice(0, 50).map(agency => (
                        <div key={agency.id} className="table-row">
                          <span className="agency-name" title={agency.agencyName}>
                            {agency.agencyName}
                          </span>
                          <span className="contact-info">
                            <div>{agency.contactName}</div>
                            <div className="contact-email">{agency.contactEmail}</div>
                          </span>
                          <span className="region">{agency.region}</span>
                          <span className="role">{agency.role}</span>
                          <span className="actions">
                            <button 
                              className="btn-icon edit-btn"
                              onClick={() => handleEditAgency(agency)}
                              title="Edit agency"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn-icon delete-btn"
                              onClick={() => handleDeleteAgency(agency)}
                              title="Delete agency"
                            >
                              🗑️
                            </button>
                          </span>
                        </div>
                      ))}
                      
                      {agencies.length > 50 && (
                        <div className="table-footer">
                          <p>Showing first 50 agencies. Use the Agency Directory to search all agencies.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'triage-calc':
        return (
          <div className="tab-content">
            <div className="settings-field">
              <h3>Calculation Settings</h3>
              <p className="field-description">Configure multipliers and thresholds for triage calculations</p>
              
              <div className="calculation-settings">
                <div className="setting-group">
                  <h4>LMP Multipliers (minutes)</h4>
                  <div className="setting-row">
                    <label>Small:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.lmpMultipliers.small}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          lmpMultipliers: {
                            ...prev.calculationSettings.lmpMultipliers,
                            small: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Medium:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.lmpMultipliers.medium}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          lmpMultipliers: {
                            ...prev.calculationSettings.lmpMultipliers,
                            medium: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Large:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.lmpMultipliers.large}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          lmpMultipliers: {
                            ...prev.calculationSettings.lmpMultipliers,
                            large: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>ARP Multipliers (minutes)</h4>
                  <div className="setting-row">
                    <label>ARP 8:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp8}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp8: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>ARP 16:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp16}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp16: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>ARP 32:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp32}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp32: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>ARP 48:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.arpMultipliers.arp48}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          arpMultipliers: {
                            ...prev.calculationSettings.arpMultipliers,
                            arp48: parseInt(e.target.value) || 0
                          }
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <h4>Room Multipliers</h4>
                  <div className="setting-row">
                    <label>Room Multiplier (min/room):</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.roomMultiplier}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          roomMultiplier: parseInt(e.target.value) || 0
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>Riser Multiplier (min/room):</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.riserMultiplier}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          riserMultiplier: parseInt(e.target.value) || 0
                        }
                      }))}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="setting-row">
                    <label>E-Sheets Multiplier:</label>
                    <input
                      type="number"
                      value={settings.calculationSettings.esheetsMultiplier}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        calculationSettings: {
                          ...prev.calculationSettings,
                          esheetsMultiplier: parseFloat(e.target.value) || 0
                        }
                      }))}
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Application Settings</h1>
        <p>Manage application configuration and form options</p>
      </div>

      {/* Tab Navigation */}
      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.fullLabel}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Settings Actions */}
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            const defaultSettings = {
              rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE', 'GRAPHICS', 'PHOTOMETRICS', 'Consultation'],
              regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
              nationalAccounts: ['Default', 'ARBYS', 'MCDONALDS', 'WALMART', 'TARGET', 'HOMEDEPOT', 'LOWES', 'KROGER', 'CVS', 'WALGREENS'],
              saveLocations: ['Triage', 'Desktop', 'Server'],
              complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
              statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
              productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
              assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger'],
              calculationSettings: {
                lmpMultipliers: { small: 15, medium: 30, large: 45 },
                arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
                roomMultiplier: 2,
                riserMultiplier: 1,
                esheetsMultiplier: 2,
                defaultReviewSetup: 0.5,
                defaultSOO: 0.5,
                defaultNumOfPages: 1,
                pageBonusThreshold: 3,
                pageBonusMultiplier: 3,
                selfQCHigh: 12,
                selfQCLow: 4,
                selfQCDefault: 0.5,
                fluffPercentage: 10
              },
              pathSettings: {
                templates: {
                  primaryPath: '\\\\10.3.10.30\\DAS\\DAS References\\!!!Templates For Project Creator',
                  fallbackPath: '{userHome}\\Desktop\\1) Triage\\!!!Templates For Project Creator',
                  agentRequirementsPath: '\\\\10.3.10.30\\DAS\\Agent Requirements'
                },
                projectOutput: {
                  defaultLocation: 'desktop',
                  customPath: '{userHome}\\Desktop',
                  triagePath: '{userHome}\\Desktop\\1) Triage'
                }
              }
            };
            setSettings(defaultSettings);
            // Update both services
            dropdownOptionsService.updateOptions(defaultSettings);
            triageCalculationService.updateSettings(defaultSettings);
          }}
        >
          Reset to Defaults
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveSettings}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

export default Settings;
