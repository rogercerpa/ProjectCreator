import { useState, useEffect, useCallback } from 'react';

/**
 * useSmartDefaults - Intelligent default value system
 * Features: Learning from user patterns, context-aware suggestions, preference storage
 */
const useSmartDefaults = ({
  userId = 'default',
  enabled = true,
  learningEnabled = true,
  storageKey = 'wizard-smart-defaults'
}) => {
  const [defaults, setDefaults] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [userPatterns, setUserPatterns] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load stored patterns and defaults
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        setIsLoading(true);
        
        const storedData = localStorage.getItem(`${storageKey}-${userId}`);
        if (storedData) {
          const parsed = JSON.parse(storedData);
          setDefaults(parsed.defaults || {});
          setUserPatterns(parsed.patterns || {});
        }
        
        // Initialize default values if none exist
        if (!storedData) {
          setDefaults(getInitialDefaults());
        }
        
      } catch (error) {
        console.warn('Error loading smart defaults:', error);
        setDefaults(getInitialDefaults());
      } finally {
        setIsLoading(false);
      }
    };

    if (enabled) {
      loadStoredData();
    }
  }, [userId, enabled, storageKey]);

  // Get initial default values
  const getInitialDefaults = useCallback(() => {
    return {
      // Project defaults
      saveLocation: 'Server',
      roomMultiplier: 2,
      riserMultiplier: 1,
      reviewSetup: 0.5,
      soo: 0.5,
      numOfPages: 1,
      specReview: 0,
      
      // Regional team based on time zone or previous selections
      regionalTeam: getDefaultRegionalTeam(),
      
      // RFA type based on frequency
      rfaType: 'BOM (With Layout)', // Most common
      
      // Triage defaults
      hasPanelSchedules: true,
      hasSubmittals: false,
      needsLayoutBOM: true,
      
      // Common values
      esheetsSchedules: 2, // No by default
      firstAvailable: false
    };
  }, []);

  // Get default regional team based on timezone or patterns
  const getDefaultRegionalTeam = () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hour = new Date().getHours();
    
    // Simple timezone-based defaults
    if (timezone.includes('Eastern') || hour >= 8 && hour <= 17) {
      return 'East';
    } else if (timezone.includes('Central')) {
      return 'Central';
    } else if (timezone.includes('Mountain')) {
      return 'Mountain';
    } else if (timezone.includes('Pacific')) {
      return 'West';
    }
    
    return 'East'; // Default fallback
  };

  // Learn from user input patterns
  const learnFromInput = useCallback((fieldName, value, context = {}) => {
    if (!learningEnabled || !fieldName || value === undefined) return;

    setUserPatterns(prev => {
      const newPatterns = { ...prev };
      
      // Initialize field patterns
      if (!newPatterns[fieldName]) {
        newPatterns[fieldName] = {
          values: {},
          contexts: {},
          frequency: {},
          lastUsed: {}
        };
      }
      
      // Track value frequency
      newPatterns[fieldName].frequency[value] = (newPatterns[fieldName].frequency[value] || 0) + 1;
      newPatterns[fieldName].lastUsed[value] = Date.now();
      
      // Track contextual patterns
      if (context.rfaType) {
        if (!newPatterns[fieldName].contexts[context.rfaType]) {
          newPatterns[fieldName].contexts[context.rfaType] = {};
        }
        newPatterns[fieldName].contexts[context.rfaType][value] = 
          (newPatterns[fieldName].contexts[context.rfaType][value] || 0) + 1;
      }
      
      return newPatterns;
    });
    
    // Update defaults based on patterns
    updateDefaultsFromPatterns(fieldName, value, context);
  }, [learningEnabled]);

  // Update defaults based on learned patterns
  const updateDefaultsFromPatterns = useCallback((fieldName, value, context) => {
    setDefaults(prev => {
      const patterns = userPatterns[fieldName];
      if (!patterns) return prev;
      
      // If this value is used frequently, make it the default
      const totalUses = Object.values(patterns.frequency).reduce((sum, count) => sum + count, 0);
      const valueUses = patterns.frequency[value] || 0;
      const usagePercentage = totalUses > 0 ? valueUses / totalUses : 0;
      
      // If used more than 60% of the time, make it default
      if (usagePercentage > 0.6) {
        return { ...prev, [fieldName]: value };
      }
      
      return prev;
    });
  }, [userPatterns]);

  // Get smart suggestion for a field
  const getSuggestion = useCallback((fieldName, context = {}) => {
    if (!enabled) return null;
    
    const patterns = userPatterns[fieldName];
    if (!patterns) return defaults[fieldName];
    
    // Context-aware suggestions
    if (context.rfaType && patterns.contexts[context.rfaType]) {
      const contextValues = patterns.contexts[context.rfaType];
      const mostUsedInContext = Object.entries(contextValues)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (mostUsedInContext) {
        return {
          value: mostUsedInContext[0],
          confidence: Math.min(mostUsedInContext[1] / 5, 1), // Max confidence at 5 uses
          reason: `Often used with ${context.rfaType}`
        };
      }
    }
    
    // Frequency-based suggestions
    const mostFrequent = Object.entries(patterns.frequency)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostFrequent) {
      return {
        value: mostFrequent[0],
        confidence: Math.min(mostFrequent[1] / 10, 1), // Max confidence at 10 uses
        reason: `Your most common choice`
      };
    }
    
    return defaults[fieldName];
  }, [enabled, userPatterns, defaults]);

  // Get smart defaults for multiple fields
  const getSmartDefaults = useCallback((context = {}) => {
    if (!enabled) return defaults;
    
    const smartDefaults = { ...defaults };
    
    // Apply contextual intelligence
    if (context.rfaType) {
      // RFA-specific defaults
      switch (context.rfaType) {
        case 'SUBMITTAL':
          smartDefaults.hasPanelSchedules = true;
          smartDefaults.hasSubmittals = true;
          smartDefaults.needsLayoutBOM = false;
          break;
        case 'BOM (No Layout)':
          smartDefaults.hasPanelSchedules = true;
          smartDefaults.hasSubmittals = false;
          smartDefaults.needsLayoutBOM = false;
          break;
        case 'BOM (With Layout)':
          smartDefaults.hasPanelSchedules = true;
          smartDefaults.hasSubmittals = false;
          smartDefaults.needsLayoutBOM = true;
          break;
        case 'PHOTOMETRICS':
          smartDefaults.hasPanelSchedules = false;
          smartDefaults.hasSubmittals = false;
          smartDefaults.showPhotometrics = true;
          break;
      }
    }
    
    // Apply learned patterns
    Object.keys(userPatterns).forEach(fieldName => {
      const suggestion = getSuggestion(fieldName, context);
      if (suggestion && suggestion.value !== undefined) {
        smartDefaults[fieldName] = suggestion.value;
      }
    });
    
    return smartDefaults;
  }, [enabled, defaults, userPatterns, getSuggestion]);

  // Save patterns and defaults to storage
  const saveToStorage = useCallback(() => {
    try {
      const dataToSave = {
        defaults,
        patterns: userPatterns,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem(`${storageKey}-${userId}`, JSON.stringify(dataToSave));
    } catch (error) {
      console.warn('Error saving smart defaults:', error);
    }
  }, [defaults, userPatterns, storageKey, userId]);

  // Auto-save patterns periodically
  useEffect(() => {
    if (enabled && !isLoading) {
      const saveTimeout = setTimeout(saveToStorage, 2000); // Save after 2 seconds of inactivity
      return () => clearTimeout(saveTimeout);
    }
  }, [defaults, userPatterns, enabled, isLoading, saveToStorage]);

  // Reset all learned patterns
  const resetPatterns = useCallback(() => {
    setUserPatterns({});
    setDefaults(getInitialDefaults());
    localStorage.removeItem(`${storageKey}-${userId}`);
  }, [getInitialDefaults, storageKey, userId]);

  // Get statistics about learned patterns
  const getPatternStats = useCallback(() => {
    const stats = {
      totalFields: Object.keys(userPatterns).length,
      totalInteractions: 0,
      mostUsedField: null,
      learningProgress: 0
    };
    
    let maxInteractions = 0;
    
    Object.entries(userPatterns).forEach(([fieldName, patterns]) => {
      const fieldInteractions = Object.values(patterns.frequency).reduce((sum, count) => sum + count, 0);
      stats.totalInteractions += fieldInteractions;
      
      if (fieldInteractions > maxInteractions) {
        maxInteractions = fieldInteractions;
        stats.mostUsedField = fieldName;
      }
    });
    
    // Calculate learning progress (0-1 scale)
    stats.learningProgress = Math.min(stats.totalInteractions / 50, 1); // 50 interactions = 100% learned
    
    return stats;
  }, [userPatterns]);

  // Export patterns for backup
  const exportPatterns = useCallback(() => {
    return {
      defaults,
      patterns: userPatterns,
      stats: getPatternStats(),
      exportDate: new Date().toISOString(),
      userId
    };
  }, [defaults, userPatterns, getPatternStats, userId]);

  // Import patterns from backup
  const importPatterns = useCallback((importData) => {
    try {
      if (importData.defaults) {
        setDefaults(importData.defaults);
      }
      if (importData.patterns) {
        setUserPatterns(importData.patterns);
      }
      return { success: true };
    } catch (error) {
      console.error('Error importing patterns:', error);
      return { success: false, error: error.message };
    }
  }, []);

  return {
    // State
    defaults,
    suggestions,
    userPatterns,
    isLoading,
    
    // Functions
    learnFromInput,
    getSuggestion,
    getSmartDefaults,
    resetPatterns,
    getPatternStats,
    exportPatterns,
    importPatterns,
    
    // Utilities
    enabled: enabled && !isLoading
  };
};

export default useSmartDefaults;


