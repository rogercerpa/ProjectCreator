/**
 * AgileWorkqueueTable - Sortable/filterable table of workqueue entries
 */

import React, { useState, useMemo } from 'react';

const COLUMNS = [
  { key: 'wqNumber', label: 'WQ #', sortable: true },
  { key: 'rfaType', label: 'Type', sortable: true },
  { key: 'rfaNumber', label: 'RFA # (Doc)', sortable: true },
  { key: 'agentNumber', label: 'Rep', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'assignedTo', label: 'Assigned To', sortable: true },
  { key: 'ecd', label: 'ECD (Due Date)', sortable: true },
  { key: 'projectName', label: 'Sub Name', sortable: true },
  { key: 'priority', label: 'Complexity', sortable: true },
  { key: 'estHours', label: 'Est. Hours', sortable: true },
  { key: 'userComment', label: 'User Comment', sortable: false }
];

export default function AgileWorkqueueTable({ entries, onOpenRFA, onImportRFA, onFetchDetails, loading, fetchingDetailsRfa }) {
  const [sortKey, setSortKey] = useState('rfaNumber');
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');

  const sorted = useMemo(() => {
    let list = [...(entries || [])];
    if (filter.trim()) {
      const f = filter.toLowerCase();
      list = list.filter(
        (e) =>
          (e.rfaNumber && e.rfaNumber.toLowerCase().includes(f)) ||
          (e.wqNumber && e.wqNumber.toLowerCase().includes(f)) ||
          (e.projectName && e.projectName.toLowerCase().includes(f)) ||
          (e.status && e.status.toLowerCase().includes(f)) ||
          (e.rfaType && e.rfaType.toLowerCase().includes(f)) ||
          (e.userComment && e.userComment.toLowerCase().includes(f))
      );
    }
    list.sort((a, b) => {
      const aVal = a[sortKey] || '';
      const bVal = b[sortKey] || '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [entries, filter, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else setSortKey(key);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-gray-500 dark:text-gray-400">
        Loading workqueue…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <input
          type="text"
          placeholder="Filter by RFA, project, status, type…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
        />
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/80 text-left">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap"
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="hover:underline"
                    >
                      {col.label}
                      {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200 w-40">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                  {entries?.length === 0 ? 'No workqueue data. Connect Edge and scrape the workqueue.' : 'No rows match the filter.'}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={row.rfaNumber || row.wqNumber || row.projectName || Math.random()}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-gray-800 dark:text-gray-200">
                      {row[col.key] || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {onOpenRFA && row.rfaNumber && (
                        <button
                          type="button"
                          onClick={() => onOpenRFA(row.rfaNumber)}
                          className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                        >
                          Open in Edge
                        </button>
                      )}
                      {onFetchDetails && row.rfaNumber && (
                        <button
                          type="button"
                          onClick={() => onFetchDetails(row)}
                          disabled={fetchingDetailsRfa != null}
                          className="text-primary-600 dark:text-primary-400 hover:underline text-xs disabled:opacity-50"
                        >
                          {fetchingDetailsRfa === row.rfaNumber ? 'Fetching…' : 'Fetch details'}
                        </button>
                      )}
                      {onImportRFA && (
                        <button
                          type="button"
                          onClick={() => onImportRFA(row)}
                          className="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                        >
                          Import to wizard
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
