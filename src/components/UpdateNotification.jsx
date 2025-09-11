import React, { useState, useEffect } from 'react';
import autoUpdateService from '../services/AutoUpdateService';
import analyticsService from '../services/AnalyticsService';
import './UpdateNotification.css';

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
    <div className="update-notification">
      <div className="update-notification-content">
        <div className="update-notification-header">
          <div className="update-notification-icon">
            🚀
          </div>
          <div className="update-notification-title">
            <h3>Update Available</h3>
            <p>Version {updateInfo?.version} is ready to download</p>
          </div>
          <button 
            className="update-notification-close"
            onClick={handleDismiss}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>

        <div className="update-notification-body">
          {updateInfo?.releaseName && (
            <p className="update-release-name">{updateInfo.releaseName}</p>
          )}
          
          {updateInfo?.releaseNotes && (
            <div className="update-release-notes">
              <h4>What's New:</h4>
              <div className="release-notes-content">
                {updateInfo.releaseNotes}
              </div>
            </div>
          )}

          {isDownloading && (
            <div className="update-download-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p>Downloading... {Math.round(downloadProgress)}%</p>
            </div>
          )}

          {isInstalling && (
            <div className="update-installing">
              <div className="spinner" />
              <p>Installing update...</p>
            </div>
          )}
        </div>

        <div className="update-notification-actions">
          {!isDownloading && !isInstalling && (
            <>
              <button 
                className="update-button primary"
                onClick={handleDownloadUpdate}
              >
                Download Update
              </button>
              <button 
                className="update-button secondary"
                onClick={handleDismiss}
              >
                Later
              </button>
            </>
          )}

          {isDownloading && (
            <button 
              className="update-button disabled"
              disabled
            >
              Downloading...
            </button>
          )}

          {updateStatus?.updateInfo && !isDownloading && !isInstalling && (
            <button 
              className="update-button install"
              onClick={handleInstallUpdate}
            >
              Install & Restart
            </button>
          )}

          {isInstalling && (
            <button 
              className="update-button disabled"
              disabled
            >
              Installing...
            </button>
          )}
        </div>

        <div className="update-notification-footer">
          <button 
            className="update-link"
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


