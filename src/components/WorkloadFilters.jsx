/**
 * WorkloadFilters - Filter controls for workload dashboard
 */

import React from 'react';
import './WorkloadFilters.css';

const WorkloadFilters = ({
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange
}) => {
  
  const handleSearchChange = (e) => {
    onFilterChange({ searchTerm: e.target.value });
  };

  const handleTeamFilterChange = (e) => {
    onFilterChange({ teamFilter: e.target.value });
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
    <div className="workload-filters">
      {/* Left side - View mode and date navigation */}
      <div className="filters-left">
        {/* View mode selector */}
        <div className="view-mode-selector">
          <button
            className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('day')}
          >
            Day
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('week')}
          >
            Week
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => handleViewModeChange('month')}
          >
            Month
          </button>
        </div>

        {/* Date navigation */}
        <div className="date-navigation">
          <button 
            className="date-nav-btn"
            onClick={() => handleDateNavigation(-1)}
            title="Previous"
          >
            ◀
          </button>
          <button 
            className="date-today-btn"
            onClick={handleToday}
          >
            Today
          </button>
          <span className="date-display">{formatDateDisplay()}</span>
          <button 
            className="date-nav-btn"
            onClick={() => handleDateNavigation(1)}
            title="Next"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Right side - Filters and search */}
      <div className="filters-right">
        {/* Team filter */}
        <select
          className="filter-select"
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
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={filters.searchTerm}
            onChange={handleSearchChange}
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>
    </div>
  );
};

export default WorkloadFilters;

