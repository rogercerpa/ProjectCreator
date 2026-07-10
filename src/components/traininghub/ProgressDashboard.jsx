import React, { useMemo } from 'react';
import ScoreBadge from './components/ScoreBadge';
import { deriveStatus, levelLabel, levelBadgeClass } from './utils';

const ProgressDashboard = ({ catalog, progress, onStart }) => {
  const courses = catalog?.courses || [];
  const categories = catalog?.categories || [];
  const progressCourses = progress?.courses || {};
  const topicScores = progress?.topicScores || {};

  const stats = useMemo(() => {
    let passed = 0;
    let inProgress = 0;
    courses.forEach(course => {
      const status = deriveStatus(course, progressCourses[course.id]);
      if (status === 'passed') passed += 1;
      else if (status === 'in-progress' || status === 'needs-refresh') inProgress += 1;
    });
    return { passed, inProgress, total: courses.length };
  }, [courses, progressCourses]);

  const recentAttempts = useMemo(() => {
    const rows = [];
    Object.entries(progressCourses).forEach(([courseId, record]) => {
      const course = courses.find(c => c.id === courseId);
      (record.attempts || []).forEach(a => {
        rows.push({ courseId, title: course?.title || courseId, ...a });
      });
    });
    return rows.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
  }, [progressCourses, courses]);

  const suggested = useMemo(() => {
    return courses.filter(c => deriveStatus(c, progressCourses[c.id]) !== 'passed').slice(0, 3);
  }, [courses, progressCourses]);

  const completion = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0;

  return (
    <div className="p-6 space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Courses passed</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.passed}<span className="text-lg text-gray-400 font-medium"> / {stats.total}</span></p>
          <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">In progress</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.inProgress}</p>
          <p className="text-xs text-gray-400 mt-2">Started or needing a refresh</p>
        </div>
        <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Overall completion</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{completion}%</p>
          <p className="text-xs text-gray-400 mt-2">Across all topics</p>
        </div>
      </div>

      {/* Topic proficiency */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Topic proficiency</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(cat => {
            const level = topicScores[cat.id]?.level || 0;
            return (
              <div key={cat.id} className="flex items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-200 inline-flex items-center gap-2">
                  <span>{cat.icon}</span>{cat.label}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${levelBadgeClass(level)}`}>
                  {levelLabel(level)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested next */}
      {suggested.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Suggested next</h3>
          <div className="space-y-2">
            {suggested.map(course => (
              <button
                key={course.id}
                onClick={() => onStart(course)}
                className="w-full flex items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 hover:shadow-md transition-shadow text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{course.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">⏱ {course.estimatedMinutes || 8} min</p>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBadge status={deriveStatus(course, progressCourses[course.id])} />
                  <span className="text-primary-500">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent attempts */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Recent attempts</h3>
        {recentAttempts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No quiz attempts yet. Complete a course to see your history here.</p>
        ) : (
          <div className="rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            {recentAttempts.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-800 dark:text-gray-100">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{a.score}%</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.passed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                    {a.passed ? 'Passed' : 'Failed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressDashboard;
