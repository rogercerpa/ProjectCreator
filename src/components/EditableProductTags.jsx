import React, { useState, useRef, useEffect } from 'react';

/**
 * EditableProductTags - Display and edit product tags with delete on hover
 * Shows product chips with X button on hover for deletion
 * Includes dropdown to add new products
 */
const EditableProductTags = ({ 
  options = [], 
  selectedValues = [], 
  onChange, 
  label,
  className = "",
  disabled = false,
  isFieldImported = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Filter options to show only unselected ones
  const availableOptions = options.filter(option => !selectedValues.includes(option));
  
  // Filter available options based on search term
  const filteredOptions = availableOptions.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Remove a product
  const handleRemove = (productToRemove) => {
    const newSelectedValues = selectedValues.filter(value => value !== productToRemove);
    onChange(newSelectedValues);
  };

  // Add a product
  const handleAdd = (productToAdd) => {
    const newSelectedValues = [...selectedValues, productToAdd];
    onChange(newSelectedValues);
    setSearchTerm('');
  };

  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      {label && (
        <label className="block font-semibold text-gray-800 dark:text-gray-200 text-sm">
          {label}
        </label>
      )}
      
      {/* Selected Products Display */}
      <div className={`flex flex-wrap gap-2 min-h-[42px] p-2 border-2 rounded-md transition-all ${
        isFieldImported 
          ? 'bg-gradient-to-br from-info-50 to-blue-50 dark:from-info-900/20 dark:to-blue-900/20 border-primary-600 dark:border-primary-500 animate-importHighlight' 
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
      }`}>
        {selectedValues.length > 0 ? (
          selectedValues.map((product, index) => (
            <div
              key={index}
              className="group relative inline-flex items-center px-3 py-1.5 text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 rounded-md border border-primary-200 dark:border-primary-700 transition-all hover:bg-primary-200 dark:hover:bg-primary-900/50"
            >
              <span className="mr-1">{product}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(product)}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-300 dark:hover:bg-primary-800 text-primary-900 dark:text-primary-200 font-bold text-xs"
                  title={`Remove ${product}`}
                >
                  ×
                </button>
              )}
            </div>
          ))
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500 italic flex items-center">
            No products selected
          </span>
        )}
      </div>

      {/* Add Product Dropdown */}
      {!disabled && availableOptions.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full px-3 py-2 text-sm text-left bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-between"
          >
            <span className="text-gray-700 dark:text-gray-300">
              + Add Product
            </span>
            <span className={`text-gray-500 dark:text-gray-400 text-xs transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-primary-600 dark:border-primary-500 rounded-md shadow-xl z-[1000] max-h-[250px] overflow-hidden flex flex-col">
              {/* Search input */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 outline-none transition-all focus:border-primary-600 dark:focus:border-primary-500 focus:ring-2 focus:ring-primary-600/10 dark:focus:ring-primary-500/20"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Options list */}
              <div className="max-h-[180px] overflow-y-auto py-1 custom-scrollbar">
                {filteredOptions.length === 0 ? (
                  <div className="p-4 text-center text-gray-600 dark:text-gray-400 italic text-sm">
                    {availableOptions.length === 0 ? 'All products selected' : 'No products found'}
                  </div>
                ) : (
                  filteredOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="w-full flex items-center px-4 py-2.5 cursor-pointer transition-colors border-none bg-transparent text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => {
                        handleAdd(option);
                      }}
                    >
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">
                        {option}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import indicator */}
      {isFieldImported && (
        <span className="absolute -top-2 -right-2 bg-primary-600 dark:bg-primary-500 text-white text-[10px] font-semibold px-2 py-1 rounded-xl z-10 shadow-lg shadow-primary-600/30 dark:shadow-primary-500/30">
          📋 Imported
        </span>
      )}
    </div>
  );
};

export default EditableProductTags;

