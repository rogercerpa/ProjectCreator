import React from 'react';
import {
  compareSchedule,
  formatScheduleResult,
  isHoursRecorded,
  resolvePhaseCreditDate
} from '../../services/ProductivityMetricsService';

const PHASES = [
  {
    id: 'triage',
    hoursKey: 'actualTriageHours',
    dateKey: 'triageHoursDate',
    label: 'Actual triage time',
    hint: 'Credits to the submitted or created date when this date is blank.'
  },
  {
    id: 'design',
    hoursKey: 'actualDesignHours',
    dateKey: 'designHoursDate',
    label: 'Actual design / work time',
    hint: 'Credits to the completion date, or Expected Ready for QC, when this date is blank.'
  },
  {
    id: 'qc',
    hoursKey: 'actualQcHours',
    dateKey: 'qcHoursDate',
    label: 'Actual QC time',
    hint: 'Credits to the completion date, or Ready for QC, when this date is blank.'
  }
];

function toDateInput(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}`;
}

function dateTimeInputToISO(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function formatShortDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm';

export function ActualHoursFields({ formData = {}, onPatch, readOnly = false }) {
  const estimated = Number(formData.totalTriage || 0);
  const actualTriage = isHoursRecorded(formData.actualTriageHours) ? Number(formData.actualTriageHours) : null;

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Actual time</div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Leave hours blank until they are known. Blank hours stay out of the productivity score. Estimated triage stays the planning number.
      </p>
      {actualTriage != null && estimated > 0 && (
        <div className="text-xs text-primary-700 dark:text-primary-300">
          Triage estimate {estimated.toFixed(1)} h vs actual {actualTriage.toFixed(1)} h
          {' '}({actualTriage - estimated >= 0 ? '+' : ''}{(actualTriage - estimated).toFixed(1)} h)
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {PHASES.map((phase) => {
          const recorded = isHoursRecorded(formData[phase.hoursKey]);
          const effectiveDate = resolvePhaseCreditDate(formData, phase.id);
          return (
            <div key={phase.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 space-y-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{phase.label}</label>
              {readOnly ? (
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {recorded ? `${Number(formData[phase.hoursKey]).toFixed(1)} hours` : 'Not recorded'}
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  className={inputClass}
                  value={recorded ? formData[phase.hoursKey] : ''}
                  placeholder="Hours"
                  onChange={(event) => {
                    const raw = event.target.value;
                    onPatch?.({ [phase.hoursKey]: raw === '' ? '' : Number(raw) });
                  }}
                />
              )}
              <label className="text-xs text-gray-500 dark:text-gray-400">Credit date</label>
              {readOnly ? (
                <div className="text-sm text-gray-800 dark:text-gray-200">{formatShortDate(effectiveDate)}</div>
              ) : (
                <>
                  <input
                    type="date"
                    className={inputClass}
                    value={toDateInput(formData[phase.dateKey])}
                    onChange={(event) => onPatch?.({ [phase.dateKey]: event.target.value })}
                  />
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {formData[phase.dateKey]
                      ? phase.hint
                      : `Using ${formatShortDate(effectiveDate)}. ${phase.hint}`}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTargetDate(value) {
  const day = toDateInput(value);
  if (!day) return 'Not recorded';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function OutcomeCard({ title, targetDate, result, reason, readOnly, onReasonChange }) {
  const missed = result.status === 'not-met';
  return (
    <div className={`p-3 rounded-lg border space-y-2 ${
      missed
        ? 'border-warning-300 bg-warning-50 dark:border-warning-700 dark:bg-warning-900/20'
        : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-900'
    }`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">{title}</div>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatTargetDate(targetDate)}</div>
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{formatScheduleResult(result)}</div>
      <label className="text-xs text-gray-500 dark:text-gray-400">
        {missed ? 'Why it was missed' : 'Notes if this date is missed'}
      </label>
      {readOnly ? (
        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {reason?.trim() ? reason : (missed ? 'Reason missing' : '—')}
        </div>
      ) : (
        <textarea
          className={inputClass}
          rows={2}
          value={reason || ''}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={missed ? 'Describe why this date was missed' : 'Optional until the date is missed'}
        />
      )}
    </div>
  );
}

export function ScheduleOutcomeFields({ formData = {}, onPatch, readOnly = false }) {
  const rd = compareSchedule(formData.completedAt, formData.requestedDate);
  const ecd = compareSchedule(formData.completedAt, formData.ecd);

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Requested Date and ECD</div>
      <div className="max-w-sm">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Completed date</label>
        {readOnly ? (
          <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
            {formData.completedAt ? new Date(formData.completedAt).toLocaleString() : 'Not recorded'}
          </div>
        ) : (
          <input
            type="datetime-local"
            className={`${inputClass} mt-1`}
            value={toDateTimeInput(formData.completedAt)}
            onChange={(event) => onPatch?.({ completedAt: dateTimeInputToISO(event.target.value) })}
          />
        )}
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
          Met when completion is on or before the target. Days are calendar days. A later status change to Completed can overwrite this date.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutcomeCard
          title="Requested Date (RD)"
          targetDate={formData.requestedDate}
          result={rd}
          reason={formData.rdMissReason}
          readOnly={readOnly}
          onReasonChange={(value) => onPatch?.({ rdMissReason: value })}
        />
        <OutcomeCard
          title="Expected Completion (ECD)"
          targetDate={formData.ecd}
          result={ecd}
          reason={formData.ecdMissReason}
          readOnly={readOnly}
          onReasonChange={(value) => onPatch?.({ ecdMissReason: value })}
        />
      </div>
    </div>
  );
}
