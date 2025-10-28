import React, { useState, useEffect } from 'react';
import autoUpdateService from '../services/AutoUpdateService';
import analyticsService from '../services/AnalyticsService';

const UpdateNotification = () => {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Get initial update status
    setUpdateStatus(autoUpdateService.getUpdateStatus());

    // Set up event listeners
    const handleUpdateAvailable = (info) => {
      setUpdateStatus(prev => ({ ...prev, updateAvailable: true, updateInfo: info }));
      setIsVisible(true);
    };

    const handleDownloadProgress = (progress) => {
      setDownloadProgress(progress.percent);
      setIsDownloading(true);
    };

    const handleDownloadComplete = () => {
      setIsDownloading(false);
      setDownloadProgress(100);
    };

    const handleInstallStart = () => {
      setIsInstalling(true);
    };

    const handleError = (error) => {
      console.error('Update error:', error);
      setIsDownloading(false);
      setIsInstalling(false);
    };

    // Add event listeners
    autoUpdateService.addEventListener('update-available', handleUpdateAvailable);
    autoUpdateService.addEventListener('download-progress', handleDownloadProgress);
    autoUpdateService.addEventListener('update-downloaded', handleDownloadComplete);
    autoUpdateService.addEventListener('install-started', handleInstallStart);
    autoUpdateService.addEventListener('update-error', handleError);

    // Cleanup
    return () => {
      autoUpdateService.removeEventListener('update-available', handleUpdateAvailable);
      autoUpdateService.removeEventListener('download-progress', handleDownloadProgress);
      autoUpdateService.removeEventListener('update-downloaded', handleDownloadComplete);
      autoUpdateService.removeEventListener('install-started', handleInstallStart);
      autoUpdateService.removeEventListener('update-error', handleError);
    };
  }, []);

  const handleDownloadUpdate = async () => {
    try {
      await autoUpdateService.downloadUpdate();
      analyticsService.trackEvent('update_download_initiated', {
        version: updateStatus?.updateInfo?.version
      });
    } catch (error) {
      console.error('Failed to download update:', error);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await autoUpdateService.installUpdate();
      analyticsService.trackEvent('update_install_initiated', {
        version: updateStatus?.updateInfo?.version
      });
    } catch (error) {
      console.error('Failed to install update:', error);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    analyticsService.trackEvent('update_notification_dismissed', {
      version: updateStatus?.updateInfo?.version
    });
  };

  const handleCheckForUpdates = async () => {
    try {
      await autoUpdateService.checkForUpdates();
      analyticsService.trackEvent('manual_update_check');
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  if (!isVisible || !updateStatus?.updateAvailable) {
    return null;
  }

  const { updateInfo } = updateStatus;

  return (
    <div className="fixed top-5 right-5 z-[10000] max-w-[400px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                    rounded-xl shadow-2xl animate-slideIn
                    sm:top-2.5 sm:right-2.5 sm:left-2.5 sm:max-w-none">
      <div className="p-0">
        {/* Header */}
        <div className="flex items-start px-5 py-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="text-2xl mr-3 mt-0.5">
            🚀
          </div>
          <div className="flex-1">
            <h3 className="m-0 mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">Update Available</h3>
            <p className="m-0 text-sm text-gray-600 dark:text-gray-400">Version {updateInfo?.version} is ready to download</p>
          </div>
          <button 
            className="bg-transparent border-none text-xl text-gray-400 dark:text-gray-500 cursor-pointer p-1 -mr-1 -mt-1 
                       rounded transition-all hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={handleDismiss}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {updateInfo?.releaseName && (
            <p className="m-0 mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">{updateInfo.releaseName}</p>
          )}
          
          {updateInfo?.releaseNotes && (
            <div className="mb-4">
              <h4 className="m-0 mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">What's New:</h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 leading-snug max-h-[120px] overflow-y-auto p-2 
                             bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                {updateInfo.releaseNotes}
              </div>
            </div>
          )}

          {isDownloading && (
            <div className="mb-4">
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden mb-2">
                <div 
                  className="h-full bg-gradient-to-r from-info-600 to-info-700 dark:from-info-700 dark:to-info-600 rounded transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="m-0 text-xs text-gray-600 dark:text-gray-400 text-center">
                Downloading... {Math.round(downloadProgress)}%
              </p>
            </div>
          )}

          {isInstalling && (
            <div className="flex items-center justify-center mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
              <div className="w-4 h-4 border-2 border-gray-200 dark:border-gray-700 border-t-info-600 dark:border-t-info-500 
                             rounded-full animate-spin mr-2" />
              <p className="m-0 text-sm text-gray-600 dark:text-gray-400">Installing update...</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-4 sm:flex-col">
          {!isDownloading && !isInstalling && (
            <>
              <button 
                className="flex-1 px-4 py-2.5 border-none rounded-md text-sm font-medium cursor-pointer transition-all text-center
                           bg-info-600 hover:bg-info-700 dark:bg-info-700 dark:hover:bg-info-600 text-white
                           sm:flex-none"
                onClick={handleDownloadUpdate}
              >
                Download Update
              </button>
              <button 
                className="flex-1 px-4 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-all text-center
                           bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600
                           hover:bg-gray-200 dark:hover:bg-gray-600
                           sm:flex-none"
                onClick={handleDismiss}
              >
                Later
              </button>
            </>
          )}

          {isDownloading && (
            <button 
              className="flex-1 px-4 py-2.5 border-none rounded-md text-sm font-medium text-center
                         bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              disabled
            >
              Downloading...
            </button>
          )}

          {updateStatus?.updateInfo && !isDownloading && !isInstalling && (
            <button 
              className="flex-1 px-4 py-2.5 border-none rounded-md text-sm font-medium cursor-pointer transition-all text-center
                         bg-success-600 hover:bg-success-700 dark:bg-success-700 dark:hover:bg-success-600 text-white
                         sm:flex-none"
              onClick={handleInstallUpdate}
            >
              Install & Restart
            </button>
          )}

          {isInstalling && (
            <button 
              className="flex-1 px-4 py-2.5 border-none rounded-md text-sm font-medium text-center
                         bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              disabled
            >
              Installing...
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 pb-4 border-t border-gray-100 dark:border-gray-700 text-center">
          <button 
            className="bg-transparent border-none text-info-600 dark:text-info-500 text-xs cursor-pointer underline px-2 py-1 
                       rounded transition-all hover:bg-gray-50 dark:hover:bg-gray-900 hover:no-underline"
            onClick={handleCheckForUpdates}
          >
            Check for Updates
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;


