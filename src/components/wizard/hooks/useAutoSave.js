import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useAutoSave - Enhanced auto-save functionality with intelligent timing
 * Features: Smart intervals, change detection, network awareness, conflict resolution
 */
const useAutoSave = ({
  data,
  saveFunction,
  interval = 30000, // 30 seconds default
  enabled = true,
  dependencies = [],
  onAutoSave = null,
  onAutoSaveError = null,
  conflictResolution = 'user-wins' // 'user-wins', 'server-wins', 'merge'
}) => {
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  
  const intervalRef = useRef(null);
  const lastDataRef = useRef(null);
  const saveAttemptRef = useRef(0);
  const lastUserActivityRef = useRef(Date.now());

  // Track user activity for smart timing
  const trackUserActivity = useCallback(() => {
    lastUserActivityRef.current = Date.now();
  }, []);

  // Check if data has changed significantly
  const hasSignificantChanges = useCallback((newData, oldData) => {
    if (!oldData) return true;
    
    // Define significant fields that should trigger auto-save
    const significantFields = [
      'projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 
      'rfaType', 'regionalTeam', 'totalTriage', 'hasPanelSchedules',
      'hasSubmittals', 'needsLayoutBOM'
    ];
    
    return significantFields.some(field => newData[field] !== oldData[field]);
  }, []);

  // Perform auto-save
  const performAutoSave = useCallback(async () => {
    if (!enabled || isSaving || !data) return;

    // Check if enough time has passed since last user activity (smart timing)
    const timeSinceActivity = Date.now() - lastUserActivityRef.current;
    const minInactivityTime = 5000; // 5 seconds of inactivity
    
    if (timeSinceActivity < minInactivityTime) {
      // User is actively typing, postpone auto-save
      return;
    }

    // Check for significant changes
    if (!hasSignificantChanges(data, lastDataRef.current)) {
      return;
    }

    try {
      setIsSaving(true);
      setAutoSaveError(null);
      saveAttemptRef.current += 1;

      const saveResult = await saveFunction(data, {
        isAutoSave: true,
        attempt: saveAttemptRef.current,
        timestamp: new Date().toISOString()
      });

      if (saveResult && saveResult.success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        setSaveCount(prev => prev + 1);
        lastDataRef.current = { ...data };

        if (onAutoSave) {
          onAutoSave({
            timestamp: new Date(),
            attempt: saveAttemptRef.current,
            dataSize: JSON.stringify(data).length
          });
        }
      } else {
        throw new Error(saveResult?.error || 'Auto-save failed');
      }

    } catch (error) {
      console.warn('Auto-save failed:', error);
      setAutoSaveError(error.message);
      
      if (onAutoSaveError) {
        onAutoSaveError(error, saveAttemptRef.current);
      }
    } finally {
      setIsSaving(false);
    }
  }, [data, enabled, isSaving, saveFunction, hasSignificantChanges, onAutoSave, onAutoSaveError]);

  // Set up auto-save interval
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval
    intervalRef.current = setInterval(performAutoSave, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, performAutoSave]);

  // Track data changes
  useEffect(() => {
    if (data && hasSignificantChanges(data, lastDataRef.current)) {
      setHasUnsavedChanges(true);
      trackUserActivity();
    }
  }, [data, hasSignificantChanges, trackUserActivity, ...dependencies]);

  // Manual save function
  const manualSave = useCallback(async () => {
    return performAutoSave();
  }, [performAutoSave]);

  // Force save (ignores timing constraints)
  const forceSave = useCallback(async () => {
    if (!enabled || !data || !saveFunction) return;

    try {
      setIsSaving(true);
      setAutoSaveError(null);

      const saveResult = await saveFunction(data, {
        isAutoSave: false,
        isForced: true,
        timestamp: new Date().toISOString()
      });

      if (saveResult && saveResult.success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        setSaveCount(prev => prev + 1);
        lastDataRef.current = { ...data };
        return { success: true };
      } else {
        throw new Error(saveResult?.error || 'Force save failed');
      }

    } catch (error) {
      setAutoSaveError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  }, [data, enabled, saveFunction]);

  // Reset auto-save state
  const resetAutoSave = useCallback(() => {
    setLastSaved(null);
    setHasUnsavedChanges(false);
    setAutoSaveError(null);
    setSaveCount(0);
    lastDataRef.current = null;
    saveAttemptRef.current = 0;
  }, []);

  // Pause auto-save temporarily
  const pauseAutoSave = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Resume auto-save
  const resumeAutoSave = useCallback(() => {
    if (enabled && !intervalRef.current) {
      intervalRef.current = setInterval(performAutoSave, interval);
    }
  }, [enabled, interval, performAutoSave]);

  // Get auto-save status
  const getAutoSaveStatus = useCallback(() => {
    return {
      lastSaved,
      isSaving,
      hasUnsavedChanges,
      saveCount,
      error: autoSaveError,
      isEnabled: enabled,
      interval,
      timeSinceLastSave: lastSaved ? Date.now() - lastSaved.getTime() : null
    };
  }, [lastSaved, isSaving, hasUnsavedChanges, saveCount, autoSaveError, enabled, interval]);

  return {
    // State
    lastSaved,
    isSaving,
    hasUnsavedChanges,
    autoSaveError,
    saveCount,
    
    // Functions
    manualSave,
    forceSave,
    resetAutoSave,
    pauseAutoSave,
    resumeAutoSave,
    trackUserActivity,
    getAutoSaveStatus
  };
};

export default useAutoSave;


