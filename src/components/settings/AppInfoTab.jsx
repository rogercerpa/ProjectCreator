import React, { useEffect, useRef, useState } from 'react';
import { getFullVersionInfo, getVersionDisplay, BUILD_INFO } from '../../utils/version';
import ErrorReportTab from './ErrorReportTab';

function AppInfoTab({ onLaunchOnboarding, setupChecklist = [], initialErrorId = null }) {
  const remainingSetupItems = setupChecklist.filter(item => !item.done);
  const [isChecklistOpen, setIsChecklistOpen] = useState(() => remainingSetupItems.length > 0);
  // Auto-expand the Error Report section when deep-linked to a specific error
  // (e.g. clicking "View Details" on a persistent error banner elsewhere in the app).
  const [isErrorReportOpen, setIsErrorReportOpen] = useState(() => Boolean(initialErrorId));
  const errorReportSectionRef = useRef(null);

  useEffect(() => {
    setIsChecklistOpen(remainingSetupItems.length > 0);
  }, [remainingSetupItems.length]);

  useEffect(() => {
    if (initialErrorId) {
      setIsErrorReportOpen(true);
      errorReportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [initialErrorId]);

  return (
    <div className="space-y-6">
      {setupChecklist.length > 0 && (
        <div className="p-4 rounded-lg border border-info-200 dark:border-info-800 bg-info-50 dark:bg-info-900/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">First-Run Setup Checklist</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {remainingSetupItems.length === 0
                  ? 'All setup items are complete. Expand this if you want to review them.'
                  : 'Finish these setup items to make the app ready for daily use.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${remainingSetupItems.length === 0 ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300' : 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'}`}>
                {remainingSetupItems.length === 0 ? 'Ready to go' : `${remainingSetupItems.length} setup item${remainingSetupItems.length === 1 ? '' : 's'} left`}
              </span>
              <button
                type="button"
                onClick={() => setIsChecklistOpen(prev => !prev)}
                className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-all"
                aria-expanded={isChecklistOpen}
              >
                {isChecklistOpen ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {isChecklistOpen && (
            <div className="space-y-2 mt-3">
              {setupChecklist.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.done ? '✅' : '⚠️'} {item.label}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{item.help}</p>
                  </div>
                  {!item.done && (
                    <button
                      type="button"
                      onClick={item.action}
                      className="px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-all"
                    >
                      {item.actionLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Application Information Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Application Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Version:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{getVersionDisplay()}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Full Version:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{getFullVersionInfo()}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Build Date:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{new Date(BUILD_INFO.buildDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Environment:</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{BUILD_INFO.environment}</span>
          </div>
        </div>
      </div>

      {/* Error Report & Diagnostics Section */}
      <div ref={errorReportSectionRef} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">🐞 Error Report & Diagnostics</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Having a problem? View recorded errors or download a report to share with the software team.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsErrorReportOpen(prev => !prev)}
            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-all whitespace-nowrap"
            aria-expanded={isErrorReportOpen}
          >
            {isErrorReportOpen ? 'Hide' : 'Show'}
          </button>
        </div>
        {isErrorReportOpen && (
          <div className="mt-4">
            <ErrorReportTab selectedErrorId={initialErrorId} />
          </div>
        )}
      </div>

      {/* Onboarding Tutorial Section */}
      <div className="p-6 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border-2 border-primary-200 dark:border-primary-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span>🎓</span>
          <span>Onboarding Tutorial</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Learn how to use Project Creator with our interactive tutorial. Perfect for new users or as a refresher.
        </p>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <span className="text-3xl flex-shrink-0">📚</span>
              <div>
                <strong className="text-sm font-semibold text-gray-900 dark:text-white block">6 Quick Steps</strong>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Learn the main features in just a few minutes</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <span className="text-3xl flex-shrink-0">🚀</span>
              <div>
                <strong className="text-sm font-semibold text-gray-900 dark:text-white block">Interactive Walkthroughs</strong>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">See how to use the wizard, projects, agencies, and more</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
              <span className="text-3xl flex-shrink-0">💡</span>
              <div>
                <strong className="text-sm font-semibold text-gray-900 dark:text-white block">Practical Tips</strong>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Get actionable advice for each feature</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button 
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center gap-2"
              onClick={() => {
                if (onLaunchOnboarding) {
                  onLaunchOnboarding();
                }
              }}
            >
              <span>🎉</span>
              <span>Launch Tutorial</span>
            </button>

            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              💡 You can exit the tutorial at any time by clicking the X button or "Skip Tutorial"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppInfoTab;

