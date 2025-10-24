import React from 'react';

const FormSettingsTab = ({
  settings,
  formCategories,
  selectedCategory,
  setSelectedCategory,
  viewMode,
  setViewMode,
  searchTerm,
  setSearchTerm,
  cancelEditing,
  getCurrentCategory,
  getFilteredItems,
  renderCompactFieldEditor,
  renderFieldEditor
}) => {
  const currentCategory = getCurrentCategory();
  const currentItems = settings[selectedCategory] || [];

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar with categories */}
      <div className="w-64 flex-shrink-0 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Categories</h3>
          <div className="flex bg-gray-200 dark:bg-gray-700 rounded p-0.5">
            <button 
              className={`px-2 py-1 rounded text-xs transition-all ${viewMode === 'compact' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow' : 'text-gray-600 dark:text-gray-400'}`}
              onClick={() => setViewMode('compact')}
              title="Compact View"
            >
              ⊞
            </button>
            <button 
              className={`px-2 py-1 rounded text-xs transition-all ${viewMode === 'detailed' ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow' : 'text-gray-600 dark:text-gray-400'}`}
              onClick={() => setViewMode('detailed')}
              title="Detailed View"
            >
              ☰
            </button>
          </div>
        </div>
        
        <div className="space-y-1">
          {formCategories.map(category => (
            <button
              key={category.key}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                selectedCategory === category.key 
                  ? 'bg-primary-600 text-white shadow-lg' 
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => {
                setSelectedCategory(category.key);
                setSearchTerm(''); // Clear search when switching categories
                cancelEditing(); // Cancel any active editing
              }}
            >
              <span className="text-xl">{category.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{category.label}</div>
                <div className={`text-xs ${selectedCategory === category.key ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                  {settings[category.key]?.length || 0} items
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with search and actions */}
        <div className="mb-4 p-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="text-2xl">{currentCategory?.icon}</span>
                <span>{currentCategory?.label}</span>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{currentCategory?.description}</p>
            </div>
            
            <div className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs font-bold">
              {getFilteredItems(currentItems).length} of {currentItems.length} items
            </div>
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            {searchTerm && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ✗
              </button>
            )}
          </div>
        </div>

        {/* Items display */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {viewMode === 'compact' ? 
            renderCompactFieldEditor(selectedCategory, currentItems) :
            renderFieldEditor(selectedCategory, currentCategory?.label, currentItems)
          }
        </div>
      </div>
    </div>
  );
};

export default FormSettingsTab;

