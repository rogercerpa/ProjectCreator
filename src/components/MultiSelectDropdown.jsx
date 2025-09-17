import React, { useState, useRef, useEffect } from 'react';
import './MultiSelectDropdown.css';

const MultiSelectDropdown = ({ 
  options = [], 
  selectedValues = [], 
  onChange, 
  placeholder = "Select", 
  label,
  className = "",
  disabled = false,
  isFieldImported = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle option toggle
  const handleOptionToggle = (option) => {
    const newSelectedValues = selectedValues.includes(option)
      ? selectedValues.filter(value => value !== option)
      : [...selectedValues, option];
    
    onChange(newSelectedValues);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedValues.length === filteredOptions.length) {
      // Deselect all filtered options
      const newSelectedValues = selectedValues.filter(value => 
        !filteredOptions.includes(value)
      );
      onChange(newSelectedValues);
    } else {
      // Select all filtered options
      const newSelectedValues = [...new Set([...selectedValues, ...filteredOptions])];
      onChange(newSelectedValues);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get display text for selected values
  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) return selectedValues[0];
    if (selectedValues.length <= 3) return selectedValues.join(', ');
    return `${selectedValues.length} items selected`;
  };

  const allFilteredSelected = filteredOptions.length > 0 && 
    filteredOptions.every(option => selectedValues.includes(option));

  return (
    <div className={`multi-select-dropdown ${className} ${isFieldImported ? 'imported-field' : ''}`} ref={dropdownRef}>
      {label && <label className="multi-select-label">{label}</label>}
      
      <div 
        className={`multi-select-input ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="multi-select-text">{getDisplayText()}</span>
        <span className={`multi-select-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </div>

      {isOpen && (
        <div className="multi-select-options">
          {/* Search input */}
          <div className="multi-select-search">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Select All option */}
          {filteredOptions.length > 1 && (
            <div 
              className={`multi-select-option select-all ${allFilteredSelected ? 'selected' : ''}`}
              onClick={() => handleSelectAll()}
            >
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={() => {}} // Handled by onClick
                className="option-checkbox"
              />
              <span className="option-label">
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </span>
            </div>
          )}

          {/* Options list */}
          <div className="options-list">
            {filteredOptions.length === 0 ? (
              <div className="no-options">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  className={`multi-select-option ${selectedValues.includes(option) ? 'selected' : ''}`}
                  onClick={() => handleOptionToggle(option)}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={() => {}} // Handled by onClick
                    className="option-checkbox"
                  />
                  <span className="option-label">{option}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isFieldImported && <span className="import-indicator">📋 Imported</span>}
    </div>
  );
};

export default MultiSelectDropdown;
