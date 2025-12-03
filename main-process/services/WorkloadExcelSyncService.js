// WorkloadExcelSyncService - Monitors Excel file and handles bidirectional sync
const fs = require('fs');
const { EventEmitter } = require('events');

class WorkloadExcelSyncService extends EventEmitter {
  constructor(workloadExcelService, fieldMappingService, settingsService) {
    super();
    this.workloadExcelService = workloadExcelService;
    this.fieldMappingService = fieldMappingService;
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
   * Initialize sync service with current settings
   */
  async initialize() {
    try {
      const settings = await this.settingsService.getSettings();
      const syncSettings = settings.workloadExcelSync || {};
      
      console.log('🔄 Initializing WorkloadExcelSyncService with settings:', syncSettings);
      
      if (syncSettings.enabled && syncSettings.filePath && syncSettings.mode === 'auto') {
        await this.startAutoSync(syncSettings.filePath);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing workload sync service:', error);
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
        msListsUrl: '',
        lastSync: null,
        lastExport: null,
        autoSyncInterval: 30 // seconds
      };
      
      return {
        success: true,
        settings: { ...defaultSettings, ...(settings.workloadExcelSync || {}) }
      };
    } catch (error) {
      console.error('Error getting workload sync settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update sync settings
   */
  async updateSyncSettings(newSettings) {
    try {
      console.log('📝 Updating workload sync settings:', newSettings);
      
      // Validate file path if provided
      if (newSettings.filePath) {
        const pathInfo = await this.workloadExcelService.validateFilePath(newSettings.filePath);
        if (!pathInfo.isValid) {
          return { success: false, error: `Invalid file path: ${pathInfo.error}` };
        }
        // Use normalized path
        newSettings.filePath = pathInfo.path;
      }
      
      const currentSettings = await this.settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        workloadExcelSync: {
          ...currentSettings.workloadExcelSync,
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
      
      this.emit('settingsUpdated', updatedSettings.workloadExcelSync);
      
      return { success: true, settings: updatedSettings.workloadExcelSync };
    } catch (error) {
      console.error('Error updating workload sync settings:', error);
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
      const testResult = await this.workloadExcelService.testFilePath(filePath);
      if (!testResult.success) {
        // If file doesn't exist, try to create it
        if (testResult.error.includes('does not exist')) {
          console.log('📁 File does not exist, attempting to create...');
          const fieldMappingResult = await this.fieldMappingService.getFieldMapping(this.settingsService);
          if (fieldMappingResult.success) {
            const initResult = await this.workloadExcelService.initializeWorkbook(filePath, fieldMappingResult.mapping);
            if (!initResult.success) {
              throw new Error(`Cannot create Excel file: ${initResult.error}`);
            }
          } else {
            throw new Error(`Cannot start auto-sync: ${testResult.error}`);
          }
        } else {
          throw new Error(`Cannot start auto-sync: ${testResult.error}`);
        }
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
      
      const testResult = await this.workloadExcelService.testFilePath(filePath);
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
   * Perform the actual sync operation (import from Excel)
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
      
      // Get field mapping
      const fieldMappingResult = await this.fieldMappingService.getFieldMapping(this.settingsService);
      if (!fieldMappingResult.success) {
        throw new Error('Failed to load field mapping');
      }
      
      // Import from Excel using workload Excel service
      const importResult = await this.workloadExcelService.importAllFromExcel(filePath, fieldMappingResult.mapping);
      
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
        
        const totalImported = importResult.data.projects.length + importResult.data.assignments.length + importResult.data.users.length;
        console.log(`✅ Auto-sync completed: ${totalImported} items imported`);
        
        this.emit('syncCompleted', {
          success: true,
          filePath,
          auto: true,
          data: importResult.data,
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
   * Manually trigger sync from Excel to app
   */
  async syncFromExcel(filePath) {
    try {
      console.log('🔄 Manual sync from Excel triggered for:', filePath);
      
      if (!filePath) {
        const settings = await this.getSyncSettings();
        if (settings.success && settings.settings.filePath) {
          filePath = settings.settings.filePath;
        } else {
          throw new Error('No file path specified');
        }
      }
      
      this.emit('syncStarted', { filePath, auto: false, direction: 'import' });
      
      // Get field mapping
      const fieldMappingResult = await this.fieldMappingService.getFieldMapping(this.settingsService);
      if (!fieldMappingResult.success) {
        throw new Error('Failed to load field mapping');
      }
      
      const importResult = await this.workloadExcelService.importAllFromExcel(filePath, fieldMappingResult.mapping);
      
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
          direction: 'import',
          data: importResult.data,
          timestamp: new Date().toISOString()
        });
        
        return importResult;
      } else {
        this.emit('syncCompleted', {
          success: false,
          filePath,
          auto: false,
          direction: 'import',
          error: importResult.error,
          timestamp: new Date().toISOString()
        });
        
        return importResult;
      }
    } catch (error) {
      console.error('Error in manual sync from Excel:', error);
      
      this.emit('syncCompleted', {
        success: false,
        filePath,
        auto: false,
        direction: 'import',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Manually trigger sync from app to Excel
   */
  async syncToExcel(data, filePath) {
    try {
      console.log('📤 Manual sync to Excel triggered');
      
      if (!filePath) {
        const settings = await this.getSyncSettings();
        if (settings.success && settings.settings.filePath) {
          filePath = settings.settings.filePath;
        } else {
          throw new Error('No file path specified');
        }
      }
      
      this.emit('syncStarted', { filePath, auto: false, direction: 'export' });
      
      // Get field mapping
      const fieldMappingResult = await this.fieldMappingService.getFieldMapping(this.settingsService);
      if (!fieldMappingResult.success) {
        throw new Error('Failed to load field mapping');
      }
      
      const exportResult = await this.workloadExcelService.exportAllToExcel(data, filePath, fieldMappingResult.mapping);
      
      if (exportResult.success) {
        // Update last export time
        const currentSettings = await this.getSyncSettings();
        if (currentSettings.success) {
          await this.updateSyncSettings({
            ...currentSettings.settings,
            lastExport: new Date().toISOString()
          });
        }
        
        this.emit('syncCompleted', {
          success: true,
          filePath,
          auto: false,
          direction: 'export',
          results: exportResult.results,
          timestamp: new Date().toISOString()
        });
        
        return exportResult;
      } else {
        this.emit('syncCompleted', {
          success: false,
          filePath,
          auto: false,
          direction: 'export',
          error: exportResult.error,
          timestamp: new Date().toISOString()
        });
        
        return exportResult;
      }
    } catch (error) {
      console.error('Error in manual sync to Excel:', error);
      
      this.emit('syncCompleted', {
        success: false,
        filePath,
        auto: false,
        direction: 'export',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform bidirectional sync
   */
  async performBidirectionalSync(appData, filePath) {
    try {
      console.log('🔄 Starting bidirectional sync');
      
      // First, export app data to Excel
      const exportResult = await this.syncToExcel(appData, filePath);
      if (!exportResult.success) {
        return {
          success: false,
          error: 'Export failed: ' + exportResult.error
        };
      }
      
      // Then, import any updates from Excel
      const importResult = await this.syncFromExcel(filePath);
      if (!importResult.success) {
        return {
          success: false,
          error: 'Import failed: ' + importResult.error,
          exportSuccess: true
        };
      }
      
      return {
        success: true,
        exported: exportResult.results,
        imported: importResult.data,
        message: 'Bidirectional sync completed successfully'
      };
    } catch (error) {
      console.error('Error in bidirectional sync:', error);
      return {
        success: false,
        error: error.message
      };
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

module.exports = WorkloadExcelSyncService;





