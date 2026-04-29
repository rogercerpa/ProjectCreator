import React from 'react';
import { getVersionDisplay } from '../utils/version';
import logoUrl from '/assets/images/logo.png';
import ThemeToggle from './ThemeToggle';
import UploadStatusBar from './UploadStatusBar';

function Header({
  isAssistantVisible = false,
  onToggleAssistant
}) {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm relative z-[100]">
      <div className="flex items-center justify-between px-8 py-4 max-w-screen-2xl mx-auto">
        {/* Left section - Logo and Title */}
        <div className="flex items-center gap-4">
          <img 
            src={logoUrl} 
            alt="Project Creator Logo" 
            className="w-10 h-10 rounded-lg object-cover shadow-md"
          />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 leading-tight">
              Project Creator
            </h1>
          </div>
        </div>

        {/* Center section - Upload Status Bar */}
        <div className="flex-1 mx-8">
          <UploadStatusBar />
        </div>

        {/* Right section - Version and Theme Toggle */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={onToggleAssistant}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isAssistantVisible
                ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label={isAssistantVisible ? 'Hide assistant panel' : 'Show assistant panel'}
            title={isAssistantVisible ? 'Hide assistant panel' : 'Show assistant panel'}
          >
            <span className="text-base">🤖</span>
            <span className="hidden md:inline">{isAssistantVisible ? 'Hide AI' : 'Show AI'}</span>
          </button>
          <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm font-medium font-mono">
            {getVersionDisplay()}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default Header;
