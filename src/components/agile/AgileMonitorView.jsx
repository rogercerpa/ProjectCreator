/**
 * AgileMonitorView - Agile workqueue monitoring (Edge CDP)
 * Connection panel, workqueue table, status dashboard, activity feed, quick actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import AgileConnectionPanel from './AgileConnectionPanel';
import AgileWorkqueueTable from './AgileWorkqueueTable';

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const RFA_DETAIL_URL = 'http://rfa.acuitybrandslighting.net/#/requestnav/';

export default function AgileMonitorView({ onNavigateToWizard, onImportRfaData }) {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState({
    edge: { connected: false, error: null },
    isMonitoring: false,
    lastScrapedAt: null,
    lastError: null,
    entryCount: 0
  });
  const [workqueue, setWorkqueue] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [checking, setChecking] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosingProject, setDiagnosingProject] = useState(false);
  const [diagnoseProjectRfa, setDiagnoseProjectRfa] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [fetchingDetailsRfa, setFetchingDetailsRfa] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [projectDetailsModalOpen, setProjectDetailsModalOpen] = useState(false);
  const [projectDetailsRow, setProjectDetailsRow] = useState(null);
  const [downloadingDocUrl, setDownloadingDocUrl] = useState(null);

  const loadStatus = useCallback(async () => {
    if (!window.electronAPI?.agileGetStatus) return;
    try {
      const s = await window.electronAPI.agileGetStatus();
      setStatus({
        edge: s.edge || { connected: false, error: null },
        isMonitoring: s.isMonitoring ?? false,
        lastScrapedAt: s.lastScrapedAt ?? null,
        lastError: s.lastError ?? null,
        entryCount: s.entryCount ?? 0
      });
      const list = await window.electronAPI.agileGetWorkqueue();
      setWorkqueue(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Agile status load failed:', e);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (window.electronAPI?.settingsLoad) {
      window.electronAPI.settingsLoad().then((res) => {
        if (res?.success && res?.data) setSettings(res.data);
      });
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onAgileUpdate) return;
    const cleanup = window.electronAPI.onAgileUpdate((data) => {
      if (data.entries) setWorkqueue(data.entries);
      if (data.scrapedAt) {
        setStatus((prev) => ({ ...prev, lastScrapedAt: data.scrapedAt, lastError: data.error || null }));
      }
    });
    return () => (typeof cleanup === 'function' ? cleanup() : undefined);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onAgileNewRFA) return;
    const cleanup = window.electronAPI.onAgileNewRFA((rfa) => {
      setActivityFeed((prev) => [
        { type: 'new', rfa, at: new Date().toISOString() },
        ...prev.slice(0, 49)
      ]);
    });
    return () => (typeof cleanup === 'function' ? cleanup() : undefined);
  }, []);

  const handleCheckConnection = async () => {
    setChecking(true);
    try {
      await loadStatus();
      if (window.electronAPI?.agileCheckEdge) {
        const result = await window.electronAPI.agileCheckEdge();
        setStatus((prev) => ({
          ...prev,
          edge: { connected: result?.connected ?? false, error: result?.error ?? null }
        }));
      }
    } finally {
      setChecking(false);
    }
  };

  const handleLaunchEdge = () => (window.electronAPI?.agileLaunchEdge ? window.electronAPI.agileLaunchEdge() : Promise.resolve({ success: false }));

  const handleStartMonitoring = async () => {
    if (!window.electronAPI?.agileStartMonitoring) return;
    const minutes = settings?.agileSettings?.pollingIntervalMinutes ?? 5;
    const intervalMs = Math.max(60000, minutes * 60 * 1000);
    await window.electronAPI.agileStartMonitoring(intervalMs);
    setStatus((prev) => ({ ...prev, isMonitoring: true }));
  };

  const handleStopMonitoring = async () => {
    if (!window.electronAPI?.agileStopMonitoring) return;
    await window.electronAPI.agileStopMonitoring();
    setStatus((prev) => ({ ...prev, isMonitoring: false }));
  };

  const handleScrapeNow = async () => {
    setScraping(true);
    try {
      if (window.electronAPI?.agileScrapeNow) {
        const result = await window.electronAPI.agileScrapeNow();
        if (result?.entries) setWorkqueue(result.entries);
        if (result?.scrapedAt) {
          setStatus((prev) => ({ ...prev, lastScrapedAt: result.scrapedAt, lastError: result.error || null }));
        }
      }
    } finally {
      setScraping(false);
    }
  };

  const handleDiagnosePage = async () => {
    setDiagnosing(true);
    setDiagnosticResult(null);
    try {
      if (window.electronAPI?.agileDiagnosePage) {
        const result = await window.electronAPI.agileDiagnosePage();
        setDiagnosticResult(result);
        setDebugPanelOpen(true);
      }
    } finally {
      setDiagnosing(false);
    }
  };

  const handleDiagnoseProjectPage = async () => {
    const rfa = (diagnoseProjectRfa || '').trim() || (workqueue[0]?.rfaNumber || '').trim();
    if (!rfa) {
      setDiagnosticResult({ error: 'Enter an RFA number or ensure workqueue has at least one row.' });
      setDebugPanelOpen(true);
      return;
    }
    setDiagnosingProject(true);
    setDiagnosticResult(null);
    try {
      if (window.electronAPI?.agileDiagnoseProjectPage) {
        const pattern = settings?.agileSettings?.rfaDetailUrlPattern || 'http://rfa.acuitybrandslighting.net/#/requestnav/{rfaNumber}';
        const result = await window.electronAPI.agileDiagnoseProjectPage({ rfaNumber: rfa, rfaDetailUrlPattern: pattern });
        setDiagnosticResult(result);
        setDebugPanelOpen(true);
      }
    } finally {
      setDiagnosingProject(false);
    }
  };

  const handleOpenRFA = (rfaNumber) => {
    const base = (rfaNumber || '').split('-')[0];
    const url = base ? `${RFA_DETAIL_URL}${base}` : RFA_DETAIL_URL;
    if (window.electronAPI?.openInEdge) window.electronAPI.openInEdge(url);
  };

  const handleImportRFA = (row) => {
    if (onImportRfaData) {
      onImportRfaData({
        rfaNumber: row.rfaNumber,
        rfaType: row.rfaType,
        projectName: row.projectName,
        projectContainer: row.projectContainer,
        agentNumber: row.agentNumber,
        ecd: row.ecd,
        status: row.status
      });
      if (onNavigateToWizard) onNavigateToWizard();
    }
  };

  const handleFetchDetails = async (row) => {
    if (!row?.rfaNumber || !window.electronAPI?.agileFetchProjectDetails) return;
    setFetchingDetailsRfa(row.rfaNumber);
    setProjectDetails(null);
    try {
      const pattern = settings?.agileSettings?.rfaDetailUrlPattern || 'http://rfa.acuitybrandslighting.net/#/requestnav/{rfaNumber}';
      const result = await window.electronAPI.agileFetchProjectDetails({ rfaNumber: row.rfaNumber, rfaDetailUrlPattern: pattern });
      setProjectDetails(result);
      setProjectDetailsRow(row);
      setProjectDetailsModalOpen(true);
    } finally {
      setFetchingDetailsRfa(null);
    }
  };

  const handleUseProjectDetailsInWizard = () => {
    if (!projectDetailsRow || !onImportRfaData) return;
    const h = projectDetails?.header || {};
    const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && String(v).trim() !== '');
    const enriched = {
      ...projectDetailsRow,
      rfaType: pick(h.rfaType, projectDetailsRow.rfaType),
      projectName: pick(h.projectName, projectDetailsRow.projectName),
      projectContainer: pick(h.projectContainer, projectDetailsRow.projectContainer),
      agentNumber: pick(h.repAgencyNumber, h.rep, projectDetailsRow.agentNumber),
      status: pick(h.status, h.Status, projectDetailsRow.status),
      ecd: pick(h.ecd, h.ECD, projectDetailsRow.ecd),
      assignedTo: pick(h.assignedTo, h.AssignedTo),
      priority: pick(h.complexity, h.Complexity),
      nationalAccount: pick(h.nationalAccount, h.NationalAccount),
      requestedDate: pick(h.requestedDate, h.RequestedDate),
      submittedDate: pick(h.submittedDate, h.SubmittedDate),
      lastUpdated: pick(h.lastUpdated, h.LastUpdated),
      createdBy: pick(h.createdBy, h.CreatedBy),
      products: pick(h.productsOnThisRequest, h.ProductsonThisRequest),
      requestedVersion: projectDetails?.requestedVersion,
      selectedVersion: projectDetails?.selectedVersion,
      versionWarning: projectDetails?.versionWarning
    };
    onImportRfaData(enriched);
    setProjectDetailsModalOpen(false);
    setProjectDetails(null);
    setProjectDetailsRow(null);
    setDownloadingDocUrl(null);
    if (onNavigateToWizard) onNavigateToWizard();
  };

  const getHeaderValue = (header, ...keys) => {
    for (const key of keys) {
      const value = header?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };

  const normalizeForCompare = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizeDigits = (value) => String(value ?? '').replace(/[^\d]/g, '');
  const parseAgileDateTime = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const todayMatch = raw.match(/^today\s+(\d{1,2}:\d{2}\s*[ap]m)$/i);
    if (todayMatch) {
      const now = new Date();
      const mm = todayMatch[1].match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
      if (!mm) return null;
      let hour = Number(mm[1]);
      const minute = Number(mm[2]);
      const ap = mm[3].toLowerCase();
      if (ap === 'pm' && hour < 12) hour += 12;
      if (ap === 'am' && hour === 12) hour = 0;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const sameMinute = (a, b) => {
    if (!a || !b) return false;
    return Math.abs(a.getTime() - b.getTime()) < 60 * 1000;
  };

  const byStatus = workqueue.reduce((acc, e) => {
    const s = (e.status || 'Unknown').trim() || 'Unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agile Workqueue Monitor</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Monitor your Agile workqueue via Microsoft Edge. Ensure VPN is connected and Edge is open with remote debugging (or use Launch Edge).
        </p>
      </div>

      <AgileConnectionPanel
        edgeConnected={status.edge?.connected}
        edgeError={status.edge?.error}
        isMonitoring={status.isMonitoring}
        lastScrapedAt={status.lastScrapedAt}
        onCheckConnection={handleCheckConnection}
        onLaunchEdge={handleLaunchEdge}
        onStartMonitoring={handleStartMonitoring}
        onStopMonitoring={handleStopMonitoring}
        onScrapeNow={handleScrapeNow}
        checking={checking}
        scraping={scraping}
      />

      {status.edge?.connected && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDiagnosePage}
            disabled={diagnosing}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-50"
          >
            {diagnosing ? 'Diagnosing…' : 'Diagnose page'}
          </button>
          <span className="text-gray-400 dark:text-gray-500">|</span>
          <input
            type="text"
            value={diagnoseProjectRfa}
            onChange={(e) => setDiagnoseProjectRfa(e.target.value)}
            placeholder="RFA number for project"
            className="w-40 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
          />
          <button
            type="button"
            onClick={handleDiagnoseProjectPage}
            disabled={diagnosingProject}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-50"
          >
            {diagnosingProject ? 'Diagnosing…' : 'Diagnose project page'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Total in queue</h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{workqueue.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">By status</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
            {Object.entries(byStatus).slice(0, 5).map(([s, count]) => (
              <li key={s}>{s}: {count}</li>
            ))}
            {Object.keys(byStatus).length === 0 && <li>—</li>}
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Activity</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">{activityFeed.length} recent events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Workqueue</h3>
          <AgileWorkqueueTable
            entries={workqueue}
            onOpenRFA={handleOpenRFA}
            onImportRFA={onImportRfaData || onNavigateToWizard ? handleImportRFA : undefined}
            onFetchDetails={window.electronAPI?.agileFetchProjectDetails ? handleFetchDetails : undefined}
            fetchingDetailsRfa={fetchingDetailsRfa}
            loading={scraping}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Activity feed</h3>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm max-h-96 overflow-y-auto">
            {activityFeed.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet. New RFAs will appear here.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activityFeed.map((item, i) => (
                  <li key={i} className="border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                    {item.type === 'new' && (
                      <span className="text-green-600 dark:text-green-400 font-medium">New RFA: {item.rfa?.rfaNumber}</span>
                    )}
                    {item.rfa?.projectName && <span className="block text-gray-600 dark:text-gray-400 truncate">{item.rfa.projectName}</span>}
                    <span className="text-xs text-gray-400">{new Date(item.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {diagnosticResult != null && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setDebugPanelOpen((v) => !v)}
            className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {debugPanelOpen ? '▼' : '▶'} Page diagnostic (DOM structure)
          </button>
          {debugPanelOpen && (
            <pre className="p-4 text-xs text-gray-800 dark:text-gray-200 overflow-auto max-h-80 bg-gray-50 dark:bg-gray-900 whitespace-pre-wrap break-words">
              {diagnosticResult?.error
                ? String(diagnosticResult.error)
                : JSON.stringify(diagnosticResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {projectDetailsModalOpen && projectDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Project details</h3>
              <button
                type="button"
                onClick={() => { setProjectDetailsModalOpen(false); setProjectDetails(null); setProjectDetailsRow(null); setDownloadingDocUrl(null); }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm">
              {projectDetails.error ? (
                <p className="text-amber-600 dark:text-amber-400">{projectDetails.error}</p>
              ) : (
                <>
                  {projectDetailsRow && (
                    <section className="mb-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">QA: Expected vs Scraped</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-gray-200 dark:border-gray-600 text-xs">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700">
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Field</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Expected</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Scraped</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const h = projectDetails.header || {};
                              const expectedVersion = (() => {
                                const m = String(projectDetailsRow.rfaNumber || '').match(/-(\d+)$/);
                                return m ? m[1] : '0';
                              })();
                              const rows = [
                                { field: 'RFA Number', expected: projectDetailsRow.rfaNumber || '', scraped: getHeaderValue(h, 'rfaNumber'), rule: 'textExact' },
                                { field: 'RFA Type', expected: projectDetailsRow.rfaType || '', scraped: getHeaderValue(h, 'rfaType'), rule: 'textExact' },
                                { field: 'Project Name', expected: projectDetailsRow.projectName || '', scraped: getHeaderValue(h, 'projectName'), rule: 'textContains' },
                                { field: 'Project Container', expected: projectDetailsRow.projectContainer || '', scraped: getHeaderValue(h, 'projectContainer'), rule: 'containerOrInfo' },
                                { field: 'Rep Agency #', expected: projectDetailsRow.agentNumber || '', scraped: getHeaderValue(h, 'repAgencyNumber', 'rep'), rule: 'digitsExact' },
                                { field: 'Version', expected: expectedVersion, scraped: String(projectDetails.selectedVersion ?? getHeaderValue(h, 'version') ?? ''), rule: 'digitsExact' },
                                { field: 'Status', expected: projectDetailsRow.status || '', scraped: getHeaderValue(h, 'status', 'Status'), rule: 'textExact' },
                                { field: 'ECD', expected: projectDetailsRow.ecd || '', scraped: getHeaderValue(h, 'ecd', 'ECD'), rule: 'dateMinute' }
                              ];
                              return rows.map((row) => {
                                const expectedNorm = normalizeForCompare(row.expected);
                                const scrapedNorm = normalizeForCompare(row.scraped);
                                let result = 'Check';
                                if (row.rule === 'containerOrInfo' && (!expectedNorm || expectedNorm === '-')) {
                                  result = 'Info';
                                } else if (row.rule === 'digitsExact') {
                                  result = normalizeDigits(row.expected) && normalizeDigits(row.expected) === normalizeDigits(row.scraped) ? 'Match' : 'Check';
                                } else if (row.rule === 'dateMinute') {
                                  const d1 = parseAgileDateTime(row.expected);
                                  const d2 = parseAgileDateTime(row.scraped);
                                  result = sameMinute(d1, d2) ? 'Match' : 'Check';
                                } else if (row.rule === 'textContains') {
                                  result = expectedNorm && scrapedNorm && (scrapedNorm.includes(expectedNorm) || expectedNorm.includes(scrapedNorm)) ? 'Match' : 'Check';
                                } else {
                                  result = expectedNorm && scrapedNorm && expectedNorm === scrapedNorm ? 'Match' : 'Check';
                                }
                                const colorClass = result === 'Match'
                                  ? 'text-green-600 dark:text-green-400'
                                  : result === 'Info'
                                    ? 'text-sky-600 dark:text-sky-400'
                                    : 'text-amber-600 dark:text-amber-400';
                                return (
                                  <tr key={row.field} className="border-b border-gray-200 dark:border-gray-600">
                                    <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{row.field}</td>
                                    <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{row.expected || '-'}</td>
                                    <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{row.scraped || '-'}</td>
                                    <td className={`border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium ${colorClass}`}>
                                      {result}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  {projectDetails.nonHeaderTabsUnavailable && (
                    <section className="mb-4 rounded border border-amber-300/50 dark:border-amber-600/50 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2">
                      <p className="text-amber-700 dark:text-amber-300">
                        {projectDetails.nonHeaderTabsMessage || 'Only Header data is currently available in this browser mode.'}
                      </p>
                    </section>
                  )}
                  {(projectDetails.requestedVersion !== undefined || projectDetails.selectedVersion !== undefined) && (
                    <section className="mb-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Version</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <dt className="text-gray-500 dark:text-gray-400">Requested:</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {projectDetails.requestedVersion ?? '-'}
                        </dd>
                        <dt className="text-gray-500 dark:text-gray-400">Selected:</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                          {projectDetails.selectedVersion ?? '-'}
                        </dd>
                      </dl>
                      {projectDetails.versionWarning && (
                        <p className="mt-2 text-amber-600 dark:text-amber-400">
                          {projectDetails.versionWarning}
                        </p>
                      )}
                    </section>
                  )}
                  {Object.keys(projectDetails.header || {}).length > 0 && (
                    <section className="mb-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Header</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {(() => {
                          const h = projectDetails.header || {};
                          const ordered = [
                            ['rfaNumber', h.rfaNumber],
                            ['rfaType', h.rfaType],
                            ['rfaTypeDetail', h.rfaTypeDetail],
                            ['projectName', h.projectName],
                            ['projectContainer', h.projectContainer],
                            ['repAgencyNumber', h.repAgencyNumber || h.rep],
                            ['version', h.version],
                            ['status', h.status || h.Status],
                            ['ecd', h.ecd || h.ECD],
                            ['requestedDate', h.requestedDate || h.RequestedDate],
                            ['submittedDate', h.submittedDate || h.SubmittedDate],
                            ['explicitSequenceOfOperations', h.explicitSequenceOfOperations],
                            ['assignedTo', h.assignedTo || h.AssignedTo],
                            ['repContacts', h.repContacts || h.RepContacts],
                            ['complexity', h.complexity || h.Complexity],
                            ['rfaValue', h.rfaValue || h.RFAValue],
                            ['productsOnThisRequest', h.productsOnThisRequest || h.ProductsonThisRequest],
                            ['rootCauseRevision', h.rootCauseRevision || h.RootCauseRevision],
                            ['nationalAccount', h.nationalAccount || h.NationalAccount],
                            ['lastUpdated', h.lastUpdated || h.LastUpdated],
                            ['createdBy', h.createdBy || h.CreatedBy],
                            ['lightingPagesWithControls', h.lightingPagesWithControls || h.LightingPagesWithControls]
                          ];
                          const seen = new Set(ordered.map(([k]) => k));
                          const extras = Object.entries(h).filter(([k, v]) => !seen.has(k) && String(v || '').trim() !== '');
                          return [...ordered.filter(([, v]) => String(v || '').trim() !== ''), ...extras];
                        })().map(([k, v]) => (
                          <React.Fragment key={k}>
                            <dt className="text-gray-500 dark:text-gray-400">{k.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (c) => c.toUpperCase())}:</dt>
                            <dd className="text-gray-900 dark:text-gray-100 break-words">{v}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    </section>
                  )}
                  {!projectDetails.nonHeaderTabsUnavailable && Object.keys(projectDetails.details || {}).length > 0 && (
                    <section className="mb-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Details</h4>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(projectDetails.details).slice(0, 15).map(([k, v]) => (
                          <React.Fragment key={k}>
                            <dt className="text-gray-500 dark:text-gray-400 shrink-0">{k}:</dt>
                            <dd className="text-gray-900 dark:text-gray-100 break-words">{String(v).slice(0, 200)}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    </section>
                  )}
                  {!projectDetails.nonHeaderTabsUnavailable && Array.isArray(projectDetails.notes) && projectDetails.notes.length > 0 && (
                    <section className="mb-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Notes ({projectDetails.notes.length})</h4>
                      <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                        {projectDetails.notes.map((n, i) => (
                          <li key={i} className="border-b border-gray-100 dark:border-gray-700 pb-2 last:border-0">
                            {n.category && <span className="font-medium text-gray-600 dark:text-gray-400">{n.category}</span>}
                            <p className="mt-0.5">{n.description || n.text || '-'}</p>
                            {(n.author || n.date) && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {[n.author, n.date].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {!projectDetails.nonHeaderTabsUnavailable && Array.isArray(projectDetails.documents) && projectDetails.documents.length > 0 && (
                    <section className="mb-4">
                      <h4 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Documents ({projectDetails.documents.length})</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-gray-200 dark:border-gray-600">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700">
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">File</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Category</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">File date</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Size</th>
                              <th className="border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectDetails.documents.map((d, i) => (
                              <tr key={i} className="border-b border-gray-200 dark:border-gray-600">
                                <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{d.description || d.name || '-'}</td>
                                <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{d.category || '-'}</td>
                                <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{d.fileDate || '-'}</td>
                                <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">{d.fileSize || '-'}</td>
                                <td className="border border-gray-200 dark:border-gray-600 px-2 py-1.5">
                                  {d.fileLink ? (
                                    <button
                                      type="button"
                                      disabled={!!downloadingDocUrl}
                                      onClick={async () => {
                                        if (!window.electronAPI?.agileDownloadDocument) return;
                                        setDownloadingDocUrl(d.fileLink);
                                        try {
                                          const result = await window.electronAPI.agileDownloadDocument({
                                            url: d.fileLink,
                                            filename: d.description || d.name || 'document'
                                          });
                                          if (result?.error && !result.cancelled) {
                                            console.error('Download failed:', result.error);
                                          }
                                        } finally {
                                          setDownloadingDocUrl(null);
                                        }
                                      }}
                                      className="text-sm px-2 py-1 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded disabled:opacity-50"
                                    >
                                      {downloadingDocUrl === d.fileLink ? '…' : 'Download'}
                                    </button>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
            {!projectDetails.error && onImportRfaData && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setProjectDetailsModalOpen(false); setProjectDetails(null); setProjectDetailsRow(null); setDownloadingDocUrl(null); }}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUseProjectDetailsInWizard}
                  className="px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded-lg"
                >
                  Use in wizard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
