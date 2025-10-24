import React from 'react';
import { getFullVersionInfo, getVersionDisplay, BUILD_INFO } from '../../utils/version';

function AppInfoTab({ onLaunchOnboarding }) {
  return (
    <div className="space-y-6">
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

