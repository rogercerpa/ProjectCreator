/**
 * Performance Monitoring Service
 * Tracks application performance metrics and provides optimization insights
 */

class PerformanceMonitoringService {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.thresholds = {
      renderTime: 100, // ms
      apiResponseTime: 1000, // ms
      memoryUsage: 100 * 1024 * 1024, // 100MB
      cpuUsage: 80 // percentage
    };
    this.isEnabled = true;
    this.reportInterval = 30000; // 30 seconds
    this.reportTimer = null;
  }

  /**
   * Initialize performance monitoring
   */
  initialize(options = {}) {
    this.isEnabled = options.enabled !== false;
    this.thresholds = { ...this.thresholds, ...options.thresholds };
    
    if (this.isEnabled) {
      this.startReporting();
      this.trackAppStartup();
    }
  }

  /**
   * Start timing a performance metric
   */
  startTimer(name, context = {}) {
    if (!this.isEnabled) return;

    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timers.set(timerId, {
      name,
      startTime: performance.now(),
      context
    });
    
    return timerId;
  }

  /**
   * End timing a performance metric
   */
  endTimer(timerId, additionalData = {}) {
    if (!this.isEnabled || !this.timers.has(timerId)) return;

    const timer = this.timers.get(timerId);
    const duration = performance.now() - timer.startTime;
    
    this.recordMetric(timer.name, duration, {
      ...timer.context,
      ...additionalData
    });

    this.timers.delete(timerId);
    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(name, value, context = {}) {
    if (!this.isEnabled) return;

    const metric = {
      name,
      value,
      context,
      timestamp: Date.now(),
      threshold: this.thresholds[name] || null,
      exceeded: this.thresholds[name] ? value > this.thresholds[name] : false
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name).push(metric);

    // Keep only last 100 measurements per metric
    const metrics = this.metrics.get(name);
    if (metrics.length > 100) {
      this.metrics.set(name, metrics.slice(-100));
    }

    // Log if threshold exceeded
    if (metric.exceeded) {
      console.warn(`Performance threshold exceeded for ${name}: ${value}ms (threshold: ${this.thresholds[name]}ms)`);
    }

    return metric;
  }

  /**
   * Track render performance
   */
  trackRender(componentName, renderTime, props = {}) {
    this.recordMetric('renderTime', renderTime, {
      component: componentName,
      props: this.sanitizeProps(props)
    });
  }

  /**
   * Track API call performance
   */
  trackAPICall(endpoint, duration, success, statusCode = null) {
    this.recordMetric('apiResponseTime', duration, {
      endpoint,
      success,
      statusCode
    });
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      this.recordMetric('memoryUsage', memoryUsage.heapUsed, {
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
    if (typeof process !== 'undefined' && process.cpuUsage) {
      const cpuUsage = process.cpuUsage();
      const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
      this.recordMetric('cpuUsage', totalUsage, {
        user: cpuUsage.user,
        system: cpuUsage.system
      });
    }
  }

  /**
   * Track file operation performance
   */
  trackFileOperation(operation, fileSize, duration) {
    this.recordMetric('fileOperation', duration, {
      operation,
      fileSize,
      throughput: fileSize / duration // bytes per ms
    });
  }

  /**
   * Track database operation performance
   */
  trackDatabaseOperation(operation, recordCount, duration) {
    this.recordMetric('databaseOperation', duration, {
      operation,
      recordCount,
      recordsPerSecond: recordCount / (duration / 1000)
    });
  }

  /**
   * Track project creation performance
   */
  trackProjectCreation(projectType, complexity, duration, steps) {
    this.recordMetric('projectCreation', duration, {
      projectType,
      complexity,
      steps,
      timePerStep: duration / steps
    });
  }

  /**
   * Track wizard step performance
   */
  trackWizardStep(step, duration, validationTime, saveTime) {
    this.recordMetric('wizardStep', duration, {
      step,
      validationTime,
      saveTime,
      processingTime: duration - validationTime - saveTime
    });
  }

  /**
   * Track export performance
   */
  trackExport(format, projectCount, duration, fileSize) {
    this.recordMetric('export', duration, {
      format,
      projectCount,
      fileSize,
      projectsPerSecond: projectCount / (duration / 1000),
      throughput: fileSize / duration
    });
  }

  /**
   * Track app startup performance
   */
  trackAppStartup() {
    const startupTime = performance.now();
    this.recordMetric('appStartup', startupTime, {
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      arch: typeof process !== 'undefined' ? process.arch : 'unknown',
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown'
    });
  }

  /**
   * Get performance statistics
   */
  getStats(metricName = null) {
    if (metricName) {
      const metrics = this.metrics.get(metricName) || [];
      return this.calculateStats(metrics);
    }

    const allStats = {};
    for (const [name, metrics] of this.metrics) {
      allStats[name] = this.calculateStats(metrics);
    }

    return allStats;
  }

  /**
   * Calculate statistics for a set of metrics
   */
  calculateStats(metrics) {
    if (metrics.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        p95: 0,
        p99: 0,
        thresholdExceeded: 0
      };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const exceeded = metrics.filter(m => m.exceeded).length;

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      median: values[Math.floor(values.length / 2)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      thresholdExceeded: exceeded,
      thresholdExceededRate: exceeded / values.length
    };
  }

  /**
   * Get performance report
   */
  getReport() {
    const stats = this.getStats();
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalMetrics: Object.keys(stats).length,
        totalMeasurements: Object.values(stats).reduce((sum, stat) => sum + stat.count, 0)
      },
      metrics: stats,
      recommendations: this.generateRecommendations(stats)
    };

    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(stats) {
    const recommendations = [];

    // Check render performance
    if (stats.renderTime && stats.renderTime.avg > this.thresholds.renderTime) {
      recommendations.push({
        type: 'render',
        severity: 'warning',
        message: `Average render time is ${stats.renderTime.avg.toFixed(2)}ms, exceeding threshold of ${this.thresholds.renderTime}ms`,
        suggestion: 'Consider optimizing component rendering or implementing React.memo'
      });
    }

    // Check API performance
    if (stats.apiResponseTime && stats.apiResponseTime.avg > this.thresholds.apiResponseTime) {
      recommendations.push({
        type: 'api',
        severity: 'warning',
        message: `Average API response time is ${stats.apiResponseTime.avg.toFixed(2)}ms, exceeding threshold of ${this.thresholds.apiResponseTime}ms`,
        suggestion: 'Consider optimizing API calls or implementing caching'
      });
    }

    // Check memory usage
    if (stats.memoryUsage && stats.memoryUsage.avg > this.thresholds.memoryUsage) {
      recommendations.push({
        type: 'memory',
        severity: 'error',
        message: `Average memory usage is ${(stats.memoryUsage.avg / 1024 / 1024).toFixed(2)}MB, exceeding threshold of ${this.thresholds.memoryUsage / 1024 / 1024}MB`,
        suggestion: 'Consider implementing memory optimization or garbage collection'
      });
    }

    // Check threshold exceeded rates
    for (const [metricName, stat] of Object.entries(stats)) {
      if (stat.thresholdExceededRate > 0.1) { // More than 10% of measurements exceed threshold
        recommendations.push({
          type: 'threshold',
          severity: 'warning',
          message: `${metricName} exceeds threshold in ${(stat.thresholdExceededRate * 100).toFixed(1)}% of measurements`,
          suggestion: 'Consider adjusting threshold or optimizing performance'
        });
      }
    }

    return recommendations;
  }

  /**
   * Start periodic reporting
   */
  startReporting() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }

    this.reportTimer = setInterval(() => {
      this.trackMemoryUsage();
      this.trackCPUUsage();
      this.generateReport();
    }, this.reportInterval);
  }

  /**
   * Stop periodic reporting
   */
  stopReporting() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  /**
   * Generate and log performance report
   */
  generateReport() {
    const report = this.getReport();
    console.log('Performance Report:', report);
    
    if (report.recommendations.length > 0) {
      console.warn('Performance Recommendations:', report.recommendations);
    }
  }

  /**
   * Sanitize props to remove sensitive data
   */
  sanitizeProps(props) {
    const sanitized = { ...props };
    const sensitiveKeys = ['password', 'token', 'key', 'secret'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.timers.clear();
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Enable performance monitoring
   */
  enable() {
    this.isEnabled = true;
    this.startReporting();
  }

  /**
   * Disable performance monitoring
   */
  disable() {
    this.isEnabled = false;
    this.stopReporting();
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopReporting();
    this.clearMetrics();
  }
}

// Create singleton instance
const performanceMonitoringService = new PerformanceMonitoringService();

export default performanceMonitoringService;
