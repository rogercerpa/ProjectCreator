import React, { useState, useRef, useEffect } from 'react';

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
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block mb-2 font-semibold text-gray-800 dark:text-gray-200 text-sm">
          {label}
        </label>
      )}
      
      <div 
        className={`relative w-full min-h-[40px] px-3 py-2 border-2 rounded-md bg-white dark:bg-gray-800 cursor-pointer flex items-center justify-between transition-all ${
          isOpen 
            ? 'border-primary-600 dark:border-primary-500 ring-2 ring-primary-600/10 dark:ring-primary-500/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-600 dark:hover:border-primary-500'
        } ${
          disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''
        } ${
          isFieldImported ? 'bg-gradient-to-br from-info-50 to-blue-50 dark:from-info-900/20 dark:to-blue-900/20 border-primary-600 dark:border-primary-500 animate-importHighlight' : ''
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="flex-1 text-gray-800 dark:text-gray-200 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
          {getDisplayText()}
        </span>
        <span className={`text-gray-600 dark:text-gray-400 text-xs ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border-2 border-primary-600 dark:border-primary-500 border-t-0 rounded-b-md shadow-xl z-[1000] max-h-[300px] overflow-hidden flex flex-col md:max-h-[250px]">
          {/* Search input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 outline-none transition-all focus:border-primary-600 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-600/10 dark:focus:ring-primary-500/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Select All option */}
          {filteredOptions.length > 1 && (
            <div 
              className={`flex items-center px-4 py-2.5 cursor-pointer transition-colors border-none bg-gray-50 dark:bg-gray-900 w-full text-left font-semibold border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                allFilteredSelected ? 'bg-info-100 dark:bg-info-900/30' : ''
              }`}
              onClick={() => handleSelectAll()}
            >
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={() => {}} // Handled by onClick
                className="mr-3 w-4 h-4 cursor-pointer accent-primary-600 dark:accent-primary-500"
              />
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </span>
            </div>
          )}

          {/* Options list */}
          <div className="max-h-[200px] overflow-y-auto py-1 custom-scrollbar md:max-h-[150px]">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-600 dark:text-gray-400 italic text-sm">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  className={`flex items-center px-4 py-2.5 cursor-pointer transition-colors border-none bg-transparent w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 md:py-3 ${
                    selectedValues.includes(option) ? 'bg-info-100 dark:bg-info-900/30' : ''
                  }`}
                  onClick={() => handleOptionToggle(option)}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={() => {}} // Handled by onClick
                    className="mr-3 w-4 h-4 cursor-pointer accent-primary-600 dark:accent-primary-500"
                  />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                    {option}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isFieldImported && (
        <span className="absolute -top-2 -right-2 bg-primary-600 dark:bg-primary-500 text-white text-[10px] font-semibold px-2 py-1 rounded-xl z-10 shadow-lg shadow-primary-600/30 dark:shadow-primary-500/30">
          📋 Imported
        </span>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
