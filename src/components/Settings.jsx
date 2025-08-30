import React, { useState, useEffect } from 'react';
import './Settings.css';

// Access ipcRenderer from the global scope (available due to nodeIntegration: true)
const { ipcRenderer } = window.require('electron');

function Settings() {
  const [settings, setSettings] = useState({
    rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout'],
    regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
    nationalAccounts: ['N/A', "Arby's"],
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

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const savedSettings = await ipcRenderer.invoke('settings-load');
      if (savedSettings && savedSettings.success) {
        setSettings(prev => ({ ...prev, ...savedSettings.data }));
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
      const result = await ipcRenderer.invoke('settings-save', settings);
      if (result && result.success) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (field, index = -1) => {
    setEditingField(field);
    setEditingIndex(index);
    setNewValue(index >= 0 ? settings[field][index] : '');
  };

  const cancelEditing = () => {
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
      return newSettings;
    });

    cancelEditing();
  };

  const deleteItem = (field, index) => {
    if (confirm('Are you sure you want to delete this item?')) {
      setSettings(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }));
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
      return { ...prev, [field]: newArray };
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
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                  placeholder="Enter new value..."
                  autoFocus
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
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
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

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Application Settings</h1>
        <p>Manage dropdown options for form fields</p>
      </div>

      <div className="settings-content">
        {renderFieldEditor('rfaTypes', 'RFA Type Options', settings.rfaTypes)}
        {renderFieldEditor('regionalTeams', 'Regional Team Options', settings.regionalTeams)}
        {renderFieldEditor('nationalAccounts', 'National Account Options', settings.nationalAccounts)}
                 {renderFieldEditor('complexityLevels', 'Complexity Level Options', settings.complexityLevels)}
         {renderFieldEditor('statusOptions', 'Status Options', settings.statusOptions)}
         {renderFieldEditor('productOptions', 'Product Options', settings.productOptions)}
         {renderFieldEditor('assignedToOptions', 'Assigned To Options', settings.assignedToOptions)}
         
         {/* Calculation Settings */}
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

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSettings({
            rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout'],
            regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
            nationalAccounts: ['N/A', "Arby's"],
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
          })}
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
