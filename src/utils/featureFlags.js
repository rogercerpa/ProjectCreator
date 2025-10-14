/**
 * Feature Flags for Safe Refactoring
 * 
 * This system allows us to deploy refactored code in production
 * but keep it disabled until we're confident it works.
 * 
 * Usage:
 * ```javascript
 * import { isFeatureEnabled } from './utils/featureFlags';
 * 
 * if (isFeatureEnabled('NEW_IPC_HANDLERS')) {
 *   // Use new refactored code
 * } else {
 *   // Use old stable code
 * }
 * ```
 */

const FEATURE_FLAGS = {
  // Phase 1: IPC Handler Refactor
  NEW_IPC_HANDLERS: {
    enabled: false,
    description: 'Use refactored IPC handler modules',
    rolloutPercentage: 0, // 0-100, for gradual rollout
    environment: ['development'] // or ['development', 'production']
  },
  
  // Phase 1: Service Consolidation
  CONSOLIDATED_MONITORING: {
    enabled: false,
    description: 'Use consolidated monitoring service',
    rolloutPercentage: 0,
    environment: ['development']
  },
  
  // Phase 2: React Performance
  OPTIMIZED_COMPONENTS: {
    enabled: false,
    description: 'Use memoized and optimized React components',
    rolloutPercentage: 0,
    environment: ['development']
  },
  
  // Phase 2: IPC Batching
  IPC_BATCHING: {
    enabled: false,
    description: 'Enable IPC call batching for performance',
    rolloutPercentage: 0,
    environment: ['development']
  },
  
  // Phase 3: TypeScript
  TYPESCRIPT_MODE: {
    enabled: false,
    description: 'Use TypeScript compiled code',
    rolloutPercentage: 0,
    environment: ['development']
  },
  
  // Phase 3: State Management
  ZUSTAND_STATE: {
    enabled: false,
    description: 'Use Zustand for state management',
    rolloutPercentage: 0,
    environment: ['development']
  },
  
  // Phase 4: Database
  SQLITE_PERSISTENCE: {
    enabled: false,
    description: 'Use SQLite instead of JSON files',
    rolloutPercentage: 0,
    environment: ['development']
  }
};

/**
 * Check if a feature flag is enabled
 * @param {string} flagName - Name of the feature flag
 * @returns {boolean} - Whether the feature is enabled
 */
export function isFeatureEnabled(flagName) {
  const flag = FEATURE_FLAGS[flagName];
  
  if (!flag) {
    console.warn(`Unknown feature flag: ${flagName}`);
    return false;
  }
  
  // Check if disabled
  if (!flag.enabled) {
    return false;
  }
  
  // Check environment
  const currentEnv = process.env.NODE_ENV || 'development';
  if (!flag.environment.includes(currentEnv)) {
    return false;
  }
  
  // Check rollout percentage
  if (flag.rolloutPercentage < 100) {
    const userHash = getUserHash();
    const rolloutHash = hashString(flagName + userHash);
    const percentage = rolloutHash % 100;
    return percentage < flag.rolloutPercentage;
  }
  
  return true;
}

/**
 * Enable a feature flag (for testing)
 * @param {string} flagName - Name of the feature flag
 */
export function enableFeature(flagName) {
  if (FEATURE_FLAGS[flagName]) {
    FEATURE_FLAGS[flagName].enabled = true;
    console.log(`✅ Feature enabled: ${flagName}`);
  }
}

/**
 * Disable a feature flag (for rollback)
 * @param {string} flagName - Name of the feature flag
 */
export function disableFeature(flagName) {
  if (FEATURE_FLAGS[flagName]) {
    FEATURE_FLAGS[flagName].enabled = false;
    console.log(`❌ Feature disabled: ${flagName}`);
  }
}

/**
 * Get all feature flags status
 * @returns {Object} - All feature flags with their status
 */
export function getAllFeatures() {
  const result = {};
  for (const [name, flag] of Object.entries(FEATURE_FLAGS)) {
    result[name] = {
      ...flag,
      isEnabled: isFeatureEnabled(name)
    };
  }
  return result;
}

/**
 * Set rollout percentage for gradual deployment
 * @param {string} flagName - Name of the feature flag
 * @param {number} percentage - Percentage (0-100)
 */
export function setRolloutPercentage(flagName, percentage) {
  if (FEATURE_FLAGS[flagName]) {
    FEATURE_FLAGS[flagName].rolloutPercentage = Math.max(0, Math.min(100, percentage));
    console.log(`📊 Rollout for ${flagName} set to ${percentage}%`);
  }
}

/**
 * Helper: Get consistent user hash for rollout
 * @returns {string}
 */
function getUserHash() {
  // Use username or create a stable identifier
  const username = process.env.USERNAME || process.env.USER || 'anonymous';
  return username;
}

/**
 * Helper: Simple string hash function
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Export for testing
export const _test = {
  FEATURE_FLAGS,
  getUserHash,
  hashString
};

export default {
  isFeatureEnabled,
  enableFeature,
  disableFeature,
  getAllFeatures,
  setRolloutPercentage
};



