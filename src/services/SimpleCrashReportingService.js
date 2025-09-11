/**
 * Simple Crash Reporting Service
 * Safe for both main and renderer processes
 */

class SimpleCrashReportingService {
  constructor() {
    this.isInitialized = false;
    this.errorCount = 0;
    this.maxErrorsPerSession = 100;
  }

  /**
   * Initialize crash reporting (safe for both processes)
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      console.log('SimpleCrashReportingService already initialized');
      return;
    }

    try {
      // Only initialize Sentry in main process
      if (typeof process !== 'undefined' && process.type === 'main') {
        console.log('SimpleCrashReportingService: Initializing in main process');
        // Here you would initialize Sentry for main process
        // For now, we'll just log
      } else {
        console.log('SimpleCrashReportingService: Running in renderer process, using console logging');
      }

      this.isInitialized = true;
      console.log('SimpleCrashReportingService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SimpleCrashReportingService:', error);
    }
  }

  /**
   * Capture exception (safe for both processes)
   */
  captureException(error, context = {}) {
    this.errorCount++;
    
    // Rate limiting
    if (this.errorCount > this.maxErrorsPerSession) {
      console.warn('Error rate limit exceeded, not reporting error');
      return;
    }

    // Log error with context
    console.error('Exception captured:', {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString()
    });

    // In a real implementation, you would send this to your crash reporting service
    // For now, we'll just log it
  }

  /**
   * Capture message (safe for both processes)
   */
  captureMessage(message, level = 'info', context = {}) {
    console.log(`[${level.toUpperCase()}] ${message}`, context);
  }

  /**
   * Add breadcrumb (safe for both processes)
   */
  addBreadcrumb(message, category = 'custom', level = 'info', data = {}) {
    console.log(`[BREADCRUMB] ${category}: ${message}`, data);
  }

  /**
   * Set context (safe for both processes)
   */
  setContext(key, context) {
    console.log(`[CONTEXT] ${key}:`, context);
  }

  /**
   * Start transaction (safe for both processes)
   */
  startTransaction(name, op = 'custom') {
    const startTime = Date.now();
    console.log(`[TRANSACTION START] ${name} (${op})`);
    
    return {
      name,
      op,
      startTime,
      finish: () => {
        const duration = Date.now() - startTime;
        console.log(`[TRANSACTION END] ${name}: ${duration}ms`);
      }
    };
  }

  /**
   * Close service (safe for both processes)
   */
  close() {
    console.log('SimpleCrashReportingService closed');
    this.isInitialized = false;
  }
}

// Create singleton instance
const simpleCrashReportingService = new SimpleCrashReportingService();

export default simpleCrashReportingService;


