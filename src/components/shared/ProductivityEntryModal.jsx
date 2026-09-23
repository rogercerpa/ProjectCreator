import React, { useState } from 'react';
import { ActualHoursFields, ScheduleOutcomeFields } from './ProjectProductivityFields';

const { electronAPI } = window;

export default function ProductivityEntryModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...project }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
            These hours and date notes are the same ones shown on the project page.
          </p>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
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
