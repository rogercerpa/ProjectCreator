/**
 * AgileTab - Settings for Agile workqueue monitoring (Edge CDP, polling, notifications)
 */

import React from 'react';

export default function AgileTab({ settings, setSettings }) {
  const agile = settings.agileSettings || {};
  const update = (path, value) => {
    setSettings((prev) => ({
      ...prev,
      agileSettings: {
        ...prev.agileSettings,
        [path]: value
      }
    }));
  };
  const updateNested = (parent, key, value) => {
    setSettings((prev) => ({
      ...prev,
      agileSettings: {
        ...prev.agileSettings,
        [parent]: {
          ...(prev.agileSettings?.[parent] || {}),
          [key]: value
        }
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Agile Workqueue Monitor</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure how Project Creator connects to Microsoft Edge and polls the Agile workqueue.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">URLs</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Workqueue URL</label>
          <input
            type="text"
            value={agile.workqueueUrl || ''}
            onChange={(e) => update('workqueueUrl', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="https://agile.acuitybrandslighting.net/applications/workqueue2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RFA detail URL pattern</label>
          <input
            type="text"
            value={agile.rfaDetailUrlPattern || ''}
            onChange={(e) => update('rfaDetailUrlPattern', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            placeholder="http://rfa.acuitybrandslighting.net/#/requestnav/{rfaNumber}"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use {'{rfaNumber}'} for the RFA number.</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Connection</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Edge remote debugging port</label>
          <input
            type="number"
            min="1024"
            max="65535"
            value={agile.edgeDebugPort ?? 9222}
            onChange={(e) => update('edgeDebugPort', parseInt(e.target.value, 10) || 9222)}
            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Polling interval (minutes)</label>
          <input
            type="number"
            min="1"
            max="60"
            value={agile.pollingIntervalMinutes ?? 5}
            onChange={(e) => update('pollingIntervalMinutes', Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 5)))}
            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Desktop notifications</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={agile.notifications?.newRfa !== false}
            onChange={(e) => updateNested('notifications', 'newRfa', e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">New RFA in workqueue</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={agile.notifications?.statusChange !== false}
            onChange={(e) => updateNested('notifications', 'statusChange', e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">RFA status change</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={agile.notifications?.ecdAlert !== false}
            onChange={(e) => updateNested('notifications', 'ecdAlert', e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">ECD due soon or overdue</span>
        </label>
      </div>
    </div>
  );
}
