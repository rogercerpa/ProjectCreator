import React from 'react';
import { getVersionDisplay } from '../utils/version';
import logoUrl from '/assets/images/logo.png';
import ThemeToggle from './ThemeToggle';

function Header() {
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

        {/* Right section - Version and Theme Toggle */}
        <div className="flex items-center gap-6">
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
