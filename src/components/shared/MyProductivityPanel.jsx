import React from 'react';
import { formatScheduleResult } from '../../services/ProductivityMetricsService';

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

export default function MyProductivityPanel({ report, compact = false, onOpenProject }) {
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

  const rows = [
    ['Weekday capacity', hours(report.grossHours)],
    ['PTO', hours(report.pto)],
    ['Available', hours(report.available)],
    ['Triage', hours(report.triage)],
    ['Design / work', hours(report.design)],
    ['QC', hours(report.qc)],
    ['Productive', hours(report.productive)],
    ['Meetings', hours(report.meetings)],
    ['Initiative', hours(report.initiative)],
    ['Agency', hours(report.agency)],
    ['Training', hours(report.training)],
    ['Unaccounted', hours(report.unaccounted)]
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
        {rows.map(([label, value]) => (
          <div key={label} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      {report.band === 'needs-validation' && (
        <p className="text-sm text-warning-800 dark:text-warning-200">
          Productive project time is under 80% of available hours. Meetings, initiative, agency calls, training, and unaccounted time show where the rest of the week went.
        </p>
      )}

      {!compact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Schedule · RD {percent(report.rdHitRate)} · ECD {percent(report.ecdHitRate)}
            </h4>
            {report.schedule.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No projects you designed were completed in this period.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {report.schedule.map((item) => (
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
    </div>
  );
}
