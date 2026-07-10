// Shared helpers for the Training Hub UI.

export const SKILL_LEVELS = [
  { label: 'No Knowledge', badge: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  { label: 'Basic', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { label: 'Intermediate', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { label: 'Advanced', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { label: 'Expert', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { label: 'Master', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
];

export function levelLabel(level) {
  return SKILL_LEVELS[level]?.label || SKILL_LEVELS[0].label;
}

export function levelBadgeClass(level) {
  return SKILL_LEVELS[level]?.badge || SKILL_LEVELS[0].badge;
}

/**
 * Derive the display status of a course from its catalog entry and the user's
 * stored progress. Adds a "needs-refresh" state when a passed course has been
 * updated to a newer version since it was last passed.
 */
export function deriveStatus(catalogCourse, courseProgress) {
  if (!courseProgress || courseProgress.status === 'not-started') return 'not-started';

  if (courseProgress.status === 'passed') {
    const currentVersion = catalogCourse?.version || 1;
    const passedVersion = courseProgress.passedVersion || courseProgress.courseVersion || 1;
    if (currentVersion > passedVersion) return 'needs-refresh';
    return 'passed';
  }

  return 'in-progress';
}

export const STATUS_META = {
  'not-started': { label: 'Not started', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
  'in-progress': { label: 'In progress', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500' },
  'passed': { label: 'Passed', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
  'needs-refresh': { label: 'Needs refresh', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500' }
};

export function difficultyLabel(difficulty) {
  if (difficulty >= 3) return 'Advanced';
  if (difficulty === 2) return 'Intermediate';
  return 'Introductory';
}
