import React, { useState } from 'react';
import ColumnVisibilityControl from './ColumnVisibilityControl';
import { formatDateTimeLocal, getUserTimezone } from '../utils/dateUtils';

function ProjectTableView({ 
  projects, 
  onProjectSelect, 
  onProjectDelete,
  sortBy,
  sortOrder,
  onSort
}) {
  const tableScrollRef = React.useRef(null);
  const stickyScrollRef = React.useRef(null);
  const [showStickyScroll, setShowStickyScroll] = React.useState(false);

  // Sync scroll positions between table and sticky scrollbar
  React.useEffect(() => {
    const tableScroll = tableScrollRef.current;
    const stickyScroll = stickyScrollRef.current;
    
    if (!tableScroll || !stickyScroll) return;

    // Check if horizontal scroll is needed
    const checkScroll = () => {
      setShowStickyScroll(tableScroll.scrollWidth > tableScroll.clientWidth);
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);

    // Sync table scroll to sticky scroll
    const handleTableScroll = () => {
      if (stickyScroll.scrollLeft !== tableScroll.scrollLeft) {
        stickyScroll.scrollLeft = tableScroll.scrollLeft;
      }
    };

    // Sync sticky scroll to table scroll
    const handleStickyScroll = () => {
      if (tableScroll.scrollLeft !== stickyScroll.scrollLeft) {
        tableScroll.scrollLeft = stickyScroll.scrollLeft;
      }
    };

    tableScroll.addEventListener('scroll', handleTableScroll);
    stickyScroll.addEventListener('scroll', handleStickyScroll);

    return () => {
      window.removeEventListener('resize', checkScroll);
      tableScroll?.removeEventListener('scroll', handleTableScroll);
      stickyScroll?.removeEventListener('scroll', handleStickyScroll);
    };
  }, [projects]);
  // Define all available columns
  const allColumns = [
    { key: 'projectName', label: 'Project Name', sortable: true, width: '20%', minWidth: '180px' },
    { key: 'rfaNumber', label: 'RFA Number', sortable: true, width: '10%', minWidth: '110px' },
    { key: 'rfaValue', label: 'RFA Value', sortable: true, width: '10%', minWidth: '110px' },
    { key: 'rfaType', label: 'RFA Type', sortable: true, width: '12%', minWidth: '120px' },
    { key: 'projectType', label: 'Project Type', sortable: true, width: '12%', minWidth: '130px' },
    { key: 'agentNumber', label: 'Agent Number', sortable: true, width: '10%', minWidth: '110px' },
    { key: 'projectContainer', label: 'Project Container', sortable: true, width: '12%', minWidth: '130px' },
    { key: 'dasPaidServices', label: 'DAS Paid Services', sortable: true, width: '12%', minWidth: '140px' },
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
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl shadow-xl overflow-hidden text-sm">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Database Explorer</span>
          </div>
          <ColumnVisibilityControl
            columns={allColumns}
            visibleColumns={visibleColumns}
            columnOrder={columnOrder}
            onColumnToggle={handleColumnToggle}
            onColumnReorder={handleColumnReorder}
            onResetColumns={handleResetColumns}
          />
        </div>
        <div className="overflow-x-auto custom-scrollbar" ref={tableScrollRef}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                {visibleColumnsData.map((column) => (
                  <th
                    key={column.key}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, column.key)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, column.key)}
                    onDragEnd={handleDragEnd}
                    className={`px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700 ${column.sortable ? 'cursor-pointer hover:text-primary-600 transition-colors' : ''} ${sortBy === column.key ? 'text-primary-600 dark:text-primary-400 bg-primary-50/30 dark:bg-primary-900/10' : ''} ${draggedColumn === column.key ? 'opacity-50' : ''}`}
                    style={{ width: column.width, minWidth: column.minWidth, cursor: 'move' }}
                    onClick={column.sortable ? () => handleHeaderClick(column.key) : undefined}
                    title="Drag to reorder columns"
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <span className={`transition-transform duration-300 ${sortBy === column.key && sortOrder === 'desc' ? 'rotate-180' : ''}`}>
                          {sortBy === column.key ? (
                            <svg className="w-3 h-3 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 15l7-7 7 7"/></svg>
                          ) : (
                            <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M12 5v14M5 12l7-7 7 7"/></svg>
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="group hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all cursor-pointer"
                  onClick={(e) => handleRowClick(project, e)}
                >
                  {visibleColumnsData.map((column) => {
                    switch (column.key) {
                      case 'projectName':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" title={project.projectName}>
                                {project.projectName || 'Untitled Project'}
                              </span>
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                                {project.projectType || 'Standard'}
                              </span>
                            </div>
                          </td>
                        );
                      case 'rfaNumber':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono text-[11px] font-bold">
                              {project.rfaNumber || 'N/A'}
                            </span>
                          </td>
                        );
                      case 'rfaValue':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <span className="text-sm font-bold text-success-600 dark:text-success-400">
                              {formatCurrency(project.rfaValue)}
                            </span>
                          </td>
                        );
                      case 'rfaType':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                              {project.rfaType || 'N/A'}
                            </span>
                          </td>
                        );
                      case 'projectType':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              {project.projectType || project.customProjectType || 'N/A'}
                            </span>
                          </td>
                        );
                      case 'agentNumber':
                        return (
                          <td key={column.key} className="px-6 py-4 text-xs font-medium text-gray-500">
                            {project.agentNumber || 'N/A'}
                          </td>
                        );
                      case 'projectContainer':
                        return (
                          <td key={column.key} className="px-6 py-4 text-xs font-mono text-gray-400">
                            {project.projectContainer || 'N/A'}
                          </td>
                        );
                      case 'dasPaidServices':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            {project.dasPaidServiceEnabled ? (
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                                  project.dasStatus === 'Paid' ? 'bg-success-100 text-success-700 dark:bg-success-900/30' :
                                  project.dasStatus === 'Fee Waived' ? 'bg-info-100 text-info-700 dark:bg-info-900/30' :
                                  'bg-warning-100 text-warning-700 dark:bg-warning-900/30'
                                }`}>
                                  {project.dasStatus || 'Pending'}
                                </span>
                                {project.dasFee > 0 && (
                                  <span className="text-[10px] font-bold text-gray-400 ml-1">
                                    {formatCurrency(project.dasFee)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">Inactive</span>
                            )}
                          </td>
                        );
                      case 'ecd':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {project.ecd ? formatDate(project.ecd).split(',')[0] : 'N/A'}
                              </span>
                              <span className="text-[9px] text-gray-400">
                                {project.ecd ? formatDate(project.ecd).split(',')[1] : ''}
                              </span>
                            </div>
                          </td>
                        );
                      case 'requestedDate':
                        return (
                          <td key={column.key} className="px-6 py-4">
                            <span className="text-xs text-gray-500">
                              {project.requestedDate ? formatDate(project.requestedDate).split(',')[0] : 'N/A'}
                            </span>
                          </td>
                        );
                      case 'actions':
                        return (
                          <td key={column.key} className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {onProjectDelete && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onProjectDelete(project.id, project.projectName);
                                  }}
                                  className="p-2 rounded-lg text-gray-400 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all"
                                  title="Delete Project"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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
    
    {/* Sticky horizontal scrollbar at bottom of viewport */}
    {showStickyScroll && (
      <div 
        className="sticky bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 shadow-lg"
        style={{ marginTop: '-1px' }}
      >
        <div 
          ref={stickyScrollRef}
          className="overflow-x-auto overflow-y-hidden"
          style={{ height: '20px' }}
        >
          <div style={{ width: tableScrollRef.current?.scrollWidth || '100%', height: '1px' }} />
        </div>
      </div>
    )}
  </>
  );
}

export default ProjectTableView;
