/**
 * ErrorReportingService - Renderer-side facade for the local error log.
 *
 * Persists structured error entries to disk (via main process IPC) so users
 * can review and export a diagnostic report to share with software engineering,
 * instead of errors only flashing in a toast for a few seconds.
 */

let sessionBreadcrumbs = [];
const MAX_BREADCRUMBS = 25;

function isElectronAvailable() {
  return typeof window !== 'undefined' && !!window.electronAPI?.errorLogCapture;
}

function serializeError(error) {
  if (!error) return { technicalMessage: null, stack: null };
  if (typeof error === 'string') return { technicalMessage: error, stack: null };
  return {
    technicalMessage: error.message || String(error),
    stack: error.stack || null
  };
}

/**
 * Report an error to the local diagnostic log.
 * Returns the errorId (string) on success, or null if logging failed/unavailable.
 */
async function reportError({ category = 'general', userMessage, error = null, context = {}, severity = 'error' } = {}) {
  const { technicalMessage, stack } = serializeError(error);

  const entry = {
    severity: severity === 'warning' ? 'warning' : 'error',
    category,
    userMessage: userMessage || technicalMessage || 'An unexpected error occurred.',
    technicalMessage,
    stack,
    context: {
      ...context,
      breadcrumbs: [...sessionBreadcrumbs]
    }
  };

  if (!isElectronAvailable()) {
    console.error(`[ErrorReportingService] ${category}: ${entry.userMessage}`, entry);
    return null;
  }

  try {
    const result = await window.electronAPI.errorLogCapture(entry);
    if (result?.success && result.entry?.id) {
      return result.entry.id;
    }
    return null;
  } catch (ipcError) {
    console.error('[ErrorReportingService] Failed to report error via IPC:', ipcError);
    return null;
  }
}

/** Add a lightweight breadcrumb (kept in-memory only, attached to the next reported error). */
function addBreadcrumb(message, data = {}) {
  sessionBreadcrumbs.push({
    message,
    data,
    timestamp: new Date().toISOString()
  });
  if (sessionBreadcrumbs.length > MAX_BREADCRUMBS) {
    sessionBreadcrumbs.shift();
  }
}

async function listErrors(options = {}) {
  if (!isElectronAvailable()) return [];
  try {
    const result = await window.electronAPI.errorLogList(options);
    return result?.success ? result.errors : [];
  } catch (error) {
    console.error('[ErrorReportingService] Failed to list errors:', error);
    return [];
  }
}

async function getError(id) {
  if (!isElectronAvailable() || !id) return null;
  try {
    const result = await window.electronAPI.errorLogGet(id);
    return result?.success ? result.entry : null;
  } catch (error) {
    console.error('[ErrorReportingService] Failed to get error:', error);
    return null;
  }
}

async function clearErrors() {
  if (!isElectronAvailable()) return { success: false, error: 'Not available' };
  try {
    return await window.electronAPI.errorLogClear();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getEnvironment() {
  if (!isElectronAvailable() || !window.electronAPI?.errorLogEnvironment) return null;
  try {
    const result = await window.electronAPI.errorLogEnvironment();
    return result?.success ? result.environment : null;
  } catch (error) {
    console.error('[ErrorReportingService] Failed to get environment:', error);
    return null;
  }
}

async function exportErrors() {
  if (!isElectronAvailable() || !window.electronAPI?.errorLogExport) {
    return { success: false, error: 'Not available' };
  }
  try {
    return await window.electronAPI.errorLogExport();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

const errorReportingService = {
  reportError,
  addBreadcrumb,
  listErrors,
  getError,
  clearErrors,
  getEnvironment,
  exportErrors
};

export default errorReportingService;
