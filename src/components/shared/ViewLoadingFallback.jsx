import React from 'react';

/** Placeholder shown inside the main content area while a page chunk loads. */
export default function ViewLoadingFallback({ label = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite" className="flex h-full min-h-[240px] flex-col gap-4 p-6 animate-pulse">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-1/3 rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-2/3 rounded bg-gray-100 dark:bg-gray-700/60" />
      <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-700/60" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-700/60" />
    </div>
  );
}
