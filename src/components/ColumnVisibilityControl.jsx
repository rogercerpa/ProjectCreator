import React, { useState, useRef, useEffect } from 'react';

function ColumnVisibilityControl({ 
  columns, 
  visibleColumns, 
  columnOrder = [],
  onColumnToggle, 
  onColumnReorder,
  onResetColumns 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [draggedItem, setDraggedItem] = useState(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleColumnToggle = (columnKey) => {
    onColumnToggle(columnKey);
  };

  const handleReset = () => {
    onResetColumns();
    setIsOpen(false);
  };

  // Drag and drop handlers
  const handleDragStart = (e, columnKey) => {
    setDraggedItem(columnKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetColumnKey) {
      setDraggedItem(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(targetColumnKey);

    // Remove dragged item and insert at target position
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);

    if (onColumnReorder) {
      onColumnReorder(newOrder);
    }
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const calculatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 400; // max-height from CSS
      
      // Check if there's enough space below
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top, left;
      
      if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
        // Position below
        top = rect.bottom + 4;
      } else {
        // Position above
        top = rect.top - dropdownHeight - 4;
      }
      
      // Center horizontally relative to button
      left = rect.left + (rect.width / 2) - 100; // 100px is half of min-width
      
      // Ensure dropdown doesn't go off-screen horizontally
      if (left < 8) left = 8;
      if (left + 200 > window.innerWidth - 8) {
        left = window.innerWidth - 208;
      }
      
      setDropdownPosition({ top, left });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && 
          buttonRef.current && 
          !buttonRef.current.contains(event.target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;

  // Get ordered columns for display
  const getOrderedColumns = () => {
    if (!columnOrder || columnOrder.length === 0) {
      return columns;
    }
    return columnOrder
      .map(key => columns.find(col => col.key === key))
      .filter(Boolean);
  };

  const orderedColumns = getOrderedColumns();

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 md:px-2 md:py-1.5 md:text-[0.8125rem]"
        onClick={handleToggle}
        title="Show/Hide Columns"
      >
        <span className="text-base">📊</span>
        <span className="font-medium md:hidden">Columns</span>
        <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full text-xs font-semibold">
          ({visibleCount}/{totalCount})
        </span>
        <span className={`text-xs text-gray-400 dark:text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl z-[9999] min-w-[240px] mt-1 overflow-hidden max-h-[450px] animate-slideUp md:min-w-[220px] sm:min-w-[200px]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <h4 className="m-0 text-sm font-semibold text-gray-800 dark:text-gray-200">
              Show Columns
            </h4>
            <button 
              className="bg-transparent border-none text-primary-600 dark:text-primary-400 text-xs font-medium cursor-pointer px-2 py-1 rounded transition-all hover:bg-info-50 dark:hover:bg-info-900/20 hover:text-primary-700 dark:hover:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              onClick={handleReset}
              title="Reset to Default"
            >
              Reset
            </button>
          </div>
          
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-300 m-0">
              💡 Drag items to reorder columns
            </p>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto py-2 custom-scrollbar">
            {orderedColumns.map((column) => (
              <div
                key={column.key}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, column.key)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.key)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-4 py-2 cursor-move transition-all text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 md:px-3 md:py-1.5 md:text-[0.8125rem] sm:px-2.5 ${draggedItem === column.key ? 'opacity-40 bg-blue-100 dark:bg-blue-900/30' : ''}`}
              >
                <span className="text-gray-400 dark:text-gray-500 text-xs">⋮⋮</span>
                <label 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.key)}
                    onChange={() => handleColumnToggle(column.key)}
                    className="w-4 h-4 accent-primary-600 dark:accent-primary-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  />
                  <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">
                    {column.label}
                  </span>
                  {column.sortable && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 opacity-70">↕️</span>
                  )}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnVisibilityControl;
