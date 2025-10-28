import React, { useState, useEffect } from 'react';

function EmailTemplateCreator({ 
  isOpen, 
  onClose, 
  onSave, 
  editingTemplate = null,
  initialCategory = 'General' 
}) {
  const [template, setTemplate] = useState({
    name: '',
    category: initialCategory,
    subject: '',
    content: '',
    variables: []
  });
  
  const [availableVariables, setAvailableVariables] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState({
    AgencyName: 'Sample Agency',
    ContactName: 'John Smith',
    Region: 'Southeast',
    AgentCount: '5',
    CurrentDate: new Date().toLocaleDateString(),
    UserName: 'Your Name'
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);

  // Load available variables on component mount
  useEffect(() => {
    loadAvailableVariables();
  }, []);

  // Set editing template data when provided
  useEffect(() => {
    if (editingTemplate) {
      setTemplate({
        name: editingTemplate.name || '',
        category: editingTemplate.category || 'General',
        subject: editingTemplate.subject || '',
        content: editingTemplate.content || '',
        variables: editingTemplate.variables || []
      });
    } else {
      // Reset for new template
      setTemplate({
        name: '',
        category: initialCategory,
        subject: '',
        content: '',
        variables: []
      });
    }
    setErrors({});
  }, [editingTemplate, initialCategory, isOpen]);

  const loadAvailableVariables = async () => {
    try {
      const result = await window.electronAPI.emailTemplatesGetVariables();
      if (result.success) {
        setAvailableVariables(result.variables);
      }
    } catch (error) {
      console.error('Error loading template variables:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setTemplate(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const insertVariable = (variableKey) => {
    const variable = `{${variableKey}}`;
    const contentTextarea = document.getElementById('template-content');
    
    if (contentTextarea) {
      const start = contentTextarea.selectionStart;
      const end = contentTextarea.selectionEnd;
      const newContent = 
        template.content.substring(0, start) + 
        variable + 
        template.content.substring(end);
      
      handleInputChange('content', newContent);
      
      // Reset cursor position after variable
      setTimeout(() => {
        contentTextarea.focus();
        contentTextarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const handleImageUpload = async () => {
    try {
      setUploadingImage(true);
      
      // Use Electron file dialog to select image
      const result = await window.electronAPI.selectFile({
        title: 'Select Image for Email',
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result) {
        // Convert image to base64 data URL
        const imageResult = await window.electronAPI.emailConvertImageToBase64(result);
        
        if (!imageResult.success) {
          alert(`Failed to process image: ${imageResult.error}`);
          return;
        }
        
        const { dataUrl, fileName, size } = imageResult;
        
        // Check file size (warn if > 1MB)
        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        if (size > 1024 * 1024) {
          const proceed = window.confirm(
            `This image is ${sizeMB}MB. Large images may cause email delivery issues. Continue?`
          );
          if (!proceed) {
            return;
          }
        }
        
        // Insert actual image HTML with base64 data
        const imageHtml = `\n<img src="${dataUrl}" alt="${fileName}" style="max-width: 100%; height: auto; border-radius: 4px;" title="${fileName}" />\n\n`;
        
        const contentTextarea = document.getElementById('template-content');
        if (contentTextarea) {
          const start = contentTextarea.selectionStart;
          const end = contentTextarea.selectionEnd;
          const newContent = 
            template.content.substring(0, start) + 
            imageHtml + 
            template.content.substring(end);
          
          handleInputChange('content', newContent);
          
          // Reset cursor position after image
          setTimeout(() => {
            contentTextarea.focus();
            contentTextarea.setSelectionRange(start + imageHtml.length, start + imageHtml.length);
          }, 0);
        }
        
        // Show success message with note about manual attachment
        console.log(`Image embedded in template: ${fileName} (${sizeMB}MB) - Note: Images will need to be attached manually in Outlook`);
        
        // Show user notification for first image in this template
        const hadImagesBefore = template.content.includes('<img');
        if (!hadImagesBefore) {
          alert(`Image added to template! Note: When sending emails, images will need to be attached manually in Outlook as mailto links don't support embedded images.`);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const insertVariableInSubject = (variableKey) => {
    const variable = `{${variableKey}}`;
    const subjectInput = document.getElementById('template-subject');
    
    if (subjectInput) {
      const start = subjectInput.selectionStart;
      const end = subjectInput.selectionEnd;
      const newSubject = 
        template.subject.substring(0, start) + 
        variable + 
        template.subject.substring(end);
      
      handleInputChange('subject', newSubject);
      
      // Reset cursor position after variable
      setTimeout(() => {
        subjectInput.focus();
        subjectInput.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const applyPreviewVariables = (text) => {
    let previewText = text;
    Object.entries(previewData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      previewText = previewText.replace(regex, value);
    });
    return previewText;
  };

  const validateTemplate = () => {
    const newErrors = {};
    
    if (!template.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!template.subject.trim()) {
      newErrors.subject = 'Email subject is required';
    }
    
    if (!template.content.trim()) {
      newErrors.content = 'Email content is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateTemplate()) {
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        ...template,
        variables: availableVariables.filter(v => 
          template.subject.includes(`{${v.key}}`) || 
          template.content.includes(`{${v.key}}`)
        )
      };

      await onSave(templateData);
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      setErrors({ general: 'Failed to save template. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (template.name || template.subject || template.content) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1003] p-5">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-[90%] max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <h2 className="m-0 text-gray-800 dark:text-gray-200 text-2xl font-semibold">
            {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
          </h2>
          <button 
            className="bg-transparent border-none text-2xl text-gray-600 dark:text-gray-400 cursor-pointer p-1 rounded transition-all hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200" 
            onClick={handleCancel}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar">
          {/* Template Basic Info */}
          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="template-name">Template Name *</label>
              <input
                id="template-name"
                type="text"
                value={template.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter template name..."
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="template-category">Category</label>
              <select
                id="template-category"
                value={template.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
              >
                <option value="General">General</option>
                <option value="Project Updates">Project Updates</option>
                <option value="Announcements">Announcements</option>
                <option value="Follow-ups">Follow-ups</option>
                <option value="Urgent">Urgent</option>
                <option value="Marketing">Marketing</option>
                <option value="Support">Support</option>
              </select>
            </div>
          </div>

          {/* Preview Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-md p-1 self-start">
            <button
              className={`px-4 py-2 border-none rounded transition-all text-sm flex items-center gap-1.5 ${
                !previewMode 
                  ? 'bg-white dark:bg-gray-800 shadow text-primary-600 dark:text-primary-400' 
                  : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => setPreviewMode(false)}
            >
              ✏️ Edit
            </button>
            <button
              className={`px-4 py-2 border-none rounded transition-all text-sm flex items-center gap-1.5 ${
                previewMode 
                  ? 'bg-white dark:bg-gray-800 shadow text-primary-600 dark:text-primary-400' 
                  : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              onClick={() => setPreviewMode(true)}
            >
              👁️ Preview
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden">
            {!previewMode ? (
              // Edit Mode
              <div className="grid grid-cols-[1fr_300px] gap-5 h-full lg:grid-cols-1">
                <div className="flex flex-col gap-4">
                  {/* Subject Field */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="template-subject">Email Subject *</label>
                    <input
                      id="template-subject"
                      type="text"
                      value={template.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      placeholder="Enter email subject..."
                      className={errors.subject ? 'error' : ''}
                    />
                    {errors.subject && <span className="error-message">{errors.subject}</span>}
                  </div>

                  {/* Content Field */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label htmlFor="template-content">Email Content *</label>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={handleImageUpload}
                        disabled={uploadingImage}
                        title="Add image to email content"
                      >
                        {uploadingImage ? '⏳' : '🖼️'} {uploadingImage ? 'Uploading...' : 'Add Image'}
                      </button>
                    </div>
                    <textarea
                      id="template-content"
                      value={template.content}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      placeholder="Enter email content...&#10;&#10;Use variables like {AgencyName}, {ContactName}, etc. to personalize your emails.&#10;&#10;Click 'Add Image' to include images in your email."
                      rows={12}
                      className={errors.content ? 'error' : ''}
                    />
                    {errors.content && <span className="error-message">{errors.content}</span>}
                    <div className="mt-2 p-3 bg-info-50 dark:bg-info-900/20 border-l-4 border-info-500 dark:border-info-700 rounded text-xs text-info-800 dark:text-info-200">
                      <small>💡 Tip: You can mix text, variables, and images. Images will be shown in preview but need to be attached manually in Outlook.</small>
                    </div>
                  </div>
                </div>

                {/* Variables Panel */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 h-fit lg:col-span-full">
                  <h3 className="m-0 mb-2 text-base font-semibold text-gray-800 dark:text-gray-200">Available Variables</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                    Click to insert variables into your template
                  </p>
                  
                  <div className="flex flex-col gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">For Subject Line</h4>
                      <div className="flex flex-wrap gap-2">
                        {availableVariables.slice(0, 6).map(variable => (
                          <button
                            key={variable.key}
                            className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-primary-600 dark:text-primary-400 cursor-pointer transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-500 dark:hover:border-primary-500"
                            onClick={() => insertVariableInSubject(variable.key)}
                            title={variable.description}
                          >
                            {`{${variable.key}}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">For Email Content</h4>
                      <div className="flex flex-wrap gap-2">
                        {availableVariables.map(variable => (
                          <button
                            key={variable.key}
                            className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono text-primary-600 dark:text-primary-400 cursor-pointer transition-all hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-500 dark:hover:border-primary-500"
                            onClick={() => insertVariable(variable.key)}
                            title={variable.description}
                          >
                            {`{${variable.key}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Preview Mode
              <div className="flex flex-col gap-5 h-full overflow-auto custom-scrollbar">
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="m-0 mb-3 text-base font-semibold text-gray-800 dark:text-gray-200">Preview with Sample Data</h3>
                  <div className="grid grid-cols-3 gap-3 lg:grid-cols-2 md:grid-cols-1">
                    <input
                      type="text"
                      placeholder="Agency Name"
                      value={previewData.AgencyName}
                      onChange={(e) => setPreviewData(prev => ({...prev, AgencyName: e.target.value}))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    />
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={previewData.ContactName}
                      onChange={(e) => setPreviewData(prev => ({...prev, ContactName: e.target.value}))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    />
                    <input
                      type="text"
                      placeholder="Region"
                      value={previewData.Region}
                      onChange={(e) => setPreviewData(prev => ({...prev, Region: e.target.value}))}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-inner">
                  <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-200">
                    <strong>Subject:</strong> {applyPreviewVariables(template.subject)}
                  </div>
                  <div 
                    className="px-4 py-4 text-sm text-gray-800 dark:text-gray-200 leading-relaxed min-h-[300px]"
                    dangerouslySetInnerHTML={{
                      __html: applyPreviewVariables(template.content)
                        .replace(/\n/g, '<br>')
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="p-4 bg-error-50 dark:bg-error-900/20 border-l-4 border-error-500 dark:border-error-700 rounded text-error-800 dark:text-error-200 text-sm">
              {errors.general}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button 
              className="btn-secondary" 
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Save Template')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailTemplateCreator;
