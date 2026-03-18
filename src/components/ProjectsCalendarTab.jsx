import React, { useEffect, useMemo, useState } from 'react';

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 17;
const DAYS_IN_WEEK_VIEW = 5;
const HOUR_ROW_HEIGHT = 68;

const DATE_BASIS_OPTIONS = [
  { value: 'requestedDate', label: 'Requested Date' },
  { value: 'ecd', label: 'ECD Date' },
  { value: 'engineerExpectedCompleteDate', label: 'Expected Ready for QC' }
];

function startOfWeekMonday(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDayLabel(dateLike) {
  return new Date(dateLike).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function clampWorkday(dateLike) {
  const date = new Date(dateLike);
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  if (date.getDay() === 6) date.setDate(date.getDate() + 2);

  const hours = date.getHours() + (date.getMinutes() / 60);
  if (hours < WORKDAY_START_HOUR) {
    date.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  } else if (hours >= WORKDAY_END_HOUR) {
    date.setHours(WORKDAY_END_HOUR - 1, 0, 0, 0);
  }

  return date;
}

function buildDropDate(weekStart, dayIndex, hour) {
  const target = addDays(weekStart, dayIndex);
  target.setHours(hour, 0, 0, 0);
  return clampWorkday(target);
}

function calendarEventTitle(project) {
  if (!project) return 'Untitled project';
  return project.projectName || `Project ${project.rfaNumber || ''}`.trim();
}

function getProjectDurationHours(project) {
  const raw = Number(project?.totalTriage ?? project?.triageResults?.totalTriage ?? 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

function ProjectsCalendarTab({
  projects,
  onProjectSelect,
  onProjectUpdate
}) {
  const [calendarMode, setCalendarMode] = useState('expected');
  const [dateBasis, setDateBasis] = useState('engineerExpectedCompleteDate');
  const [userScope, setUserScope] = useState('multi');
  const [selectedUser, setSelectedUser] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [sharedEntries, setSharedEntries] = useState({});
  const [activeDragProjectId, setActiveDragProjectId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [isLoadingShared, setIsLoadingShared] = useState(false);

  const dayHeaders = useMemo(
    () => Array.from({ length: DAYS_IN_WEEK_VIEW }, (_, idx) => addDays(weekStart, idx)),
    [weekStart]
  );

  const usersFromProjects = useMemo(() => {
    const names = new Set();
    (projects || []).forEach((project) => {
      if (project?.designBy) names.add(project.designBy);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  const effectiveSelectedUser = selectedUser || currentUserName || usersFromProjects[0] || '';

  useEffect(() => {
    let cancelled = false;

    const loadSettingsAndShared = async () => {
      setIsLoadingShared(true);
      try {
        if (window.electronAPI?.settingsLoad) {
          const settingsResult = await window.electronAPI.settingsLoad();
          if (!cancelled && settingsResult?.success) {
            const configuredName = settingsResult?.data?.workloadSettings?.userName || '';
            setCurrentUserName(configuredName);
            if (configuredName && !selectedUser) {
              setSelectedUser(configuredName);
            }
          }
        }

        if (window.electronAPI?.sharedCalendarLoad) {
          const sharedResult = await window.electronAPI.sharedCalendarLoad();
          if (!cancelled && sharedResult?.success) {
            setSharedEntries(sharedResult.entries || {});
          }
        }
      } catch (error) {
        if (!cancelled) {
          setSaveError(`Unable to load shared calendar: ${error.message}`);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingShared(false);
        }
      }
    };

    loadSettingsAndShared();

    let unsubscribe = null;
    if (window.electronAPI?.onSharedCalendarChanged) {
      unsubscribe = window.electronAPI.onSharedCalendarChanged((data) => {
        setSharedEntries(data?.entries || {});
      });
    }

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [selectedUser]);

  const mergedProjects = useMemo(() => {
    const safeProjects = Array.isArray(projects) ? projects : [];
    return safeProjects.map((project) => {
      const overlay = sharedEntries?.[project.id] || null;
      return overlay ? { ...project, ...overlay } : project;
    });
  }, [projects, sharedEntries]);

  const visibleProjects = useMemo(() => {
    let filtered = mergedProjects;

    if (userScope === 'single' && effectiveSelectedUser) {
      filtered = filtered.filter((project) => (project.designBy || '') === effectiveSelectedUser);
    }

    return filtered;
  }, [mergedProjects, userScope, effectiveSelectedUser]);

  const events = useMemo(() => {
    return visibleProjects
      .map((project) => {
        const dateField = calendarMode === 'schedule' ? 'engineerExpectedCompleteDate' : dateBasis;
        const startDate = toDateOrNull(project?.[dateField]);
        if (!startDate) return null;

        return {
          project,
          start: clampWorkday(startDate),
          durationHours: getProjectDurationHours(project)
        };
      })
      .filter(Boolean);
  }, [visibleProjects, calendarMode, dateBasis]);

  const eventsInWeek = useMemo(() => {
    const weekEnd = addDays(weekStart, DAYS_IN_WEEK_VIEW);
    return events.filter(({ start }) => start >= weekStart && start < weekEnd && start.getDay() >= 1 && start.getDay() <= 5);
  }, [events, weekStart]);

  const updateProjectExpectedDate = async (project, targetDate) => {
    if (!project?.id || !targetDate || typeof onProjectUpdate !== 'function') return;

    const safeDate = clampWorkday(targetDate).toISOString();
    setSaveError('');

    try {
      await onProjectUpdate(project.id, {
        engineerExpectedCompleteDate: safeDate
      });
    } catch (error) {
      setSaveError(`Failed to update project date: ${error.message}`);
    }
  };

  const onExpectedDrop = async (event, dayIndex) => {
    event.preventDefault();
    if (!activeDragProjectId) return;

    const project = visibleProjects.find((entry) => entry.id === activeDragProjectId);
    setActiveDragProjectId(null);
    if (!project) return;

    const existingDate = toDateOrNull(project.engineerExpectedCompleteDate);
    const target = addDays(weekStart, dayIndex);
    if (existingDate) {
      target.setHours(existingDate.getHours(), existingDate.getMinutes(), 0, 0);
    } else {
      target.setHours(WORKDAY_START_HOUR, 0, 0, 0);
    }

    await updateProjectExpectedDate(project, target);
  };

  const onScheduleDrop = async (event, dayIndex, hour) => {
    event.preventDefault();
    if (!activeDragProjectId) return;

    const project = visibleProjects.find((entry) => entry.id === activeDragProjectId);
    setActiveDragProjectId(null);
    if (!project) return;

    const target = buildDropDate(weekStart, dayIndex, hour);
    await updateProjectExpectedDate(project, target);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-700 p-1">
            <button
              onClick={() => setCalendarMode('expected')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${calendarMode === 'expected'
                ? 'bg-white dark:bg-gray-500 text-primary-600 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Expected Date View
            </button>
            <button
              onClick={() => setCalendarMode('schedule')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${calendarMode === 'schedule'
                ? 'bg-white dark:bg-gray-500 text-primary-600 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              User Schedule View
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((prev) => addDays(prev, -7))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium"
            >
              ◀
            </button>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[180px] text-center">
              Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button
              onClick={() => setWeekStart((prev) => addDays(prev, 7))}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {calendarMode === 'expected' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Date basis</span>
              <select
                value={dateBasis}
                onChange={(e) => setDateBasis(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              >
                {DATE_BASIS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-600 dark:text-gray-300">User scope</span>
            <select
              value={userScope}
              onChange={(e) => setUserScope(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
            >
              <option value="multi">Multi User Projects</option>
              <option value="single">Single User Projects</option>
            </select>
          </label>

          {userScope === 'single' && (
            <label className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-600 dark:text-gray-300">Engineer</span>
              <select
                value={effectiveSelectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
              >
                {usersFromProjects.length === 0 && <option value="">No users found</option>}
                {usersFromProjects.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {(saveError || isLoadingShared) && (
          <div className={`text-sm px-3 py-2 rounded-lg ${saveError
            ? 'bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-300'
            : 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300'
          }`}
          >
            {saveError || 'Loading shared calendar...'}
          </div>
        )}
      </div>

      {calendarMode === 'expected' ? (
        <div className="grid grid-cols-5 gap-3 p-4">
          {dayHeaders.map((day, dayIndex) => {
            const dayEvents = eventsInWeek.filter((entry) =>
              entry.start.toDateString() === day.toDateString()
            );

            return (
              <div
                key={day.toISOString()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onExpectedDrop(event, dayIndex)}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 min-h-[280px]"
              >
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-700 dark:text-gray-200">
                  {formatDayLabel(day)}
                </div>
                <div className="p-2 space-y-2">
                  {dayEvents.length === 0 && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 p-2">No projects</div>
                  )}
                  {dayEvents.map(({ project, start, durationHours }) => (
                    <button
                      key={project.id}
                      draggable
                      onDragStart={() => setActiveDragProjectId(project.id)}
                      onClick={() => onProjectSelect(project)}
                      className="w-full text-left px-2.5 py-2 rounded-lg bg-white dark:bg-gray-800 border border-primary-200 dark:border-primary-700 hover:shadow-sm transition-all"
                      title="Click to open project details. Drag to move day."
                    >
                      <div className="text-xs font-bold text-primary-600 dark:text-primary-400 truncate">
                        {project.rfaNumber || 'No RFA'}
                      </div>
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {calendarEventTitle(project)}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {durationHours.toFixed(1)}h
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4">
          <div
            className="grid border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            style={{ gridTemplateColumns: `72px repeat(${DAYS_IN_WEEK_VIEW}, minmax(0, 1fr))` }}
          >
            <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700" />
            {dayHeaders.map((day) => (
              <div
                key={day.toISOString()}
                className="px-2 py-2 text-center text-sm font-bold bg-gray-100 dark:bg-gray-900 border-b border-l border-gray-200 dark:border-gray-700"
              >
                {formatDayLabel(day)}
              </div>
            ))}

            {Array.from({ length: WORKDAY_END_HOUR - WORKDAY_START_HOUR }, (_, idx) => WORKDAY_START_HOUR + idx).map((hour) => (
              <React.Fragment key={hour}>
                <div className="px-2 py-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700">
                  {new Date(2020, 0, 1, hour).toLocaleTimeString('en-US', { hour: 'numeric' })}
                </div>
                {dayHeaders.map((day, dayIndex) => (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="relative border-l border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onScheduleDrop(event, dayIndex, hour)}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>

          <div
            className="pointer-events-none relative -mt-[544px] ml-[72px]"
            style={{ height: `${(WORKDAY_END_HOUR - WORKDAY_START_HOUR) * HOUR_ROW_HEIGHT}px` }}
          >
            {eventsInWeek.map(({ project, start, durationHours }) => {
              const dayIndex = start.getDay() - 1;
              const startDecimal = start.getHours() + (start.getMinutes() / 60);
              const top = (startDecimal - WORKDAY_START_HOUR) * HOUR_ROW_HEIGHT;
              const normalizedDuration = Math.min(Math.max(durationHours, 0.5), 8);
              const height = Math.max(34, (normalizedDuration * HOUR_ROW_HEIGHT) - 6);

              return (
                <button
                  key={project.id}
                  draggable
                  onDragStart={() => setActiveDragProjectId(project.id)}
                  onClick={() => onProjectSelect(project)}
                  className="pointer-events-auto absolute px-2 py-1 rounded-lg bg-primary-500/90 hover:bg-primary-600 text-white text-left shadow-md overflow-hidden"
                  style={{
                    left: `calc(${(dayIndex / DAYS_IN_WEEK_VIEW) * 100}% + 4px)`,
                    width: `calc(${(1 / DAYS_IN_WEEK_VIEW) * 100}% - 8px)`,
                    top: `${Math.max(top, 0)}px`,
                    height: `${height}px`
                  }}
                  title="Click to open project details. Drag to move time/day."
                >
                  <div className="text-[11px] font-bold truncate">{project.rfaNumber || 'No RFA'}</div>
                  <div className="text-xs font-semibold truncate">{calendarEventTitle(project)}</div>
                  <div className="text-[11px] opacity-90">
                    {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ({durationHours.toFixed(1)}h)
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsCalendarTab;
