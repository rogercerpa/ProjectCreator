import React, { useState } from 'react';
import './ColumnVisibilityControl.css';

function ColumnVisibilityControl({ 
  columns, 
  visibleColumns, 
  onColumnToggle, 
  onResetColumns 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleColumnToggle = (columnKey) => {
    onColumnToggle(columnKey);
  };

  const handleReset = () => {
    onResetColumns();
    setIsOpen(false);
  };

  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;

  return (
    <div className="column-visibility-control">
      <button
        className="column-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Show/Hide Columns"
      >
        <span className="column-icon">📊</span>
        <span className="column-text">Columns</span>
        <span className="column-count">({visibleCount}/{totalCount})</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="column-dropdown">
          <div className="column-dropdown-header">
            <h4>Show Columns</h4>
            <button 
              className="reset-btn"
              onClick={handleReset}
              title="Show All Columns"
            >
              Reset
            </button>
          </div>
          
          <div className="column-list">
            {columns.map((column) => (
              <label key={column.key} className="column-item">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.key)}
                  onChange={() => handleColumnToggle(column.key)}
                  className="column-checkbox"
                />
                <span className="column-label">{column.label}</span>
                {column.sortable && (
                  <span className="sort-indicator">↕️</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnVisibilityControl;
