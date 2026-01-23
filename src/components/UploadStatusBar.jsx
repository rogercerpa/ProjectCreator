import React, { useState } from 'react';
import { useUploadContext, UPLOAD_TYPES, UPLOAD_STATUS } from '../contexts/UploadContext';

/**
 * UploadStatusBar - Compact header status bar showing upload progress
 * Allows users to see upload status while continuing to use the app
 */
const UploadStatusBar = () => {
  const {
    activeUpload,
    uploadQueue,
    completedUploads,
    hasActiveUpload,
    hasQueuedUploads,
    totalPendingUploads,
    dismissCompletedUpload
  } = useUploadContext();

  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if nothing to show
  if (!hasActiveUpload && !hasQueuedUploads && completedUploads.length === 0) {
    return null;
  }

  // Get upload type display info
  const getUploadTypeInfo = (type) => {
    switch (type) {
      case UPLOAD_TYPES.DAS:
        return { icon: '📤', label: 'DAS Drive', color: 'primary' };
      case UPLOAD_TYPES.SHAREPOINT:
      case UPLOAD_TYPES.ONEDRIVE:
        return { icon: '☁️', label: 'SharePoint', color: 'blue' };
      default:
        return { icon: '📁', label: 'Upload', color: 'gray' };
    }
  };

  // Get phase display
  const getPhaseDisplay = (upload) => {
    if (!upload) return '';
    
    switch (upload.phase) {
      case 'checking':
        return 'Checking...';
      case 'preparing':
        return 'Preparing...';
      case 'copying':
        return upload.currentFile ? `Copying: ${upload.currentFile}` : 'Copying files...';
      case 'zipping':
        return 'Compressing...';
      case 'syncing':
        return 'Syncing...';
      case 'complete':
        return 'Complete!';
      default:
        return upload.message || 'Processing...';
    }
  };

  // Truncate project name for compact display
  const truncateName = (name, maxLength = 25) => {
    if (!name || name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  const activeInfo = activeUpload ? getUploadTypeInfo(activeUpload.type) : null;

  return (
    <div className="relative">
      {/* Compact status bar */}
      <div 
        className={`
          flex items-center gap-3 px-4 py-2 
          bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800
          border-b border-gray-200 dark:border-gray-600
          cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700
          transition-all duration-200
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Active upload indicator */}
        {hasActiveUpload && activeUpload && (
          <>
            {/* Animated icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-lg animate-pulse">{activeInfo?.icon}</span>
            </div>

            {/* Upload info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {truncateName(activeUpload.projectName)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  → {activeInfo?.label}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {getPhaseDisplay(activeUpload)}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-32 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${activeUpload.progress || 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400 w-10 text-right">
                  {activeUpload.progress || 0}%
                </span>
              </div>
            </div>

            {/* Queue indicator */}
            {hasQueuedUploads && (
              <div className="flex-shrink-0 px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  +{uploadQueue.length} queued
                </span>
              </div>
            )}
          </>
        )}

        {/* No active upload but has completed */}
        {!hasActiveUpload && completedUploads.length > 0 && (
          <div className="flex items-center gap-3 flex-1">
            {completedUploads[0].status === UPLOAD_STATUS.COMPLETE ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
                  <span className="text-lg">✅</span>
                </div>
                <span className="text-sm font-medium text-success-700 dark:text-success-400">
                  Upload complete: {truncateName(completedUploads[0].projectName)}
                </span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
                  <span className="text-lg">❌</span>
                </div>
                <span className="text-sm font-medium text-error-700 dark:text-error-400">
                  Upload failed: {truncateName(completedUploads[0].projectName)}
                </span>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissCompletedUpload(completedUploads[0].id);
              }}
              className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* Expand/collapse indicator */}
        <div className="flex-shrink-0 text-gray-400 dark:text-gray-500">
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded details panel */}
      {isExpanded && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-b-lg overflow-hidden">
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
            {/* Active upload details */}
            {activeUpload && (
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                    <span className="text-xl animate-pulse">{activeInfo?.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {activeUpload.projectName}
                      </span>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                        {activeUpload.progress || 0}%
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Uploading to {activeInfo?.label}
                    </div>
                    <div className="mt-2">
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300"
                          style={{ width: `${activeUpload.progress || 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {getPhaseDisplay(activeUpload)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Queued uploads */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Queued ({uploadQueue.length})
                </h4>
                {uploadQueue.map((upload) => {
                  const info = getUploadTypeInfo(upload.type);
                  return (
                    <div 
                      key={upload.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <span className="text-lg opacity-50">{info.icon}</span>
                      <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 truncate">
                        {upload.projectName}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        → {info.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed uploads */}
            {completedUploads.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Recent
                </h4>
                {completedUploads.map((upload) => {
                  const info = getUploadTypeInfo(upload.type);
                  const isSuccess = upload.status === UPLOAD_STATUS.COMPLETE;
                  return (
                    <div 
                      key={upload.id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        isSuccess 
                          ? 'bg-success-50 dark:bg-success-900/20' 
                          : 'bg-error-50 dark:bg-error-900/20'
                      }`}
                    >
                      <span className="text-lg">{isSuccess ? '✅' : '❌'}</span>
                      <span className={`flex-1 text-sm truncate ${
                        isSuccess 
                          ? 'text-success-700 dark:text-success-300' 
                          : 'text-error-700 dark:text-error-300'
                      }`}>
                        {upload.projectName}
                      </span>
                      <button
                        onClick={() => dismissCompletedUpload(upload.id)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!activeUpload && uploadQueue.length === 0 && completedUploads.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                No uploads in progress
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadStatusBar;
