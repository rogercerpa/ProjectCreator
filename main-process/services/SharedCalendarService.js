const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { EventEmitter } = require('events');

class SharedCalendarService extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      dataDirectory: options.dataDirectory || 'Z:\\DAS References\\ProjectCreatorV5',
      fileName: 'shared-calendar.json',
      debounceMs: 750
    };

    this.watcher = null;
    this.isWatching = false;
    this.lastContentHash = null;
    this.debounceTimer = null;
  }

  getFilePath() {
    return path.join(this.config.dataDirectory, this.config.fileName);
  }

  async ensureStore() {
    await fs.ensureDir(this.config.dataDirectory);
    const filePath = this.getFilePath();

    if (!(await fs.pathExists(filePath))) {
      const initialData = {
        metadata: {
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        entries: {}
      };
      await fs.writeJson(filePath, initialData, { spaces: 2 });
    }
  }

  async loadCalendar() {
    try {
      await this.ensureStore();
      const filePath = this.getFilePath();
      const data = await fs.readJson(filePath);
      const entries = data?.entries && typeof data.entries === 'object' ? data.entries : {};

      return {
        success: true,
        dataDirectory: this.config.dataDirectory,
        filePath,
        entries
      };
    } catch (error) {
      return { success: false, error: error.message, entries: {} };
    }
  }

  async saveCalendarEntries(entries) {
    await this.ensureStore();
    const filePath = this.getFilePath();
    const payload = {
      metadata: {
        version: 1,
        updatedAt: new Date().toISOString()
      },
      entries: entries || {}
    };
    await fs.writeJson(filePath, payload, { spaces: 2 });
    this.lastContentHash = this.simpleHash(JSON.stringify(payload));
    return { success: true, filePath };
  }

  async upsertProjectEntry(project, actor = 'local-user') {
    try {
      if (!project?.id) {
        return { success: false, error: 'Project id is required' };
      }

      const loadResult = await this.loadCalendar();
      if (!loadResult.success) return loadResult;

      const now = new Date().toISOString();
      const entries = { ...loadResult.entries };
      const existing = entries[project.id] || {};

      entries[project.id] = {
        ...existing,
        projectId: project.id,
        projectName: project.projectName || existing.projectName || '',
        rfaNumber: project.rfaNumber || existing.rfaNumber || '',
        projectContainer: project.projectContainer || existing.projectContainer || '',
        designBy: project.designBy || existing.designBy || '',
        engineerExpectedCompleteDate: project.engineerExpectedCompleteDate || existing.engineerExpectedCompleteDate || '',
        totalTriage: Number(project.totalTriage ?? existing.totalTriage ?? 0),
        updatedAt: now,
        updatedBy: actor
      };

      await this.saveCalendarEntries(entries);

      return {
        success: true,
        entry: entries[project.id],
        filePath: loadResult.filePath
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setDataDirectory(directoryPath) {
    this.config.dataDirectory = directoryPath;
    await this.ensureStore();

    if (this.isWatching) {
      await this.stopWatching();
      await this.startWatching();
    }

    return { success: true, dataDirectory: this.config.dataDirectory };
  }

  async startWatching() {
    try {
      if (this.isWatching) return { success: true, message: 'Already watching' };

      await this.ensureStore();
      const filePath = this.getFilePath();

      this.watcher = chokidar.watch([filePath], {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });

      this.watcher.on('change', () => this.handleFileChanged());
      this.watcher.on('add', () => this.handleFileChanged());
      this.watcher.on('error', (error) => {
        this.emit('error', { error: error.message });
      });

      this.isWatching = true;
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async stopWatching() {
    if (!this.watcher) {
      this.isWatching = false;
      return { success: true };
    }

    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;
    return { success: true };
  }

  async handleFileChanged() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    this.debounceTimer = setTimeout(async () => {
      const loadResult = await this.loadCalendar();
      if (!loadResult.success) return;

      const currentHash = this.simpleHash(JSON.stringify(loadResult.entries));
      if (this.lastContentHash && currentHash === this.lastContentHash) {
        return;
      }

      this.lastContentHash = currentHash;
      this.emit('changed', {
        filePath: loadResult.filePath,
        dataDirectory: this.config.dataDirectory,
        entries: loadResult.entries,
        changedAt: new Date().toISOString()
      });
    }, this.config.debounceMs);
  }

  simpleHash(value) {
    let hash = 0;
    const str = String(value || '');
    for (let i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }
}

module.exports = SharedCalendarService;
