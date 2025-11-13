import React, { useState } from 'react';
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
  // Define all available columns
  const allColumns = [
    { key: 'projectName', label: 'Project Name', sortable: true, width: '20%', minWidth: '180px' },
    { key: 'rfaNumber', label: 'RFA Number', sortable: true, width: '10%', minWidth: '110px' },
    { key: 'rfaValue', label: 'RFA Value', sortable: true, width: '10%', minWidth: '110px' },
    { key: 'rfaType', label: 'RFA Type', sortable: true, width: '12%', minWidth: '120px' },
    { key: 'projectType', label: 'Project Type', sortable: true, width: '12%', minWidth: '130px' },
    { key: 'agentNumber', label: 'Agent Number', sortable: true, width: '10%', minWidth: '110px' },
    { key: 'projectContainer', label: 'Project Container', sortable: true, width: '12%', minWidth: '130px' },
    { key: 'ecd', label: 'ECD', sortable: true, width: '12%', minWidth: '120px' },
    { key: 'requestedDate', label: 'Requested Date', sortable: true, width: '12%', minWidth: '140px' },
    { key: 'actions', label: 'Actions', sortable: false, width: '5%', minWidth: '80px' }
  ];

  // Initialize column order from localStorage
  const [columnOrder, setColumnOrder] = useState(() => {
    const savedOrder = localStorage.getItem('projectTableColumnOrder');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        // Validate that saved order contains valid column keys
        const validKeys = allColumns.map(col => col.key);
        const isValid = parsed.every(key => validKeys.includes(key));
        if (isValid && parsed.length === allColumns.length) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved column order, using defaults');
      }
    }
    return allColumns.map(col => col.key);
  });

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

  const [draggedColumn, setDraggedColumn] = useState(null);
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      const formatted = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return formatted;
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
    const defaultOrder = allColumns.map(col => col.key);
    setVisibleColumns(defaultColumns);
    setColumnOrder(defaultOrder);
    localStorage.setItem('projectTableVisibleColumns', JSON.stringify(defaultColumns));
    localStorage.setItem('projectTableColumnOrder', JSON.stringify(defaultOrder));
  };

  const handleColumnReorder = (newOrder) => {
    setColumnOrder(newOrder);
    localStorage.setItem('projectTableColumnOrder', JSON.stringify(newOrder));
  };

  // Drag and drop handlers for table headers
  const handleDragStart = (e, columnKey) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const targetIndex = newOrder.indexOf(targetColumnKey);

    // Remove dragged item and insert at target position
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);

    handleColumnReorder(newOrder);
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Format currency
  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numValue);
  };

  // Get ordered columns based on current order
  const getOrderedColumns = () => {
    return columnOrder.map(key => allColumns.find(col => col.key === key)).filter(Boolean);
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="empty-icon">📋</div>
        <h3>No Projects Found</h3>
        <p>No projects match your current filters.</p>
      </div>
    );
  }

  // Filter and order columns based on visibility and order
  const orderedColumns = getOrderedColumns();
  const visibleColumnsData = orderedColumns.filter(col => visibleColumns.includes(col.key));

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden ${density === 'compact' ? 'text-sm' : density === 'comfortable' ? 'text-base' : 'text-sm'}`}>
      <div className="flex justify-end items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <ColumnVisibilityControl
          columns={allColumns}
          visibleColumns={visibleColumns}
          columnOrder={columnOrder}
          onColumnToggle={handleColumnToggle}
          onColumnReorder={handleColumnReorder}
          onResetColumns={handleResetColumns}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {visibleColumnsData.map((column) => (
                <th
                  key={column.key}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, column.key)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.key)}
                  onDragEnd={handleDragEnd}
                  className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 ${column.sortable ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600' : ''} ${sortBy === column.key ? 'text-primary-600 dark:text-primary-400' : ''} ${draggedColumn === column.key ? 'opacity-50' : ''} transition-opacity`}
                  style={{ width: column.width, minWidth: column.minWidth, cursor: 'move' }}
                  onClick={column.sortable ? () => handleHeaderClick(column.key) : undefined}
                  title="Drag to reorder columns"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 dark:text-gray-500">⋮⋮</span>
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="sort-icon">{getSortIcon(column.key)}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${getStatusColor(project)}`}
                onClick={(e) => handleRowClick(project, e)}
              >
                {visibleColumnsData.map((column) => {
                  switch (column.key) {
                    case 'projectName':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                          <div className="name-container">
                            <span className="project-name" title={project.projectName}>
                              {project.projectName || 'Untitled Project'}
                            </span>
                          </div>
                        </td>
                      );
                    case 'rfaNumber':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-primary-600 dark:text-primary-400 font-medium">
                          <span className="rfa-number">{project.rfaNumber || 'N/A'}</span>
                        </td>
                      );
                    case 'rfaValue':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-medium">
                          <span className="rfa-value">{formatCurrency(project.rfaValue)}</span>
                        </td>
                      );
                    case 'rfaType':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="rfa-type">{project.rfaType || 'N/A'}</span>
                        </td>
                      );
                    case 'projectType':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="project-type">{project.projectType || project.customProjectType || 'N/A'}</span>
                        </td>
                      );
                    case 'agentNumber':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="agent-number">{project.agentNumber || 'N/A'}</span>
                        </td>
                      );
                    case 'projectContainer':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="project-container">{project.projectContainer || 'N/A'}</span>
                        </td>
                      );
                    case 'ecd':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="date-value">{project.ecd ? formatDate(project.ecd) : 'N/A'}</span>
                        </td>
                      );
                    case 'requestedDate':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="date-value">{project.requestedDate ? formatDate(project.requestedDate) : 'N/A'}</span>
                        </td>
                      );
                    case 'actions':
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
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
