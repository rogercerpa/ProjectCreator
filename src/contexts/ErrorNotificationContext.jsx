import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import NotificationToast from '../components/NotificationToast';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import errorReportingService from '../services/ErrorReportingService';
import { registerFeedbackHandlers } from '../utils/feedback';

const ErrorNotificationContext = createContext(null);

const MAX_STACKED_NOTIFICATIONS = 4;
const QUICK_WARNING_MS = 7000;

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

  // window.confirm replacement: requests queue up and resolve one at a time.
  const [confirmQueue, setConfirmQueue] = useState([]);
  const requestConfirm = useCallback((message, options = {}) => new Promise((resolve) => {
    setConfirmQueue((prev) => [...prev, { ...options, message, resolve, id: generateId() }]);
  }), []);
  const resolveConfirm = useCallback((request, answer) => {
    request.resolve(answer);
    setConfirmQueue((prev) => prev.filter((pending) => pending.id !== request.id));
  }, []);

  useEffect(() => registerFeedbackHandlers({
    notify: (message, type, options = {}) => {
      if (type === 'error') return showError(message, { category: options.category || 'ui', ...options });
      if (type === 'warning') {
        return pushNotification({ type: 'warning', message, autoDismiss: true, durationMs: QUICK_WARNING_MS, ...options });
      }
      return type === 'success' ? showSuccess(message, options) : showInfo(message, options);
    },
    confirm: requestConfirm
  }), [showError, showSuccess, showInfo, pushNotification, requestConfirm]);

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
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[10000] flex w-[min(28rem,calc(100vw-2.5rem))] flex-col-reverse gap-3"
      >
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            inline
            notification={notification}
            duration={notification.durationMs || 5000}
            onClose={() => dismiss(notification.id)}
            onViewDetails={notification.errorId ? handleViewDetails : undefined}
          />
        ))}
      </div>
      {confirmQueue[0] && (
        <ConfirmDialog
          key={confirmQueue[0].id}
          request={confirmQueue[0]}
          onResolve={(answer) => resolveConfirm(confirmQueue[0], answer)}
        />
      )}
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
