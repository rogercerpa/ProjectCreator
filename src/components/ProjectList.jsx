import React, { useState } from 'react';
import './ProjectList.css';
import ViewToolbar from './ViewToolbar';
import ProjectTableView from './ProjectTableView';
import ProjectGroupView from './ProjectGroupView';

function ProjectList({ projects, onProjectSelect, onProjectDelete, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem('projectListSortBy');
    return saved || 'createdAt';
  });
  const [sortOrder, setSortOrder] = useState(() => {
    const saved = localStorage.getItem('projectListSortOrder');
    return saved || 'desc';
  });
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('projectListViewMode');
    return saved || 'table';
  });
  const [density, setDensity] = useState(() => {
    const saved = localStorage.getItem('projectListDensity');
    return saved || 'standard';
  });
  const [groupBy, setGroupBy] = useState(() => {
    const saved = localStorage.getItem('projectListGroupBy');
    return saved || 'none';
  });

  // Ensure projects is an array
  const safeProjects = Array.isArray(projects) ? projects : [];

  const filteredProjects = safeProjects.filter(project => {
    try {
      if (!searchTerm) return true;
      if (!project) return false;
      
      const search = searchTerm.toLowerCase();
      const searchableFields = [
        project.projectName,
        project.rfaNumber,
        project.agentNumber,
        project.rfaType,
        project.projectType,
        project.products,
        project.projectContainer
      ];
      
      return searchableFields.some(field => 
        field && typeof field === 'string' && field.toLowerCase().includes(search)
      );
    } catch (error) {
      console.error('Error filtering project:', error, project);
      return false;
    }
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // Handle date sorting
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    // Handle numeric sorting
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Handle string sorting
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Handle date sorting
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const handleSort = (field) => {
    const newSortBy = field;
    const newSortOrder = sortBy === field ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc';
    
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    localStorage.setItem('projectListSortBy', newSortBy);
    localStorage.setItem('projectListSortOrder', newSortOrder);
  };

  const handleSortOrderToggle = () => {
    const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newSortOrder);
    localStorage.setItem('projectListSortOrder', newSortOrder);
  };

  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
    localStorage.setItem('projectListViewMode', newViewMode);
  };

  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('projectListDensity', newDensity);
  };

  const handleGroupByChange = (newGroupBy) => {
    setGroupBy(newGroupBy);
    localStorage.setItem('projectListGroupBy', newGroupBy);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (project) => {
    if (project.triageResults?.totalTriage > 100) return 'high';
    if (project.triageResults?.totalTriage > 50) return 'medium';
    return 'low';
  };

  const renderCardView = (projectsToRender = sortedProjects) => {
    return projectsToRender.map((project) => (
      <div
        key={project.id}
        className={`project-card ${getStatusColor(project)} density-${density}`}
        onClick={() => onProjectSelect(project)}
      >
        {/* Card Header with Title and Actions */}
        <div className="card-header">
          <div className="card-title-section">
            <h3 className="card-title" title={project.projectName}>
              {project.projectName || 'Untitled Project'}
            </h3>
          </div>
          {onProjectDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onProjectDelete(project.id, project.projectName);
              }}
              className="card-delete-btn"
              title="Delete Project"
            >
              ×
            </button>
          )}
        </div>

        {/* Card Body with Project Details */}
        <div className="card-body">
          <div className="card-details-grid">
            <div className="detail-row">
              <span className="detail-key">RFA Number</span>
              <span className="detail-val">{project.rfaNumber || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Agent Number</span>
              <span className="detail-val">{project.agentNumber || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Project Container</span>
              <span className="detail-val">{project.projectContainer || 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">ECD</span>
              <span className="detail-val">{project.ecd ? formatDate(project.ecd) : 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Requested Date</span>
              <span className="detail-val">{project.requestedDate ? formatDate(project.requestedDate) : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    ));
  };

  const renderTableView = (projectsToRender = sortedProjects) => {
    return (
      <ProjectTableView
        projects={projectsToRender}
        onProjectSelect={onProjectSelect}
        onProjectDelete={onProjectDelete}
        density={density}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />
    );
  };

  if (safeProjects.length === 0) {
    return (
      <div className="project-list-empty">
        <div className="empty-icon">📁</div>
        <h3>No Projects Yet</h3>
        <p>Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="project-list-header">
        <div className="header-title">
          <h1>Project List</h1>
          <p>Manage and organize your projects</p>
        </div>
        
        <div className="header-actions">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="refresh-btn"
              title="Refresh Project List"
            >
              <span className="refresh-icon">🔄</span>
              <span className="refresh-text">Refresh</span>
            </button>
          )}
          <p className="import-note">
            💡 Create new projects using the <strong>Project Wizard</strong>
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="project-stats">
        <div className="stat-card">
          <span className="stat-number">{safeProjects.length}</span>
          <span className="stat-label">Total Projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{filteredProjects.length}</span>
          <span className="stat-label">Filtered Results</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{safeProjects.filter(p => p && p.triageResults && p.triageResults.totalTriage > 100).length}</span>
          <span className="stat-label">High Priority</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, RFA, agent, container, RFA type, project type, or product..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            className="clear-search-btn"
            onClick={() => setSearchTerm('')}
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <ViewToolbar
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          density={density}
          onDensityChange={handleDensityChange}
          groupBy={groupBy}
          onGroupByChange={handleGroupByChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field) => {
            setSortBy(field);
            localStorage.setItem('projectListSortBy', field);
          }}
          onSortOrderToggle={handleSortOrderToggle}
          projectCount={safeProjects.length}
          filteredCount={filteredProjects.length}
        />
      </div>

      {/* Results */}
      <div className="results-section">
        <div className="results-header">
          <span className="results-count">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} found
          </span>
        </div>

        {/* Render based on grouping and view mode */}
        {groupBy !== 'none' ? (
          <ProjectGroupView
            projects={sortedProjects}
            groupBy={groupBy}
            viewMode={viewMode}
            density={density}
            onProjectSelect={onProjectSelect}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            renderCardView={renderCardView}
            renderTableView={renderTableView}
          />
        ) : (
          <div className={`project-content ${viewMode}-view ${density}`}>
            {viewMode === 'table' ? (
              renderTableView()
            ) : (
              <div className="projects-grid">
                {renderCardView()}
              </div>
            )}
          </div>
        )}

        {filteredProjects.length === 0 && searchTerm && (
          <div className="no-results">
            <p>No projects found matching "{searchTerm}"</p>
            <button
              onClick={() => setSearchTerm('')}
              className="btn btn-secondary"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectList;
