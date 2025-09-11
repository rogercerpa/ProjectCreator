/**
 * Analytics Service
 * Handles user analytics, feature usage tracking, and performance metrics
 */

class AnalyticsService {
  constructor() {
    this.isEnabled = true;
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.events = [];
    this.maxEvents = 1000;
    this.flushInterval = 30000; // 30 seconds
    this.flushTimer = null;
    this.userId = null;
    this.userProperties = {};
  }

  /**
   * Initialize analytics
   */
  initialize(options = {}) {
    this.isEnabled = options.enabled !== false;
    this.userId = options.userId || null;
    this.userProperties = options.userProperties || {};
    
    if (this.isEnabled) {
      this.startFlushTimer();
      this.trackEvent('app_initialized', {
        version: options.version || 'unknown',
        platform: typeof process !== 'undefined' ? process.platform : 'unknown',
        arch: typeof process !== 'undefined' ? process.arch : 'unknown'
      });
    }
  }

  /**
   * Set user information
   */
  setUser(userId, properties = {}) {
    this.userId = userId;
    this.userProperties = {
      ...this.userProperties,
      ...properties
    };
  }

  /**
   * Track custom event
   */
  trackEvent(eventName, properties = {}) {
    if (!this.isEnabled) return;

    const event = {
      event: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        platform: process.platform,
        arch: process.arch
      },
      timestamp: new Date().toISOString()
    };

    this.events.push(event);

    // Prevent memory overflow
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    console.log(`Analytics: ${eventName}`, properties);
  }

  /**
   * Track page view
   */
  trackPageView(pageName, properties = {}) {
    this.trackEvent('page_view', {
      page: pageName,
      ...properties
    });
  }

  /**
   * Track user action
   */
  trackAction(action, properties = {}) {
    this.trackEvent('user_action', {
      action,
      ...properties
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(feature, properties = {}) {
    this.trackEvent('feature_used', {
      feature,
      ...properties
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric, value, unit = 'ms', properties = {}) {
    this.trackEvent('performance_metric', {
      metric,
      value,
      unit,
      ...properties
    });
  }

  /**
   * Track error
   */
  trackError(error, properties = {}) {
    this.trackEvent('error_occurred', {
      error: error.message,
      stack: error.stack,
      ...properties
    });
  }

  /**
   * Track project creation
   */
  trackProjectCreation(projectData, properties = {}) {
    this.trackEvent('project_created', {
      projectType: projectData.rfaType,
      regionalTeam: projectData.regionalTeam,
      complexity: projectData.complexity,
      ...properties
    });
  }

  /**
   * Track project completion
   */
  trackProjectCompletion(projectData, duration, properties = {}) {
    this.trackEvent('project_completed', {
      projectType: projectData.rfaType,
      regionalTeam: projectData.regionalTeam,
      complexity: projectData.complexity,
      duration,
      ...properties
    });
  }

  /**
   * Track wizard step completion
   */
  trackWizardStep(step, stepData, properties = {}) {
    this.trackEvent('wizard_step_completed', {
      step,
      stepData: this.sanitizeStepData(stepData),
      ...properties
    });
  }

  /**
   * Track form interaction
   */
  trackFormInteraction(formName, fieldName, action, properties = {}) {
    this.trackEvent('form_interaction', {
      form: formName,
      field: fieldName,
      action,
      ...properties
    });
  }

  /**
   * Track file operation
   */
  trackFileOperation(operation, fileType, success, properties = {}) {
    this.trackEvent('file_operation', {
      operation,
      fileType,
      success,
      ...properties
    });
  }

  /**
   * Track export operation
   */
  trackExport(format, projectCount, properties = {}) {
    this.trackEvent('export_performed', {
      format,
      projectCount,
      ...properties
    });
  }

  /**
   * Track settings change
   */
  trackSettingsChange(setting, oldValue, newValue, properties = {}) {
    this.trackEvent('settings_changed', {
      setting,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue),
      ...properties
    });
  }

  /**
   * Track app performance
   */
  trackAppPerformance(metric, value, properties = {}) {
    this.trackEvent('app_performance', {
      metric,
      value,
      ...properties
    });
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage() {
    if (process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      this.trackPerformance('memory_usage', memoryUsage.heapUsed, 'bytes', {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      });
    }
  }

  /**
   * Track CPU usage
   */
  trackCPUUsage() {
    if (process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      this.trackPerformance('cpu_usage', cpuUsage.user + cpuUsage.system, 'microseconds');
    }
  }

  /**
   * Start periodic performance tracking
   */
  startPerformanceTracking(interval = 60000) {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
    }

    this.performanceTimer = setInterval(() => {
      this.trackMemoryUsage();
      this.trackCPUUsage();
    }, interval);
  }

  /**
   * Stop performance tracking
   */
  stopPerformanceTracking() {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer);
      this.performanceTimer = null;
    }
  }

  /**
   * Get analytics data
   */
  getAnalyticsData() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      eventCount: this.events.length,
      sessionDuration: Date.now() - this.startTime,
      events: this.events.slice(-100) // Last 100 events
    };
  }

  /**
   * Export analytics data
   */
  exportAnalyticsData() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      eventCount: this.events.length,
      events: this.events
    };
  }

  /**
   * Clear analytics data
   */
  clearData() {
    this.events = [];
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
  }

  /**
   * Start flush timer
   */
  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop flush timer
   */
  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush events (send to server)
   */
  async flush() {
    if (this.events.length === 0) return;

    try {
      // In a real implementation, this would send data to your analytics server
      console.log(`Flushing ${this.events.length} analytics events`);
      
      // For now, just log the events
      this.events.forEach(event => {
        console.log('Analytics Event:', event);
      });

      // Clear events after flushing
      this.events = [];
    } catch (error) {
      console.error('Failed to flush analytics data:', error);
    }
  }

  /**
   * Sanitize step data to remove sensitive information
   */
  sanitizeStepData(stepData) {
    const sanitized = { ...stepData };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'ssn', 'creditCard'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize value to remove sensitive information
   */
  sanitizeValue(value) {
    if (typeof value === 'string') {
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /key/i,
        /secret/i,
        /ssn/i,
        /credit/i
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(value)) {
          return '[REDACTED]';
        }
      }
    }

    return value;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enable analytics
   */
  enable() {
    this.isEnabled = true;
    this.startFlushTimer();
  }

  /**
   * Disable analytics
   */
  disable() {
    this.isEnabled = false;
    this.stopFlushTimer();
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopFlushTimer();
    this.stopPerformanceTracking();
    this.flush();
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

export default analyticsService;
