/**
 * NotificationToast - Toast notification component
 *
 * Error and warning notifications stay on screen until the user dismisses them
 * (or clicks "View Details") instead of auto-disappearing after a few seconds,
 * since those are the messages users most need time to read.
 */

import React, { useEffect, useState } from 'react';

const PERSISTENT_TYPES = ['error', 'warning'];

const NotificationToast = ({ notification, onClose, onViewDetails, duration = 5000, style }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Errors/warnings are persistent by default so users have time to read them;
  // pass notification.autoDismiss === true to opt a specific error/warning back into auto-dismiss.
  const isPersistent = PERSISTENT_TYPES.includes(notification.type) && notification.autoDismiss !== true;
  const effectiveDuration = notification.durationMs ?? duration;

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);

    if (isPersistent) {
      return undefined;
    }

    // Auto-close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, effectiveDuration);

    return () => clearTimeout(timer);
    // Re-run whenever a genuinely new notification comes through, not just when duration changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id, notification.message, effectiveDuration, isPersistent]);

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

  const handleViewDetails = (e) => {
    e.stopPropagation();
    if (onViewDetails && notification.errorId) {
      onViewDetails(notification.errorId);
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

  const canViewDetails = Boolean(onViewDetails && notification.errorId);

  return (
    <div
      className={`
        fixed bottom-[30px] right-[30px] min-w-[320px] max-w-[500px]
        bg-white dark:bg-gray-800 rounded-lg p-4 flex items-start gap-3 z-[10000]
        shadow-lg border-l-4 ${getBorderColor()}
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+50px)] opacity-0'}
        ${isExiting ? 'translate-x-[calc(100%+50px)] opacity-0' : ''}
        ${canViewDetails ? 'cursor-pointer hover:shadow-xl' : ''}
        md:bottom-5 md:right-5 md:left-5 md:min-w-0 md:max-w-none
        sm:bottom-2.5 sm:right-2.5 sm:left-2.5 sm:p-3
      `}
      style={style}
      onClick={canViewDetails ? handleViewDetails : undefined}
      role={canViewDetails ? 'button' : undefined}
      tabIndex={canViewDetails ? 0 : undefined}
    >
      <div className="text-2xl leading-none flex-shrink-0 sm:text-xl">
        {getIcon()}
      </div>
      
      <div className="flex-1 flex flex-col gap-2">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed sm:text-xs">
          {notification.message}
        </div>

        <div className="flex items-center gap-2">
          {notification.action && (
            <button
              className="self-start px-3 py-1.5 bg-info-600 hover:bg-info-700 dark:bg-info-700 dark:hover:bg-info-600 
                         text-white text-xs font-semibold rounded transition-all hover:-translate-y-0.5 active:translate-y-0
                         sm:text-[11px] sm:px-2.5 sm:py-1"
              onClick={(e) => { e.stopPropagation(); handleAction(); }}
            >
              {notification.action}
            </button>
          )}

          {canViewDetails && (
            <button
              className="self-start px-3 py-1.5 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500
                         text-white text-xs font-semibold rounded transition-all hover:-translate-y-0.5 active:translate-y-0
                         sm:text-[11px] sm:px-2.5 sm:py-1"
              onClick={handleViewDetails}
            >
              View Details →
            </button>
          )}
        </div>
      </div>

      <button
        className="w-6 h-6 border-none bg-transparent text-gray-600 dark:text-gray-400 text-2xl leading-none 
                   cursor-pointer p-0 flex-shrink-0 transition-all rounded hover:bg-gray-100 dark:hover:bg-gray-700
                   hover:text-gray-900 dark:hover:text-gray-100"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
      >
        ×
      </button>
    </div>
  );
};

export default NotificationToast;

