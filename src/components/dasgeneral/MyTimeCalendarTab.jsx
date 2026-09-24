import React, { useEffect, useMemo, useState } from 'react';
import {
  TIME_CATEGORIES,
  buildProductivityReport,
  collectPhaseChips
} from '../../services/ProductivityMetricsService';
import MyProductivityPanel from '../shared/MyProductivityPanel';

const { electronAPI } = window;

const PHASE_COLOR = {
  triage: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  design: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200',
  qc: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
};

function monthRange(year, month) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  return { startDate, endDate };
}

function dateKey(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyForm(date) {
  return {
    id: '',
    date: dateKey(date),
    category: 'meeting',
    hours: '',
    title: '',
    notes: '',
    createdAt: ''
  };
}

export default function MyTimeCalendarTab({ onOpenProject }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [userName, setUserName] = useState('');
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [settingsResult, projectResult, calendarResult] = await Promise.all([
          electronAPI.settingsLoad(),
          electronAPI.projectsLoadAll(),
          electronAPI.timeCalendarLoad()
        ]);
        if (!active) return;
        setUserName(settingsResult?.data?.workloadSettings?.userName || '');
        setWeeklyCapacity(Number(settingsResult?.data?.workloadSettings?.weeklyCapacity) || 40);
        setProjects(Array.isArray(projectResult?.projects) ? projectResult.projects : (Array.isArray(projectResult) ? projectResult : []));
        setEntries(calendarResult?.entries || []);
      } catch (err) {
        if (active) setError(err.message || 'Could not load your calendar.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const { startDate, endDate } = monthRange(cursor.year, cursor.month);
  const dailyCapacity = (Number(weeklyCapacity) || 40) / 5;
  const report = useMemo(() => buildProductivityReport({
    projects,
    entries,
    userName,
    startDate,
    endDate,
    weeklyCapacity
  }), [projects, entries, userName, startDate, endDate, weeklyCapacity]);

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const chips = useMemo(() => collectPhaseChips(projects, userName).filter((chip) => (
    dateKey(chip.date).startsWith(monthPrefix)
  )), [projects, userName, monthPrefix]);

  const days = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const lead = first.getDay();
    const count = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i += 1) cells.push(null);
    for (let day = 1; day <= count; day += 1) cells.push(new Date(cursor.year, cursor.month, day));
    return cells;
  }, [cursor]);

  const saveForm = async () => {
    setError('');
    const result = await electronAPI.timeCalendarUpsert({
      ...form,
      hours: Number(form.hours)
    });
    if (!result?.success) {
      setError(result?.error || 'Could not save this entry.');
      return;
    }
    setEntries(result.entries || []);
    setForm(null);
  };

  const deleteEntry = async (id) => {
    const result = await electronAPI.timeCalendarDelete(id);
    if (result?.success) setEntries(result.entries || []);
  };

  const openProject = (projectId) => {
    const project = projects.find((item) => item.id === projectId);
    if (project && onOpenProject) onOpenProject(project);
  };

  if (loading) {
    return <div className="py-16 text-center text-gray-500">Loading your time…</div>;
  }

  return (
    <div className="space-y-4">
      <MyProductivityPanel report={report} compact />
      {!userName && (
        <p className="text-sm text-warning-700 dark:text-warning-300">
          Set your name under Settings → User Profile so project triage, design, and QC hours attach to you.
        </p>
      )}
      {error && <p className="text-sm text-danger-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
          onClick={() => setCursor((prev) => {
            const date = new Date(prev.year, prev.month - 1, 1);
            return { year: date.getFullYear(), month: date.getMonth() };
          })}
        >
          Previous
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {startDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <button
          type="button"
          className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
          onClick={() => setCursor((prev) => {
            const date = new Date(prev.year, prev.month + 1, 1);
            return { year: date.getFullYear(), month: date.getMonth() };
          })}
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs text-gray-500 dark:text-gray-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="px-1 py-1 text-center">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="min-h-24" />;
          const key = dateKey(day);
          const dayEntries = entries.filter((entry) => dateKey(entry.date) === key);
          const dayChips = chips.filter((chip) => dateKey(chip.date) === key);
          return (
            <div
              key={key}
              onClick={() => setForm(emptyForm(day))}
              className="min-h-24 text-left p-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 cursor-pointer"
            >
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{day.getDate()}</div>
              <div className="space-y-1 mt-1">
                {dayChips.map((chip) => (
                  <div
                    key={`${chip.projectId}-${chip.phase}`}
                    className={`px-1 py-0.5 rounded text-[10px] truncate ${PHASE_COLOR[chip.phase]}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openProject(chip.projectId);
                    }}
                  >
                    {chip.phaseLabel} {chip.hours}h {chip.rfaNumber || chip.projectName}
                  </div>
                ))}
                {dayEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    title="Edit or delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      setForm({ ...entry, date: dateKey(entry.date), hours: String(entry.hours) });
                    }}
                  >
                    {TIME_CATEGORIES.find((item) => item.id === entry.category)?.label || entry.category} {entry.hours}h
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-5 space-y-3 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {form.id ? 'Edit time' : 'Add time'} · {form.date}
            </h3>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Category</label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              {TIME_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
            <label className="block text-sm text-gray-600 dark:text-gray-300">Hours</label>
            <input
              type="number"
              min="0.25"
              step="0.25"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              value={form.hours}
              onChange={(event) => setForm((prev) => ({ ...prev, hours: event.target.value }))}
            />
            {form.category === 'pto' && (
              <button
                type="button"
                className="text-sm text-primary-600"
                onClick={() => setForm((prev) => ({ ...prev, hours: String(dailyCapacity) }))}
              >
                Full day ({dailyCapacity.toFixed(1)} h)
              </button>
            )}
            <label className="block text-sm text-gray-600 dark:text-gray-300">Title</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <label className="block text-sm text-gray-600 dark:text-gray-300">Notes</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
            {entries.some((entry) => dateKey(entry.date) === form.date) && !form.id && (
              <div className="text-xs text-gray-500 space-y-1">
                {entries.filter((entry) => dateKey(entry.date) === form.date).map((entry) => (
                  <div key={entry.id} className="flex justify-between gap-2">
                    <button type="button" className="underline" onClick={() => setForm({ ...entry, hours: String(entry.hours) })}>
                      Edit {TIME_CATEGORIES.find((item) => item.id === entry.category)?.label} {entry.hours}h
                    </button>
                    <button type="button" className="text-danger-600" onClick={() => deleteEntry(entry.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              {form.id && (
                <button type="button" className="px-3 py-2 text-danger-600" onClick={() => { deleteEntry(form.id); setForm(null); }}>
                  Delete
                </button>
              )}
              <button type="button" className="px-3 py-2" onClick={() => setForm(null)}>Cancel</button>
              <button type="button" className="px-3 py-2 rounded-lg bg-primary-600 text-white" onClick={saveForm}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
