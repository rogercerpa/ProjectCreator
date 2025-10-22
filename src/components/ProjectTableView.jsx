import React, { useState } from 'react';
import './ProjectTableView.css';
import ColumnVisibilityControl from './ColumnVisibilityControl';
import { formatDateTimeLocal, getUserTimezone } from '../utils/dateUtils';

function ProjectTableView({ 
  projects, 
  onProjectSelect, 
  onProjectDelete,
  density = 'standard',
  sortBy,
  sortOrder,
  onSort
}) {
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('projectTableVisibleColumns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved column visibility settings, using defaults');
      }
    }
    return ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'ecd', 'requestedDate', 'actions'];
  });
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // Use the dateUtils function to format with timezone awareness
    // If it's already in datetime-local format (YYYY-MM-DDTHH:MM), use it directly
    if (dateString.includes('T') && dateString.length <= 16) {
      return formatDateTimeLocal(dateString, true);
    }
    
    // Otherwise, treat as ISO string and extract the local part
    try {
      // Just display the date/time as-is from the string without conversion
      const date = new Date(dateString);
      const formatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${formatted} (${getUserTimezone().abbreviation})`;
    } catch (error) {
      return dateString;
    }
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
      const newColumns = prev.includes(columnKey)
        ? prev.filter(key => key !== columnKey)
        : [...prev, columnKey];
      
      // Save to localStorage
      localStorage.setItem('projectTableVisibleColumns', JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const handleResetColumns = () => {
    const defaultColumns = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'ecd', 'requestedDate', 'actions'];
    setVisibleColumns(defaultColumns);
    localStorage.setItem('projectTableVisibleColumns', JSON.stringify(defaultColumns));
  };

  const columns = [
    { key: 'projectName', label: 'Project Name', sortable: true, width: '25%', minWidth: '200px' },
    { key: 'rfaNumber', label: 'RFA Number', sortable: true, width: '12%', minWidth: '120px' },
    { key: 'agentNumber', label: 'Agent Number', sortable: true, width: '12%', minWidth: '120px' },
    { key: 'projectContainer', label: 'Project Container', sortable: true, width: '18%', minWidth: '150px' },
    { key: 'ecd', label: 'ECD', sortable: true, width: '13%', minWidth: '130px' },
    { key: 'requestedDate', label: 'Requested Date', sortable: true, width: '15%', minWidth: '150px' },
    { key: 'actions', label: 'Actions', sortable: false, width: '5%', minWidth: '80px' }
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
                  style={{ width: column.width, minWidth: column.minWidth }}
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
                    case 'projectContainer':
                      return (
                        <td key={column.key} className="container-cell">
                          <span className="project-container">{project.projectContainer || 'N/A'}</span>
                        </td>
                      );
                    case 'ecd':
                      return (
                        <td key={column.key} className="date-cell">
                          <span className="date-value">{project.ecd ? formatDate(project.ecd) : 'N/A'}</span>
                        </td>
                      );
                    case 'requestedDate':
                      return (
                        <td key={column.key} className="date-cell">
                          <span className="date-value">{project.requestedDate ? formatDate(project.requestedDate) : 'N/A'}</span>
                        </td>
                      );
                    case 'actions':
                      return (
                        <td key={column.key} className="actions-cell">
                          <div className="row-actions">
                            {onProjectDelete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onProjectDelete(project.id, project.projectName);
                                }}
                                className="delete-btn"
                                title="Delete Project"
                              >
                                ×
                              </button>
                            )}
                          </div>
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
