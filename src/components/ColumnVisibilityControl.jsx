import React, { useState, useRef, useEffect } from 'react';
import './ColumnVisibilityControl.css';

function ColumnVisibilityControl({ 
  columns, 
  visibleColumns, 
  onColumnToggle, 
  onResetColumns 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleColumnToggle = (columnKey) => {
    onColumnToggle(columnKey);
  };

  const handleReset = () => {
    onResetColumns();
    setIsOpen(false);
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

  return (
    <div className="column-visibility-control">
      <button
        ref={buttonRef}
        className="column-toggle-btn"
        onClick={handleToggle}
        title="Show/Hide Columns"
      >
        <span className="column-icon">📊</span>
        <span className="column-text">Columns</span>
        <span className="column-count">({visibleCount}/{totalCount})</span>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="column-dropdown"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
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
