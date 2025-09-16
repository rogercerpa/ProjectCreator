import React from 'react';
import './ViewToolbar.css';

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
  searchTerm,
  onSearchChange,
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
    <div className="view-toolbar">
      {/* Top Row - Main Controls */}
      <div className="toolbar-row toolbar-main">
        {/* Project Count */}
        <div className="project-count">
          <span className="count-text">
            {filteredCount === projectCount 
              ? `${projectCount} projects`
              : `${filteredCount} of ${projectCount} projects`
            }
          </span>
        </div>

        {/* Search */}
        <div className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <span className="control-label">View:</span>
          <div className="toggle-group">
            {viewModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onViewModeChange(mode.value)}
                className={`toggle-btn ${viewMode === mode.value ? 'active' : ''}`}
                title={mode.label}
              >
                <span className="toggle-icon">{mode.icon}</span>
                <span className="toggle-text">{mode.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - Secondary Controls */}
      <div className="toolbar-row toolbar-secondary">
        {/* Density Controls */}
        <div className="density-controls">
          <span className="control-label">Density:</span>
          <div className="density-group">
            {densityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onDensityChange(option.value)}
                className={`density-btn ${density === option.value ? 'active' : ''}`}
                title={option.label}
              >
                <span className="density-icon">{option.icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Group By */}
        <div className="group-controls">
          <label htmlFor="groupBy" className="control-label">Group by:</label>
          <select
            id="groupBy"
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value)}
            className="group-select"
          >
            {groupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className="sort-controls">
          <label htmlFor="sortBy" className="control-label">Sort by:</label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="sort-select"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <button
            onClick={onSortOrderToggle}
            className="sort-order-btn"
            title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewToolbar;
