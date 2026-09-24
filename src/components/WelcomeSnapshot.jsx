import React, { useEffect, useState } from 'react';
import { buildProductivityReport, isSampleProject } from '../services/ProductivityMetricsService';

const { electronAPI } = window;

function thisMonthRange() {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0)
  };
}

export default function WelcomeSnapshot({ projects = [], onOpenReport }) {
  const [report, setReport] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [settingsResult, calendarResult] = await Promise.all([
          electronAPI?.settingsLoad?.(),
          electronAPI?.timeCalendarLoad?.()
        ]);
        if (!active) return;
        const { startDate, endDate } = thisMonthRange();
        setReport(buildProductivityReport({
          projects: (projects || []).filter((project) => !isSampleProject(project)),
          entries: calendarResult?.entries || [],
          userName: settingsResult?.data?.workloadSettings?.userName || '',
          startDate,
          endDate,
          weeklyCapacity: settingsResult?.data?.workloadSettings?.weeklyCapacity || 40
        }));
      } catch (error) {
        console.error('Could not build the welcome snapshot:', error);
      }
    })();
    return () => { active = false; };
  }, [projects]);

  const monthLabel = new Date().toLocaleString('en-US', { month: 'long' });
  const openCount = (projects || []).filter((project) => (
    !isSampleProject(project) && String(project.rfaStatus || '').toLowerCase() !== 'completed'
  )).length;
  const percent = (value) => (value == null ? '—' : `${Math.round(value)}%`);
  const score = percent(report?.score);
  const missingByProject = [];
  const missingSeen = new Map();
  (report?.missing || []).forEach((item) => {
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

  const tiles = [
    [score, `${monthLabel} logged work`],
    [report ? String(report.schedule.length) : '—', 'Completed this month'],
    [percent(report?.rdHitRate), 'RD hit rate'],
    [percent(report?.ecdHitRate), 'ECD hit rate'],
    [String(openCount), 'Open projects'],
    [report ? `${(report.meetingsWorked || 0).toFixed(1)} h` : '—', 'Meetings this month']
  ];

  return (
    <div className="mt-12 w-full max-w-4xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {tiles.map(([value, label]) => (
          <div key={label} className="flex flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur-lg border border-white/10">
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-xs uppercase tracking-wider opacity-70 mt-1 font-semibold text-center">{label}</span>
          </div>
        ))}
      </div>
      {missingByProject.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-left border border-white/10">
          <div className="text-xs uppercase tracking-wider opacity-70 font-semibold">Still need hours</div>
          <ul className="mt-2 space-y-1">
            {missingByProject.slice(0, 4).map((item) => (
              <li key={item.projectId || item.projectName} className="text-sm">
                <span className="font-semibold">{item.projectName}</span>
                <span className="opacity-80"> · {item.phases.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenReport}
        className="mt-4 text-sm font-semibold text-white underline underline-offset-4"
      >
        Open the {monthLabel} analytics report
      </button>
    </div>
  );
}
