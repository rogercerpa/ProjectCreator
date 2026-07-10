const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5MB rotation threshold
const MAX_MEMORY_ENTRIES = 200;
const DEFAULT_LIST_LIMIT = 200;

// Basic redaction to avoid leaking secrets into logs/exports
const SENSITIVE_KEY_PATTERN = /(password|secret|token|apikey|api_key|authorization|credential)/i;

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return '[Truncated]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    // Redact obvious secret-looking strings (long base64/hex tokens) conservatively is out of scope;
    // rely primarily on key-based redaction below. Just cap length.
    return value.length > 2000 ? `${value.slice(0, 2000)}…[truncated]` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitizeValue(val, depth + 1);
      }
    }
    return result;
  }

  return value;
}

class ErrorLogService {
  constructor(options = {}) {
    this.logDir = path.join(os.homedir(), '.project-creator', 'logs');
    this.errorLogFile = path.join(this.logDir, 'errors.log');
    this.sessionId = crypto.randomUUID();
    this.appVersion = options.appVersion || 'unknown';
    this.appName = options.appName || 'Project Creator';
    this.buildDate = options.buildDate || null;
    this.getVersions = options.getVersions || (() => ({}));

    // In-memory ring buffer for fast access without re-reading the file each time
    this.memoryEntries = [];

    this.initializeLogging();
  }

  async initializeLogging() {
    try {
      await fs.ensureDir(this.logDir);
      await this.rotateIfNeeded();
      await this.loadRecentIntoMemory();
    } catch (error) {
      console.error('[ErrorLogService] Failed to initialize:', error);
    }
  }

  async rotateIfNeeded() {
    try {
      if (!(await fs.pathExists(this.errorLogFile))) return;
      const stats = await fs.stat(this.errorLogFile);
      if (stats.size > MAX_LOG_BYTES) {
        const archivePath = path.join(
          this.logDir,
          `errors-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
        );
        await fs.move(this.errorLogFile, archivePath, { overwrite: true });
      }
    } catch (error) {
      console.error('[ErrorLogService] Failed to rotate log file:', error);
    }
  }

  async loadRecentIntoMemory() {
    try {
      if (!(await fs.pathExists(this.errorLogFile))) return;
      const content = await fs.readFile(this.errorLogFile, 'utf8');
      const lines = content.trim().split('\n').filter((line) => line.trim());
      const parsed = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      this.memoryEntries = parsed.slice(-MAX_MEMORY_ENTRIES);
    } catch (error) {
      console.error('[ErrorLogService] Failed to load recent entries:', error);
    }
  }

  buildEnvironmentSnapshot() {
    const versions = this.getVersions() || {};
    return {
      appName: this.appName,
      appVersion: this.appVersion,
      buildDate: this.buildDate,
      electronVersion: versions.electron || process.versions?.electron || 'unknown',
      nodeVersion: versions.node || process.versions?.node || 'unknown',
      chromeVersion: versions.chrome || process.versions?.chrome || 'unknown',
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      username: process.env.USERNAME || process.env.USER || 'unknown',
      locale: process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || 'unknown',
      sessionId: this.sessionId
    };
  }

  /**
   * Log a new error entry. Returns the generated entry (including id).
   */
  async logError(entry) {
    try {
      const id = entry.id || crypto.randomUUID();
      const timestamp = entry.timestamp || new Date().toISOString();

      const fullEntry = {
        id,
        timestamp,
        severity: entry.severity === 'warning' ? 'warning' : 'error',
        category: entry.category || 'general',
        userMessage: entry.userMessage || 'An unexpected error occurred.',
        technicalMessage: entry.technicalMessage || null,
        stack: entry.stack || null,
        context: sanitizeValue(entry.context || {}),
        sessionId: this.sessionId
      };

      await this.rotateIfNeeded();

      const logLine = JSON.stringify(fullEntry) + '\n';
      await fs.appendFile(this.errorLogFile, logLine);

      this.memoryEntries.push(fullEntry);
      if (this.memoryEntries.length > MAX_MEMORY_ENTRIES) {
        this.memoryEntries.shift();
      }

      if (process.env.NODE_ENV === 'development') {
        console.error(`[ErrorLog] ${fullEntry.severity.toUpperCase()} [${fullEntry.category}]: ${fullEntry.userMessage}`);
      }

      return fullEntry;
    } catch (error) {
      console.error('[ErrorLogService] Failed to log error:', error);
      return null;
    }
  }

  async listErrors({ limit = DEFAULT_LIST_LIMIT, category = null, severity = null, since = null } = {}) {
    try {
      // Ensure memory reflects disk in case of external changes; memory is authoritative for this session
      let entries = [...this.memoryEntries];

      if (category) {
        entries = entries.filter((e) => e.category === category);
      }
      if (severity) {
        entries = entries.filter((e) => e.severity === severity);
      }
      if (since) {
        const sinceDate = new Date(since);
        entries = entries.filter((e) => new Date(e.timestamp) >= sinceDate);
      }

      // Newest first
      entries = entries.slice(-limit).reverse();
      return entries;
    } catch (error) {
      console.error('[ErrorLogService] Failed to list errors:', error);
      return [];
    }
  }

  async getError(id) {
    return this.memoryEntries.find((e) => e.id === id) || null;
  }

  async clearErrors() {
    try {
      this.memoryEntries = [];
      await fs.writeFile(this.errorLogFile, '');
      return { success: true };
    } catch (error) {
      console.error('[ErrorLogService] Failed to clear errors:', error);
      return { success: false, error: error.message };
    }
  }

  buildExportBundle() {
    const errors = [...this.memoryEntries].reverse(); // newest first
    const errorCount = errors.filter((e) => e.severity === 'error').length;
    const warningCount = errors.filter((e) => e.severity === 'warning').length;
    const timestamps = errors.map((e) => new Date(e.timestamp).getTime()).filter((t) => !Number.isNaN(t));

    return {
      reportType: 'ProjectCreatorErrorReport',
      reportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      environment: this.buildEnvironmentSnapshot(),
      summary: {
        totalErrors: errors.length,
        errorCount,
        warningCount,
        dateRange: {
          oldest: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
          newest: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null
        }
      },
      errors
    };
  }

  async exportErrorsToFile(savePath) {
    try {
      const bundle = this.buildExportBundle();
      await fs.writeFile(savePath, JSON.stringify(bundle, null, 2), 'utf8');
      return { success: true, filePath: savePath };
    } catch (error) {
      console.error('[ErrorLogService] Failed to export errors to file:', error);
      return { success: false, error: error.message };
    }
  }

  getDefaultExportFilename() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `ProjectCreator-ErrorReport-${stamp}.json`;
  }
}

module.exports = ErrorLogService;
