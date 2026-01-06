import React, { useState } from 'react';
import ViewToolbar from './ViewToolbar';
import ProjectTableView from './ProjectTableView';
import ProjectGroupView from './ProjectGroupView';

function ProjectList({ projects, onProjectSelect, onProjectDelete, onNewProject, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanNotification, setScanNotification] = useState(null);
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
  const [groupBy, setGroupBy] = useState(() => {
    const saved = localStorage.getItem('projectListGroupBy');
    return saved || 'none';
  });

  // Ensure projects is an array
  const safeProjects = Array.isArray(projects) ? projects : [];

  // Handle manual scan of Ready for QC folder
  const handleScanReadyForQC = async () => {
    setIsScanning(true);
    setScanNotification(null);
    
    try {
      const result = await window.electronAPI.qcScanFolder();
      
      if (result.success) {
        const message = result.updateCount > 0
          ? `Found ${result.totalMatches} match(es), updated ${result.updateCount} project(s) to "Ready for QC"`
          : result.totalMatches > 0
            ? `Found ${result.totalMatches} match(es), but no projects needed status updates`
            : 'No matching zip files found in Ready for QC folder';
        
        setScanNotification({ type: 'success', message });
        
        // Refresh projects list if updates were made
        if (result.updateCount > 0 && onRefresh) {
          setTimeout(() => {
            onRefresh();
          }, 500);
        }
      } else {
        setScanNotification({ type: 'error', message: `Scan failed: ${result.error}` });
      }
    } catch (error) {
      console.error('Error scanning Ready for QC folder:', error);
      setScanNotification({ type: 'error', message: 'Failed to scan Ready for QC folder' });
    } finally {
      setIsScanning(false);
      // Clear notification after 5 seconds
      setTimeout(() => setScanNotification(null), 5000);
    }
  };

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
        project.rfaValue,
        project.projectType,
        productsText,
        project.projectContainer,
        project.dasStatus,
        project.dasPaidServiceEnabled ? 'DAS Paid Services' : '',
        project.dasStatus === 'Fee Waived' ? 'Fee Waived' : ''
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

    // Handle DAS Paid Services column sorting
    if (sortBy === 'dasPaidServices') {
      const aEnabled = a.dasPaidServiceEnabled ? 1 : 0;
      const bEnabled = b.dasPaidServiceEnabled ? 1 : 0;
      if (aEnabled !== bEnabled) {
        return sortOrder === 'asc' ? aEnabled - bEnabled : bEnabled - aEnabled;
      }
      // If both enabled, sort by status
      const aStatus = a.dasStatus || 'Waiting on Order';
      const bStatus = b.dasStatus || 'Waiting on Order';
      return sortOrder === 'asc' 
        ? aStatus.localeCompare(bStatus)
        : bStatus.localeCompare(aStatus);
    }

    // Handle date sorting
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    // Handle currency/numeric fields that might be stored as strings
    if (sortBy === 'rfaValue') {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
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

  const handleGroupByChange = (newGroupBy) => {
    setGroupBy(newGroupBy);
    localStorage.setItem('projectListGroupBy', newGroupBy);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
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
        onClick={() => onProjectSelect(project)}
        className="group relative p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
      >
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-start justify-between gap-4">
              <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight line-clamp-2" title={project.projectName}>
                {project.projectName || 'Untitled Project'}
              </h4>
              <span className="shrink-0 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/50 text-[10px] font-bold text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-600/50 whitespace-nowrap tabular-nums tracking-tighter">
                {project.rfaNumber || 'N/A'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-primary-600/60 dark:text-primary-400/60 uppercase tracking-widest">
              {project.projectType || 'Standard Project'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2 mb-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Agent</span>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{project.agentNumber || 'N/A'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Team</span>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">{project.regionalTeam || 'N/A'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100/50 dark:border-gray-700/50">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Requested</span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                {project.requestedDate ? new Date(project.requestedDate).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">ECD</span>
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 tabular-nums">
                  {project.ecd ? new Date(project.ecd).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
              {onProjectDelete && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onProjectDelete(project.id, project.projectName);
                  }}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Project"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              )}
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 animate-fadeIn">
      {/* Modern Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-500 px-8 py-10 text-white shadow-lg">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-secondary-400/20 blur-3xl animate-float"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight mb-2">Project Repository</h1>
              <p className="text-lg text-primary-50 opacity-90 font-light">
                Manage and organize your projects with precision.
              </p>
            </div>
            
            <div className="flex flex-row items-center gap-3 flex-nowrap shrink-0">
              {onRefresh && (
                <button 
                  onClick={onRefresh}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-sm font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                  title="Refresh Project List"
                >
                  <span className="text-lg">🔄</span>
                  <span>Refresh</span>
                </button>
              )}
              <button 
                onClick={handleScanReadyForQC}
                disabled={isScanning}
                className="flex items-center gap-2 px-5 py-2.5 bg-success-500/90 hover:bg-success-500 backdrop-blur-md text-white text-sm font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Scan Ready for QC folder"
              >
                <span className="text-lg">{isScanning ? '⏳' : '🔍'}</span>
                <span>{isScanning ? 'Scanning...' : 'Scan Ready for QC'}</span>
              </button>
              <button
                onClick={onNewProject}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white text-sm font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                title="Create New Project"
              >
                <span className="text-lg">🧙‍♂️</span>
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Integrated Glass Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10 hover:bg-white/15 transition-colors group">
              <span className="text-3xl font-bold group-hover:scale-110 transition-transform">
                {safeProjects.filter(p => {
                  if (!p) return false;
                  const status = p.rfaStatus?.trim().toLowerCase();
                  return status === 'in progress' || status === 'in-progress' || 
                         status === 'ready for qc' || status === 'pending' || status === 'on hold';
                }).length}
              </span>
              <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-bold">Active Projects</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10 hover:bg-white/15 transition-colors group">
              <span className="text-3xl font-bold group-hover:scale-110 transition-transform">
                {safeProjects.filter(p => p && (p.rfaStatus?.trim().toLowerCase() === 'completed' || p.rfaStatus?.trim().toLowerCase() === 'complete')).length}
              </span>
              <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-bold">Completed Projects</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10 hover:bg-white/15 transition-colors group">
              <span className="text-3xl font-bold group-hover:scale-110 transition-transform">
                {safeProjects.filter(p => p && p.dasPaidServiceEnabled === true).length}
              </span>
              <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-bold">Paid Services</span>
            </div>
          </div>
        </div>
      </div>

      {scanNotification && (
        <div className="mx-8 mt-4 animate-slideIn">
          <div className={`px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg border-2 ${
            scanNotification.type === 'success' 
              ? 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800'
              : 'bg-error-50 text-error-700 border-error-200 dark:bg-error-900/20 dark:text-error-300 dark:border-error-800'
          }`}>
            <span className="text-xl">{scanNotification.type === 'success' ? '✅' : '❌'}</span>
            <span className="text-sm font-bold">{scanNotification.message}</span>
          </div>
        </div>
      )}

      {/* Search and Filters Hub */}
      <div className="px-8 py-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <span className="text-xl grayscale group-focus-within:grayscale-0 transition-all">🔍</span>
            </div>
            <input
              type="text"
              placeholder="Search by name, RFA, agent, container, RFA type, project type..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-12 py-4 bg-gray-50 dark:bg-gray-900/50 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all shadow-inner"
            />
            {searchTerm && (
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
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
            groupBy={groupBy}
            onGroupByChange={handleGroupByChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field) => {
              setSortBy(field);
              localStorage.setItem('projectListSortBy', field);
            }}
            onSortOrderToggle={handleSortOrderToggle}
          />
        </div>
      </div>

      {/* Results Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20">
        <div className="max-w-7xl mx-auto p-8 pt-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-2 w-2 rounded-full bg-primary-500 animate-pulse"></div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
              {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} discovered
            </span>
          </div>

          {/* Render based on grouping and view mode */}
          {groupBy !== 'none' ? (
            <ProjectGroupView
              projects={sortedProjects}
              groupBy={groupBy}
              viewMode={viewMode}
              onProjectSelect={onProjectSelect}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              renderCardView={renderCardView}
              renderTableView={renderTableView}
            />
          ) : (
            <div className={`animate-slideUp ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden' : ''}`}>
              {viewMode === 'table' ? (
                renderTableView()
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {renderCardView()}
                </div>
              )}
            </div>
          )}

          {filteredProjects.length === 0 && searchTerm && (
            <div className="flex flex-col items-center justify-center p-20 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 animate-fadeIn">
              <span className="text-6xl mb-6">📭</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No projects found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                We couldn't find any results matching "{searchTerm}". Try adjusting your filters or search terms.
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="btn-secondary px-8 py-3 rounded-xl font-bold"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectList;
