import React, { useState, useEffect } from 'react';

function AgencyDesignRequirementsTab({ agency }) {
  const [designRequirements, setDesignRequirements] = useState({
    specifications: '',
    preferredStandards: '',
    templates: '',
    customPreferences: '',
    bestPractices: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agency) {
      loadDesignRequirements();
    }
  }, [agency]);

  const loadDesignRequirements = async () => {
    // TODO: Load from extended agency data
    setLoading(true);
    try {
      const requirements = agency?.designRequirements || {};
      setDesignRequirements({
        specifications: requirements.specifications || '',
        preferredStandards: requirements.preferredStandards || '',
        templates: requirements.templates || '',
        customPreferences: requirements.customPreferences || '',
        bestPractices: requirements.bestPractices || ''
      });
    } catch (error) {
      console.error('Error loading design requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        designRequirements
      });

      if (result.success) {
        alert('Design requirements saved successfully!');
      } else {
        throw new Error(result.error || 'Failed to save design requirements');
      }
    } catch (error) {
      console.error('Error saving design requirements:', error);
      alert('Failed to save design requirements: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setDesignRequirements(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading design requirements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Design Requirements</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Save</span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-6">
        {/* Design Specifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Design Specifications</h3>
          <textarea
            value={designRequirements.specifications}
            onChange={(e) => handleChange('specifications', e.target.value)}
            placeholder="Enter design specifications and requirements for this agency..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="6"
          />
        </div>

        {/* Preferred Standards */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Preferred Design Standards</h3>
          <textarea
            value={designRequirements.preferredStandards}
            onChange={(e) => handleChange('preferredStandards', e.target.value)}
            placeholder="List preferred design standards, codes, or guidelines..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="4"
          />
        </div>

        {/* Templates */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Templates & Guidelines</h3>
          <textarea
            value={designRequirements.templates}
            onChange={(e) => handleChange('templates', e.target.value)}
            placeholder="Specify preferred templates, formats, or design guidelines..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="4"
          />
        </div>

        {/* Custom Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Custom Design Preferences</h3>
          <textarea
            value={designRequirements.customPreferences}
            onChange={(e) => handleChange('customPreferences', e.target.value)}
            placeholder="Enter any custom design preferences or special requirements..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="4"
          />
        </div>

        {/* Best Practices */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Best Practices & Guidelines</h3>
          <textarea
            value={designRequirements.bestPractices}
            onChange={(e) => handleChange('bestPractices', e.target.value)}
            placeholder="Document best practices, lessons learned, or important guidelines for working with this agency..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows="6"
          />
        </div>
      </div>
    </div>
  );
}

export default AgencyDesignRequirementsTab;

