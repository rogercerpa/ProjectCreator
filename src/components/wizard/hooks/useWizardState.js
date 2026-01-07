import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing wizard state and navigation
 * Handles step progression, data persistence between steps, and validation states
 */
const useWizardState = (initialData = {}, totalSteps = 2) => {
  // Core wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [wizardData, setWizardData] = useState(initialData);
  const [stepValidationStates, setStepValidationStates] = useState({});
  const [isNavigating, setIsNavigating] = useState(false);

  // Step navigation functions
  const goToStep = useCallback((stepNumber) => {
    if (stepNumber >= 1 && stepNumber <= totalSteps) {
      setIsNavigating(true);
      setCurrentStep(stepNumber);
      setTimeout(() => setIsNavigating(false), 100);
    }
  }, [totalSteps]);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps) {
      setCompletedSteps(prev => [...new Set([...prev, currentStep])]);
      goToStep(currentStep + 1);
    }
  }, [currentStep, totalSteps, goToStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  // Data management functions
  const updateWizardData = useCallback((newData, shouldMerge = true) => {
    setWizardData(prevData => {
      if (shouldMerge) {
        return { ...prevData, ...newData };
      }
      return newData;
    });
  }, []);

  // Validation state management
  const setStepValidation = useCallback((stepNumber, isValid, errors = {}) => {
    setStepValidationStates(prev => ({
      ...prev,
      [stepNumber]: { isValid, errors }
    }));
  }, []);

  const getStepValidation = useCallback((stepNumber) => {
    return stepValidationStates[stepNumber] || { isValid: false, errors: {} };
  }, [stepValidationStates]);

  // Utility functions
  const isStepCompleted = useCallback((stepNumber) => {
    return completedSteps.includes(stepNumber);
  }, [completedSteps]);

  // Mark a step as completed externally (used for restoring wizard state)
  const markStepCompleted = useCallback((stepNumber) => {
    setCompletedSteps(prev => {
      if (prev.includes(stepNumber)) {
        return prev; // Already completed, no change needed
      }
      return [...new Set([...prev, stepNumber])];
    });
  }, []);

  const isStepAccessible = useCallback((stepNumber) => {
    // Step 1 is always accessible
    if (stepNumber === 1) return true;
    // Other steps are accessible if previous step is completed
    return isStepCompleted(stepNumber - 1);
  }, [isStepCompleted]);

  const canProceedToNext = useCallback(() => {
    const currentStepValidation = getStepValidation(currentStep);
    
    // For the final step, only check if it's valid (no next step needed)
    if (currentStep === totalSteps) {
      return currentStepValidation.isValid;
    }
    // For other steps, check if valid and there's a next step
    return currentStepValidation.isValid && currentStep < totalSteps;
  }, [currentStep, totalSteps, getStepValidation]);

  const canGoToPrevious = useCallback(() => {
    return currentStep > 1;
  }, [currentStep]);

  // Progress calculation
  const progress = useCallback(() => {
    return {
      current: currentStep,
      total: totalSteps,
      percentage: (completedSteps.length / totalSteps) * 100,
      completedSteps: completedSteps.length,
      isComplete: completedSteps.length === totalSteps
    };
  }, [currentStep, totalSteps, completedSteps]);

  // Reset wizard state
  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps([]);
    setWizardData(initialData);
    setStepValidationStates({});
    setIsNavigating(false);
  }, []); // Remove initialData dependency to prevent infinite loops

  // Debug logging in development
  useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      console.log('Wizard State Updated:', {
        currentStep,
        completedSteps,
        dataKeys: Object.keys(wizardData),
        validationStates: stepValidationStates
      });
    }
  }, [currentStep, completedSteps, wizardData, stepValidationStates]);

  return {
    // State
    currentStep,
    completedSteps,
    wizardData,
    isNavigating,
    stepValidationStates,

    // Navigation functions
    goToStep,
    nextStep,
    previousStep,

    // Data management
    updateWizardData,

    // Validation
    setStepValidation,
    getStepValidation,

    // Utility functions
    isStepCompleted,
    markStepCompleted,
    isStepAccessible,
    canProceedToNext,
    canGoToPrevious,
    progress,
    resetWizard
  };
};

export default useWizardState;


