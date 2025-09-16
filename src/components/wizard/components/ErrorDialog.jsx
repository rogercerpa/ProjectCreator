import React from 'react';
import './ErrorDialog.css';

/**
 * ErrorDialog
 * A modal dialog for displaying error messages with better visibility
 */
const ErrorDialog = ({
  isOpen,
  title = 'Error',
  message,
  details = null,
  onClose,
  onRetry = null,
  showRetry = false,
  type = 'error' // 'error', 'warning', 'info'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="error-dialog-overlay" onClick={handleBackdropClick}>
      <div className={`error-dialog ${type}`}>
        <div className="error-dialog-header">
          <div className="error-icon">{getIcon()}</div>
          <h3 className="error-title">{title}</h3>
          <button 
            className="error-close-btn" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        
        <div className="error-dialog-content">
          <div className="error-message">
            {message}
          </div>
          
          {details && (
            <details className="error-details">
              <summary>Technical Details</summary>
              <div className="error-details-content">
                {typeof details === 'string' ? (
                  <pre>{details}</pre>
                ) : (
                  <pre>{JSON.stringify(details, null, 2)}</pre>
                )}
              </div>
            </details>
          )}
        </div>
        
        <div className="error-dialog-footer">
          <div className="error-dialog-actions">
            {showRetry && onRetry && (
              <button 
                className="btn btn-secondary" 
                onClick={onRetry}
              >
                🔄 Try Again
              </button>
            )}
            <button 
              className="btn btn-primary" 
              onClick={onClose}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook for managing error dialog state
 */
export const useErrorDialog = () => {
  const [errorState, setErrorState] = React.useState({
    isOpen: false,
    title: '',
    message: '',
    details: null,
    type: 'error',
    showRetry: false,
    onRetry: null
  });

  const showError = React.useCallback((options) => {
    const {
      title = 'Error',
      message,
      details = null,
      type = 'error',
      showRetry = false,
      onRetry = null
    } = options;

    setErrorState({
      isOpen: true,
      title,
      message,
      details,
      type,
      showRetry,
      onRetry
    });
  }, []);

  const showWarning = React.useCallback((title, message, details = null) => {
    showError({
      title: title || 'Warning',
      message,
      details,
      type: 'warning'
    });
  }, [showError]);

  const showInfo = React.useCallback((title, message, details = null) => {
    showError({
      title: title || 'Information',
      message,
      details,
      type: 'info'
    });
  }, [showError]);

  const close = React.useCallback(() => {
    setErrorState(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  const retry = React.useCallback(() => {
    if (errorState.onRetry) {
      errorState.onRetry();
    }
    close();
  }, [errorState.onRetry, close]);

  return {
    errorState,
    showError,
    showWarning,
    showInfo,
    close,
    retry
  };
};

export default ErrorDialog;
