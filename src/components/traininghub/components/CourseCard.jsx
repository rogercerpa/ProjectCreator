import React from 'react';
import ScoreBadge from './ScoreBadge';
import { deriveStatus, difficultyLabel } from '../utils';

const CourseCard = ({ course, categoryMeta, courseProgress, onStart, onEdit }) => {
  const status = deriveStatus(course, courseProgress);
  const bestScore = courseProgress?.bestScore || 0;
  const isDone = status === 'passed';

  const ctaLabel = status === 'not-started'
    ? 'Start course'
    : status === 'passed'
      ? 'Review / retake'
      : status === 'needs-refresh'
        ? 'Refresh course'
        : 'Continue';

  return (
    <div className="group flex flex-col rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span className="text-base">{categoryMeta?.icon || '📘'}</span>
            {categoryMeta?.label || course.category}
          </span>
          <div className="flex items-center gap-2">
            <ScoreBadge status={status} />
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(course); }}
                title="Edit course"
                className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                ✏️
              </button>
            )}
          </div>
        </div>

        <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-snug mb-1">
          {course.title}
        </h3>
        {course.summary && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{course.summary}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">⏱ {course.estimatedMinutes || 8} min</span>
          <span className="inline-flex items-center gap-1">🎯 {difficultyLabel(course.difficulty)}</span>
          {isDone && <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">Best {bestScore}%</span>}
        </div>
      </div>

      <button
        onClick={() => onStart(course)}
        className="w-full px-5 py-3 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 border-t border-gray-100 dark:border-gray-700 transition-colors text-left flex items-center justify-between"
      >
        {ctaLabel}
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </button>
    </div>
  );
};

export default CourseCard;
