import React from 'react';

function ProjectGroupView({ 
  projects, 
  groupBy, 
  viewMode,
  onProjectSelect,
  sortBy,
  sortOrder,
  onSort,
  renderCardView,
  renderTableView
}) {
  const [collapsedGroups, setCollapsedGroups] = React.useState(() => {
    const saved = localStorage.getItem(`projectGroupCollapsed_${groupBy}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Keep collapsed state in sync when groupBy changes
  React.useEffect(() => {
    const saved = localStorage.getItem(`projectGroupCollapsed_${groupBy}`);
    setCollapsedGroups(saved ? JSON.parse(saved) : {});
  }, [groupBy]);

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => {
      const newState = {
        ...prev,
        [groupKey]: !prev[groupKey]
      };
      localStorage.setItem(`projectGroupCollapsed_${groupBy}`, JSON.stringify(newState));
      return newState;
    });
  };

  const getGroupValue = (project, groupField) => {
    switch (groupField) {
      case 'status':
        return project.status || 'Active';
      case 'regionalTeam':
        return project.regionalTeam || 'Unassigned';
      case 'rfaType':
        return project.rfaType || 'Unknown Type';
      case 'rfaStatus':
        // Normalize RFA Status values to the standard set
        const rfaStatus = project.rfaStatus;
        if (!rfaStatus) return 'None';
        // Map common variations to standard values
        const normalizedStatus = rfaStatus.trim();
        const validStatuses = ['In Progress', 'Ready for QC', 'Pending', 'On Hold', 'Completed', 'Cancelled', 'None'];
        // Check if it's an exact match (case-sensitive)
        if (validStatuses.includes(normalizedStatus)) {
          return normalizedStatus;
        }
        // Case-insensitive matching for common variations
        const lowerStatus = normalizedStatus.toLowerCase();
        if (lowerStatus === 'in progress' || lowerStatus === 'in-progress') return 'In Progress';
        if (lowerStatus === 'ready for qc' || lowerStatus === 'ready-for-qc' || lowerStatus === 'readyforqc') return 'Ready for QC';
        if (lowerStatus === 'pending') return 'Pending';
        if (lowerStatus === 'on hold' || lowerStatus === 'on-hold') return 'On Hold';
        if (lowerStatus === 'completed' || lowerStatus === 'complete') return 'Completed';
        if (lowerStatus === 'cancelled' || lowerStatus === 'canceled') return 'Cancelled';
        if (lowerStatus === 'none' || lowerStatus === 'not specified' || lowerStatus === '') return 'None';
        // If it doesn't match any standard value, return as-is but group it
        return normalizedStatus;
      case 'triageLevel':
        if (!project.triageResults?.totalTriage) return 'Low';
        if (project.triageResults.totalTriage > 100) return 'High';
        if (project.triageResults.totalTriage > 50) return 'Medium';
        return 'Low';
      default:
        return 'All Projects';
    }
  };

  const getGroupIcon = (groupKey, groupValue) => {
    switch (groupKey) {
      case 'status':
        switch (groupValue.toLowerCase()) {
          case 'active': return '🟢';
          case 'draft': return '📝';
          case 'complete': return '✅';
          case 'archived': return '📦';
          default: return '⚪';
        }
      case 'regionalTeam':
        return '👥';
      case 'rfaType':
        return '📋';
      case 'rfaStatus':
        return '🏷️';
      case 'triageLevel':
        switch (groupValue.toLowerCase()) {
          case 'high': return '🔴';
          case 'medium': return '🟡';
          case 'low': return '🟢';
          default: return '⚪';
        }
      default:
        return '📁';
    }
  };

  const getGroupColorClass = (groupKey, groupValue) => {
    switch (groupKey) {
      case 'status':
        switch (groupValue.toLowerCase()) {
          case 'active': return 'bg-gradient-to-r from-success-500 to-green-600';
          case 'draft': return 'bg-gradient-to-r from-info-500 to-blue-600';
          case 'complete': return 'bg-gradient-to-r from-purple-500 to-purple-600';
          case 'archived': return 'bg-gradient-to-r from-gray-500 to-gray-600';
          default: return 'bg-gradient-to-r from-gray-300 to-gray-400';
        }
      case 'triageLevel':
        switch (groupValue.toLowerCase()) {
          case 'high': return 'bg-gradient-to-r from-error-500 to-red-600';
          case 'medium': return 'bg-gradient-to-r from-warning-500 to-orange-600';
          case 'low': return 'bg-gradient-to-r from-success-500 to-green-600';
          default: return 'bg-gradient-to-r from-gray-300 to-gray-400';
        }
      default:
        return 'bg-gradient-to-r from-primary-500 to-purple-600';
    }
  };

  // Group projects
  const groupedProjects = projects.reduce((groups, project) => {
    const groupValue = getGroupValue(project, groupBy);
    if (!groups[groupValue]) {
      groups[groupValue] = [];
    }
    groups[groupValue].push(project);
    return groups;
  }, {});

  // Sort groups alphabetically, but put 'Active' first for status grouping
  const sortedGroupKeys = Object.keys(groupedProjects).sort((a, b) => {
    if (groupBy === 'status') {
      if (a === 'Active') return -1;
      if (b === 'Active') return 1;
    }
    if (groupBy === 'rfaStatus') {
      // Define the desired order for RFA Status groups
      // "Ready for QC" appears right after "In Progress"
      const rfaStatusOrder = {
        'In Progress': 0,
        'Ready for QC': 1,
        'Pending': 2,
        'On Hold': 3,
        'Completed': 4,
        'Cancelled': 5,
        'None': 6
      };
      const aOrder = rfaStatusOrder[a] !== undefined ? rfaStatusOrder[a] : 99;
      const bOrder = rfaStatusOrder[b] !== undefined ? rfaStatusOrder[b] : 99;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      // If both are not in the standard list, sort alphabetically
      return a.localeCompare(b);
    }
    if (groupBy === 'triageLevel') {
      const order = { 'High': 0, 'Medium': 1, 'Low': 2 };
      return (order[a] || 99) - (order[b] || 99);
    }
    return a.localeCompare(b);
  });

  // Standard padding classes
  const paddingClasses = {
    header: 'px-6 py-4',
    content: 'p-6',
    title: 'text-lg',
    iconSize: 'w-8 h-8 text-xl'
  };

  // Standard grid columns
  const gridCols = 'grid-cols-[repeat(auto-fill,minmax(350px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]';

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 px-8 text-gray-600 dark:text-gray-400">
        <div className="text-6xl mb-4 opacity-50">📂</div>
        <h3 className="text-2xl text-gray-700 dark:text-gray-300 mb-2 font-medium">
          No Projects Found
        </h3>
        <p className="text-base m-0">No projects match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {sortedGroupKeys.map(groupKey => {
        const groupProjects = groupedProjects[groupKey];
        const groupIcon = getGroupIcon(groupBy, groupKey);
        const groupColorClass = getGroupColorClass(groupBy, groupKey);
        const isCollapsed = collapsedGroups[groupKey];
        
        return (
          <div 
            key={groupKey} 
            className="group/item animate-slideUp"
          >
            <div 
              onClick={() => toggleGroup(groupKey)}
              className="flex items-center justify-between mb-6 cursor-pointer select-none"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${groupColorClass} text-white shadow-lg shadow-primary-500/20 group-hover/item:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{groupIcon}</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">
                    {groupKey}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-pulse"></span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                      {groupProjects.length} Verified Entries
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={`h-px w-24 sm:w-48 lg:w-64 bg-gray-100 dark:bg-gray-800 group-hover/item:w-full transition-all duration-700`} />
                <div className={`p-2 rounded-xl border-2 border-gray-100 dark:border-gray-800 text-gray-400 group-hover/item:text-primary-500 group-hover/item:border-primary-500/20 transition-all ${isCollapsed ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>
            </div>
            
            {!isCollapsed && (
              <div className={`animate-fadeIn ${viewMode === 'table' ? 'bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden' : ''}`}>
                {viewMode === 'table' ? (
                  renderTableView(groupProjects)
                ) : (
                  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`}>
                    {renderCardView(groupProjects)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ProjectGroupView;
