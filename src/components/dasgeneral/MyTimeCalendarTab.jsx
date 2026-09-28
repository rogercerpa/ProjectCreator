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

const CALENDAR_VIEWS = [
  { id: 'day', label: 'Day' },
  { id: 'workweek', label: 'Work week' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' }
];

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function startOfWeek(date, weekStartsOn) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const delta = (next.getDay() - weekStartsOn + 7) % 7;
  next.setDate(next.getDate() - delta);
  return next;
}

function visibleDays(focus, view) {
  if (view === 'day') return [new Date(focus.getFullYear(), focus.getMonth(), focus.getDate())];
  if (view === 'week') {
    const start = startOfWeek(focus, 0);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  if (view === 'month') {
    const count = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => new Date(focus.getFullYear(), focus.getMonth(), index + 1));
  }
  const start = startOfWeek(focus, 1);
  return Array.from({ length: 5 }, (_, index) => addDays(start, index));
}

function shiftFocus(focus, view, direction) {
  if (view === 'day') return addDays(focus, direction);
  if (view === 'month') return new Date(focus.getFullYear(), focus.getMonth() + direction, 1);
  return addDays(focus, direction * 7);
}

function rangeLabel(days, view) {
  if (view === 'month') {
    return days[0].toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }
  if (view === 'day') {
    return days[0].toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  const start = days[0];
  const end = days[days.length - 1];
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endText = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} – ${endText}`;
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
  const [focus, setFocus] = useState(today);
  const [calendarView, setCalendarView] = useState('workweek');
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [userName, setUserName] = useState('');
  const [weeklyCapacity, setWeeklyCapacity] = useState(40);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [customCategories, setCustomCategories] = useState([]);
  const [showCategories, setShowCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
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
        setCustomCategories(calendarResult?.customCategories || []);
      } catch (err) {
        if (active) setError(err.message || 'Could not load your calendar.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const scoreStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const scoreEnd = new Date(focus.getFullYear(), focus.getMonth() + 1, 0);
  const dailyCapacity = (Number(weeklyCapacity) || 40) / 5;
  const report = useMemo(() => buildProductivityReport({
    projects,
    entries,
    userName,
    startDate: scoreStart,
    endDate: scoreEnd,
    weeklyCapacity
  }), [projects, entries, userName, scoreStart, scoreEnd, weeklyCapacity]);

  const days = useMemo(() => visibleDays(focus, calendarView), [focus, calendarView]);
  const columns = calendarView === 'workweek' ? 5 : (calendarView === 'day' ? 1 : 7);
  const chips = useMemo(() => collectPhaseChips(projects, userName), [projects, userName]);

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

  const categoryOptions = [...TIME_CATEGORIES, ...customCategories];
  const categoryLabel = (id) => categoryOptions.find((item) => item.id === id)?.label || id;

  const saveCategories = async (next) => {
    const result = await electronAPI.timeCalendarSaveCategories(next);
    if (!result?.success) {
      setError(result?.error || 'Could not save categories.');
      return;
    }
    setCustomCategories(result.customCategories || []);
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
      <div className="flex justify-end">
        <button type="button" className="text-sm text-primary-600" onClick={() => setShowCategories(true)}>
          Edit categories
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
          onClick={() => setFocus((prev) => shiftFocus(prev, calendarView, -1))}
        >
          Previous
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {rangeLabel(days, calendarView)}
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
              onClick={() => setViewMenuOpen((open) => !open)}
            >
              {CALENDAR_VIEWS.find((item) => item.id === calendarView)?.label}
            </button>
            {viewMenuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {CALENDAR_VIEWS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setCalendarView(item.id);
                      setViewMenuOpen(false);
                    }}
                  >
                    {item.id === calendarView ? '✓ ' : ''}{item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
            onClick={() => setFocus((prev) => shiftFocus(prev, calendarView, 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid gap-1 text-xs text-gray-500 dark:text-gray-400" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {(calendarView === 'month'
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          : days.map((day) => day.toLocaleDateString('en-US', { weekday: 'short' }))
        ).map((label) => (
          <div key={label} className="px-1 py-1 text-center">{label}</div>
        ))}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {calendarView === 'month' && days[0] && Array.from({ length: days[0].getDay() }, (_, index) => (
          <div key={`lead-${index}`} className="min-h-24" />
        ))}
        {days.map((day) => {
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
                    {categoryLabel(entry.category)} {entry.hours}h
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
              {categoryOptions.map((category) => (
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
                      Edit {categoryLabel(entry.category)} {entry.hours}h
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
      {showCategories && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Categories</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Work meeting, agency calls, initiative, training, email responses, and PTO stay in the list. Extra categories count as logged work.
            </p>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
              {TIME_CATEGORIES.map((category) => (
                <li key={category.id}>{category.label}</li>
              ))}
            </ul>
            <ul className="space-y-2">
              {customCategories.map((category) => (
                <li key={category.id} className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                    value={category.label}
                    onChange={(event) => setCustomCategories((prev) => prev.map((item) => (
                      item.id === category.id ? { ...item, label: event.target.value } : item
                    )))}
                  />
                  <button
                    type="button"
                    className="text-sm text-danger-600"
                    onClick={() => saveCategories(customCategories.filter((item) => item.id !== category.id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                placeholder="New category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-1 text-sm text-white"
                onClick={() => {
                  const label = newCategory.trim();
                  if (!label) return;
                  saveCategories([...customCategories, { label }]);
                  setNewCategory('');
                }}
              >
                Add
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 text-sm" onClick={() => setShowCategories(false)}>Close</button>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-2 text-sm text-white"
                onClick={async () => {
                  await saveCategories(customCategories);
                  setShowCategories(false);
                }}
              >
                Save names
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
