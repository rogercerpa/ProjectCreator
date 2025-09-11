/**
 * Crash Reporting Service
 * Handles error reporting, analytics, and crash detection
 */

import * as Sentry from '@sentry/electron';
import { getFullVersionInfo } from '../utils/version';

class CrashReportingService {
  constructor() {
    this.isInitialized = false;
    this.userContext = null;
    this.sessionId = this.generateSessionId();
    this.errorCount = 0;
    this.maxErrorsPerSession = 10;
  }

  /**
   * Initialize crash reporting
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      console.warn('CrashReportingService already initialized');
      return;
    }

    try {
      // Only initialize in main process or when explicitly enabled
      if (typeof process !== 'undefined' && process.type === 'renderer') {
        console.log('CrashReportingService: Skipping initialization in renderer process');
        this.isInitialized = true; // Mark as initialized to prevent retries
        return;
      }

      const config = {
        dsn: options.dsn || (typeof process !== 'undefined' && process.env?.SENTRY_DSN) || 'https://your-dsn@sentry.io/project-id',
        environment: options.environment || (typeof process !== 'undefined' && process.env?.NODE_ENV) || 'development',
        release: getFullVersionInfo().full,
        debug: options.debug || false,
        tracesSampleRate: options.tracesSampleRate || 0.1,
        beforeSend: this.beforeSend.bind(this),
        beforeBreadcrumb: this.beforeBreadcrumb.bind(this),
        integrations: [
          // Use default integrations for Electron
        ]
      };

      Sentry.init(config);
      this.isInitialized = true;

      // Set initial context
      this.setContext({
        app: {
          name: 'Project Creator',
          version: getFullVersionInfo().full,
          build: getFullVersionInfo().build
        },
        session: {
          id: this.sessionId,
          startTime: new Date().toISOString()
        }
      });

      console.log('Crash reporting initialized successfully');
    } catch (error) {
      console.error('Failed to initialize crash reporting:', error);
    }
  }

  /**
   * Set user context for better error tracking
   */
  setUserContext(user) {
    this.userContext = user;
    Sentry.setUser({
      id: user.id,
      username: user.username,
      email: user.email,
      company: user.company || 'Acuity Brands'
    });
  }

  /**
   * Set additional context
   */
  setContext(context) {
    Sentry.setContext('app', context.app || {});
    Sentry.setContext('session', context.session || {});
    Sentry.setContext('system', context.system || {});
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message, category = 'info', level = 'info', data = {}) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000
    });
  }

  /**
   * Capture exception
   */
  captureException(error, context = {}) {
    // Only capture in main process
    if (typeof process !== 'undefined' && process.type === 'renderer') {
      console.log('CrashReportingService: Skipping exception capture in renderer process');
      return;
    }

    this.errorCount++;
    
    // Rate limiting
    if (this.errorCount > this.maxErrorsPerSession) {
      console.warn('Error rate limit exceeded, not reporting error');
      return;
    }

    Sentry.withScope((scope) => {
      // Add context
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });

      // Add breadcrumb
      this.addBreadcrumb(
        `Exception captured: ${error.message}`,
        'error',
        'error',
        {
          error: error.message,
          stack: error.stack,
          context: context
        }
      );

      Sentry.captureException(error);
    });
  }

  /**
   * Capture message
   */
  captureMessage(message, level = 'info', context = {}) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });

      this.addBreadcrumb(message, 'message', level, context);
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Track performance
   */
  startTransaction(name, op = 'custom') {
    return Sentry.startSpan({
      name,
      op,
      data: {
        sessionId: this.sessionId,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Track user action
   */
  trackAction(action, properties = {}) {
    this.addBreadcrumb(
      `User action: ${action}`,
      'user',
      'info',
      properties
    );

    Sentry.addBreadcrumb({
      message: `Action: ${action}`,
      category: 'user-action',
      level: 'info',
      data: {
        action,
        properties,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric, value, unit = 'ms') {
    Sentry.addBreadcrumb({
      message: `Performance: ${metric}`,
      category: 'performance',
      level: 'info',
      data: {
        metric,
        value,
        unit,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature, properties = {}) {
    this.addBreadcrumb(
      `Feature used: ${feature}`,
      'feature',
      'info',
      properties
    );
  }

  /**
   * Before send hook for filtering errors
   */
  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Filter out network errors that are not critical
      if (error && error.message && error.message.includes('Network Error')) {
        return null;
      }

      // Filter out specific Electron errors
      if (error && error.message && error.message.includes('ERR_INTERNET_DISCONNECTED')) {
        return null;
      }
    }

    // Add session information
    event.tags = {
      ...event.tags,
      sessionId: this.sessionId,
      errorCount: this.errorCount
    };

    return event;
  }

  /**
   * Before breadcrumb hook for filtering breadcrumbs
   */
  beforeBreadcrumb(breadcrumb, hint) {
    // Filter out sensitive information
    if (breadcrumb.data) {
      // Remove sensitive data
      const sensitiveKeys = ['password', 'token', 'key', 'secret'];
      sensitiveKeys.forEach(key => {
        if (breadcrumb.data[key]) {
          breadcrumb.data[key] = '[REDACTED]';
        }
      });
    }

    return breadcrumb;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      errorCount: this.errorCount,
      sessionId: this.sessionId,
      isInitialized: this.isInitialized,
      maxErrorsPerSession: this.maxErrorsPerSession
    };
  }

  /**
   * Reset error count (for testing)
   */
  resetErrorCount() {
    this.errorCount = 0;
  }

  /**
   * Flush pending events
   */
  async flush() {
    if (this.isInitialized) {
      await Sentry.flush(2000);
    }
  }

  /**
   * Close the service
   */
  async close() {
    if (this.isInitialized) {
      await this.flush();
      Sentry.close();
      this.isInitialized = false;
    }
  }
}

// Create singleton instance
const crashReportingService = new CrashReportingService();

export default crashReportingService;
