import React, { useState, useEffect } from 'react';
import EmailTemplateLibrary from '../EmailTemplateLibrary';

function AgencyEmailTemplatesTab({ agency }) {
  const [templates, setTemplates] = useState([]);
  const [frequentlyUsed, setFrequentlyUsed] = useState([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [templateUsage, setTemplateUsage] = useState({});

  useEffect(() => {
    if (agency) {
      loadTemplates();
      loadTemplateUsage();
    }
  }, [agency]);

  const loadTemplates = async () => {
    try {
      const result = await window.electronAPI.emailTemplatesLoadAll();
      if (result && result.success) {
        setTemplates(result.templates || []);
        // Get frequently used templates for this agency
        const agencyTemplates = result.templates.filter(t => 
          t.agencySpecific === agency.agencyName || 
          t.categories?.includes('agency') ||
          !t.agencySpecific
        );
        setFrequentlyUsed(agencyTemplates.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadTemplateUsage = async () => {
    // TODO: Load template usage analytics for this agency
    // For now, use placeholder data
    const usage = agency?.templateUsage || {};
    setTemplateUsage(usage);
  };

  const handleUseTemplate = async (template) => {
    try {
      // Open email template selection modal with this agency pre-selected
      // This would integrate with the existing EmailTemplateLibrary component
      setShowTemplateLibrary(true);
    } catch (error) {
      console.error('Error using template:', error);
    }
  };

  const getUsageCount = (templateId) => {
    return templateUsage[templateId] || 0;
  };

  return (
    <div className="space-y-6">
      {/* Quick Access Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Frequently Used Templates</h2>
          <button
            onClick={() => setShowTemplateLibrary(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>📋</span>
            <span>Browse All Templates</span>
          </button>
        </div>

        {frequentlyUsed.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No frequently used templates yet. Click "Browse All Templates" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {frequentlyUsed.map(template => (
              <div
                key={template.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleUseTemplate(template)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                  {getUsageCount(template.id) > 0 && (
                    <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                      {getUsageCount(template.id)} uses
                    </span>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{template.description}</p>
                )}
                {template.category && (
                  <span className="inline-block px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-xs">
                    {template.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Usage Analytics */}
      {Object.keys(templateUsage).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Template Usage Analytics</h2>
          <div className="space-y-3">
            {Object.entries(templateUsage)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([templateId, count]) => {
                const template = templates.find(t => t.id === templateId);
                if (!template) return null;
                return (
                  <div
                    key={templateId}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{template.name}</p>
                      {template.category && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{template.category}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{count}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">uses</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Agency-Specific Template Customization */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Agency-Specific Customization</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 <strong>Tip:</strong> You can customize email templates specifically for this agency. 
            Templates can be personalized with agency-specific information like contact names, 
            agency numbers, and preferred communication styles.
          </p>
        </div>
        <div className="mt-4">
          <button
            onClick={() => setShowTemplateLibrary(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all"
          >
            Customize Templates
          </button>
        </div>
      </div>

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <EmailTemplateLibrary
          isOpen={showTemplateLibrary}
          onClose={() => setShowTemplateLibrary(false)}
        />
      )}
    </div>
  );
}

export default AgencyEmailTemplatesTab;

