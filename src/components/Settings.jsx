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
    }
  });

  const [editingField, setEditingField] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [newValue, setNewValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Reset editing state when tab changes
  useEffect(() => {
    setEditingField(null);
    setEditingIndex(-1);
    setNewValue('');
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
      label: 'App Info',
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
