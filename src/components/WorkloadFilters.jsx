/**
 * WorkloadFilters - Filter controls for workload dashboard
 */

import React from 'react';

const WorkloadFilters = ({
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  users = []
}) => {
  
  const handleSearchChange = (e) => {
    onFilterChange({ searchTerm: e.target.value });
  };

  const handleTeamFilterChange = (e) => {
    onFilterChange({ teamFilter: e.target.value });
  };

  const handleUserFilterChange = (e) => {
    onFilterChange({ userFilter: e.target.value });
  };

  const handleViewModeChange = (mode) => {
    onViewModeChange(mode);
  };

  const handleDateNavigation = (direction) => {
    const newDate = new Date(selectedDate);
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + direction);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      default:
        break;
    }
    
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const formatDateDisplay = () => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    
    switch (viewMode) {
      case 'day':
        return selectedDate.toLocaleDateString('en-US', options);
      case 'week':
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
      {/* Left side - View mode and date navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* View mode selector */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${
              viewMode === 'day' 
                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleViewModeChange('day')}
          >
            Day
          </button>
          <button
            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${
              viewMode === 'week' 
                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleViewModeChange('week')}
          >
            Week
          </button>
          <button
            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${
              viewMode === 'month' 
                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleViewModeChange('month')}
          >
            Month
          </button>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button 
            className="w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all text-sm"
            onClick={() => handleDateNavigation(-1)}
            title="Previous"
          >
            ◀
          </button>
          <button 
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-md text-sm font-semibold text-primary-600 dark:text-primary-400 transition-all"
            onClick={handleToday}
          >
            Today
          </button>
          <span className="min-w-[200px] text-center text-sm font-semibold text-gray-900 dark:text-white">
            {formatDateDisplay()}
          </span>
          <button 
            className="w-9 h-9 flex items-center justify-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all text-sm"
            onClick={() => handleDateNavigation(1)}
            title="Next"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Right side - Filters and search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* User filter */}
        <select
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm cursor-pointer transition-all hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[150px]"
          value={filters.userFilter || 'all'}
          onChange={handleUserFilterChange}
        >
          <option value="all">👥 All Users</option>
          {users && users.filter(u => u.isActive).map(user => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>

        {/* Team filter */}
        <select
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm cursor-pointer transition-all hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[150px]"
          value={filters.teamFilter}
          onChange={handleTeamFilterChange}
        >
          <option value="all">All Teams</option>
          <option value="Designer">Designers</option>
          <option value="Manager">Managers</option>
          <option value="QC">QC Team</option>
          <option value="Admin">Admin</option>
        </select>

        {/* Search */}
        <div className="relative min-w-[250px]">
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm transition-all hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Search users..."
            value={filters.searchTerm}
            onChange={handleSearchChange}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base opacity-60 pointer-events-none">
            🔍
          </span>
        </div>
      </div>
    </div>
  );
};

export default WorkloadFilters;

