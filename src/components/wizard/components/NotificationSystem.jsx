import React, { useState, useEffect } from 'react';

/**
 * NotificationSystem - Enhanced notifications with different types and animations
 * Supports success, error, warning, info notifications with auto-dismiss
 */
const NotificationSystem = ({ 
  notifications, 
  onDismiss, 
  position = 'top-right',
  autoHideDuration = 5000 
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState([]);

  useEffect(() => {
    setVisibleNotifications(notifications);
  }, [notifications]);

  const handleDismiss = (id) => {
    // Animate out
    setVisibleNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, dismissing: true } : notif
      )
    );
    
    // Remove after animation
    setTimeout(() => {
      onDismiss(id);
    }, 300);
  };

  const getNotificationIcon = (type) => {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      loading: '⏳'
    };
    return icons[type] || icons.info;
  };

  const getNotificationClass = (type) => {
    const classes = {
      success: 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-700 text-success-800 dark:text-success-200',
      error: 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-700 text-error-800 dark:text-error-200',
      warning: 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-700 text-warning-800 dark:text-warning-200',
      info: 'bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-700 text-info-800 dark:text-info-200',
      loading: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700 text-primary-800 dark:text-primary-200'
    };
    return classes[type] || classes.info;
  };
  
  const getPositionClass = (position) => {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
    };
    return positions[position] || positions['top-right'];
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={`fixed ${getPositionClass(position)} z-50 flex flex-col gap-2 w-96 max-w-full`}>
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 border-2 rounded-lg shadow-lg transition-all duration-300 ${
            getNotificationClass(notification.type)
          } ${
            notification.dismissing 
              ? 'opacity-0 translate-x-8' 
              : 'opacity-100 translate-x-0 animate-slideIn'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </span>
            <div className="flex-1 min-w-0">
              {notification.title && (
                <div className="font-semibold text-sm mb-1">{notification.title}</div>
              )}
              <div className="text-sm">{notification.message}</div>
              {notification.details && (
                <div className="text-xs opacity-80 mt-1">{notification.details}</div>
              )}
            </div>
            
            {notification.type !== 'loading' && (
              <button
                className="flex-shrink-0 ml-2 text-xl font-bold opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => handleDismiss(notification.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            )}
          </div>
          
          {notification.progress !== undefined && (
            <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-current transition-all duration-300"
                style={{ width: `${notification.progress}%` }}
              />
            </div>
          )}
          
          {notification.actions && (
            <div className="flex gap-2 mt-3">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                    action.type === 'primary' 
                      ? 'bg-current text-white hover:opacity-90' 
                      : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => {
                    action.onClick();
                    if (action.dismissAfter) {
                      handleDismiss(notification.id);
                    }
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Enhanced Progress Indicator Component
 * Shows step-by-step progress with animations and completion states
 */
const ProgressIndicator = ({ 
  steps, 
  currentStep, 
  completedSteps = [], 
  size = 'medium',
  showLabels = true,
  animated = true 
}) => {
  const getStepClass = (stepIndex) => {
    const step = stepIndex + 1;
    let className = 'progress-step';
    
    if (completedSteps.includes(step)) {
      className += ' completed';
    } else if (step === currentStep) {
      className += ' current';
    } else if (step < currentStep) {
      className += ' passed';
    } else {
      className += ' pending';
    }
    
    if (animated) {
      className += ' animated';
    }
    
    return className;
  };

  const getProgressPercentage = () => {
    return ((currentStep - 1) / (steps.length - 1)) * 100;
  };

  return (
    <div className={`progress-indicator size-${size}`}>
      {/* Progress Line */}
      <div className="progress-line">
        <div 
          className="progress-fill"
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
      
      {/* Steps */}
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div key={index} className={getStepClass(index)}>
            <div className="step-circle">
              {completedSteps.includes(index + 1) ? (
                <span className="step-check">✓</span>
              ) : (
                <span className="step-number">{index + 1}</span>
              )}
            </div>
            
            {showLabels && (
              <div className="step-label">
                <div className="step-title">{step.title}</div>
                {step.subtitle && (
                  <div className="step-subtitle">{step.subtitle}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Loading Overlay Component
 * Shows loading states with optional progress and cancellation
 */
const LoadingOverlay = ({ 
  isVisible, 
  message = 'Loading...', 
  progress = null,
  canCancel = false,
  onCancel = null,
  overlay = true 
}) => {
  if (!isVisible) return null;

  return (
    <div className={`loading-overlay ${overlay ? 'with-overlay' : 'inline'}`}>
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        
        <div className="loading-message">{message}</div>
        
        {progress !== null && (
          <div className="loading-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">{progress}%</div>
          </div>
        )}
        
        {canCancel && onCancel && (
          <button className="loading-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Success Animation Component
 * Shows animated success feedback
 */
const SuccessAnimation = ({ isVisible, message, onComplete }) => {
  useEffect(() => {
    if (isVisible && onComplete) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="success-animation">
      <div className="success-content">
        <div className="success-icon">
          <div className="checkmark">
            <div className="checkmark-circle"></div>
            <div className="checkmark-stem"></div>
            <div className="checkmark-kick"></div>
          </div>
        </div>
        <div className="success-message">{message}</div>
      </div>
    </div>
  );
};

export { NotificationSystem, ProgressIndicator, LoadingOverlay, SuccessAnimation };


