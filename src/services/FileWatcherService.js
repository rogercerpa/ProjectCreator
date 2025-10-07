/**
 * FileWatcherService
 * Monitors shared OneDrive folder for file changes
 * Detects when other users update workload data
 * Runs in main process
 */

const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');

class FileWatcherService extends EventEmitter {
  constructor(dataDirectory) {
    super();
    this.dataDirectory = dataDirectory;
    this.watcher = null;
    this.isWatching = false;
    this.debounceTimers = new Map();
    this.fileHashes = new Map();
    
    // Configuration
    this.config = {
      debounceDelay: 1000, // 1 second debounce
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    };
  }

  /**
   * Start watching the shared folder
   */
  async startWatching() {
    if (this.isWatching) {
      console.log('⚠️ File watcher already running');
      return { success: false, message: 'Already watching' };
    }

    try {
      // Ensure directory exists
      await fs.ensureDir(this.dataDirectory);

      // Files to watch
      const watchPatterns = [
        path.join(this.dataDirectory, 'workload.json'),
        path.join(this.dataDirectory, 'users.json'),
        path.join(this.dataDirectory, 'assignments.json'),
        path.join(this.dataDirectory, 'workload-config.json')
      ];

      // Initialize chokidar watcher
      this.watcher = chokidar.watch(watchPatterns, this.config);

      // Set up event handlers
      this.watcher
        .on('change', (filePath) => this.handleFileChange(filePath))
        .on('add', (filePath) => this.handleFileAdd(filePath))
        .on('unlink', (filePath) => this.handleFileDelete(filePath))
        .on('error', (error) => this.handleWatchError(error))
        .on('ready', () => {
          this.isWatching = true;
          console.log('✅ File watcher started for:', this.dataDirectory);
          this.emit('watcher:ready');
        });

      return { success: true, message: 'File watcher started' };
    } catch (error) {
      console.error('❌ Error starting file watcher:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop watching the shared folder
   */
  async stopWatching() {
    if (!this.isWatching || !this.watcher) {
      return { success: true, message: 'Not watching' };
    }

    try {
      await this.watcher.close();
      this.watcher = null;
      this.isWatching = false;
      
      // Clear all debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();
      
      console.log('✅ File watcher stopped');
      this.emit('watcher:stopped');
      
      return { success: true, message: 'File watcher stopped' };
    } catch (error) {
      console.error('❌ Error stopping file watcher:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle file change event
   */
  async handleFileChange(filePath) {
    const fileName = path.basename(filePath);
    
    // Check if file actually changed (not just metadata)
    const hasChanged = await this.hasFileContentChanged(filePath);
    if (!hasChanged) {
      return;
    }

    console.log(`📝 File changed: ${fileName}`);

    // Debounce rapid changes (OneDrive can trigger multiple events)
    this.debounceFileEvent(fileName, () => {
      this.emitFileChangeEvent(fileName, filePath, 'change');
    });
  }

  /**
   * Handle file add event
   */
  async handleFileAdd(filePath) {
    const fileName = path.basename(filePath);
    console.log(`➕ File added: ${fileName}`);
    
    this.debounceFileEvent(fileName, () => {
      this.emitFileChangeEvent(fileName, filePath, 'add');
    });
  }

  /**
   * Handle file delete event
   */
  async handleFileDelete(filePath) {
    const fileName = path.basename(filePath);
    console.log(`🗑️ File deleted: ${fileName}`);
    
    // Remove from hash cache
    this.fileHashes.delete(filePath);
    
    this.debounceFileEvent(fileName, () => {
      this.emitFileChangeEvent(fileName, filePath, 'delete');
    });
  }

  /**
   * Handle watcher errors
   */
  handleWatchError(error) {
    console.error('❌ File watcher error:', error);
    this.emit('watcher:error', { error: error.message });
  }

  /**
   * Debounce file events to avoid rapid firing
   */
  debounceFileEvent(fileName, callback) {
    // Clear existing timer for this file
    if (this.debounceTimers.has(fileName)) {
      clearTimeout(this.debounceTimers.get(fileName));
    }

    // Set new timer
    const timer = setTimeout(() => {
      callback();
      this.debounceTimers.delete(fileName);
    }, this.config.debounceDelay);

    this.debounceTimers.set(fileName, timer);
  }

  /**
   * Emit file change event based on file type
   */
  emitFileChangeEvent(fileName, filePath, eventType) {
    let eventName = 'file:changed';
    let dataType = 'unknown';

    switch (fileName) {
      case 'workload.json':
        eventName = 'workload:changed';
        dataType = 'workload';
        break;
      case 'users.json':
        eventName = 'users:changed';
        dataType = 'users';
        break;
      case 'assignments.json':
        eventName = 'assignments:changed';
        dataType = 'assignments';
        break;
      case 'workload-config.json':
        eventName = 'config:changed';
        dataType = 'config';
        break;
    }

    // Emit specific event
    this.emit(eventName, {
      fileName,
      filePath,
      eventType,
      dataType,
      timestamp: new Date().toISOString()
    });

    // Also emit generic file change event
    this.emit('file:changed', {
      fileName,
      filePath,
      eventType,
      dataType,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if file content has actually changed (not just metadata)
   */
  async hasFileContentChanged(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const hash = this.simpleHash(content);
      
      const previousHash = this.fileHashes.get(filePath);
      this.fileHashes.set(filePath, hash);
      
      // If no previous hash, consider it changed
      if (!previousHash) {
        return true;
      }
      
      return hash !== previousHash;
    } catch (error) {
      console.error('Error checking file content:', error);
      return true; // Assume changed on error
    }
  }

  /**
   * Simple hash function for content comparison
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Force reload of all watched files
   */
  async forceReload() {
    if (!this.isWatching) {
      return { success: false, message: 'Watcher not running' };
    }

    try {
      // Clear hash cache to force reload
      this.fileHashes.clear();
      
      // Emit reload event
      this.emit('force:reload', {
        timestamp: new Date().toISOString()
      });
      
      return { success: true, message: 'Force reload triggered' };
    } catch (error) {
      console.error('Error forcing reload:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get watcher status
   */
  getStatus() {
    return {
      isWatching: this.isWatching,
      dataDirectory: this.dataDirectory,
      watchedFiles: this.watcher ? this.watcher.getWatched() : {},
      activeDebounceTimers: this.debounceTimers.size
    };
  }

  /**
   * Update data directory
   */
  async updateDataDirectory(newDirectory) {
    const wasWatching = this.isWatching;
    
    if (wasWatching) {
      await this.stopWatching();
    }
    
    this.dataDirectory = newDirectory;
    
    if (wasWatching) {
      return await this.startWatching();
    }
    
    return { success: true, message: 'Data directory updated' };
  }

  /**
   * Manually trigger file check (useful for polling fallback)
   */
  async checkForChanges() {
    const files = [
      'workload.json',
      'users.json',
      'assignments.json',
      'workload-config.json'
    ];

    const changes = [];

    for (const fileName of files) {
      const filePath = path.join(this.dataDirectory, fileName);
      
      try {
        if (await fs.pathExists(filePath)) {
          const hasChanged = await this.hasFileContentChanged(filePath);
          
          if (hasChanged) {
            changes.push(fileName);
            this.emitFileChangeEvent(fileName, filePath, 'change');
          }
        }
      } catch (error) {
        console.error(`Error checking ${fileName}:`, error);
      }
    }

    return {
      success: true,
      changedFiles: changes,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileName) {
    try {
      const filePath = path.join(this.dataDirectory, fileName);
      
      if (!await fs.pathExists(filePath)) {
        return { success: false, error: 'File not found' };
      }

      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      
      return {
        success: true,
        metadata: {
          fileName,
          filePath,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime,
          contentHash: this.simpleHash(content)
        }
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = FileWatcherService;

