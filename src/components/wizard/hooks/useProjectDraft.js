import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook for managing project draft persistence
 * Handles auto-save, draft recovery, and cleanup of old drafts
 */
const useProjectDraft = (projectId = null, autoSaveInterval = 30000) => {
  const [draftId, setDraftId] = useState(projectId);
  const [lastSaved, setLastSaved] = useState(null);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [availableDrafts, setAvailableDrafts] = useState([]);
  
  const autoSaveTimer = useRef(null);
  const lastDataRef = useRef(null);

  // Generate unique draft ID
  const generateDraftId = useCallback(() => {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get draft storage key
  const getDraftKey = useCallback((id) => {
    return `project_draft_${id}`;
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback(async (data, step = null, isAutoSave = false) => {
    try {
      setIsDraftSaving(true);
      setDraftError(null);

      // Generate draft ID if not exists
      let currentDraftId = draftId;
      if (!currentDraftId) {
        currentDraftId = generateDraftId();
        setDraftId(currentDraftId);
      }

      const draftData = {
        id: currentDraftId,
        data: data,
        currentStep: step,
        lastModified: new Date().toISOString(),
        isAutoSave,
        version: '1.0'
      };

      const draftKey = getDraftKey(currentDraftId);
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      
      // Update metadata
      const metadataKey = 'project_drafts_metadata';
      const existingMetadata = JSON.parse(localStorage.getItem(metadataKey) || '[]');
      const updatedMetadata = existingMetadata.filter(meta => meta.id !== currentDraftId);
      updatedMetadata.push({
        id: currentDraftId,
        projectName: data.projectName || 'Untitled Project',
        rfaNumber: data.rfaNumber || '',
        lastModified: draftData.lastModified,
        currentStep: step || 1,
        isAutoSave
      });
      
      localStorage.setItem(metadataKey, JSON.stringify(updatedMetadata));
      
      setLastSaved(new Date());
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Draft ${isAutoSave ? 'auto-' : ''}saved:`, currentDraftId);
      }

      return currentDraftId;
    } catch (error) {
      console.error('Failed to save draft:', error);
      setDraftError('Failed to save draft');
      throw error;
    } finally {
      setIsDraftSaving(false);
    }
  }, [draftId, generateDraftId, getDraftKey]);

  // Load draft from localStorage
  const loadDraft = useCallback(async (id) => {
    try {
      setIsDraftLoading(true);
      setDraftError(null);

      const draftKey = getDraftKey(id);
      const draftData = localStorage.getItem(draftKey);

      if (!draftData) {
        throw new Error(`Draft ${id} not found`);
      }

      const parsedDraft = JSON.parse(draftData);
      setDraftId(id);
      setLastSaved(new Date(parsedDraft.lastModified));

      if (process.env.NODE_ENV === 'development') {
        console.log('Draft loaded:', id);
      }

      return parsedDraft;
    } catch (error) {
      console.error('Failed to load draft:', error);
      setDraftError('Failed to load draft');
      throw error;
    } finally {
      setIsDraftLoading(false);
    }
  }, [getDraftKey]);

  // Delete draft
  const deleteDraft = useCallback(async (id) => {
    try {
      const draftKey = getDraftKey(id);
      localStorage.removeItem(draftKey);

      // Update metadata
      const metadataKey = 'project_drafts_metadata';
      const existingMetadata = JSON.parse(localStorage.getItem(metadataKey) || '[]');
      const updatedMetadata = existingMetadata.filter(meta => meta.id !== id);
      localStorage.setItem(metadataKey, JSON.stringify(updatedMetadata));

      if (draftId === id) {
        setDraftId(null);
        setLastSaved(null);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Draft deleted:', id);
      }
    } catch (error) {
      console.error('Failed to delete draft:', error);
      setDraftError('Failed to delete draft');
      throw error;
    }
  }, [getDraftKey, draftId]);

  // Get all available drafts
  const getDrafts = useCallback(() => {
    try {
      const metadataKey = 'project_drafts_metadata';
      const metadata = JSON.parse(localStorage.getItem(metadataKey) || '[]');
      
      // Sort by last modified (newest first)
      const sortedDrafts = metadata.sort((a, b) => 
        new Date(b.lastModified) - new Date(a.lastModified)
      );

      setAvailableDrafts(sortedDrafts);
      return sortedDrafts;
    } catch (error) {
      console.error('Failed to get drafts:', error);
      setDraftError('Failed to load drafts');
      return [];
    }
  }, []);

  // Clean up old drafts (older than 7 days)
  const cleanupOldDrafts = useCallback(() => {
    try {
      const metadataKey = 'project_drafts_metadata';
      const metadata = JSON.parse(localStorage.getItem(metadataKey) || '[]');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const draftsToDelete = metadata.filter(meta => 
        new Date(meta.lastModified) < sevenDaysAgo
      );

      let deletedCount = 0;
      draftsToDelete.forEach(draft => {
        try {
          const draftKey = getDraftKey(draft.id);
          localStorage.removeItem(draftKey);
          deletedCount++;
        } catch (error) {
          console.error('Failed to delete old draft:', draft.id, error);
        }
      });

      // Update metadata
      const remainingMetadata = metadata.filter(meta => 
        new Date(meta.lastModified) >= sevenDaysAgo
      );
      localStorage.setItem(metadataKey, JSON.stringify(remainingMetadata));

      if (process.env.NODE_ENV === 'development' && deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old drafts`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old drafts:', error);
      return 0;
    }
  }, [getDraftKey]);

  // Auto-save functionality
  const enableAutoSave = useCallback((data, step) => {
    // Clear existing timer
    if (autoSaveTimer.current) {
      clearInterval(autoSaveTimer.current);
    }

    // Only enable auto-save if we have meaningful data
    if (!data || Object.keys(data).length === 0) {
      return;
    }

    autoSaveTimer.current = setInterval(() => {
      // Only save if data has changed
      const currentDataString = JSON.stringify(data);
      if (lastDataRef.current !== currentDataString) {
        saveDraft(data, step, true).catch(console.error);
        lastDataRef.current = currentDataString;
      }
    }, autoSaveInterval);

    // Save current data reference
    lastDataRef.current = JSON.stringify(data);
  }, [saveDraft, autoSaveInterval]);

  // Disable auto-save
  const disableAutoSave = useCallback(() => {
    if (autoSaveTimer.current) {
      clearInterval(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disableAutoSave();
    };
  }, [disableAutoSave]);

  // Load available drafts on mount
  useEffect(() => {
    getDrafts();
    // Clean up old drafts periodically
    cleanupOldDrafts();
  }, [getDrafts, cleanupOldDrafts]);

  return {
    // State
    draftId,
    lastSaved,
    isDraftLoading,
    isDraftSaving,
    draftError,
    availableDrafts,

    // Draft management functions
    saveDraft,
    loadDraft,
    deleteDraft,
    getDrafts,
    cleanupOldDrafts,

    // Auto-save functions
    enableAutoSave,
    disableAutoSave,

    // Utility functions
    generateDraftId,
    
    // Clear error
    clearError: () => setDraftError(null)
  };
};

export default useProjectDraft;


