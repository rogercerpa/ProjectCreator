import React, { useState, useEffect } from 'react';
import './EmailTemplateCreator.css';

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
    <div className="email-template-creator-overlay">
      <div className="email-template-creator">
        <div className="template-creator-header">
          <h2>
            {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
          </h2>
          <button 
            className="close-btn" 
            onClick={handleCancel}
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="template-creator-content">
          {/* Template Basic Info */}
          <div className="template-basic-info">
            <div className="form-group">
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

            <div className="form-group">
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
          <div className="preview-toggle">
            <button
              className={`toggle-btn ${!previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(false)}
            >
              ✏️ Edit
            </button>
            <button
              className={`toggle-btn ${previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(true)}
            >
              👁️ Preview
            </button>
          </div>

          {/* Main Content Area */}
          <div className="template-main-content">
            {!previewMode ? (
              // Edit Mode
              <div className="edit-mode">
                <div className="template-fields">
                  {/* Subject Field */}
                  <div className="form-group">
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
                  <div className="form-group">
                    <div className="content-field-header">
                      <label htmlFor="template-content">Email Content *</label>
                      <button
                        type="button"
                        className="btn btn-outline image-upload-btn"
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
                    <div className="content-help">
                      <small>💡 Tip: You can mix text, variables, and images. Images will be shown in preview but need to be attached manually in Outlook.</small>
                    </div>
                  </div>
                </div>

                {/* Variables Panel */}
                <div className="variables-panel">
                  <h3>Available Variables</h3>
                  <p className="variables-help">
                    Click to insert variables into your template
                  </p>
                  
                  <div className="variables-categories">
                    <div className="variable-category">
                      <h4>For Subject Line</h4>
                      <div className="variable-buttons">
                        {availableVariables.slice(0, 6).map(variable => (
                          <button
                            key={variable.key}
                            className="variable-btn"
                            onClick={() => insertVariableInSubject(variable.key)}
                            title={variable.description}
                          >
                            {`{${variable.key}}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="variable-category">
                      <h4>For Email Content</h4>
                      <div className="variable-buttons">
                        {availableVariables.map(variable => (
                          <button
                            key={variable.key}
                            className="variable-btn"
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
              <div className="preview-mode">
                <div className="preview-controls">
                  <h3>Preview with Sample Data</h3>
                  <div className="preview-data-controls">
                    <input
                      type="text"
                      placeholder="Agency Name"
                      value={previewData.AgencyName}
                      onChange={(e) => setPreviewData(prev => ({...prev, AgencyName: e.target.value}))}
                    />
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={previewData.ContactName}
                      onChange={(e) => setPreviewData(prev => ({...prev, ContactName: e.target.value}))}
                    />
                    <input
                      type="text"
                      placeholder="Region"
                      value={previewData.Region}
                      onChange={(e) => setPreviewData(prev => ({...prev, Region: e.target.value}))}
                    />
                  </div>
                </div>

                <div className="email-preview">
                  <div className="email-preview-header">
                    <strong>Subject:</strong> {applyPreviewVariables(template.subject)}
                  </div>
                  <div 
                    className="email-preview-content"
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
            <div className="error-banner">
              {errors.general}
            </div>
          )}

          {/* Action Buttons */}
          <div className="template-creator-actions">
            <button 
              className="btn btn-secondary" 
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
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
