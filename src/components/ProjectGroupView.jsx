import React from 'react';
import './ProjectGroupView.css';

function ProjectGroupView({ 
  projects, 
  groupBy, 
  viewMode,
  density,
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

  const getGroupColor = (groupKey, groupValue) => {
    switch (groupKey) {
      case 'status':
        switch (groupValue.toLowerCase()) {
          case 'active': return 'status-active';
          case 'draft': return 'status-draft';
          case 'complete': return 'status-complete';
          case 'archived': return 'status-archived';
          default: return 'status-default';
        }
      case 'triageLevel':
        switch (groupValue.toLowerCase()) {
          case 'high': return 'triage-high';
          case 'medium': return 'triage-medium';
          case 'low': return 'triage-low';
          default: return 'triage-default';
        }
      default:
        return 'group-default';
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
    if (groupBy === 'triageLevel') {
      const order = { 'High': 0, 'Medium': 1, 'Low': 2 };
      return (order[a] || 99) - (order[b] || 99);
    }
    return a.localeCompare(b);
  });

  if (projects.length === 0) {
    return (
      <div className="group-view-empty">
        <div className="empty-icon">📂</div>
        <h3>No Projects Found</h3>
        <p>No projects match your current filters.</p>
      </div>
    );
  }

  return (
    <div className={`project-group-view ${viewMode}-view ${density}`}>
      {sortedGroupKeys.map(groupKey => {
        const groupProjects = groupedProjects[groupKey];
        const groupIcon = getGroupIcon(groupBy, groupKey);
        const groupColor = getGroupColor(groupBy, groupKey);
        
        return (
          <div key={groupKey} className={`project-group ${groupColor}`}>
            <div className="group-header">
              <div className="group-info">
                <span className="group-icon">{groupIcon}</span>
                <h3 className="group-title">{groupKey}</h3>
                <span className="group-count">
                  {groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            <div className="group-content">
              {viewMode === 'table' ? (
                renderTableView(groupProjects)
              ) : (
                <div className="group-cards">
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
