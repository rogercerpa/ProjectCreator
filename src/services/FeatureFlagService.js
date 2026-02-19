/**
 * FeatureFlagService - Advanced feature flag management system
 * Features: User-based flags, percentage rollouts, A/B testing, analytics integration
 */
class FeatureFlagService {
  constructor() {
    this.flags = new Map();
    this.userOverrides = new Map();
    this.analytics = [];
    this.storageKey = 'feature-flags';
    this.userStorageKey = 'user-feature-overrides';
    
    this.initializeFlags();
    this.loadUserOverrides();
  }

  // Initialize default feature flags
  initializeFlags() {
    const defaultFlags = {
      // Wizard vs Classic Form flags
      'wizard-enabled': {
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['all'],
        description: 'Enable the project wizard interface',
        category: 'ui',
        defaultValue: true
      },
      
      'wizard-as-default': {
        enabled: false,
        rolloutPercentage: 25, // Start with 25% rollout
        userGroups: ['beta-testers', 'new-users'],
        description: 'Make wizard the default project creation method',
        category: 'experience',
        defaultValue: false
      },
      
      'force-wizard-mode': {
        enabled: false,
        rolloutPercentage: 0,
        userGroups: ['admin'],
        description: 'Force all users to use wizard (disable classic form)',
        category: 'migration',
        defaultValue: false
      },
      
      'classic-form-deprecation-warning': {
        enabled: false,
        rolloutPercentage: 50,
        userGroups: ['all'],
        description: 'Show deprecation warning on classic form',
        category: 'migration',
        defaultValue: false
      },
      
      // Enhanced features flags
      'draft-recovery-system': {
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['all'],
        description: 'Enable draft recovery system',
        category: 'features',
        defaultValue: true
      },
      
      'auto-save-feature': {
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['all'],
        description: 'Enable automatic saving of project drafts',
        category: 'features',
        defaultValue: true
      },
      
      'smart-defaults-system': {
        enabled: true,
        rolloutPercentage: 90,
        userGroups: ['all'],
        description: 'Enable intelligent default value suggestions',
        category: 'intelligence',
        defaultValue: true
      },
      
      'enhanced-notifications': {
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['all'],
        description: 'Enable enhanced notification system',
        category: 'ui',
        defaultValue: true
      },
      
      // Experimental features
      'wizard-keyboard-shortcuts': {
        enabled: true,
        rolloutPercentage: 75,
        userGroups: ['power-users'],
        description: 'Enable keyboard shortcuts in wizard',
        category: 'accessibility',
        defaultValue: false
      },
      
      'wizard-voice-commands': {
        enabled: false,
        rolloutPercentage: 5,
        userGroups: ['beta-testers'],
        description: 'Enable voice command support (experimental)',
        category: 'experimental',
        defaultValue: false
      },
      
      'advanced-analytics': {
        enabled: true,
        rolloutPercentage: 80,
        userGroups: ['all'],
        description: 'Enable detailed usage analytics',
        category: 'analytics',
        defaultValue: false
      },
      
      // Migration assistance
      'migration-assistant': {
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['all'],
        description: 'Show migration assistant for new wizard features',
        category: 'onboarding',
        defaultValue: true
      },
      
      'wizard-tutorial': {
        enabled: true,
        rolloutPercentage: 100,
        userGroups: ['new-users'],
        description: 'Show interactive wizard tutorial for first-time users',
        category: 'onboarding',
        defaultValue: true
      },
      
      // Development-only features
      'workload-dashboard': {
        enabled: false,
        rolloutPercentage: 0,
        userGroups: ['admin', 'developers'],
        description: 'Enable Workload Dashboard (in development)',
        category: 'experimental',
        defaultValue: false,
        devOnly: true
      },
      
      'agile-workqueue': {
        enabled: false,
        rolloutPercentage: 0,
        userGroups: ['admin', 'developers'],
        description: 'Enable Agile Workqueue (in development)',
        category: 'experimental',
        defaultValue: false,
        devOnly: true
      }
    };

    // Load flags from storage or use defaults
    const storedFlags = this.loadStoredFlags();
    
    Object.entries(defaultFlags).forEach(([key, config]) => {
      this.flags.set(key, {
        ...config,
        ...(storedFlags[key] || {}),
        lastUpdated: Date.now()
      });
    });
    
    // Auto-enable devOnly flags in development environment
    const isDevelopment = typeof import.meta !== 'undefined' 
      ? (import.meta.env?.MODE === 'development' || import.meta.env?.DEV)
      : (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');
    
    if (isDevelopment) {
      this.flags.forEach((flag, key) => {
        if (flag.devOnly) {
          flag.enabled = true;
          flag.rolloutPercentage = 100;
        }
      });
    }
  }

  // Load stored flags from localStorage
  loadStoredFlags() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Error loading stored feature flags:', error);
      return {};
    }
  }

  // Load user-specific overrides
  loadUserOverrides() {
    try {
      const stored = localStorage.getItem(this.userStorageKey);
      if (stored) {
        const overrides = JSON.parse(stored);
        Object.entries(overrides).forEach(([key, value]) => {
          this.userOverrides.set(key, value);
        });
      }
    } catch (error) {
      console.warn('Error loading user feature overrides:', error);
    }
  }

  // Save flags to storage
  saveFlags() {
    try {
      const flagsObject = {};
      this.flags.forEach((value, key) => {
        flagsObject[key] = value;
      });
      localStorage.setItem(this.storageKey, JSON.stringify(flagsObject));
    } catch (error) {
      console.error('Error saving feature flags:', error);
    }
  }

  // Save user overrides to storage
  saveUserOverrides() {
    try {
      const overridesObject = {};
      this.userOverrides.forEach((value, key) => {
        overridesObject[key] = value;
      });
      localStorage.setItem(this.userStorageKey, JSON.stringify(overridesObject));
    } catch (error) {
      console.error('Error saving user overrides:', error);
    }
  }

  // Get user ID (simplified for demo - in real app, this would come from auth)
  getUserId() {
    return localStorage.getItem('user-id') || 'anonymous';
  }

  // Get user group (simplified - would typically come from user profile)
  getUserGroup() {
    const userId = this.getUserId();
    const userType = localStorage.getItem('user-type') || 'regular';
    
    // Simple user group logic
    if (userId === 'admin' || userType === 'admin') return 'admin';
    if (userType === 'beta') return 'beta-testers';
    if (userType === 'power') return 'power-users';
    if (this.isNewUser()) return 'new-users';
    
    return 'regular';
  }

  // Check if user is new (joined in last 30 days)
  isNewUser() {
    const joinDate = localStorage.getItem('user-join-date');
    if (!joinDate) return true; // Assume new if no join date
    
    const daysSinceJoin = (Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceJoin <= 30;
  }

  // Generate consistent hash for percentage-based rollouts
  getUserHash(flagName) {
    const userId = this.getUserId();
    const str = `${userId}-${flagName}`;
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash) % 100; // Return 0-99
  }

  // Check if flag is enabled for current user
  isEnabled(flagName) {
    // Check user override first
    if (this.userOverrides.has(flagName)) {
      const override = this.userOverrides.get(flagName);
      this.trackUsage(flagName, override.enabled, 'user-override');
      return override.enabled;
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      this.trackUsage(flagName, false, 'globally-disabled');
      return false;
    }

    // Check user group eligibility
    const userGroup = this.getUserGroup();
    if (flag.userGroups && flag.userGroups.length > 0 && 
        !flag.userGroups.includes('all') && !flag.userGroups.includes(userGroup)) {
      this.trackUsage(flagName, false, 'user-group-exclusion');
      return false;
    }

    // Check percentage rollout
    if (flag.rolloutPercentage < 100) {
      const userHash = this.getUserHash(flagName);
      const isInRollout = userHash < flag.rolloutPercentage;
      this.trackUsage(flagName, isInRollout, 'percentage-rollout');
      return isInRollout;
    }

    this.trackUsage(flagName, true, 'enabled');
    return true;
  }

  // Get flag value with default fallback
  getValue(flagName, defaultValue = null) {
    const flag = this.flags.get(flagName);
    if (!flag) return defaultValue;

    if (this.isEnabled(flagName)) {
      return flag.value !== undefined ? flag.value : flag.defaultValue;
    }

    return defaultValue;
  }

  // Set user override for a flag
  setUserOverride(flagName, enabled, reason = 'manual') {
    this.userOverrides.set(flagName, {
      enabled,
      reason,
      timestamp: Date.now()
    });
    this.saveUserOverrides();
    
    console.log(`User override set: ${flagName} = ${enabled} (${reason})`);
  }

  // Remove user override
  removeUserOverride(flagName) {
    this.userOverrides.delete(flagName);
    this.saveUserOverrides();
    
    console.log(`User override removed: ${flagName}`);
  }

  // Update flag configuration (admin function)
  updateFlag(flagName, updates) {
    const flag = this.flags.get(flagName);
    if (!flag) {
      console.error(`Cannot update unknown flag: ${flagName}`);
      return false;
    }

    this.flags.set(flagName, {
      ...flag,
      ...updates,
      lastUpdated: Date.now()
    });
    
    this.saveFlags();
    console.log(`Flag updated: ${flagName}`, updates);
    return true;
  }

  // Track feature flag usage for analytics
  trackUsage(flagName, enabled, reason) {
    const usage = {
      flagName,
      enabled,
      reason,
      userId: this.getUserId(),
      userGroup: this.getUserGroup(),
      timestamp: Date.now(),
      sessionId: this.getSessionId()
    };

    this.analytics.push(usage);
    
    // Keep only last 100 analytics entries to prevent memory bloat
    if (this.analytics.length > 100) {
      this.analytics = this.analytics.slice(-100);
    }

    // In a real app, you might send this to an analytics service
    console.debug('Feature flag usage:', usage);
  }

  // Get session ID for analytics
  getSessionId() {
    let sessionId = sessionStorage.getItem('session-id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('session-id', sessionId);
    }
    return sessionId;
  }

  // Get all flags with their current status
  getAllFlags() {
    const result = {};
    this.flags.forEach((flag, name) => {
      result[name] = {
        ...flag,
        currentlyEnabled: this.isEnabled(name),
        hasUserOverride: this.userOverrides.has(name),
        userOverride: this.userOverrides.get(name)
      };
    });
    return result;
  }

  // Get flags by category
  getFlagsByCategory(category) {
    const result = {};
    this.flags.forEach((flag, name) => {
      if (flag.category === category) {
        result[name] = {
          ...flag,
          currentlyEnabled: this.isEnabled(name)
        };
      }
    });
    return result;
  }

  // Get analytics data
  getAnalytics() {
    return {
      usage: [...this.analytics],
      summary: this.getAnalyticsSummary()
    };
  }

  // Get analytics summary
  getAnalyticsSummary() {
    const summary = {
      totalUsages: this.analytics.length,
      flagUsage: {},
      reasonBreakdown: {},
      userGroupBreakdown: {}
    };

    this.analytics.forEach(usage => {
      // Flag usage count
      summary.flagUsage[usage.flagName] = (summary.flagUsage[usage.flagName] || 0) + 1;
      
      // Reason breakdown
      summary.reasonBreakdown[usage.reason] = (summary.reasonBreakdown[usage.reason] || 0) + 1;
      
      // User group breakdown
      summary.userGroupBreakdown[usage.userGroup] = (summary.userGroupBreakdown[usage.userGroup] || 0) + 1;
    });

    return summary;
  }

  // Wizard-specific convenience methods
  isWizardEnabled() {
    return this.isEnabled('wizard-enabled');
  }

  isWizardDefault() {
    return this.isEnabled('wizard-as-default');
  }

  isClassicFormForced() {
    return this.isEnabled('force-classic-form');
  }

  isWizardForced() {
    return this.isEnabled('force-wizard-mode');
  }

  shouldShowDeprecationWarning() {
    return this.isEnabled('classic-form-deprecation-warning');
  }

  isDraftRecoveryEnabled() {
    return this.isEnabled('draft-recovery-system');
  }

  isAutoSaveEnabled() {
    return this.isEnabled('auto-save-feature');
  }

  isSmartDefaultsEnabled() {
    return this.isEnabled('smart-defaults-system');
  }

  shouldShowMigrationAssistant() {
    return this.isEnabled('migration-assistant');
  }

  shouldShowWizardTutorial() {
    return this.isEnabled('wizard-tutorial');
  }

  // Migration strategy helpers
  getRecommendedInterface() {
    if (this.isWizardForced()) return 'wizard-only';
    if (this.isClassicFormForced()) return 'classic-only';
    if (this.isWizardDefault()) return 'wizard-default';
    return 'user-choice';
  }

  // Export configuration for backup
  exportConfiguration() {
    return {
      flags: Object.fromEntries(this.flags),
      userOverrides: Object.fromEntries(this.userOverrides),
      analytics: this.analytics,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  // Import configuration from backup
  importConfiguration(config) {
    try {
      if (config.flags) {
        this.flags = new Map(Object.entries(config.flags));
        this.saveFlags();
      }
      
      if (config.userOverrides) {
        this.userOverrides = new Map(Object.entries(config.userOverrides));
        this.saveUserOverrides();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error importing feature flag configuration:', error);
      return { success: false, error: error.message };
    }
  }

  // Reset all flags to defaults
  resetToDefaults() {
    this.userOverrides.clear();
    this.analytics = [];
    localStorage.removeItem(this.userStorageKey);
    this.initializeFlags();
    console.log('Feature flags reset to defaults');
  }
}

// Export singleton instance
const featureFlagService = new FeatureFlagService();
export default featureFlagService;


