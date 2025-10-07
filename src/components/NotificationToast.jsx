/**
 * NotificationToast - Toast notification component
 */

import React, { useEffect, useState } from 'react';
import './NotificationToast.css';

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
   * Get notification class
   */
  const getClassName = () => {
    const classes = ['notification-toast', notification.type];
    if (isVisible) classes.push('visible');
    if (isExiting) classes.push('exiting');
    return classes.join(' ');
  };

  return (
    <div className={getClassName()}>
      <div className="toast-icon">{getIcon()}</div>
      
      <div className="toast-content">
        <div className="toast-message">{notification.message}</div>
        
        {notification.action && (
          <button className="toast-action" onClick={handleAction}>
            {notification.action}
          </button>
        )}
      </div>

      <button className="toast-close" onClick={handleClose}>
        ×
      </button>
    </div>
  );
};

export default NotificationToast;

