/**
 * AgileConnectionPanel - Edge CDP connection status and monitoring controls
 */

import React, { useState } from 'react';

/**
 * Map raw error strings to user-friendly messages.
 */
function friendlyError(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('econnrefused') || lower.includes('connection refused')) {
    return 'Edge is not in debug mode';
  }
  if (lower.includes('timeout')) {
    return 'Edge did not respond (timeout)';
  }
  if (lower.includes('invalid cdp')) {
    return 'Edge responded but the debug protocol is not available';
  }
  // Truncate very long messages
  return raw.length > 80 ? raw.slice(0, 77) + '…' : raw;
}

export default function AgileConnectionPanel({
  edgeConnected,
  edgeError,
  isMonitoring,
  lastScrapedAt,
  onCheckConnection,
  onLaunchEdge,
  onStartMonitoring,
  onStopMonitoring,
  onScrapeNow,
  checking,
  scraping
}) {
  const [launching, setLaunching] = useState(false);
  const [launchMessage, setLaunchMessage] = useState(null);

  const handleLaunchEdge = async () => {
    setLaunching(true);
    setLaunchMessage(null);
    try {
      const result = await onLaunchEdge();
      if (result?.success) {
        setLaunchMessage({ type: 'success', text: result.message || 'Edge connected!' });
        setTimeout(onCheckConnection, 1500);
      } else {
        setLaunchMessage({ type: 'error', text: result?.error || 'Failed to launch Edge.' });
      }
    } catch (e) {
      setLaunchMessage({ type: 'error', text: e.message || 'Unexpected error.' });
    } finally {
      setLaunching(false);
    }
  };

  const displayError = friendlyError(edgeError);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mr-2">Edge Connection</h3>
        <span
          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ${
            edgeConnected
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${edgeConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
          {edgeConnected ? 'Connected' : displayError || 'Not connected'}
        </span>
        {lastScrapedAt && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last scrape: {new Date(lastScrapedAt).toLocaleString()}
          </span>
        )}
      </div>
      {edgeConnected && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          If Edge shows a message about turning off remote debugging for Internet Explorer mode, you can ignore it. The app uses modern Edge for scraping.
        </p>
      )}

      {/* Disconnected state */}
      {!edgeConnected && (
        <div className="rounded-md bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            To monitor the Agile workqueue, Edge needs to be running with its remote-debugging port enabled.
            Click the button below to <strong>restart Edge in debug mode</strong>. Your open tabs will be restored automatically.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLaunchEdge}
              disabled={launching || checking}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white text-sm font-medium py-2 px-4 rounded-lg shadow transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {launching ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Restarting Edge…
                </>
              ) : (
                'Launch Edge with debug mode'
              )}
            </button>
            <button
              type="button"
              onClick={onCheckConnection}
              disabled={checking || launching}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Check connection'}
            </button>
          </div>
          {launchMessage && (
            <p className={`text-sm font-medium ${launchMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {launchMessage.text}
            </p>
          )}
          <details className="text-xs text-gray-500 dark:text-gray-400">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Manual setup / troubleshooting
            </summary>
            <ol className="list-decimal ml-5 mt-2 space-y-1">
              <li>Close <strong>all</strong> Microsoft Edge windows (check the system tray too).</li>
              <li>Open a <strong>Run</strong> dialog (Win+R) and paste:
                <code className="block bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded mt-1 select-all">
                  msedge --remote-debugging-port=9222 --restore-last-session
                </code>
              </li>
              <li>Once Edge opens, come back here and click <strong>Check connection</strong>.</li>
            </ol>
          </details>
        </div>
      )}

      {/* Connected state */}
      {edgeConnected && (
        <div className="flex flex-wrap items-center gap-3">
          {isMonitoring ? (
            <button
              type="button"
              onClick={onStopMonitoring}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Stop monitoring
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartMonitoring}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow transition-all"
            >
              Start monitoring
            </button>
          )}
          <button
            type="button"
            onClick={onScrapeNow}
            disabled={scraping}
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-sm font-medium py-2 px-4 rounded-lg transition-all disabled:opacity-50"
          >
            {scraping ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Scraping…
              </>
            ) : (
              'Scrape now'
            )}
          </button>
          <button
            type="button"
            onClick={onCheckConnection}
            disabled={checking}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
          >
            {checking ? 'Checking…' : 'Refresh connection'}
          </button>
        </div>
      )}
    </div>
  );
}
