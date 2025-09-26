import React, { useState, useEffect } from 'react';
import './EmailTemplateLibrary.css';
import EmailTemplateCreator from './EmailTemplateCreator';

function EmailTemplateLibrary({ isOpen, onClose, onSelectTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [statistics, setStatistics] = useState(null);

  // Load templates and categories when component opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadCategories();
      loadStatistics();
    }
  }, [isOpen]);

  // Filter templates when search or category changes
  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, selectedCategory]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.emailTemplatesLoadAll();
      if (result.success) {
        setTemplates(result.templates || []);
      } else {
        console.error('Failed to load templates:', result.error);
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await window.electronAPI.emailTemplatesGetCategories();
      if (result.success) {
        setCategories(['all', ...result.categories]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const result = await window.electronAPI.emailTemplatesGetStatistics();
      if (result.success) {
        setStatistics(result.statistics);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const filterTemplates = () => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => 
        template.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(template =>
        template.name?.toLowerCase().includes(search) ||
        template.subject?.toLowerCase().includes(search) ||
        template.content?.toLowerCase().includes(search) ||
        template.category?.toLowerCase().includes(search)
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowCreator(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setShowCreator(true);
  };

  const handleDeleteTemplate = async (template) => {
    if (window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      try {
        const result = await window.electronAPI.emailTemplatesDelete(template.id);
        if (result.success) {
          await loadTemplates();
          await loadStatistics();
          if (selectedTemplate?.id === template.id) {
            setSelectedTemplate(null);
          }
        } else {
          alert('Failed to delete template: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting template:', error);
        alert('Error deleting template. Please try again.');
      }
    }
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      let result;
      if (editingTemplate) {
        result = await window.electronAPI.emailTemplatesUpdate(editingTemplate.id, templateData);
      } else {
        result = await window.electronAPI.emailTemplatesCreate(templateData);
      }

      if (result.success) {
        await loadTemplates();
        await loadStatistics();
        setShowCreator(false);
        setEditingTemplate(null);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      throw error; // Re-throw to be handled by EmailTemplateCreator
    }
  };

  const handleSelectTemplate = (template) => {
    // Always just mark as selected first - let user confirm with "Use Template" button
    setSelectedTemplate(template);
  };

  const handleUseTemplateButton = () => {
    if (selectedTemplate && onSelectTemplate) {
      onSelectTemplate(selectedTemplate);
      onClose();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const renderTemplateCard = (template) => (
    <div 
      key={template.id} 
      className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
      onClick={() => handleSelectTemplate(template)}
    >
      <div className="template-card-header">
        <h3 className="template-name">{template.name}</h3>
        <div className="template-actions">
          <button
            className="action-btn edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleEditTemplate(template);
            }}
            title="Edit Template"
          >
            ✏️
          </button>
          <button
            className="action-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTemplate(template);
            }}
            title="Delete Template"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="template-meta">
        <span className="template-category">{template.category || 'General'}</span>
        <span className="template-usage">Used {template.usageCount || 0} times</span>
      </div>

      <div className="template-subject">
        <strong>Subject:</strong> {truncateText(template.subject, 80)}
      </div>

      <div className="template-content-preview">
        {truncateText(template.content, 120)}
      </div>

      <div className="template-footer">
        <span className="template-date">
          Created: {formatDate(template.createdAt)}
        </span>
        {template.lastUsed && (
          <span className="template-last-used">
            Last used: {formatDate(template.lastUsed)}
          </span>
        )}
      </div>
    </div>
  );

  const renderTemplateListItem = (template) => (
    <div 
      key={template.id} 
      className={`template-list-item ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
      onClick={() => handleSelectTemplate(template)}
    >
      <div className="template-list-main">
        <div className="template-list-header">
          <h4 className="template-name">{template.name}</h4>
          <span className="template-category">{template.category || 'General'}</span>
        </div>
        <div className="template-subject">
          <strong>Subject:</strong> {template.subject}
        </div>
        <div className="template-content-preview">
          {truncateText(template.content, 200)}
        </div>
      </div>

      <div className="template-list-meta">
        <div className="template-stats">
          <span>Used {template.usageCount || 0} times</span>
          <span>Created: {formatDate(template.createdAt)}</span>
        </div>
        <div className="template-list-actions">
          <button
            className="action-btn edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleEditTemplate(template);
            }}
            title="Edit Template"
          >
            ✏️
          </button>
          <button
            className="action-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTemplate(template);
            }}
            title="Delete Template"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="email-template-library-overlay">
        <div className="email-template-library">
          <div className="library-header">
            <h2>Email Template Library</h2>
            <button 
              className="close-btn" 
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="library-toolbar">
            <div className="library-search">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="library-filters">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-filter"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            <div className="library-view-controls">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                ⊞
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                ☰
              </button>
            </div>

            <button 
              className="btn btn-primary create-btn"
              onClick={handleCreateTemplate}
            >
              ✨ Create Template
            </button>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="library-stats">
              <div className="stat">
                <span className="stat-value">{statistics.totalTemplates}</span>
                <span className="stat-label">Templates</span>
              </div>
              <div className="stat">
                <span className="stat-value">{statistics.categoriesCount}</span>
                <span className="stat-label">Categories</span>
              </div>
              <div className="stat">
                <span className="stat-value">{statistics.totalUsage}</span>
                <span className="stat-label">Total Uses</span>
              </div>
              <div className="stat">
                <span className="stat-value">{statistics.recentlyCreated}</span>
                <span className="stat-label">This Week</span>
              </div>
            </div>
          )}

          <div className="library-content">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📧</div>
                <h3>No templates found</h3>
                <p>
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Create your first email template to get started!'
                  }
                </p>
                {!searchTerm && selectedCategory === 'all' && (
                  <button 
                    className="btn btn-primary"
                    onClick={handleCreateTemplate}
                  >
                    Create Your First Template
                  </button>
                )}
              </div>
            ) : (
              <div className={`templates-container ${viewMode}`}>
                {viewMode === 'grid' 
                  ? filteredTemplates.map(renderTemplateCard)
                  : filteredTemplates.map(renderTemplateListItem)
                }
              </div>
            )}
          </div>

          {onSelectTemplate && (
            <div className="library-actions">
              <div className="selection-info">
                {selectedTemplate ? (
                  <span className="selected-template-info">
                    Selected: <strong>{selectedTemplate.name}</strong>
                  </span>
                ) : (
                  <span className="no-selection-info">
                    Click on a template to select it
                  </span>
                )}
              </div>
              <div className="action-buttons">
                <button 
                  className="btn btn-secondary" 
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleUseTemplateButton}
                  disabled={!selectedTemplate}
                >
                  Use Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreator && (
        <EmailTemplateCreator
          isOpen={showCreator}
          onClose={() => {
            setShowCreator(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveTemplate}
          editingTemplate={editingTemplate}
        />
      )}
    </>
  );
}

export default EmailTemplateLibrary;
