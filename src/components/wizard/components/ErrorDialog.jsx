import React from 'react';

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

  const getBorderColor = () => {
    switch (type) {
      case 'error':
        return 'border-error-500 dark:border-error-600';
      case 'warning':
        return 'border-warning-500 dark:border-warning-600';
      case 'info':
        return 'border-info-500 dark:border-info-600';
      default:
        return 'border-error-500 dark:border-error-600';
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay backdrop-blur-sm" 
      onClick={handleBackdropClick}
    >
      <div className={`
        modal-content border-2 ${getBorderColor()}
        min-w-[400px] max-w-[600px] w-[90%] max-h-[80vh] overflow-hidden
      `}>
        {/* Header */}
        <div className="flex items-center px-6 py-5 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 relative">
          <div className="text-3xl mr-3 animate-pulse-soft">
            {getIcon()}
          </div>
          <h3 className="flex-1 m-0 text-gray-700 dark:text-gray-200 text-2xl font-semibold">
            {title}
          </h3>
          <button 
            className="bg-transparent border-none text-2xl font-bold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" 
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="text-gray-700 dark:text-gray-300 text-base leading-relaxed mb-4">
            {message}
          </div>
          
          {details && (
            <details className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-3 mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors select-none">
                Technical Details
              </summary>
              <div className="mt-3 bg-gray-900 dark:bg-black rounded p-3 overflow-x-auto">
                <pre className="text-xs text-green-400 font-mono m-0 whitespace-pre-wrap break-words">
                  {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
                </pre>
              </div>
            </details>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-end gap-3">
            {showRetry && onRetry && (
              <button 
                className="btn-secondary" 
                onClick={onRetry}
              >
                🔄 Try Again
              </button>
            )}
            <button 
              className="btn-primary" 
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
