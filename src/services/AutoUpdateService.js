/**
 * Auto-Update Service
 * Handles automatic updates for the application
 */

import { autoUpdater } from 'electron-updater';
import { ipcRenderer } from 'electron';
import analyticsService from './AnalyticsService';
import crashReportingService from './CrashReportingService';

class AutoUpdateService {
  constructor() {
    this.isEnabled = true;
    this.checkOnStartup = true;
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.checkTimer = null;
    this.updateAvailable = false;
    this.updateInfo = null;
    this.downloadProgress = 0;
    this.isDownloading = false;
    this.isInstalling = false;
    this.listeners = new Map();
  }

  /**
   * Initialize auto-update service
   */
  async initialize(options = {}) {
    try {
      this.isEnabled = options.enabled !== false;
      this.checkOnStartup = options.checkOnStartup !== false;
      this.checkInterval = options.checkInterval || this.checkInterval;

      if (!this.isEnabled) {
        console.log('Auto-update is disabled');
        return;
      }

      // Configure auto-updater
      this.configureAutoUpdater();

      // Set up event listeners
      this.setupEventListeners();

      // Check for updates on startup if enabled
      if (this.checkOnStartup) {
        await this.checkForUpdates();
      }

      // Start periodic update checks
      this.startPeriodicChecks();

      console.log('Auto-update service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize auto-update service:', error);
      crashReportingService.captureException(error, { context: 'auto_update_init' });
    }
  }

  /**
   * Configure auto-updater settings
   */
  configureAutoUpdater() {
    // Set update server URL (you'll need to configure this)
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'your-username', // Replace with your GitHub username
      repo: 'project-creator', // Replace with your repository name
      private: false
    });

    // Configure update behavior
    autoUpdater.autoDownload = false; // Don't auto-download, let user choose
    autoUpdater.autoInstallOnAppQuit = true; // Install on app quit
    autoUpdater.allowDowngrade = false; // Don't allow downgrades
    autoUpdater.allowPrerelease = false; // Only stable releases

    // Set update check interval
    autoUpdater.checkForUpdatesAndNotify();
  }

  /**
   * Set up event listeners for auto-updater
   */
  setupEventListeners() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      this.updateAvailable = true;
      this.updateInfo = info;
      this.notifyListeners('update-available', info);
      
      // Track in analytics
      analyticsService.trackEvent('update_available', {
        version: info.version,
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes
      });
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
      this.updateAvailable = false;
      this.updateInfo = null;
      this.notifyListeners('update-not-available', info);
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj.percent;
      this.isDownloading = true;
      this.notifyListeners('download-progress', progressObj);
      
      // Track download progress in analytics
      analyticsService.trackEvent('update_download_progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    });

    // Download completed
    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.isDownloading = false;
      this.notifyListeners('update-downloaded', info);
      
      // Track download completion in analytics
      analyticsService.trackEvent('update_downloaded', {
        version: info.version,
        releaseName: info.releaseName
      });
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      console.error('Auto-update error:', error);
      this.isDownloading = false;
      this.isInstalling = false;
      this.notifyListeners('update-error', error);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'auto_update' });
      crashReportingService.captureException(error, { context: 'auto_update' });
    });

    // Before quit for install
    autoUpdater.on('before-quit-for-update', () => {
      console.log('App will quit for update');
      this.isInstalling = true;
      this.notifyListeners('before-quit-for-update');
      
      // Track update installation in analytics
      analyticsService.trackEvent('update_installing', {
        version: this.updateInfo?.version
      });
    });
  }

  /**
   * Check for updates
   */
  async checkForUpdates() {
    if (!this.isEnabled) {
      console.log('Auto-update is disabled, skipping check');
      return;
    }

    try {
      console.log('Checking for updates...');
      this.notifyListeners('checking-for-update');
      
      // Track update check in analytics
      analyticsService.trackEvent('update_check_started');
      
      const result = await autoUpdater.checkForUpdates();
      console.log('Update check result:', result);
      
      // Track update check completion in analytics
      analyticsService.trackEvent('update_check_completed', {
        hasUpdate: !!result?.updateInfo
      });
      
      return result;
    } catch (error) {
      console.error('Error checking for updates:', error);
      this.notifyListeners('update-error', error);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'update_check' });
      crashReportingService.captureException(error, { context: 'update_check' });
      
      throw error;
    }
  }

  /**
   * Download update
   */
  async downloadUpdate() {
    if (!this.updateAvailable) {
      throw new Error('No update available to download');
    }

    try {
      console.log('Starting update download...');
      this.isDownloading = true;
      this.notifyListeners('download-started');
      
      // Track download start in analytics
      analyticsService.trackEvent('update_download_started', {
        version: this.updateInfo?.version
      });
      
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      this.isDownloading = false;
      this.notifyListeners('update-error', error);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'update_download' });
      crashReportingService.captureException(error, { context: 'update_download' });
      
      throw error;
    }
  }

  /**
   * Install update
   */
  async installUpdate() {
    if (!this.updateAvailable) {
      throw new Error('No update available to install');
    }

    try {
      console.log('Installing update...');
      this.isInstalling = true;
      this.notifyListeners('install-started');
      
      // Track install start in analytics
      analyticsService.trackEvent('update_install_started', {
        version: this.updateInfo?.version
      });
      
      // Quit and install
      autoUpdater.quitAndInstall();
    } catch (error) {
      console.error('Error installing update:', error);
      this.isInstalling = false;
      this.notifyListeners('update-error', error);
      
      // Track error in analytics and crash reporting
      analyticsService.trackError(error, { context: 'update_install' });
      crashReportingService.captureException(error, { context: 'update_install' });
      
      throw error;
    }
  }

  /**
   * Start periodic update checks
   */
  startPeriodicChecks() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        console.error('Periodic update check failed:', error);
      }
    }, this.checkInterval);
  }

  /**
   * Stop periodic update checks
   */
  stopPeriodicChecks() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Add event listener
   */
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in update event listener:', error);
        }
      });
    }
  }

  /**
   * Get update status
   */
  getUpdateStatus() {
    return {
      isEnabled: this.isEnabled,
      updateAvailable: this.updateAvailable,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      isDownloading: this.isDownloading,
      isInstalling: this.isInstalling,
      checkInterval: this.checkInterval
    };
  }

  /**
   * Get current version info
   */
  getCurrentVersion() {
    return {
      version: process.env.npm_package_version || '1.0.0',
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * Enable auto-update
   */
  enable() {
    this.isEnabled = true;
    this.startPeriodicChecks();
    console.log('Auto-update enabled');
  }

  /**
   * Disable auto-update
   */
  disable() {
    this.isEnabled = false;
    this.stopPeriodicChecks();
    console.log('Auto-update disabled');
  }

  /**
   * Set update check interval
   */
  setCheckInterval(interval) {
    this.checkInterval = interval;
    if (this.isEnabled) {
      this.stopPeriodicChecks();
      this.startPeriodicChecks();
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopPeriodicChecks();
    this.listeners.clear();
  }
}

// Create singleton instance
const autoUpdateService = new AutoUpdateService();

export default autoUpdateService;


