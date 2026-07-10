import React, { useEffect, useMemo, useRef, useState } from 'react';
import errorReportingService from '../../services/ErrorReportingService';

const SEVERITY_STYLES = {
  error: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300 border-error-300 dark:border-error-700',
  warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 border-warning-300 dark:border-warning-700'
};

const CATEGORY_LABELS = {
  wizard: 'Project Wizard',
  'das-upload': 'DAS Upload',
  'das-download': 'Download Folder',
  ipc: 'System / IPC',
  ui: 'Interface',
  crash: 'Application Crash',
  general: 'General'
};

function formatCategory(category) {
  return CATEGORY_LABELS[category] || category || 'General';
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function ErrorReportTab({ selectedErrorId = null }) {
  const [errors, setErrors] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(selectedErrorId || null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const rowRefs = useRef({});

  const loadErrors = async () => {
    setIsLoading(true);
    try {
      const [errorList, env] = await Promise.all([
        errorReportingService.listErrors({ limit: 200 }),
        errorReportingService.getEnvironment()
      ]);
      setErrors(errorList || []);
      setEnvironment(env);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedErrorId) {
      setExpandedId(selectedErrorId);
      const node = rowRefs.current[selectedErrorId];
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedErrorId, errors]);

  const filteredErrors = useMemo(() => {
    return errors.filter((entry) => {
      if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
      if (filterSeverity !== 'all' && entry.severity !== filterSeverity) return false;
      return true;
    });
  }, [errors, filterCategory, filterSeverity]);

  const availableCategories = useMemo(() => {
    const set = new Set(errors.map((e) => e.category).filter(Boolean));
    return Array.from(set);
  }, [errors]);

  const showStatus = (message, type = 'info') => {
    setStatusMessage({ message, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleDownloadReport = async () => {
    setIsExporting(true);
    try {
      const result = await errorReportingService.exportErrors();
      if (result?.success) {
        showStatus(`Error report saved to ${result.filePath}`, 'success');
      } else if (result?.cancelled) {
        // User cancelled the save dialog - no message needed
      } else {
        showStatus(`Failed to save error report: ${result?.error || 'Unknown error'}`, 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyError = async (entry) => {
    const text = JSON.stringify(entry, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      showStatus('Error details copied to clipboard.', 'success');
    } catch (error) {
      showStatus('Failed to copy to clipboard.', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all recorded errors? This cannot be undone.')) {
      return;
    }
    const result = await errorReportingService.clearErrors();
    if (result?.success) {
      setErrors([]);
      showStatus('All errors cleared.', 'success');
    } else {
      showStatus(`Failed to clear errors: ${result?.error || 'Unknown error'}`, 'error');
    }
  };

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header / description */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Error Report</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Errors encountered in the app are recorded here so you can review what happened and share
          details with the software team. Nothing is sent automatically — you choose when to download a report.
        </p>
      </div>

      {/* Environment summary */}
      {environment && (
        <div className="p-4 rounded-lg border border-info-200 dark:border-info-800 bg-info-50 dark:bg-info-900/20">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-info-700 dark:text-info-300 mb-2">
            Included in every download
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-700 dark:text-gray-300">
            <div><span className="font-medium">App:</span> {environment.appName} v{environment.appVersion}</div>
            <div><span className="font-medium">OS:</span> {environment.platform} {environment.osRelease}</div>
            <div><span className="font-medium">User:</span> {environment.username}</div>
            <div><span className="font-medium">Session:</span> {environment.sessionId?.slice(0, 8)}…</div>
          </div>
        </div>
      )}

      {/* Status message */}
      {statusMessage && (
        <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
          statusMessage.type === 'success' ? 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300' :
          statusMessage.type === 'error' ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300' :
          'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300'
        }`}>
          {statusMessage.message}
        </div>
      )}

      {/* Actions toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleDownloadReport}
          disabled={isExporting || errors.length === 0}
          className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
        >
          {isExporting ? 'Saving…' : '⬇ Download Error Report'}
        </button>
        <button
          type="button"
          onClick={loadErrors}
          className="px-3 py-2 text-sm font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-all"
        >
          ↻ Refresh
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={errors.length === 0}
          className="px-3 py-2 text-sm font-medium bg-white dark:bg-gray-800 hover:bg-error-50 dark:hover:bg-error-900/20 disabled:opacity-50 disabled:cursor-not-allowed border border-error-300 dark:border-error-700 text-error-600 dark:text-error-400 rounded-lg transition-all ml-auto"
        >
          Clear All
        </button>
      </div>

      {/* Filters */}
      {errors.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Severity:</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md"
            >
              <option value="all">All</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md"
            >
              <option value="all">All</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>{formatCategory(cat)}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filteredErrors.length} of {errors.length} shown
          </span>
        </div>
      )}

      {/* Error list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">Loading errors…</div>
      ) : filteredErrors.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm">No errors recorded{errors.length > 0 ? ' matching filters' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredErrors.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                ref={(node) => { rowRefs.current[entry.id] = node; }}
                className={`border rounded-lg overflow-hidden transition-all ${
                  entry.id === selectedErrorId ? 'ring-2 ring-primary-400' : ''
                } border-gray-200 dark:border-gray-700`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(entry.id)}
                  className="w-full flex items-start gap-3 p-3 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${SEVERITY_STYLES[entry.severity] || SEVERITY_STYLES.error}`}>
                    {entry.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {formatCategory(entry.category)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                      {entry.userMessage}
                    </p>
                  </div>
                  <span className="shrink-0 text-gray-400 dark:text-gray-500 text-xs mt-1">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-3">
                    {entry.technicalMessage && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Technical Message</h4>
                        <p className="text-xs font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 break-words">
                          {entry.technicalMessage}
                        </p>
                      </div>
                    )}

                    {entry.context && Object.keys(entry.context).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Context</h4>
                        <pre className="text-[11px] font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.context, null, 2)}
                        </pre>
                      </div>
                    )}

                    {entry.stack && (
                      <details>
                        <summary className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer">
                          Stack Trace
                        </summary>
                        <pre className="text-[11px] font-mono text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 mt-1 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-pre-wrap break-words">
                          {entry.stack}
                        </pre>
                      </details>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyError(entry)}
                        className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-all"
                      >
                        📋 Copy Details
                      </button>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        ID: {entry.id}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ErrorReportTab;
