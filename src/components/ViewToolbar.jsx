import React from 'react';

function ViewToolbar({ 
  viewMode, 
  onViewModeChange, 
  groupBy, 
  onGroupByChange,
  sortBy,
  sortOrder,
  onSortChange,
  onSortOrderToggle
}) {
  const viewModes = [
    { value: 'card', icon: '🎴', label: 'Card View' },
    { value: 'table', icon: '📋', label: 'Table View' }
  ];

  const groupOptions = [
    { value: 'none', label: 'No Grouping' },
    { value: 'status', label: 'By Status' },
    { value: 'regionalTeam', label: 'By Team' },
    { value: 'rfaType', label: 'By RFA Type' },
    { value: 'rfaStatus', label: 'By RFA Status' },
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
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-wrap items-center gap-4 sm:gap-8 w-full lg:w-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden xs:inline">Layout</span>
            <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              {viewModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onViewModeChange(mode.value)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all text-xs sm:text-sm font-bold whitespace-nowrap ${
                    viewMode === mode.value 
                      ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                  title={mode.label}
                >
                  <span className="text-base sm:text-lg">{mode.icon}</span>
                  <span className="hidden xs:inline">{mode.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Group By */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none min-w-[120px]">
            <label htmlFor="groupBy" className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden md:inline">Group</label>
            <div className="relative w-full">
              <select
                id="groupBy"
                value={groupBy}
                onChange={(e) => onGroupByChange(e.target.value)}
                className="w-full appearance-none pl-3 sm:pl-4 pr-8 sm:pr-10 py-2 sm:py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-all cursor-pointer"
              >
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none min-w-[120px]">
            <label htmlFor="sortBy" className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden md:inline">Sort</label>
            <div className="flex items-center gap-1.5 sm:gap-2 w-full">
              <div className="relative w-full">
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value)}
                  className="w-full appearance-none pl-3 sm:pl-4 pr-8 sm:pr-10 py-2 sm:py-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-primary-500 transition-all cursor-pointer"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
              
              <button
                onClick={onSortOrderToggle}
                className="p-2 sm:p-2.5 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:border-primary-500 hover:text-primary-600 transition-all group shrink-0"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                <div className={`transition-transform duration-300 ${sortOrder === 'asc' ? '' : 'rotate-180'}`}>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7"/></svg>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewToolbar;
