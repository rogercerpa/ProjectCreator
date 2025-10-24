import React, { useState, useEffect } from 'react';
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
      className={`p-4 bg-white dark:bg-gray-800 border-2 rounded-lg cursor-pointer transition-all group ${
        selectedTemplate?.id === template.id 
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg' 
          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md'
      }`}
      onClick={() => handleSelectTemplate(template)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex-1 pr-2">
          {template.name}
        </h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1.5 hover:bg-info-100 dark:hover:bg-info-900/30 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleEditTemplate(template);
            }}
            title="Edit Template"
          >
            ✏️
          </button>
          <button
            className="p-1.5 hover:bg-error-100 dark:hover:bg-error-900/30 rounded transition-colors"
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

      {/* Meta */}
      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-medium">
          {template.category || 'General'}
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          Used {template.usageCount || 0} times
        </span>
      </div>

      {/* Subject */}
      <div className="mb-2 text-sm text-gray-700 dark:text-gray-300">
        <strong>Subject:</strong> {truncateText(template.subject, 80)}
      </div>

      {/* Content Preview */}
      <div className="mb-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed min-h-[40px]">
        {truncateText(template.content, 120)}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-2">
        <span>Created: {formatDate(template.createdAt)}</span>
        {template.lastUsed && (
          <span>Last used: {formatDate(template.lastUsed)}</span>
        )}
      </div>
    </div>
  );

  const renderTemplateListItem = (template) => (
    <div 
      key={template.id} 
      className={`p-4 bg-white dark:bg-gray-800 border-2 rounded-lg cursor-pointer transition-all group flex items-center gap-4 ${
        selectedTemplate?.id === template.id 
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg' 
          : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md'
      }`}
      onClick={() => handleSelectTemplate(template)}
    >
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
            {template.name}
          </h4>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
            {template.category || 'General'}
          </span>
        </div>
        <div className="mb-1 text-sm text-gray-700 dark:text-gray-300">
          <strong>Subject:</strong> {template.subject}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {truncateText(template.content, 200)}
        </div>
      </div>

      {/* Meta & Actions */}
      <div className="flex flex-col items-end gap-2 min-w-[150px]">
        <div className="flex flex-col items-end text-xs text-gray-500 dark:text-gray-500 gap-1">
          <span>Used {template.usageCount || 0} times</span>
          <span>Created: {formatDate(template.createdAt)}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1.5 hover:bg-info-100 dark:hover:bg-info-900/30 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleEditTemplate(template);
            }}
            title="Edit Template"
          >
            ✏️
          </button>
          <button
            className="p-1.5 hover:bg-error-100 dark:hover:bg-error-900/30 rounded transition-colors"
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
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1002] p-5">
        {/* Modal Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90%] max-w-[1400px] max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Template Library</h2>
            <button 
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all text-xl"
              onClick={onClose}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>

            {/* View Controls */}
            <div className="flex gap-1">
              <button
                className={`px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                ⊞
              </button>
              <button
                className={`px-3 py-2 border rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                ☰
              </button>
            </div>

            {/* Create Button */}
            <button 
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow transition-all flex items-center gap-2"
              onClick={handleCreateTemplate}
            >
              <span>✨</span>
              <span>Create Template</span>
            </button>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statistics.totalTemplates}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Templates</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statistics.categoriesCount}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Categories</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statistics.totalUsage}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total Uses</div>
              </div>
              <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{statistics.recentlyCreated}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">This Week</div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 border-t-primary-600 dark:border-t-primary-400 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-6xl mb-4 opacity-50">📧</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No templates found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-5 max-w-md">
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Create your first email template to get started!'
                  }
                </p>
                {!searchTerm && selectedCategory === 'all' && (
                  <button 
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow transition-all"
                    onClick={handleCreateTemplate}
                  >
                    Create Your First Template
                  </button>
                )}
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
                : 'flex flex-col gap-4'
              }>
                {viewMode === 'grid' 
                  ? filteredTemplates.map(renderTemplateCard)
                  : filteredTemplates.map(renderTemplateListItem)
                }
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {onSelectTemplate && (
            <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex-1">
                {selectedTemplate ? (
                  <span className="text-sm text-success-600 dark:text-success-400">
                    Selected: <strong>{selectedTemplate.name}</strong>
                  </span>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Click on a template to select it
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow transition-all"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
