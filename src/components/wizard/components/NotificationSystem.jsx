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
      success: 'notification-success',
      error: 'notification-error',
      warning: 'notification-warning',
      info: 'notification-info',
      loading: 'notification-loading'
    };
    return classes[type] || classes.info;
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={`notification-container position-${position}`}>
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification ${getNotificationClass(notification.type)} ${
            notification.dismissing ? 'dismissing' : 'entering'
          }`}
        >
          <div className="notification-content">
            <span className="notification-icon">
              {getNotificationIcon(notification.type)}
            </span>
            <div className="notification-body">
              {notification.title && (
                <div className="notification-title">{notification.title}</div>
              )}
              <div className="notification-message">{notification.message}</div>
              {notification.details && (
                <div className="notification-details">{notification.details}</div>
              )}
            </div>
          </div>
          
          {notification.type !== 'loading' && (
            <button
              className="notification-dismiss"
              onClick={() => handleDismiss(notification.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          )}
          
          {notification.progress !== undefined && (
            <div className="notification-progress">
              <div 
                className="progress-bar"
                style={{ width: `${notification.progress}%` }}
              />
            </div>
          )}
          
          {notification.actions && (
            <div className="notification-actions">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  className={`notification-action ${action.type || 'secondary'}`}
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


