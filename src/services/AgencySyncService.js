const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class AgencySyncService extends EventEmitter {
  constructor(agencyService, settingsService) {
    super();
    this.agencyService = agencyService;
    this.settingsService = settingsService;
    this.fileWatcher = null;
    this.isWatching = false;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    
    // Auto-sync check interval (every 30 seconds as fallback)
    this.checkInterval = null;
    this.checkIntervalMs = 30000;
  }

  /**
   * Initialize the sync service with current settings
   */
  async initialize() {
    try {
      const settings = await this.settingsService.getSettings();
      const syncSettings = settings.agencySync || {};
      
      console.log('🔄 Initializing AgencySyncService with settings:', syncSettings);
      
      if (syncSettings.enabled && syncSettings.filePath && syncSettings.mode === 'auto') {
        await this.startAutoSync(syncSettings.filePath);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing sync service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current sync settings
   */
  async getSyncSettings() {
    try {
      const settings = await this.settingsService.getSettings();
      const defaultSettings = {
        enabled: false,
        mode: 'manual', // 'auto' or 'manual'
        filePath: '',
        lastSync: null,
        autoSyncInterval: 30 // seconds
      };
      
      return {
        success: true,
        settings: { ...defaultSettings, ...(settings.agencySync || {}) }
      };
    } catch (error) {
      console.error('Error getting sync settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update sync settings
   */
  async updateSyncSettings(newSettings) {
    try {
      console.log('📝 Updating sync settings:', newSettings);
      
      const currentSettings = await this.settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        agencySync: {
          ...currentSettings.agencySync,
          ...newSettings,
          lastUpdated: new Date().toISOString()
        }
      };
      
      await this.settingsService.saveSettings(updatedSettings);
      
      // Restart auto-sync if settings changed
      if (newSettings.enabled && newSettings.mode === 'auto' && newSettings.filePath) {
        await this.startAutoSync(newSettings.filePath);
      } else {
        await this.stopAutoSync();
      }
      
      this.emit('settingsUpdated', updatedSettings.agencySync);
      
      return { success: true, settings: updatedSettings.agencySync };
    } catch (error) {
      console.error('Error updating sync settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test if the specified file path is accessible
   */
  async testFilePath(filePath) {
    try {
      console.log('🔍 Testing file path:', filePath);
      
      if (!filePath || !filePath.trim()) {
        return { success: false, error: 'File path is required' };
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
      }

      // Check if it's a file (not directory)
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Path is not a file' };
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) {
        return { success: false, error: 'File must be an Excel file (.xlsx or .xls)' };
      }

      // Try to read file to check permissions
      fs.accessSync(filePath, fs.constants.R_OK);
      
      // Get file modification time
      const modTime = stats.mtime.toISOString();
      
      return { 
        success: true, 
        fileInfo: {
          path: filePath,
          size: stats.size,
          lastModified: modTime,
          accessible: true
        }
      };
    } catch (error) {
      console.error('Error testing file path:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start automatic sync monitoring
   */
  async startAutoSync(filePath) {
    try {
      console.log('🚀 Starting auto-sync for:', filePath);
      
      // Stop any existing watchers
      await this.stopAutoSync();
      
      // Test file path first
      const testResult = await this.testFilePath(filePath);
      if (!testResult.success) {
        throw new Error(`Cannot start auto-sync: ${testResult.error}`);
      }
      
      this.isWatching = true;
      
      // Set up file system watcher
      try {
        this.fileWatcher = fs.watch(filePath, (eventType, filename) => {
          console.log(`📂 File change detected: ${eventType} on ${filename || filePath}`);
          
          if (eventType === 'change' && !this.syncInProgress) {
            // Debounce multiple rapid changes
            setTimeout(() => {
              this.performAutoSync(filePath);
            }, 2000);
          }
        });
        
        console.log('👁️ File watcher established');
      } catch (watchError) {
        console.warn('File watcher failed, falling back to interval checking:', watchError.message);
      }
      
      // Set up interval checking as fallback
      this.checkInterval = setInterval(() => {
        this.checkFileAndSync(filePath);
      }, this.checkIntervalMs);
      
      this.emit('autoSyncStarted', { filePath });
      
      return { success: true, message: 'Auto-sync started' };
    } catch (error) {
      console.error('Error starting auto-sync:', error);
      this.isWatching = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop automatic sync monitoring
   */
  async stopAutoSync() {
    try {
      console.log('🛑 Stopping auto-sync');
      
      this.isWatching = false;
      
      if (this.fileWatcher) {
        this.fileWatcher.close();
        this.fileWatcher = null;
      }
      
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      
      this.emit('autoSyncStopped');
      
      return { success: true, message: 'Auto-sync stopped' };
    } catch (error) {
      console.error('Error stopping auto-sync:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check file modification time and sync if needed
   */
  async checkFileAndSync(filePath) {
    try {
      if (this.syncInProgress) return;
      
      const settings = await this.getSyncSettings();
      if (!settings.success || !settings.settings.enabled) return;
      
      const testResult = await this.testFilePath(filePath);
      if (!testResult.success) {
        console.warn('File check failed:', testResult.error);
        return;
      }
      
      const lastSync = settings.settings.lastSync;
      const fileModTime = testResult.fileInfo.lastModified;
      
      if (!lastSync || new Date(fileModTime) > new Date(lastSync)) {
        console.log('📅 File is newer than last sync, triggering auto-sync');
        await this.performAutoSync(filePath);
      }
    } catch (error) {
      console.error('Error in file check:', error);
    }
  }

  /**
   * Perform the actual sync operation
   */
  async performAutoSync(filePath) {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping');
      return;
    }
    
    try {
      this.syncInProgress = true;
      console.log('🔄 Starting auto-sync import from:', filePath);
      
      this.emit('syncStarted', { filePath, auto: true });
      
      // Import from Excel using existing service
      const importResult = await this.agencyService.importFromExcel(filePath);
      
      if (importResult.success) {
        // Update last sync time
        const currentSettings = await this.getSyncSettings();
        if (currentSettings.success) {
          await this.updateSyncSettings({
            ...currentSettings.settings,
            lastSync: new Date().toISOString()
          });
        }
        
        this.lastSyncTime = new Date().toISOString();
        
        console.log(`✅ Auto-sync completed: ${importResult.totalImported} agencies imported`);
        
        this.emit('syncCompleted', {
          success: true,
          filePath,
          auto: true,
          totalImported: importResult.totalImported,
          timestamp: this.lastSyncTime
        });
      } else {
        console.error('❌ Auto-sync failed:', importResult.error);
        
        this.emit('syncCompleted', {
          success: false,
          filePath,
          auto: true,
          error: importResult.error,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error in auto-sync:', error);
      
      this.emit('syncCompleted', {
        success: false,
        filePath,
        auto: true,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Manually trigger sync
   */
  async manualSync(filePath) {
    try {
      console.log('🔄 Manual sync triggered for:', filePath);
      
      if (!filePath) {
        const settings = await this.getSyncSettings();
        if (settings.success && settings.settings.filePath) {
          filePath = settings.settings.filePath;
        } else {
          throw new Error('No file path specified');
        }
      }
      
      this.emit('syncStarted', { filePath, auto: false });
      
      const importResult = await this.agencyService.importFromExcel(filePath);
      
      if (importResult.success) {
        // Update last sync time
        const currentSettings = await this.getSyncSettings();
        if (currentSettings.success) {
          await this.updateSyncSettings({
            ...currentSettings.settings,
            lastSync: new Date().toISOString()
          });
        }
        
        this.emit('syncCompleted', {
          success: true,
          filePath,
          auto: false,
          totalImported: importResult.totalImported,
          timestamp: new Date().toISOString()
        });
      } else {
        this.emit('syncCompleted', {
          success: false,
          filePath,
          auto: false,
          error: importResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
      return importResult;
    } catch (error) {
      console.error('Error in manual sync:', error);
      
      this.emit('syncCompleted', {
        success: false,
        filePath,
        auto: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Export agencies to the configured Excel file
   */
  async exportToExcel(filePath, options = {}) {
    try {
      console.log('📤 Starting export to Excel:', filePath);
      
      if (!filePath) {
        const settings = await this.getSyncSettings();
        if (settings.success && settings.settings.filePath) {
          filePath = settings.settings.filePath;
        } else {
          throw new Error('No file path specified for export');
        }
      }
      
      // Test file accessibility first
      const testResult = await this.testFilePath(filePath);
      if (!testResult.success) {
        throw new Error(`Cannot export to file: ${testResult.error}`);
      }
      
      this.emit('exportStarted', { filePath });
      
      // Use the agency service to export to existing Excel file
      const exportResult = await this.agencyService.exportToExistingExcel(filePath, {
        createBackup: options.createBackup !== false,
        sheetName: options.sheetName
      });
      
      if (exportResult.success) {
        // Update last export time in settings
        const currentSettings = await this.getSyncSettings();
        if (currentSettings.success) {
          await this.updateSyncSettings({
            ...currentSettings.settings,
            lastExport: new Date().toISOString()
          });
        }
        
        console.log(`✅ Export completed: ${exportResult.exportedCount} agencies exported`);
        
        this.emit('exportCompleted', {
          success: true,
          filePath,
          exportedCount: exportResult.exportedCount,
          targetSheet: exportResult.targetSheet,
          backupCreated: exportResult.backupCreated,
          timestamp: new Date().toISOString()
        });
      } else {
        console.error('❌ Export failed:', exportResult.error);
        
        this.emit('exportCompleted', {
          success: false,
          filePath,
          error: exportResult.error,
          timestamp: new Date().toISOString()
        });
      }
      
      return exportResult;
      
    } catch (error) {
      console.error('Error in export:', error);
      
      this.emit('exportCompleted', {
        success: false,
        filePath,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isWatching: this.isWatching,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      hasFileWatcher: !!this.fileWatcher,
      hasInterval: !!this.checkInterval
    };
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    await this.stopAutoSync();
    this.removeAllListeners();
  }
}

module.exports = AgencySyncService;
