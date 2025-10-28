import React from 'react';

function ViewToolbar({ 
  viewMode, 
  onViewModeChange, 
  density, 
  onDensityChange, 
  groupBy, 
  onGroupByChange,
  sortBy,
  sortOrder,
  onSortChange,
  onSortOrderToggle,
  projectCount,
  filteredCount
}) {
  const viewModes = [
    { value: 'card', icon: '🎴', label: 'Card View' },
    { value: 'table', icon: '📋', label: 'Table View' }
  ];

  const densityOptions = [
    { value: 'compact', icon: '⚪', label: 'Compact' },
    { value: 'standard', icon: '⚫', label: 'Standard' },
    { value: 'comfortable', icon: '⭕', label: 'Comfortable' }
  ];

  const groupOptions = [
    { value: 'none', label: 'No Grouping' },
    { value: 'status', label: 'By Status' },
    { value: 'regionalTeam', label: 'By Team' },
    { value: 'rfaType', label: 'By RFA Type' },
    { value: 'triageLevel', label: 'By Triage Level' }
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Updated Date' },
    { value: 'projectName', label: 'Project Name' },
    { value: 'rfaNumber', label: 'RFA Number' },
    { value: 'agentNumber', label: 'Agent Number' },
    { value: 'regionalTeam', label: 'Regional Team' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6 shadow-sm lg:p-4 md:p-3 md:mb-4">
      {/* Top Row - Main Controls */}
      <div className="flex items-center gap-6 flex-wrap justify-between mb-4 md:gap-4">
        {/* Project Count */}
        <div className="flex-shrink-0">
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {filteredCount === projectCount 
              ? `${projectCount} projects`
              : `${filteredCount} of ${projectCount} projects`
            }
          </span>
        </div>


        {/* View Mode Toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">View:</span>
          <div className="flex border-2 border-gray-200 dark:border-gray-600 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900">
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onViewModeChange(mode.value)}
                className={`flex items-center gap-2 px-4 py-2.5 border-none bg-transparent cursor-pointer transition-all text-sm font-medium border-r border-gray-200 dark:border-gray-600 last:border-r-0 ${
                  viewMode === mode.value 
                    ? 'bg-primary-600 dark:bg-primary-700 text-white hover:bg-primary-700 dark:hover:bg-primary-600' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
                title={mode.label}
              >
                <span className="text-base">{mode.icon}</span>
                <span className="font-medium">{mode.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - Secondary Controls */}
      <div className="flex items-center gap-6 flex-wrap justify-start pt-4 border-t border-gray-100 dark:border-gray-700 md:gap-4 md:pt-3">
        {/* Density Controls */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Density:</span>
          <div className="flex border-2 border-gray-200 dark:border-gray-600 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900">
            {densityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onDensityChange(option.value)}
                className={`flex items-center justify-center w-10 h-10 border-none bg-transparent cursor-pointer transition-all text-base border-r border-gray-200 dark:border-gray-600 last:border-r-0 ${
                  density === option.value 
                    ? 'bg-primary-600 dark:bg-primary-700 hover:bg-primary-700 dark:hover:bg-primary-600' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
                title={option.label}
              >
                <span>{option.icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Group By */}
        <div className="flex items-center gap-3">
          <label htmlFor="groupBy" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Group by:</label>
          <select
            id="groupBy"
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value)}
            className="px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-md text-sm transition-all bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-primary-600 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-600/10 dark:focus:ring-primary-500/20"
          >
            {groupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-3">
          <label htmlFor="sortBy" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Sort by:</label>
          <div className="flex items-center gap-2">
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-md text-sm transition-all bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-primary-600 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-600/10 dark:focus:ring-primary-500/20"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={onSortOrderToggle}
              className="px-3 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all font-bold text-lg"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewToolbar;
