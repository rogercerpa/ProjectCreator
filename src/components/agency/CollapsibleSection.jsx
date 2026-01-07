import React, { useState, useRef, useEffect } from 'react';

function CollapsibleSection({ 
  title, 
  icon, 
  children, 
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onToggle
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children, isExpanded]);

  // Update height when content changes
  useEffect(() => {
    const updateHeight = () => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight);
      }
    };

    // Use ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined' && contentRef.current) {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isExpanded);
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all duration-200">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-xl">{icon}</span>}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          <svg
            className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content with animation */}
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div ref={contentRef} className="px-6 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export default CollapsibleSection;
