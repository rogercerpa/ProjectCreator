import React from 'react';
import { useUploadContext, UPLOAD_TYPES, UPLOAD_STATUS } from '../../contexts/UploadContext';

/**
 * UploadBadge - Shows upload status on project cards
 * Displays when a project is uploading or queued for upload
 */
const UploadBadge = ({ projectId, compact = false }) => {
  const { getProjectUploadStatus, UPLOAD_TYPES: types } = useUploadContext();
  
  const uploadStatus = getProjectUploadStatus(projectId);
  
  // Don't render if no upload status for this project
  if (!uploadStatus) return null;
  
  // Get display info based on upload type and status
  const getDisplayInfo = () => {
    const isActive = uploadStatus.status === UPLOAD_STATUS.UPLOADING;
    const isQueued = uploadStatus.status === UPLOAD_STATUS.QUEUED;
    const isComplete = uploadStatus.status === UPLOAD_STATUS.COMPLETE;
    const isError = uploadStatus.status === UPLOAD_STATUS.ERROR;
    
    if (isActive) {
      switch (uploadStatus.type) {
        case UPLOAD_TYPES.DAS:
          return {
            icon: '📤',
            label: compact ? 'DAS...' : 'Uploading to DAS Drive',
            color: 'primary',
            animate: true
          };
        case UPLOAD_TYPES.SHAREPOINT:
        case UPLOAD_TYPES.ONEDRIVE:
          return {
            icon: '☁️',
            label: compact ? 'Cloud...' : 'Uploading to SharePoint',
            color: 'blue',
            animate: true
          };
        default:
          return {
            icon: '📁',
            label: compact ? 'Uploading...' : 'Uploading',
            color: 'gray',
            animate: true
          };
      }
    }
    
    if (isQueued) {
      return {
        icon: '⏳',
        label: compact ? 'Queued' : 'Queued for upload',
        color: 'gray',
        animate: false
      };
    }
    
    if (isComplete) {
      return {
        icon: '✅',
        label: compact ? 'Done' : 'Upload complete',
        color: 'success',
        animate: false
      };
    }
    
    if (isError) {
      return {
        icon: '❌',
        label: compact ? 'Failed' : 'Upload failed',
        color: 'error',
        animate: false
      };
    }
    
    return null;
  };
  
  const info = getDisplayInfo();
  if (!info) return null;
  
  const colorClasses = {
    primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800',
    error: 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300 border-error-200 dark:border-error-800'
  };
  
  if (compact) {
    // Compact badge for tight spaces
    return (
      <span 
        className={`
          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border
          ${colorClasses[info.color]}
          ${info.animate ? 'animate-pulse' : ''}
        `}
        title={info.label}
      >
        <span>{info.icon}</span>
        {uploadStatus.progress > 0 && uploadStatus.status === UPLOAD_STATUS.UPLOADING && (
          <span>{uploadStatus.progress}%</span>
        )}
      </span>
    );
  }
  
  // Full badge with progress
  return (
    <div 
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-lg border
        ${colorClasses[info.color]}
        ${info.animate ? 'animate-pulse' : ''}
      `}
    >
      <span className="text-sm">{info.icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate">{info.label}</span>
        {uploadStatus.status === UPLOAD_STATUS.UPLOADING && uploadStatus.progress > 0 && (
          <div className="mt-1">
            <div className="h-1 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-current opacity-70 transition-all duration-300"
                style={{ width: `${uploadStatus.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {uploadStatus.status === UPLOAD_STATUS.UPLOADING && uploadStatus.progress > 0 && (
        <span className="text-xs font-bold">{uploadStatus.progress}%</span>
      )}
    </div>
  );
};

export default UploadBadge;
