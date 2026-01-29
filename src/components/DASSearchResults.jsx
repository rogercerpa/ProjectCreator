import React, { useState } from 'react';

/**
 * DASSearchResults - Display search results from DAS Drive
 * Shows project folders and RFA subfolders with actions
 */
function DASSearchResults({ 
  results, 
  isLoading, 
  error, 
  searchInfo,
  onOpenFolder,
  onCopyPath 
}) {
  const [copiedPath, setCopiedPath] = useState(null);

  // Handle copy path with feedback
  const handleCopyPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
      if (onCopyPath) onCopyPath(path);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  // Handle open folder
  const handleOpenFolder = async (path) => {
    if (onOpenFolder) {
      await onOpenFolder(path);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Extract project name from folder name
  const extractProjectName = (folderName) => {
    if (!folderName) return 'Unknown Project';
    // Remove container suffix like _24-16071 or  _24-16071
    const match = folderName.match(/^(.+?)(?:\s*_\d{2}-\d{4,6})?$/);
    return match ? match[1] : folderName;
  };

  // Get icon based on result type
  const getResultIcon = (result) => {
    if (result.type === 'rfa') {
      return (
        <div className="w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center text-secondary-600 dark:text-secondary-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </div>
    );
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary-200 dark:border-primary-800 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-primary-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Searching DAS Drive...
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-error-50 dark:bg-error-900/20 rounded-2xl border border-error-200 dark:border-error-800 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-error-100 dark:bg-error-900/30 flex items-center justify-center text-error-600 dark:text-error-400 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-error-700 dark:text-error-300 mb-1">Search Error</h4>
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!results || results.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-1">No Results Found</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            No matching projects found on the DAS Drive. Try a different search term.
          </p>
          {searchInfo && (
            <div className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Searched: {searchInfo.detectedType === 'container' ? 'Container' : searchInfo.detectedType === 'rfa' ? 'RFA Number' : 'Project Name'}
                {searchInfo.searchedYears && ` in ${searchInfo.searchedYears.join(', ')}`}
                {searchInfo.searchedYear && ` in ${searchInfo.searchedYear}`}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render results
  return (
    <div className="space-y-4">
      {/* Results header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success-500 animate-pulse"></div>
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
            {results.length} {results.length === 1 ? 'result' : 'results'} found on DAS Drive
          </span>
        </div>
        {searchInfo && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Detected as: {searchInfo.detectedType === 'container' ? 'Container Number' : searchInfo.detectedType === 'rfa' ? 'RFA Number' : 'Project Name'}
          </span>
        )}
      </div>

      {/* Results list */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
        {results.map((result, index) => (
          <div 
            key={`${result.path}-${index}`}
            className="group p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              {getResultIcon(result)}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white truncate" title={result.name}>
                      {result.type === 'rfa' ? result.name : extractProjectName(result.name)}
                    </h4>
                    {result.type === 'rfa' && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        Project: {extractProjectName(result.projectFolder)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {result.container && (
                      <span className="px-2 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-xs font-bold text-primary-600 dark:text-primary-400">
                        {result.container}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400">
                      {result.year}
                    </span>
                  </div>
                </div>

                {/* Path */}
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 truncate font-mono" title={result.path}>
                  {result.path}
                </p>

                {/* Metadata row */}
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                  {result.nationalAccount && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                      </svg>
                      {result.nationalAccount}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Modified: {formatDate(result.modified)}
                  </span>
                  <span className="flex items-center gap-1 capitalize">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                    </svg>
                    {result.matchedBy}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopyPath(result.path)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                  title="Copy path"
                >
                  {copiedPath === result.path ? (
                    <svg className="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleOpenFolder(result.path)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold transition-all"
                  title="Open in File Explorer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                  Open
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DASSearchResults;
