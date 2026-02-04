import React, { useState, useRef, useEffect } from 'react';

/**
 * CollapsibleSection - A reusable collapsible section component
 * 
 * @param {string} title - Section title
 * @param {string|React.ReactNode} icon - Icon to display (emoji or component)
 * @param {React.ReactNode} children - Section content
 * @param {boolean} defaultExpanded - Initial expanded state (default: true)
 * @param {boolean} isExpanded - Controlled expanded state
 * @param {function} onToggle - Callback when toggled (receives new expanded state)
 * @param {React.ReactNode} headerActions - Action buttons to render in header (uses stopPropagation)
 * @param {React.ReactNode} headerExtra - Extra elements like status badges
 * @param {string} className - Additional CSS classes for the container
 */
function CollapsibleSection({ 
  title, 
  icon, 
  children, 
  defaultExpanded = true,
  isExpanded: controlledExpanded,
  onToggle,
  headerActions,
  headerExtra,
  className = ''
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

  // Prevent clicks on action buttons from toggling the section
  const handleActionsClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-md overflow-hidden transition-all duration-200 ${className}`}>
      {/* Header */}
      <div
        onClick={handleToggle}
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-xl">{icon}</span>}
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          {headerExtra && (
            <div onClick={handleActionsClick}>
              {headerExtra}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {headerActions && (
            <div className="flex gap-2" onClick={handleActionsClick}>
              {headerActions}
            </div>
          )}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-600">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:inline">
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
        </div>
      </div>

      {/* Content with animation */}
      <div
        className="transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          maxHeight: isExpanded ? `${contentHeight}px` : '0px',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div ref={contentRef} className="px-6 pb-6 border-t-2 border-gray-100 dark:border-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}

export default CollapsibleSection;
