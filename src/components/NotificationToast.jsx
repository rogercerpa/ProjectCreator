/**
 * NotificationToast - Toast notification component
 */

import React, { useEffect, useState } from 'react';

const NotificationToast = ({ notification, onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto-close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  const handleAction = () => {
    if (notification.onAction) {
      notification.onAction();
    }
    handleClose();
  };

  /**
   * Get notification icon
   */
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'assignment':
        return '📋';
      default:
        return 'ℹ️';
    }
  };

  /**
   * Get border color based on type
   */
  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-l-success-600 dark:border-l-success-500';
      case 'error':
        return 'border-l-error-600 dark:border-l-error-500';
      case 'warning':
        return 'border-l-warning-600 dark:border-l-warning-500';
      case 'assignment':
      case 'info':
        return 'border-l-info-600 dark:border-l-info-500';
      default:
        return 'border-l-gray-600 dark:border-l-gray-500';
    }
  };

  return (
    <div 
      className={`
        fixed bottom-[30px] right-[30px] min-w-[320px] max-w-[500px]
        bg-white dark:bg-gray-800 rounded-lg p-4 flex items-start gap-3 z-[10000]
        shadow-lg border-l-4 ${getBorderColor()}
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+50px)] opacity-0'}
        ${isExiting ? 'translate-x-[calc(100%+50px)] opacity-0' : ''}
        md:bottom-5 md:right-5 md:left-5 md:min-w-0 md:max-w-none
        sm:bottom-2.5 sm:right-2.5 sm:left-2.5 sm:p-3
      `}
    >
      <div className="text-2xl leading-none flex-shrink-0 sm:text-xl">
        {getIcon()}
      </div>
      
      <div className="flex-1 flex flex-col gap-2">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed sm:text-xs">
          {notification.message}
        </div>
        
        {notification.action && (
          <button 
            className="self-start px-3 py-1.5 bg-info-600 hover:bg-info-700 dark:bg-info-700 dark:hover:bg-info-600 
                       text-white text-xs font-semibold rounded transition-all hover:-translate-y-0.5 active:translate-y-0
                       sm:text-[11px] sm:px-2.5 sm:py-1"
            onClick={handleAction}
          >
            {notification.action}
          </button>
        )}
      </div>

      <button 
        className="w-6 h-6 border-none bg-transparent text-gray-600 dark:text-gray-400 text-2xl leading-none 
                   cursor-pointer p-0 flex-shrink-0 transition-all rounded hover:bg-gray-100 dark:hover:bg-gray-700
                   hover:text-gray-900 dark:hover:text-gray-100"
        onClick={handleClose}
      >
        ×
      </button>
    </div>
  );
};

export default NotificationToast;

