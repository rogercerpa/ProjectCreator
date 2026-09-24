import React, { useEffect, useState } from 'react';
import dropdownOptionsService from '../../services/DropdownOptionsService';
import { ActualHoursFields, SampleProjectField, ScheduleOutcomeFields } from './ProjectProductivityFields';

const { electronAPI } = window;

const PEOPLE = [
  { key: 'triagedBy', label: 'Triaged by' },
  { key: 'designBy', label: 'Worked by' },
  { key: 'qcBy', label: 'QC by' }
];

function namesFor(options, current) {
  const names = Array.isArray(options) ? [...options] : [];
  const value = String(current || '').trim();
  if (value && !names.some((name) => name.trim().toLowerCase() === value.toLowerCase())) {
    names.unshift(value);
  }
  return names;
}

export default function ProductivityEntryModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...project }));
  const [assignees, setAssignees] = useState(() => dropdownOptionsService.getOptionsForField('assignedToOptions'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rfaNotice, setRfaNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    dropdownOptionsService.loadFromSettings().then(() => {
      if (!cancelled) setAssignees(dropdownOptionsService.getOptionsForField('assignedToOptions'));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenRfa = async () => {
    const rfaNumber = String(form.rfaNumber || '').trim();
    if (!rfaNumber) {
      setRfaNotice('No RFA number available for this project.');
      return;
    }
    try {
      const baseRfaNumber = rfaNumber.split('-')[0];
      const rfaUrl = `http://rfa.acuitybrandslighting.net/#/requestnav/${baseRfaNumber}`;
      const result = await electronAPI.openInEdge(rfaUrl);
      if (result?.success) {
        setRfaNotice('Opening RFA in Microsoft Edge.');
      } else {
        setRfaNotice(result?.error || 'Could not open the RFA.');
      }
    } catch (err) {
      setRfaNotice(err.message || 'Could not open the RFA.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await electronAPI.projectSave(form);
      if (!result?.success) {
        setError(result?.error || 'Could not save this project.');
        setSaving(false);
        return;
      }
      onSaved(result.project || form);
    } catch (err) {
      setError(err.message || 'Could not save this project.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl dark:bg-gray-800">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {project.projectName || project.rfaNumber || 'Project'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {project.rfaNumber ? `${project.rfaNumber} · ` : ''}
            Hours, who did each task, and date notes are the same fields shown on the project page.
          </p>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Who did the work</div>
              <button
                type="button"
                className="btn-outline-primary btn-sm shrink-0"
                onClick={handleOpenRfa}
                disabled={!form.rfaNumber}
                title={form.rfaNumber ? `Open RFA ${form.rfaNumber} in Microsoft Edge` : 'No RFA number available'}
              >
                Open RFA
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Worked by is Design By on the project page. Hours count for the person named on that task.
            </p>
            {rfaNotice && <p className="text-xs text-gray-600 dark:text-gray-300">{rfaNotice}</p>}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {PEOPLE.map((person) => (
                <div key={person.key} className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300" htmlFor={`productivity-${person.key}`}>
                    {person.label}
                  </label>
                  <select
                    id={`productivity-${person.key}`}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    value={form[person.key] || ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, [person.key]: event.target.value }))}
                  >
                    <option value="">Not assigned</option>
                    {namesFor(assignees, form[person.key]).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <SampleProjectField
            formData={form}
            onPatch={(partial) => setForm((prev) => ({ ...prev, ...partial }))}
          />
          <ActualHoursFields
            formData={form}
            onPatch={(partial) => setForm((prev) => ({ ...prev, ...partial }))}
          />
          <ScheduleOutcomeFields
            formData={form}
            onPatch={(partial) => setForm((prev) => ({ ...prev, ...partial }))}
          />
          {error && <p className="text-sm text-danger-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button type="button" className="px-3 py-2 text-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
