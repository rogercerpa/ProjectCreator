/**
 * Simple Performance Monitoring Service
 * Safe for both main and renderer processes
 */

class SimplePerformanceMonitoringService {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.isEnabled = true;
    this.thresholds = {
      renderTime: 100, // ms
      apiResponseTime: 1000, // ms
      memoryUsage: 100 * 1024 * 1024, // 100MB
      cpuUsage: 80 // percentage
    };
  }

  /**
   * Initialize performance monitoring (safe for both processes)
   */
  initialize(options = {}) {
    this.isEnabled = options.enabled !== false;
    this.thresholds = { ...this.thresholds, ...options.thresholds };
    
    if (this.isEnabled) {
      console.log('SimplePerformanceMonitoringService initialized');
      this.trackAppStartup();
    }
  }

  /**
   * Start timing a performance metric (safe for both processes)
   */
  startTimer(name, context = {}) {
    if (!this.isEnabled) return null;

    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timers.set(timerId, {
      name,
      startTime: performance.now(),
      context
    });
    
    return timerId;
  }

  /**
   * End timing a performance metric (safe for both processes)
   */
  endTimer(timerId, additionalData = {}) {
    if (!this.isEnabled || !this.timers.has(timerId)) return null;

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
   * Record a performance metric (safe for both processes)
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

    console.log(`[PERFORMANCE] ${name}: ${value}ms`, context);
    return metric;
  }

  /**
   * Track app startup performance (safe for both processes)
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
   * Track render performance (safe for both processes)
   */
  trackRender(componentName, renderTime, props = {}) {
    this.recordMetric('renderTime', renderTime, {
      component: componentName,
      props: this.sanitizeProps(props)
    });
  }

  /**
   * Track wizard step performance (safe for both processes)
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
   * Get performance statistics (safe for both processes)
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
   * Calculate statistics for a set of metrics (safe for both processes)
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
   * Sanitize props to remove sensitive data (safe for both processes)
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
   * Cleanup (safe for both processes)
   */
  cleanup() {
    console.log('SimplePerformanceMonitoringService cleaned up');
    this.metrics.clear();
    this.timers.clear();
  }
}

// Create singleton instance
const simplePerformanceMonitoringService = new SimplePerformanceMonitoringService();

export default simplePerformanceMonitoringService;


