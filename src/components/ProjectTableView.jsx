import React, { useState } from 'react';
import './ProjectTableView.css';
import ColumnVisibilityControl from './ColumnVisibilityControl';

function ProjectTableView({ 
  projects, 
  onProjectSelect, 
  density = 'standard',
  sortBy,
  sortOrder,
  onSort
}) {
  const [visibleColumns, setVisibleColumns] = useState([
    'projectName', 'rfaNumber', 'agentNumber', 'rfaType', 'regionalTeam', 'status', 'triage', 'createdAt'
  ]);
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (project) => {
    if (!project.triageResults?.totalTriage) return 'low';
    if (project.triageResults.totalTriage > 100) return 'high';
    if (project.triageResults.totalTriage > 50) return 'medium';
    return 'low';
  };

  const getTriageDisplay = (project) => {
    if (!project.triageResults) return 'N/A';
    return project.triageResults.totalTriage || '0';
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleHeaderClick = (column) => {
    onSort(column);
  };

  const handleRowClick = (project, e) => {
    // Prevent row click when clicking on specific elements
    if (e.target.closest('.row-actions')) return;
    onProjectSelect(project);
  };

  const handleColumnToggle = (columnKey) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  const handleResetColumns = () => {
    setVisibleColumns([
      'projectName', 'rfaNumber', 'agentNumber', 'rfaType', 'regionalTeam', 'status', 'triage', 'createdAt'
    ]);
  };

  const columns = [
    { key: 'projectName', label: 'Project Name', sortable: true, width: '250px' },
    { key: 'rfaNumber', label: 'RFA', sortable: true, width: '100px' },
    { key: 'agentNumber', label: 'Agent', sortable: true, width: '80px' },
    { key: 'rfaType', label: 'Type', sortable: true, width: '120px' },
    { key: 'regionalTeam', label: 'Team', sortable: true, width: '120px' },
    { key: 'status', label: 'Priority', sortable: false, width: '80px' },
    { key: 'triage', label: 'Triage', sortable: false, width: '70px' },
    { key: 'createdAt', label: 'Created', sortable: true, width: '100px' },
    { key: 'updatedAt', label: 'Updated', sortable: true, width: '100px' }
  ];

  if (projects.length === 0) {
    return (
      <div className="table-empty-state">
        <div className="empty-icon">📋</div>
        <h3>No Projects Found</h3>
        <p>No projects match your current filters.</p>
      </div>
    );
  }

  // Filter columns based on visibility
  const visibleColumnsData = columns.filter(col => visibleColumns.includes(col.key));

  return (
    <div className={`project-table-container ${density}`}>
      <div className="table-controls">
        <ColumnVisibilityControl
          columns={columns}
          visibleColumns={visibleColumns}
          onColumnToggle={handleColumnToggle}
          onResetColumns={handleResetColumns}
        />
      </div>
      <div className="table-wrapper">
        <table className="project-table">
          <thead>
            <tr>
              {visibleColumnsData.map((column) => (
                <th
                  key={column.key}
                  className={`table-header ${column.sortable ? 'sortable' : ''} ${sortBy === column.key ? 'sorted' : ''}`}
                  style={{ width: column.width, minWidth: column.width }}
                  onClick={column.sortable ? () => handleHeaderClick(column.key) : undefined}
                >
                  {column.label}
                  {column.sortable && (
                    <span className="sort-icon">{getSortIcon(column.key)}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className={`project-row ${getStatusColor(project)}-priority`}
                onClick={(e) => handleRowClick(project, e)}
              >
                {visibleColumnsData.map((column) => {
                  switch (column.key) {
                    case 'projectName':
                      return (
                        <td key={column.key} className="project-name-cell">
                          <div className="name-container">
                            <span className="project-name" title={project.projectName}>
                              {project.projectName || 'Untitled Project'}
                            </span>
                            {project.projectContainer && (
                              <span className="project-container" title={project.projectContainer}>
                                {project.projectContainer}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    case 'rfaNumber':
                      return (
                        <td key={column.key} className="rfa-cell">
                          <span className="rfa-number">{project.rfaNumber || 'N/A'}</span>
                        </td>
                      );
                    case 'agentNumber':
                      return (
                        <td key={column.key} className="agent-cell">
                          <span className="agent-number">{project.agentNumber || 'N/A'}</span>
                        </td>
                      );
                    case 'rfaType':
                      return (
                        <td key={column.key} className="type-cell">
                          <span className="rfa-type">{project.rfaType || 'N/A'}</span>
                        </td>
                      );
                    case 'regionalTeam':
                      return (
                        <td key={column.key} className="team-cell">
                          <span className="regional-team">{project.regionalTeam || 'N/A'}</span>
                        </td>
                      );
                    case 'status':
                      return (
                        <td key={column.key} className="status-cell">
                          <span className={`status-badge ${getStatusColor(project)}`}>
                            {getStatusColor(project).toUpperCase()}
                          </span>
                        </td>
                      );
                    case 'triage':
                      return (
                        <td key={column.key} className="triage-cell">
                          <span className={`triage-value ${getStatusColor(project)}`}>
                            {getTriageDisplay(project)}
                          </span>
                        </td>
                      );
                    case 'createdAt':
                      return (
                        <td key={column.key} className="date-cell">
                          <span className="date-value">{formatDate(project.createdAt)}</span>
                        </td>
                      );
                    case 'updatedAt':
                      return (
                        <td key={column.key} className="date-cell">
                          <span className="date-value">
                            {project.updatedAt !== project.createdAt 
                              ? formatDate(project.updatedAt) 
                              : '—'
                            }
                          </span>
                        </td>
                      );
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectTableView;
