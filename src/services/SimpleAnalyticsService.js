/**
 * Simple Analytics Service
 * Safe for both main and renderer processes
 */

class SimpleAnalyticsService {
  constructor() {
    this.isEnabled = false;
    this.events = [];
    this.userId = null;
    this.userProperties = {};
  }

  /**
   * Initialize analytics (safe for both processes)
   */
  initialize(options = {}) {
    this.isEnabled = options.enabled !== false;
    this.userId = options.userId || null;
    this.userProperties = options.userProperties || {};
    
    if (this.isEnabled) {
      console.log('SimpleAnalyticsService initialized');
      this.trackEvent('app_initialized', {
        version: options.version || 'unknown',
        platform: typeof process !== 'undefined' ? process.platform : 'unknown',
        arch: typeof process !== 'undefined' ? process.arch : 'unknown'
      });
    }
  }

  /**
   * Track event (safe for both processes)
   */
  trackEvent(eventName, properties = {}) {
    if (!this.isEnabled) return;

    const event = {
      name: eventName,
      properties: {
        ...properties,
        userId: this.userId,
        timestamp: Date.now(),
        sessionId: this.getSessionId()
      }
    };

    this.events.push(event);
    console.log('[ANALYTICS] Event tracked:', event);

    // In a real implementation, you would send this to your analytics service
  }

  /**
   * Track page view (safe for both processes)
   */
  trackPageView(page, properties = {}) {
    this.trackEvent('page_view', {
      page,
      ...properties
    });
  }

  /**
   * Track project creation (safe for both processes)
   */
  trackProjectCreation(project, properties = {}) {
    this.trackEvent('project_created', {
      projectId: project.id,
      projectType: project.rfaType,
      regionalTeam: project.regionalTeam,
      ...properties
    });
  }

  /**
   * Track error (safe for both processes)
   */
  trackError(error, context = {}) {
    this.trackEvent('error', {
      errorMessage: error.message,
      errorStack: error.stack,
      ...context
    });
  }

  /**
   * Set user information (safe for both processes)
   */
  setUser(userId, properties = {}) {
    this.userId = userId;
    this.userProperties = { ...this.userProperties, ...properties };
    console.log('[ANALYTICS] User set:', { userId, properties });
  }

  /**
   * Get session ID (safe for both processes)
   */
  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.sessionId;
  }

  /**
   * Cleanup (safe for both processes)
   */
  cleanup() {
    console.log('SimpleAnalyticsService cleaned up');
    this.events = [];
    this.isEnabled = false;
  }
}

// Create singleton instance
const simpleAnalyticsService = new SimpleAnalyticsService();

export default simpleAnalyticsService;


