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
        const validStatuses = ['In Progress', 'Pending', 'On Hold', 'Completed', 'Cancelled', 'None'];
        // Check if it's an exact match (case-sensitive)
        if (validStatuses.includes(normalizedStatus)) {
          return normalizedStatus;
        }
        // Case-insensitive matching for common variations
        const lowerStatus = normalizedStatus.toLowerCase();
        if (lowerStatus === 'in progress' || lowerStatus === 'in-progress') return 'In Progress';
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
      const rfaStatusOrder = {
        'In Progress': 0,
        'Pending': 1,
        'On Hold': 2,
        'Completed': 3,
        'Cancelled': 4,
        'None': 5
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
    <div className="flex flex-col gap-8 lg:gap-6 md:gap-4">
      {sortedGroupKeys.map(groupKey => {
        const groupProjects = groupedProjects[groupKey];
        const groupIcon = getGroupIcon(groupBy, groupKey);
        const groupColorClass = getGroupColorClass(groupBy, groupKey);
        
        return (
          <div 
            key={groupKey} 
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-all hover:shadow-lg animate-slideUp focus-within:outline-2 focus-within:outline-primary-600 focus-within:outline-offset-2"
          >
            <div className={`${paddingClasses.header} bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 relative overflow-hidden`}>
              {/* Top gradient accent */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${groupColorClass}`} />
              
              <div className="flex items-center gap-3">
                <span className={`${paddingClasses.iconSize} flex items-center justify-center bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700`}>
                  {groupIcon}
                </span>
                <h3 className={`${paddingClasses.title} font-semibold text-gray-800 dark:text-gray-200 m-0 flex-1`}>
                  {groupKey}
                </h3>
                <span className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-xl border border-gray-200 dark:border-gray-700 font-medium">
                  {groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            <div className={viewMode === 'table' ? 'p-0' : paddingClasses.content}>
              {viewMode === 'table' ? (
                renderTableView(groupProjects)
              ) : (
                <div className={`grid ${gridCols} gap-6 lg:gap-5 md:gap-4 md:grid-cols-1`}>
                  {renderCardView(groupProjects)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ProjectGroupView;
