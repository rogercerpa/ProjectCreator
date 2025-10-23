const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SecurityLoggingService {
  constructor() {
    this.logDir = path.join(os.homedir(), '.project-creator', 'logs');
    this.securityLogFile = path.join(this.logDir, 'security.log');
    this.auditLogFile = path.join(this.logDir, 'audit.log');
    this.initializeLogging();
  }

  async initializeLogging() {
    try {
      await fs.ensureDir(this.logDir);
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  async logSecurityEvent(eventType, details, severity = 'INFO') {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        eventType,
        severity,
        details,
        user: process.env.USERNAME || 'unknown',
        hostname: os.hostname(),
        platform: os.platform()
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.securityLogFile, logLine);

      // Also log to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SECURITY] ${severity}: ${eventType}`, details);
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  async logAuditEvent(action, resource, user, details = {}) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        action,
        resource,
        user,
        details,
        hostname: os.hostname(),
        ip: this.getClientIP()
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.auditLogFile, logLine);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  async logFailedLogin(username, reason, ipAddress) {
    await this.logSecurityEvent('LOGIN_FAILED', {
      username,
      reason,
      ipAddress,
      userAgent: this.getUserAgent()
    }, 'WARNING');
  }

  async logSuccessfulLogin(username, ipAddress) {
    await this.logSecurityEvent('LOGIN_SUCCESS', {
      username,
      ipAddress,
      userAgent: this.getUserAgent()
    }, 'INFO');
  }

  async logSuspiciousActivity(activity, details) {
    await this.logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      activity,
      details
    }, 'WARNING');
  }

  async logPathTraversalAttempt(path, user) {
    await this.logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', {
      attemptedPath: path,
      user
    }, 'HIGH');
  }

  async logFileAccess(filePath, user, operation) {
    await this.logAuditEvent('FILE_ACCESS', filePath, user, {
      operation,
      timestamp: new Date().toISOString()
    });
  }

  async logAdminAction(action, user, details) {
    await this.logSecurityEvent('ADMIN_ACTION', {
      action,
      user,
      details
    }, 'INFO');
  }

  async getSecurityLogs(limit = 100) {
    try {
      if (!await fs.pathExists(this.securityLogFile)) {
        return [];
      }

      const content = await fs.readFile(this.securityLogFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const logs = lines.slice(-limit).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(log => log !== null);

      return logs.reverse();
    } catch (error) {
      console.error('Failed to read security logs:', error);
      return [];
    }
  }

  async getAuditLogs(limit = 100) {
    try {
      if (!await fs.pathExists(this.auditLogFile)) {
        return [];
      }

      const content = await fs.readFile(this.auditLogFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const logs = lines.slice(-limit).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(log => log !== null);

      return logs.reverse();
    } catch (error) {
      console.error('Failed to read audit logs:', error);
      return [];
    }
  }

  async clearOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clear old security logs
      if (await fs.pathExists(this.securityLogFile)) {
        const content = await fs.readFile(this.securityLogFile, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const recentLogs = lines.filter(line => {
          try {
            const log = JSON.parse(line);
            return new Date(log.timestamp) > cutoffDate;
          } catch {
            return false;
          }
        });

        await fs.writeFile(this.securityLogFile, recentLogs.join('\n') + '\n');
      }

      // Clear old audit logs
      if (await fs.pathExists(this.auditLogFile)) {
        const content = await fs.readFile(this.auditLogFile, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const recentLogs = lines.filter(line => {
          try {
            const log = JSON.parse(line);
            return new Date(log.timestamp) > cutoffDate;
          } catch {
            return false;
          }
        });

        await fs.writeFile(this.auditLogFile, recentLogs.join('\n') + '\n');
      }
    } catch (error) {
      console.error('Failed to clear old logs:', error);
    }
  }

  getClientIP() {
    // In Electron, this would typically come from the request context
    // For now, return a placeholder
    return '127.0.0.1';
  }

  getUserAgent() {
    // In Electron, this would come from the renderer process
    // For now, return a placeholder
    return 'Electron App';
  }

  // Export logs for analysis
  async exportLogs(format = 'json', startDate = null, endDate = null) {
    try {
      const securityLogs = await this.getSecurityLogs(10000);
      const auditLogs = await this.getAuditLogs(10000);

      let filteredSecurityLogs = securityLogs;
      let filteredAuditLogs = auditLogs;

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();

        filteredSecurityLogs = securityLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= start && logDate <= end;
        });

        filteredAuditLogs = auditLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= start && logDate <= end;
        });
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        securityLogs: filteredSecurityLogs,
        auditLogs: filteredAuditLogs,
        summary: {
          totalSecurityEvents: filteredSecurityLogs.length,
          totalAuditEvents: filteredAuditLogs.length,
          dateRange: {
            start: startDate || 'all',
            end: endDate || 'all'
          }
        }
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else if (format === 'csv') {
        return this.convertToCSV(exportData);
      }

      return exportData;
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  }

  convertToCSV(data) {
    // Simple CSV conversion for log export
    const headers = ['timestamp', 'eventType', 'severity', 'user', 'details'];
    const csvRows = [headers.join(',')];

    data.securityLogs.forEach(log => {
      const row = [
        log.timestamp,
        log.eventType,
        log.severity,
        log.user,
        JSON.stringify(log.details).replace(/"/g, '""')
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }
}

module.exports = SecurityLoggingService;
