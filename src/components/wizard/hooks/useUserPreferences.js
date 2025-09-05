import { useState, useEffect, useCallback } from 'react';

/**
 * useUserPreferences - User preference management system
 * Features: Persistent preferences, theme management, accessibility options, workflow customization
 */
const useUserPreferences = ({
  userId = 'default',
  storageKey = 'wizard-user-preferences',
  syncWithServer = false
}) => {
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);

  // Default preference structure
  const getDefaultPreferences = useCallback(() => {
    return {
      // General preferences
      general: {
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      },
      
      // Wizard behavior
      wizard: {
        autoAdvance: false, // Auto-advance to next step after completion
        showProgressBar: true,
        showStepNumbers: true,
        confirmBeforeExit: true,
        rememberLastPosition: true,
        autoSaveInterval: 30000, // 30 seconds
        enableKeyboardShortcuts: true,
        showTooltips: true,
        animationsEnabled: true
      },
      
      // Form preferences
      form: {
        autoComplete: true,
        validateOnBlur: true,
        validateOnChange: false,
        highlightErrors: true,
        showFieldHints: true,
        rememberFieldValues: true,
        autoFormatInputs: true,
        showProgressiveDisclosure: true
      },
      
      // Visual preferences
      visual: {
        theme: 'light', // light, dark, auto
        fontSize: 'medium', // small, medium, large
        compactMode: false,
        highContrast: false,
        reducedMotion: false,
        colorBlindMode: 'none', // none, protanopia, deuteranopia, tritanopia
        sidebarCollapsed: false
      },
      
      // Accessibility
      accessibility: {
        screenReaderOptimized: false,
        keyboardNavigation: true,
        focusIndicators: true,
        announceChanges: false,
        reducedAnimations: false,
        largeClickTargets: false
      },
      
      // Notifications
      notifications: {
        autoSaveNotifications: true,
        errorNotifications: true,
        successNotifications: true,
        warningNotifications: true,
        soundEnabled: false,
        notificationPosition: 'top-right',
        autoHideDuration: 5000
      },
      
      // Default values
      defaults: {
        saveLocation: 'Server',
        regionalTeam: 'East',
        rfaType: 'BOM (With Layout)',
        enableSmartDefaults: true,
        learnFromBehavior: true
      },
      
      // Advanced
      advanced: {
        enableBetaFeatures: false,
        debugMode: false,
        performanceMode: false,
        enableAnalytics: true,
        exportDataFormat: 'json'
      }
    };
  }, []);

  // Load preferences from storage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        
        let loadedPreferences = null;
        
        // Try to load from localStorage first
        const localData = localStorage.getItem(`${storageKey}-${userId}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          loadedPreferences = mergeWithDefaults(parsed.preferences);
          setLastSync(parsed.lastSync ? new Date(parsed.lastSync) : null);
        }
        
        // If sync with server is enabled, try to load from server
        if (syncWithServer && window.electron) {
          // Implementation would depend on your server sync strategy
          // For now, we'll use localStorage only
        }
        
        setPreferences(loadedPreferences || getDefaultPreferences());
        
      } catch (error) {
        console.warn('Error loading user preferences:', error);
        setPreferences(getDefaultPreferences());
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [userId, storageKey, syncWithServer, getDefaultPreferences]);

  // Merge loaded preferences with defaults (for new preference additions)
  const mergeWithDefaults = useCallback((loadedPrefs) => {
    const defaults = getDefaultPreferences();
    
    const mergeDeep = (target, source) => {
      const output = { ...target };
      if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
          if (isObject(source[key])) {
            if (!(key in target)) {
              Object.assign(output, { [key]: source[key] });
            } else {
              output[key] = mergeDeep(target[key], source[key]);
            }
          } else {
            Object.assign(output, { [key]: source[key] });
          }
        });
      }
      return output;
    };
    
    return mergeDeep(loadedPrefs, defaults);
  }, [getDefaultPreferences]);

  // Helper function to check if value is object
  const isObject = (item) => {
    return item && typeof item === 'object' && !Array.isArray(item);
  };

  // Update specific preference
  const updatePreference = useCallback((path, value) => {
    setPreferences(prev => {
      if (!prev) return prev;
      
      const newPrefs = { ...prev };
      const pathArray = path.split('.');
      let current = newPrefs;
      
      // Navigate to the parent of the target property
      for (let i = 0; i < pathArray.length - 1; i++) {
        if (!current[pathArray[i]]) {
          current[pathArray[i]] = {};
        }
        current = current[pathArray[i]];
      }
      
      // Set the value
      current[pathArray[pathArray.length - 1]] = value;
      
      return newPrefs;
    });
  }, []);

  // Update multiple preferences at once
  const updatePreferences = useCallback((updates) => {
    setPreferences(prev => {
      if (!prev) return prev;
      
      let newPrefs = { ...prev };
      
      Object.entries(updates).forEach(([path, value]) => {
        const pathArray = path.split('.');
        let current = newPrefs;
        
        for (let i = 0; i < pathArray.length - 1; i++) {
          if (!current[pathArray[i]]) {
            current[pathArray[i]] = {};
          }
          current = current[pathArray[i]];
        }
        
        current[pathArray[pathArray.length - 1]] = value;
      });
      
      return newPrefs;
    });
  }, []);

  // Get specific preference value
  const getPreference = useCallback((path, defaultValue = null) => {
    if (!preferences) return defaultValue;
    
    const pathArray = path.split('.');
    let current = preferences;
    
    for (const key of pathArray) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }, [preferences]);

  // Save preferences to storage
  const savePreferences = useCallback(async () => {
    if (!preferences) return;
    
    try {
      const dataToSave = {
        preferences,
        lastSync: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem(`${storageKey}-${userId}`, JSON.stringify(dataToSave));
      setLastSync(new Date());
      
      // Sync with server if enabled
      if (syncWithServer && window.electron) {
        // Server sync implementation would go here
      }
      
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }, [preferences, storageKey, userId, syncWithServer]);

  // Auto-save preferences when they change
  useEffect(() => {
    if (preferences && !isLoading) {
      const saveTimeout = setTimeout(savePreferences, 1000); // Save after 1 second of inactivity
      return () => clearTimeout(saveTimeout);
    }
  }, [preferences, isLoading, savePreferences]);

  // Reset preferences to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(getDefaultPreferences());
    localStorage.removeItem(`${storageKey}-${userId}`);
  }, [getDefaultPreferences, storageKey, userId]);

  // Export preferences
  const exportPreferences = useCallback(() => {
    return {
      preferences,
      exportDate: new Date().toISOString(),
      userId,
      version: '1.0'
    };
  }, [preferences, userId]);

  // Import preferences
  const importPreferences = useCallback((importData) => {
    try {
      if (importData.preferences) {
        const mergedPrefs = mergeWithDefaults(importData.preferences);
        setPreferences(mergedPrefs);
        return { success: true };
      }
      return { success: false, error: 'No preferences data found' };
    } catch (error) {
      console.error('Error importing preferences:', error);
      return { success: false, error: error.message };
    }
  }, [mergeWithDefaults]);

  // Apply theme-related preferences to document
  useEffect(() => {
    if (!preferences) return;
    
    const visual = preferences.visual;
    const accessibility = preferences.accessibility;
    
    // Apply theme
    if (visual.theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.classList.remove('light-theme');
    } else if (visual.theme === 'light') {
      document.documentElement.classList.add('light-theme');
      document.documentElement.classList.remove('dark-theme');
    } else if (visual.theme === 'auto') {
      // Use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark-theme');
        document.documentElement.classList.remove('light-theme');
      } else {
        document.documentElement.classList.add('light-theme');
        document.documentElement.classList.remove('dark-theme');
      }
    }
    
    // Apply accessibility preferences
    if (accessibility.reducedAnimations || visual.reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
    
    if (visual.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    
    // Apply font size
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add(`font-${visual.fontSize}`);
    
  }, [preferences]);

  // Get computed styles based on preferences
  const getComputedStyles = useCallback(() => {
    if (!preferences) return {};
    
    return {
      theme: preferences.visual.theme,
      fontSize: preferences.visual.fontSize,
      compactMode: preferences.visual.compactMode,
      highContrast: preferences.visual.highContrast,
      reducedMotion: preferences.visual.reducedMotion || preferences.accessibility.reducedAnimations,
      sidebarCollapsed: preferences.visual.sidebarCollapsed
    };
  }, [preferences]);

  return {
    // State
    preferences,
    isLoading,
    lastSync,
    
    // Getters
    getPreference,
    getComputedStyles,
    
    // Setters
    updatePreference,
    updatePreferences,
    
    // Actions
    savePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,
    
    // Utilities
    isReady: !isLoading && preferences !== null
  };
};

export default useUserPreferences;


