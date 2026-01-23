import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * Upload Context - Manages global upload state for background uploads
 * Enables users to continue working while uploads happen in the background
 */

// Upload types
export const UPLOAD_TYPES = {
  DAS: 'das',
  SHAREPOINT: 'sharepoint',
  ONEDRIVE: 'onedrive'
};

// Upload states
export const UPLOAD_STATUS = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  COMPLETE: 'complete',
  ERROR: 'error'
};

const UploadContext = createContext();

export function UploadProvider({ children }) {
  // Upload queue - pending uploads waiting to be processed
  const [uploadQueue, setUploadQueue] = useState([]);
  
  // Currently active upload
  const [activeUpload, setActiveUpload] = useState(null);
  
  // Completed uploads (for showing success/error state briefly)
  const [completedUploads, setCompletedUploads] = useState([]);
  
  // Error state
  const [lastError, setLastError] = useState(null);
  
  // Processing flag to prevent race conditions
  const isProcessingRef = useRef(false);

  // Set up IPC listeners for progress updates
  useEffect(() => {
    // DAS upload progress listener
    const dasCleanup = window.electronAPI?.onDasUploadProgress?.((progress) => {
      if (activeUpload?.type === UPLOAD_TYPES.DAS) {
        setActiveUpload(prev => prev ? {
          ...prev,
          progress: progress.progress || 0,
          phase: progress.phase || prev.phase,
          message: progress.message || '',
          currentFile: progress.currentFile || null
        } : null);
      }
    });

    // OneDrive/SharePoint sync progress listener
    const handleOneDriveProgress = (progressData) => {
      if (activeUpload?.type === UPLOAD_TYPES.SHAREPOINT || activeUpload?.type === UPLOAD_TYPES.ONEDRIVE) {
        setActiveUpload(prev => prev ? {
          ...prev,
          progress: progressData.progress || 0,
          phase: progressData.phase || prev.phase,
          message: progressData.message || '',
          syncStatus: progressData.syncStatus || prev.syncStatus
        } : null);
      }
    };

    if (window.electronAPI?.onOneDriveSyncProgress) {
      window.electronAPI.onOneDriveSyncProgress(handleOneDriveProgress);
    }

    return () => {
      if (dasCleanup) dasCleanup();
      if (window.electronAPI?.removeOneDriveSyncProgressListener) {
        window.electronAPI.removeOneDriveSyncProgressListener(handleOneDriveProgress);
      }
    };
  }, [activeUpload?.type]);

  // Process the next upload in queue when current one completes
  const processNextUpload = useCallback(async () => {
    if (isProcessingRef.current || activeUpload || uploadQueue.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    
    const nextUpload = uploadQueue[0];
    setUploadQueue(prev => prev.slice(1));
    
    setActiveUpload({
      ...nextUpload,
      status: UPLOAD_STATUS.UPLOADING,
      progress: 0,
      phase: 'starting',
      message: 'Starting upload...',
      startedAt: new Date().toISOString()
    });

    isProcessingRef.current = false;
  }, [activeUpload, uploadQueue]);

  // Watch for queue changes and process next
  useEffect(() => {
    if (!activeUpload && uploadQueue.length > 0) {
      processNextUpload();
    }
  }, [activeUpload, uploadQueue, processNextUpload]);

  // Start a new upload (adds to queue)
  const startUpload = useCallback((projectId, projectName, type, params = {}) => {
    const uploadItem = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      projectName,
      type,
      params,
      status: UPLOAD_STATUS.QUEUED,
      queuedAt: new Date().toISOString()
    };

    // If no active upload, start immediately; otherwise queue it
    if (!activeUpload && uploadQueue.length === 0) {
      setActiveUpload({
        ...uploadItem,
        status: UPLOAD_STATUS.UPLOADING,
        progress: 0,
        phase: 'starting',
        message: 'Starting upload...',
        startedAt: new Date().toISOString()
      });
    } else {
      setUploadQueue(prev => [...prev, uploadItem]);
    }

    return uploadItem.id;
  }, [activeUpload, uploadQueue]);

  // Complete the active upload (success)
  const completeUpload = useCallback((result = {}) => {
    if (!activeUpload) return;

    const completedUpload = {
      ...activeUpload,
      status: UPLOAD_STATUS.COMPLETE,
      completedAt: new Date().toISOString(),
      result
    };

    setCompletedUploads(prev => [completedUpload, ...prev].slice(0, 5)); // Keep last 5
    setActiveUpload(null);

    // Auto-remove from completed after 5 seconds
    setTimeout(() => {
      setCompletedUploads(prev => prev.filter(u => u.id !== completedUpload.id));
    }, 5000);
  }, [activeUpload]);

  // Mark active upload as failed
  const failUpload = useCallback((error) => {
    if (!activeUpload) return;

    const failedUpload = {
      ...activeUpload,
      status: UPLOAD_STATUS.ERROR,
      error: error?.message || error || 'Upload failed',
      failedAt: new Date().toISOString()
    };

    setCompletedUploads(prev => [failedUpload, ...prev].slice(0, 5));
    setLastError(failedUpload);
    setActiveUpload(null);
  }, [activeUpload]);

  // Check if a specific project is currently uploading
  const isProjectUploading = useCallback((projectId) => {
    if (activeUpload?.projectId === projectId) return true;
    return uploadQueue.some(u => u.projectId === projectId);
  }, [activeUpload, uploadQueue]);

  // Get upload status for a specific project
  const getProjectUploadStatus = useCallback((projectId) => {
    if (activeUpload?.projectId === projectId) {
      return activeUpload;
    }
    const queued = uploadQueue.find(u => u.projectId === projectId);
    if (queued) return queued;
    return completedUploads.find(u => u.projectId === projectId) || null;
  }, [activeUpload, uploadQueue, completedUploads]);

  // Clear last error
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Dismiss a completed upload notification
  const dismissCompletedUpload = useCallback((uploadId) => {
    setCompletedUploads(prev => prev.filter(u => u.id !== uploadId));
  }, []);

  // Check if any upload is in progress
  const hasActiveUpload = !!activeUpload;
  const hasQueuedUploads = uploadQueue.length > 0;
  const totalPendingUploads = uploadQueue.length + (activeUpload ? 1 : 0);

  const value = {
    // State
    activeUpload,
    uploadQueue,
    completedUploads,
    lastError,
    hasActiveUpload,
    hasQueuedUploads,
    totalPendingUploads,
    
    // Actions
    startUpload,
    completeUpload,
    failUpload,
    isProjectUploading,
    getProjectUploadStatus,
    clearError,
    dismissCompletedUpload,
    
    // Constants
    UPLOAD_TYPES,
    UPLOAD_STATUS
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
}

// Custom hook to use upload context
export function useUploadContext() {
  const context = useContext(UploadContext);
  
  if (context === undefined) {
    throw new Error('useUploadContext must be used within an UploadProvider');
  }
  
  return context;
}

export default UploadContext;
