import React, { useEffect, useState } from 'react';
import { formatScheduleResult, startOfDay } from '../../services/ProductivityMetricsService';

function hours(value) {
  return `${Number(value || 0).toFixed(1)} h`;
}

function percent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(0)}%`;
}

const bandClass = {
  'needs-validation': 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-200',
  meets: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-200',
  exceeds: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200',
  unavailable: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
};

function scheduleNeedsAttention(item) {
  return item.rd.status === 'not-recorded'
    || item.ecd.status === 'not-recorded'
    || item.rdReasonMissing
    || item.ecdReasonMissing;
}

const DRILLDOWN = {
  'Project hours': 'projectHours',
  Meetings: 'meetings',
  Initiative: 'initiative',
  Training: 'training',
  'Email responses': 'email',
  Other: 'other'
};

function formatEntryDate(value) {
  const day = startOfDay(value);
  if (!day) return '';
  return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function phaseBits(item) {
  return [
    item.triage != null ? `Triage ${hours(item.triage)}` : '',
    item.design != null ? `Design ${hours(item.design)}` : '',
    item.qc != null ? `QC ${hours(item.qc)}` : ''
  ].filter(Boolean).join(' · ');
}

function MetricDetailModal({ metric, report, onClose, onViewProject }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lines = report.detail?.[metric] || [];
  const titles = {
    projectHours: 'Project hours',
    meetings: 'Meetings',
    initiative: 'Initiative',
    training: 'Training',
    email: 'Email responses',
    other: 'Other'
  };
  const summaries = {
    projectHours: `${hours(report.productive)} · ${percent(report.projectShare)}`,
    meetings: `${hours(report.meetingsWorked)} · ${percent(report.meetingsShare)}`,
    initiative: `${hours(report.initiative)} · ${percent(report.initiativeShare)}`,
    training: `${hours(report.training)} · ${percent(report.trainingShare)}`,
    email: `${hours(report.email)} · ${percent(report.emailShare)}`,
    other: `${hours(report.other)} · ${percent(report.otherShare)}`
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 print:hidden" role="presentation" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-detail-title"
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div>
            <h3 id="metric-detail-title" className="text-base font-bold text-gray-900 dark:text-white">{titles[metric]}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{summaries[metric]}</p>
          </div>
          <button type="button" onClick={onClose} className="text-lg font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" aria-label="Close">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3">
          {lines.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nothing was logged in this period.</p>
          ) : metric === 'projectHours' ? (
            <ul className="space-y-1">
              {lines.map((item) => (
                <li key={item.projectId || item.projectName}>
                  <button
                    type="button"
                    onClick={() => onViewProject?.(item.projectId)}
                    disabled={!onViewProject || !item.projectId}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700/40"
                  >
                    <span className="font-medium">{item.projectName}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {[item.rfaNumber, phaseBits(item), hours(item.total)].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1">
              {lines.map((item) => (
                <li key={item.id} className="rounded-lg px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200">
                  <span className="font-medium">{formatEntryDate(item.date)}</span>
                  <span className="text-gray-500 dark:text-gray-400"> · {item.label} · {hours(item.hours)}</span>
                  {item.notes ? <span className="block text-xs text-gray-500 dark:text-gray-400">{item.notes}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyProductivityPanel({
  report,
  compact = false,
  onOpenProject,
  onViewProject,
  showSampleProjects = false,
  interactive = true
}) {
  const [openMetric, setOpenMetric] = useState(null);

  useEffect(() => {
    if (!interactive) setOpenMetric(null);
  }, [interactive]);

  if (!report) return null;

  const missingByProject = [];
  const missingSeen = new Map();
  (report.missing || []).forEach((item) => {
    const key = item.projectId || item.projectName;
    const existing = missingSeen.get(key);
    if (existing) {
      existing.phases.push(item.phaseLabel);
      return;
    }
    const grouped = { ...item, phases: [item.phaseLabel] };
    missingSeen.set(key, grouped);
    missingByProject.push(grouped);
  });

  const openProject = (projectId) => {
    if (onOpenProject && projectId) onOpenProject(projectId);
  };

  const viewProject = (projectId) => {
    setOpenMetric(null);
    if (onViewProject && projectId) onViewProject(projectId);
  };

  const scheduleAttention = (report.schedule || []).filter(scheduleNeedsAttention);

  const rows = [
    ['Weekday capacity', hours(report.grossHours), ''],
    ['PTO', hours(report.pto), ''],
    ['Available', hours(report.available), '100% of this period'],
    ['Project hours', `${hours(report.productive)} · ${percent(report.projectShare)}`, `Triage ${hours(report.triage)} · Design ${hours(report.design)} · QC ${hours(report.qc)}`],
    ['Meetings', `${hours(report.meetingsWorked)} · ${percent(report.meetingsShare)}`, report.agency > 0 ? `Includes ${hours(report.agency)} agency calls` : ''],
    ['Initiative', `${hours(report.initiative)} · ${percent(report.initiativeShare)}`, ''],
    ['Training', `${hours(report.training)} · ${percent(report.trainingShare)}`, ''],
    ['Email responses', `${hours(report.email)} · ${percent(report.emailShare)}`, ''],
    ...(report.other > 0 ? [['Other', `${hours(report.other)} · ${percent(report.otherShare)}`, '']] : []),
    ['Not recorded', `${hours(report.unaccounted)} · ${percent(report.unaccountedShare)}`, '']
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">My productivity</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {report.userName || 'Set your name in Settings'} · {report.weekdays} weekdays · {report.dailyCapacity.toFixed(1)} h per weekday
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{percent(report.score)}</div>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${bandClass[report.band] || bandClass.unavailable}`}>
            {report.bandLabel}
          </span>
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
        {rows.map(([label, value, detail]) => {
          const metric = DRILLDOWN[label];
          const card = (
            <>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
              {detail ? <div className="text-[11px] text-gray-500 dark:text-gray-400">{detail}</div> : null}
            </>
          );
          if (!metric || !interactive) {
            return (
              <div key={label} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900">
                {card}
              </div>
            );
          }
          return (
            <button
              key={label}
              type="button"
              onClick={() => setOpenMetric(metric)}
              className="px-3 py-2 rounded-lg bg-gray-50 text-left hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-700/60"
            >
              {card}
            </button>
          );
        })}
      </div>

      {openMetric && interactive && (
        <MetricDetailModal
          metric={openMetric}
          report={report}
          onClose={() => setOpenMetric(null)}
          onViewProject={onViewProject ? viewProject : undefined}
        />
      )}

      {report.band === 'needs-validation' && (
        <p className="text-sm text-warning-800 dark:text-warning-200">
          Logged work is under 80% of available hours. Project hours, meetings, initiative, training, and email responses are the slices of that total. The rest of the period is not recorded yet.
        </p>
      )}

      {!compact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Schedule · RD {percent(report.rdHitRate)} · ECD {percent(report.ecdHitRate)}
            </h4>
            {scheduleAttention.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Requested dates and ECDs are recorded for the projects you completed in this period.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {scheduleAttention.map((item) => (
                  <li key={item.projectId || item.rfaNumber}>
                    <button
                      type="button"
                      onClick={() => openProject(item.projectId)}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/40"
                    >
                      <span className="font-medium">{item.projectName}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        RD {formatScheduleResult(item.rd)}
                        {item.rdReasonMissing ? ' · reason missing' : ''}
                        {item.rd.status === 'not-met' && item.rdMissReason ? ` · ${item.rdMissReason}` : ''}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        ECD {formatScheduleResult(item.ecd)}
                        {item.ecdReasonMissing ? ' · reason missing' : ''}
                        {item.ecd.status === 'not-met' && item.ecdMissReason ? ` · ${item.ecdMissReason}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Hours not recorded yet</h4>
            {report.missing.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Recorded project hours cover your work in this period.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {missingByProject.map((item) => (
                  <li key={item.projectId || item.projectName}>
                    <button
                      type="button"
                      onClick={() => openProject(item.projectId)}
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/40"
                    >
                      <span className="font-medium">{item.projectName}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{item.phases.join(', ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!compact && showSampleProjects && report.samples?.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Sample projects, not counted</h4>
          <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
            {report.samples.map((item) => (
              <li key={item.projectId || item.projectName}>
                <button
                  type="button"
                  onClick={() => openProject(item.projectId)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/40"
                >
                  <span className="font-medium">{item.projectName}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Left out of productivity and this report</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
