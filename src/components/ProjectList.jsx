import React, { useState, useEffect, useCallback } from 'react';
import ViewToolbar from './ViewToolbar';
import ProjectTableView from './ProjectTableView';
import ProjectGroupView from './ProjectGroupView';
import DASSearchResults from './DASSearchResults';

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
  
  // DAS Search state
  const [searchMode, setSearchMode] = useState(() => {
    const saved = localStorage.getItem('projectListSearchMode');
    return saved || 'database';
  });
  const [dasSearchResults, setDasSearchResults] = useState([]);
  const [dasSearchLoading, setDasSearchLoading] = useState(false);
  const [dasSearchError, setDasSearchError] = useState(null);
  const [dasSearchInfo, setDasSearchInfo] = useState(null);
  const [dasSearchDebounceTimer, setDasSearchDebounceTimer] = useState(null);

  // Get placeholder text based on search mode
  const getSearchPlaceholder = () => {
    switch (searchMode) {
      case 'das':
        return 'Search DAS Drive by project name, container (24-16071), or RFA number...';
      case 'both':
        return 'Search projects in database and DAS Drive...';
      default:
        return 'Search by name, RFA, agent, container, RFA type, project type...';
    }
  };

  // Handle search mode change
  const handleSearchModeChange = (newMode) => {
    setSearchMode(newMode);
    localStorage.setItem('projectListSearchMode', newMode);
    // Clear DAS results when switching modes
    if (newMode === 'database') {
      setDasSearchResults([]);
      setDasSearchError(null);
      setDasSearchInfo(null);
    }
  };

  // Perform DAS Drive search
  const performDasSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setDasSearchResults([]);
      setDasSearchError(null);
      setDasSearchInfo(null);
      return;
    }

    setDasSearchLoading(true);
    setDasSearchError(null);

    try {
      const result = await window.electronAPI.dasSearch(query.trim(), { yearLimit: 3 });
      
      if (result.success) {
        setDasSearchResults(result.results || []);
        setDasSearchInfo({
          detectedType: result.detectedType,
          searchedYears: result.searchedYears,
          searchedYear: result.searchedYear,
          query: result.query
        });
      } else {
        setDasSearchError(result.error || 'Search failed');
        setDasSearchResults([]);
      }
    } catch (error) {
      console.error('DAS search error:', error);
      setDasSearchError('Failed to search DAS Drive. Please check your network connection.');
      setDasSearchResults([]);
    } finally {
      setDasSearchLoading(false);
    }
  }, []);

  // Debounced DAS search effect
  useEffect(() => {
    if (searchMode === 'database') return;

    // Clear previous timer
    if (dasSearchDebounceTimer) {
      clearTimeout(dasSearchDebounceTimer);
    }

    // Set new debounce timer (500ms delay for DAS search)
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performDasSearch(searchTerm);
      } else {
        setDasSearchResults([]);
        setDasSearchInfo(null);
      }
    }, 500);

    setDasSearchDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchTerm, searchMode, performDasSearch]);

  // Handle opening a folder from DAS search results
  const handleOpenDasFolder = async (folderPath) => {
    try {
      const result = await window.electronAPI.dasSearchOpenPath(folderPath);
      if (!result.success) {
        console.error('Failed to open folder:', result.error);
      }
    } catch (error) {
      console.error('Error opening folder:', error);
    }
  };

  // Handle copying path from DAS search results
  const handleCopyDasPath = (path) => {
    console.log('Path copied:', path);
  };

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

  // Helper function for BOM tooltip text
  const getBOMTooltip = (project) => {
    if (!project.bomData) return 'No BOM uploaded';
    const devices = project.bomData.totalDevices || 0;
    const cost = project.bomData.startupCosts?.total;
    return cost 
      ? `${devices} devices • $${cost.toLocaleString()} startup`
      : `${devices} devices`;
  };

  const renderCardView = (projectsToRender = sortedProjects) => {
    return projectsToRender.map((project) => (
      <div 
        key={project.id}
        onClick={() => onProjectSelect(project)}
        className={`group relative p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden border-l-4 ${
          project.bomData ? 'border-l-green-500' : 'border-l-amber-400'
        }`}
      >
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-start justify-between gap-4">
              <h4 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight line-clamp-2" title={project.projectName}>
                {project.projectName || 'Untitled Project'}
              </h4>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/50 text-[10px] font-bold text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-600/50 whitespace-nowrap tabular-nums tracking-tighter">
                  {project.rfaNumber || 'N/A'}
                </span>
                {/* BOM Status Badge */}
                <span 
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${
                    project.bomData 
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700' 
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700'
                  }`}
                  title={getBOMTooltip(project)}
                >
                  <span>{project.bomData ? '📦' : '○'}</span>
                  <span>{project.bomData ? `${project.bomData.totalDevices || 0}` : 'No BOM'}</span>
                </span>
              </div>
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
          {/* Search Mode Toggle */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Search in:</span>
            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
              <button
                onClick={() => handleSearchModeChange('database')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  searchMode === 'database'
                    ? 'bg-white dark:bg-gray-500 text-primary-600 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
                  </svg>
                  Database
                </span>
              </button>
              <button
                onClick={() => handleSearchModeChange('das')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  searchMode === 'das'
                    ? 'bg-white dark:bg-gray-500 text-primary-600 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/>
                  </svg>
                  DAS Drive
                </span>
              </button>
              <button
                onClick={() => handleSearchModeChange('both')}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  searchMode === 'both'
                    ? 'bg-white dark:bg-gray-500 text-primary-600 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
                  </svg>
                  Both
                </span>
              </button>
            </div>
            {searchMode !== 'database' && (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                Tip: Enter container (24-16071), RFA number (12345-0), or project name
              </span>
            )}
          </div>

          {/* Search Input */}
          <div className="relative group">
            {/* Loading indicator only shown when searching DAS Drive */}
            {dasSearchLoading && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin"></div>
              </div>
            )}
            <input
              type="text"
              placeholder={getSearchPlaceholder()}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full ${dasSearchLoading ? 'pl-12' : 'pl-5'} pr-12 py-4 bg-gray-50 dark:bg-gray-900/50 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all shadow-inner`}
            />
            {searchTerm && (
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                onClick={() => {
                  setSearchTerm('');
                  setDasSearchResults([]);
                  setDasSearchError(null);
                  setDasSearchInfo(null);
                }}
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
      <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20 custom-scrollbar">
        <div className="max-w-7xl mx-auto p-8 pt-4">
          {/* DAS Drive Search Results (shown when mode is 'das' or 'both') */}
          {(searchMode === 'das' || searchMode === 'both') && searchTerm.trim().length >= 2 && (
            <div className="mb-8">
              <DASSearchResults
                results={dasSearchResults}
                isLoading={dasSearchLoading}
                error={dasSearchError}
                searchInfo={dasSearchInfo}
                onOpenFolder={handleOpenDasFolder}
                onCopyPath={handleCopyDasPath}
              />
            </div>
          )}

          {/* Database Results Header (shown when mode is 'database' or 'both') */}
          {(searchMode === 'database' || searchMode === 'both') && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-2 w-2 rounded-full bg-primary-500 animate-pulse"></div>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
                  {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} in database
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

              {filteredProjects.length === 0 && searchTerm && searchMode === 'database' && (
                <div className="flex flex-col items-center justify-center p-20 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 animate-fadeIn">
                  <span className="text-6xl mb-6">📭</span>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No projects found in database</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
                    We couldn't find any results matching "{searchTerm}". Try searching the DAS Drive or adjusting your search terms.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSearchModeChange('das')}
                      className="btn-primary px-6 py-3 rounded-xl font-bold"
                    >
                      Search DAS Drive
                    </button>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="btn-secondary px-6 py-3 rounded-xl font-bold"
                    >
                      Clear Search
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* DAS-only mode empty state */}
          {searchMode === 'das' && searchTerm.trim().length < 2 && (
            <div className="flex flex-col items-center justify-center p-20 text-center bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 animate-fadeIn">
              <div className="w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Search the DAS Drive</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Enter at least 2 characters to search. You can search by:
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Project Name</span>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">e.g., "YOKOTA B118"</p>
                </div>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span className="font-bold text-gray-700 dark:text-gray-300">Container Number</span>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">e.g., "24-16071"</p>
                </div>
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <span className="font-bold text-gray-700 dark:text-gray-300">RFA Number</span>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">e.g., "12345-0"</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectList;
