import React, { useState, useEffect } from 'react';

const DEFAULT_TEMPLATE = `Hello {{repName}},

Thank you for submittal this request to the Design Solutions team. This request falls under the Paid services package, please proceed on submitting your order and once received we will proceed with your project.

Lighting Pages: {{lightingPages}}
Charge per page: {{costPerPage}}
Total cost for the service: {{totalFee}}

Thank you`;

const STORAGE_KEY_TEMPLATE = 'das-paid-services-email-template';
const STORAGE_KEY_SIGNATURE = 'das-paid-services-email-signature';

const EmailTemplateEditor = ({ isOpen, onClose, project = {} }) => {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [signature, setSignature] = useState('');
  const [preview, setPreview] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved template and signature from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedTemplate = localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE;
      const savedSignature = localStorage.getItem(STORAGE_KEY_SIGNATURE) || '';
      setTemplate(savedTemplate);
      setSignature(savedSignature);
      setHasChanges(false);
      generatePreview(savedTemplate, savedSignature, project);
    }
  }, [isOpen, project]);

  // Generate preview when template, signature, or project changes
  useEffect(() => {
    if (isOpen) {
      generatePreview(template, signature, project);
    }
  }, [template, signature, project, isOpen]);

  const generatePreview = (templateText, signatureText, projectData = {}) => {
    const lightingPages = Number(projectData?.dasLightingPages || 0);
    const costPerPage = Number(projectData?.dasCostPerPage || 0);
    const totalFee = Number(projectData?.dasFee || 0);

    // Extract rep name from repContacts or use default
    const extractRepName = (repContacts) => {
      if (!repContacts) return 'there';
      let cleaned = repContacts;
      const emailMatch = repContacts.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch) {
        cleaned = cleaned.replace(emailMatch[0], '');
      }
      cleaned = cleaned.replace(/[\(\)<>\[\]]/g, '').trim();
      if (!cleaned) return 'there';
      if (cleaned.includes(',')) {
        const parts = cleaned.split(',');
        if (parts[1]) {
          cleaned = parts[1].trim();
        }
      }
      const firstName = cleaned.split(/\s+/)[0];
      return firstName || 'there';
    };

    const repName = extractRepName(projectData?.repContacts);
    const formatUSD = (value) => {
      const amount = Number(value || 0);
      return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      });
    };

    let previewText = templateText
      .replace(/\{\{repName\}\}/g, repName)
      .replace(/\{\{lightingPages\}\}/g, lightingPages.toString())
      .replace(/\{\{costPerPage\}\}/g, formatUSD(costPerPage))
      .replace(/\{\{totalFee\}\}/g, formatUSD(totalFee));

    if (signatureText.trim()) {
      previewText += `\n\n${signatureText.trim()}`;
    }

    setPreview(previewText);
  };

  const handleTemplateChange = (e) => {
    setTemplate(e.target.value);
    setHasChanges(true);
  };

  const handleSignatureChange = (e) => {
    setSignature(e.target.value);
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY_TEMPLATE, template);
    localStorage.setItem(STORAGE_KEY_SIGNATURE, signature);
    setHasChanges(false);
    // Show success message
    alert('Email template and signature saved successfully!');
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset to the default template? This will discard your changes.')) {
      setTemplate(DEFAULT_TEMPLATE);
      setSignature('');
      setHasChanges(true);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Do you want to save before closing?')) {
        handleSave();
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            ✉️ Email Template Editor
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Template Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Email Template
              </label>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                Reset to Default
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Use placeholders: {'{{repName}}'}, {'{{lightingPages}}'}, {'{{costPerPage}}'}, {'{{totalFee}}'}
            </p>
            <textarea
              value={template}
              onChange={handleTemplateChange}
              className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
              placeholder="Enter email template..."
            />
          </div>

          {/* Signature Editor */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Email Signature
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Optional: Add your email signature (will be appended to the email)
            </p>
            <textarea
              value={signature}
              onChange={handleSignatureChange}
              className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="Enter your email signature..."
            />
          </div>

          {/* Preview */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
              Preview
            </label>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
                {preview || 'Preview will appear here...'}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {hasChanges && <span className="text-warning-600">You have unsaved changes</span>}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-primary"
              disabled={!hasChanges}
            >
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export function to get saved template and signature
export const getSavedEmailTemplate = () => {
  return localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE;
};

export const getSavedEmailSignature = () => {
  return localStorage.getItem(STORAGE_KEY_SIGNATURE) || '';
};

export default EmailTemplateEditor;

