import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import NotificationToast from '../components/NotificationToast';
import errorReportingService from '../services/ErrorReportingService';

const ErrorNotificationContext = createContext(null);

const MAX_STACKED_NOTIFICATIONS = 4;
const TOAST_STACK_SPACING_PX = 88;

function generateId() {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * App-wide provider for persistent, clickable error/warning banners.
 *
 * Errors and warnings shown via showError()/showWarning() are logged to the
 * local error log (see ErrorReportingService) and stay on screen until the
 * user dismisses them or clicks "View Details" to jump to Settings > Error Report.
 */
export function ErrorNotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const viewDetailsHandlerRef = useRef(null);

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pushNotification = useCallback((notification) => {
    const id = notification.id || generateId();
    setNotifications((prev) => [...prev, { ...notification, id }].slice(-MAX_STACKED_NOTIFICATIONS));
    return id;
  }, []);

  const showError = useCallback(async (message, options = {}) => {
    const { category = 'general', error = null, context = {}, action, onAction, autoDismiss, durationMs } = options;
    const errorId = await errorReportingService.reportError({
      category,
      userMessage: message,
      error,
      context,
      severity: 'error'
    });
    return pushNotification({ type: 'error', message, errorId, action, onAction, autoDismiss, durationMs });
  }, [pushNotification]);

  const showWarning = useCallback(async (message, options = {}) => {
    const { category = 'general', error = null, context = {}, action, onAction, autoDismiss, durationMs } = options;
    const errorId = await errorReportingService.reportError({
      category,
      userMessage: message,
      error,
      context,
      severity: 'warning'
    });
    return pushNotification({ type: 'warning', message, errorId, action, onAction, autoDismiss, durationMs });
  }, [pushNotification]);

  const showSuccess = useCallback((message, options = {}) => {
    return pushNotification({
      type: 'success',
      message,
      durationMs: options.durationMs ?? 4000,
      action: options.action,
      onAction: options.onAction
    });
  }, [pushNotification]);

  const showInfo = useCallback((message, options = {}) => {
    return pushNotification({
      type: 'info',
      message,
      durationMs: options.durationMs ?? 4000,
      action: options.action,
      onAction: options.onAction
    });
  }, [pushNotification]);

  const setViewDetailsHandler = useCallback((handlerFn) => {
    viewDetailsHandlerRef.current = handlerFn || null;
  }, []);

  const handleViewDetails = useCallback((errorId) => {
    if (viewDetailsHandlerRef.current) {
      viewDetailsHandlerRef.current(errorId);
    }
  }, []);

  const value = useMemo(() => ({
    showError,
    showWarning,
    showSuccess,
    showInfo,
    dismiss,
    setViewDetailsHandler
  }), [showError, showWarning, showSuccess, showInfo, dismiss, setViewDetailsHandler]);

  return (
    <ErrorNotificationContext.Provider value={value}>
      {children}
      {notifications.map((notification, index) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          duration={notification.durationMs || 5000}
          onClose={() => dismiss(notification.id)}
          onViewDetails={notification.errorId ? handleViewDetails : undefined}
          style={{ bottom: 30 + index * TOAST_STACK_SPACING_PX }}
        />
      ))}
    </ErrorNotificationContext.Provider>
  );
}

const noopContext = {
  showError: async (message) => { console.error('[ErrorNotification]', message); return null; },
  showWarning: async (message) => { console.warn('[ErrorNotification]', message); return null; },
  showSuccess: () => null,
  showInfo: () => null,
  dismiss: () => {},
  setViewDetailsHandler: () => {}
};

/**
 * Hook for showing persistent, clickable error/warning banners from anywhere in the app.
 * Falls back to console logging if used outside the provider (e.g. in isolated tests).
 */
export function useErrorNotification() {
  const context = useContext(ErrorNotificationContext);
  return context || noopContext;
}

export default ErrorNotificationContext;
