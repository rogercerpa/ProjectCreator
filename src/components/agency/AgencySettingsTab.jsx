import React, { useState, useEffect } from 'react';

function AgencySettingsTab({ agency }) {
  const [customFields, setCustomFields] = useState([]);
  const [tags, setTags] = useState([]);
  const [newField, setNewField] = useState({ name: '', value: '', type: 'text' });
  const [newTag, setNewTag] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (agency) {
      loadSettings();
    }
  }, [agency]);

  const loadSettings = async () => {
    // TODO: Load from extended agency data
    const fields = agency?.customFields ? Object.entries(agency.customFields).map(([name, value]) => ({
      id: `field-${name}`,
      name,
      value,
      type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text'
    })) : [];
    const agencyTags = agency?.tags || [];

    setCustomFields(fields);
    setTags(agencyTags);
  };

  const handleAddField = () => {
    if (!newField.name.trim()) return;

    const field = {
      id: `field-${Date.now()}`,
      ...newField
    };

    setCustomFields([...customFields, field]);
    setNewField({ name: '', value: '', type: 'text' });
    setShowAddField(false);
  };

  const handleUpdateField = (fieldId, value) => {
    setCustomFields(customFields.map(field =>
      field.id === fieldId ? { ...field, value } : field
    ));
  };

  const handleDeleteField = (fieldId) => {
    if (window.confirm('Are you sure you want to delete this custom field?')) {
      setCustomFields(customFields.filter(field => field.id !== fieldId));
    }
  };

  const handleAddTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return;

    setTags([...tags, newTag.trim()]);
    setNewTag('');
  };

  const handleDeleteTag = (tagToDelete) => {
    setTags(tags.filter(tag => tag !== tagToDelete));
  };

  const handleSave = async () => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    try {
      const customFieldsObj = {};
      customFields.forEach(field => {
        let value = field.value;
        if (field.type === 'number') {
          value = parseFloat(value) || 0;
        } else if (field.type === 'boolean') {
          value = value === 'true' || value === true;
        }
        customFieldsObj[field.name] = value;
      });

      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        customFields: customFieldsObj,
        tags
      });

      if (result.success) {
        alert('Settings saved successfully!');
      } else {
        throw new Error(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings: ' + error.message);
    }
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      // Use the save file dialog to get the output path
      const result = await window.electronAPI.saveFile({
        title: 'Export Agency Data to Excel',
        defaultPath: 'agencies_export.xlsx',
        filters: [
          { name: 'Excel Files', extensions: ['xlsx'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return;
      }

      // Export all agencies (includes extended data)
      const exportResult = await window.electronAPI.agenciesExportExcel(result.filePath);

      if (exportResult.success) {
        alert(`Successfully exported ${exportResult.exportedCount || 0} agencies to:\n${result.filePath}`);
      } else {
        throw new Error(exportResult.error || 'Failed to export to Excel');
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Custom Fields & Tags</h2>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
        >
          <span>💾</span>
          <span>Save Settings</span>
        </button>
      </div>

      {/* Custom Fields Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Fields</h3>
          <button
            onClick={() => setShowAddField(!showAddField)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Field</span>
          </button>
        </div>

        {showAddField && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                    placeholder="Field name..."
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="date">Date</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Initial Value
                </label>
                {newField.type === 'boolean' ? (
                  <select
                    value={newField.value}
                    onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select...</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : newField.type === 'date' ? (
                  <input
                    type="date"
                    value={newField.value}
                    onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                ) : (
                  <input
                    type={newField.type}
                    value={newField.value}
                    onChange={(e) => setNewField({ ...newField, value: e.target.value })}
                    placeholder="Field value..."
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddField}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
                >
                  Add Field
                </button>
                <button
                  onClick={() => {
                    setNewField({ name: '', value: '', type: 'text' });
                    setShowAddField(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {customFields.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No custom fields yet. Click "Add Field" to create one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customFields.map(field => (
              <div
                key={field.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center gap-4"
              >
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.name}
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({field.type})</span>
                  </label>
                  {field.type === 'boolean' ? (
                    <select
                      value={field.value}
                      onChange={(e) => handleUpdateField(field.id, e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : field.type === 'date' ? (
                    <input
                      type="date"
                      value={field.value}
                      onChange={(e) => handleUpdateField(field.id, e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={field.value}
                      onChange={(e) => handleUpdateField(field.id, e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                </div>
                <button
                  onClick={() => handleDeleteField(field.id)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all"
                  title="Delete field"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h3>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="Add a tag..."
            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleAddTag}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all"
          >
            Add Tag
          </button>
        </div>

        {tags.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No tags yet. Add tags to categorize this agency.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium"
              >
                {tag}
                <button
                  onClick={() => handleDeleteTag(tag)}
                  className="text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-100"
                  title="Remove tag"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Excel Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Export</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Export all agency data to Excel format. This will include all basic agency information as well as 
          extended data (design requirements, product focus, training, market strategy, notes, tasks, etc.).
        </p>
        <button
          onClick={handleExportToExcel}
          disabled={exporting}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {exporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📊</span>
              <span>Export to Excel</span>
            </>
          )}
        </button>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          💡 <strong>Custom Fields:</strong> Add custom metadata fields to store additional information 
          specific to this agency. Fields can be text, numbers, dates, or boolean values.
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
          💡 <strong>Tags:</strong> Use tags to categorize and filter agencies. Tags can be used for 
          custom filtering and organization.
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
          💡 <strong>Data Storage:</strong> All agency data is automatically saved to JSON format in 
          <code className="bg-blue-100 dark:bg-blue-900/30 px-1 rounded">~/.project-creator/agencies.json</code>. 
          Use Excel export for backup or sharing purposes.
        </p>
      </div>
    </div>
  );
}

export default AgencySettingsTab;

