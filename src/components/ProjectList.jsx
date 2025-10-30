import React, { useState } from 'react';
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
      
      // Handle products as array or string
      const productsText = Array.isArray(project.products) 
        ? project.products.join(' ') 
        : (project.products || '');
      
      const searchableFields = [
        project.projectName,
        project.rfaNumber,
        project.agentNumber,
        project.rfaType,
        project.projectType,
        productsText,
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
    const getCardBorderColor = (project) => {
      const triage = project.triageResults?.totalTriage || 0;
      if (triage > 100) return 'border-l-error-500';
      if (triage > 50) return 'border-l-warning-500';
      return 'border-l-success-500';
    };

    const getCardPadding = () => {
      if (density === 'compact') return 'p-3';
      if (density === 'comfortable') return 'p-6';
      return 'p-4';
    };

    return projectsToRender.map((project) => (
      <div
        key={project.id}
        className={`${getCardPadding()} bg-white dark:bg-gray-800 border-2 ${getCardBorderColor(project)} border-l-4 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer group`}
        onClick={() => onProjectSelect(project)}
      >
        {/* Card Header with Title and Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 mr-3">
            <h3 
              className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" 
              title={project.projectName}
            >
              {project.projectName || 'Untitled Project'}
            </h3>
          </div>
          {onProjectDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onProjectDelete(project.id, project.projectName);
              }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-error-600 dark:hover:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 rounded transition-all text-lg font-bold"
              title="Delete Project"
            >
              ×
            </button>
          )}
        </div>

        {/* Card Body with Project Details */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400 font-medium">RFA Number</span>
            <span className="text-gray-900 dark:text-gray-100 font-semibold">{project.rfaNumber || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Agent Number</span>
            <span className="text-gray-900 dark:text-gray-100">{project.agentNumber || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Container</span>
            <span className="text-gray-900 dark:text-gray-100 truncate max-w-[60%]" title={project.projectContainer || 'N/A'}>
              {project.projectContainer || 'N/A'}
            </span>
          </div>
          {project.ecd && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-medium">ECD</span>
              <span className="text-gray-900 dark:text-gray-100">{formatDate(project.ecd)}</span>
            </div>
          )}
          {project.requestedDate && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Requested</span>
              <span className="text-gray-900 dark:text-gray-100">{formatDate(project.requestedDate)}</span>
            </div>
          )}
          {project.triageResults?.totalTriage && (
            <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 font-medium">Triage Hours</span>
              <span className={`font-bold ${
                project.triageResults.totalTriage > 100 ? 'text-error-600 dark:text-error-400' :
                project.triageResults.totalTriage > 50 ? 'text-warning-600 dark:text-warning-400' :
                'text-success-600 dark:text-success-400'
              }`}>
                {project.triageResults.totalTriage}h
              </span>
            </div>
          )}
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
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">No Projects Yet</h3>
          <p className="text-gray-600 dark:text-gray-400">Create your first project to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Project List</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Manage and organize your projects</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {onRefresh && (
                <button 
                  onClick={onRefresh}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded shadow transition-colors"
                  title="Refresh Project List"
                >
                  <span>🔄</span>
                  <span>Refresh</span>
                </button>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 bg-info-50 dark:bg-info-900/20 px-3 py-2 rounded">
                💡 Create new projects using the <strong>Project Wizard</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="text-center p-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 rounded-lg border border-primary-200 dark:border-primary-700">
          <span className="block text-3xl font-bold text-primary-700 dark:text-primary-300">{safeProjects.length}</span>
          <span className="block text-sm text-primary-600 dark:text-primary-400 mt-1">Total Projects</span>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-info-50 to-info-100 dark:from-info-900/30 dark:to-info-800/30 rounded-lg border border-info-200 dark:border-info-700">
          <span className="block text-3xl font-bold text-info-700 dark:text-info-300">{filteredProjects.length}</span>
          <span className="block text-sm text-info-600 dark:text-info-400 mt-1">Filtered Results</span>
        </div>
        <div className="text-center p-4 bg-gradient-to-br from-warning-50 to-warning-100 dark:from-warning-900/30 dark:to-warning-800/30 rounded-lg border border-warning-200 dark:border-warning-700">
          <span className="block text-3xl font-bold text-warning-700 dark:text-warning-300">
            {safeProjects.filter(p => p && p.triageResults && p.triageResults.totalTriage > 100).length}
          </span>
          <span className="block text-sm text-warning-600 dark:text-warning-400 mt-1">High Priority</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-6 py-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search by name, RFA, agent, container, RFA type, project type, or product..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchTerm && (
            <button 
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
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
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
          <div className={`${viewMode === 'table' ? '' : 'p-6'}`}>
            {viewMode === 'table' ? (
              renderTableView()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {renderCardView()}
              </div>
            )}
          </div>
        )}

        {filteredProjects.length === 0 && searchTerm && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No projects found matching "{searchTerm}"
            </p>
            <button
              onClick={() => setSearchTerm('')}
              className="btn-secondary"
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
