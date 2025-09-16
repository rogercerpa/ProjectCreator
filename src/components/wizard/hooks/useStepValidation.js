import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for managing step-by-step validation
 * Handles field validation, error management, and step completion status
 */
const useStepValidation = () => {
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});
  const [validationState, setValidationState] = useState({});

  // Validation rules for each step
  const validationRules = useMemo(() => ({
    step1: {
      required: [
        'projectName',
        'rfaNumber', 
        'agentNumber',
        'projectContainer',
        'rfaType',
        'regionalTeam'
      ],
      patterns: {
        rfaNumber: /^\d+-\d+$/,
        agentNumber: /^\d+$/,
        projectContainer: /^\d{2}-\d{5}$/
      },
      custom: {
        projectName: (value) => {
          if (!value || value.trim().length < 3) {
            return 'Project name must be at least 3 characters long';
          }
          return null;
        },
        rfaType: (value) => {
          if (!value || value === '') {
            return 'Please select an RFA type';
          }
          return null;
        },
        revision: (value, formData) => {
          // Revision-specific validation
          if (formData.isRevision) {
            // Check if revision configuration is complete
            if (!formData.previousRevisionPath && !formData.revisionOptions?.previousRevisionPath) {
              return 'Revision configuration is required. Please configure your revision settings.';
            }
          }
          return null;
        }
      }
    },
    step2: {
      required: [],
      custom: {
        triageConfiguration: (formData) => {
          // PRIORITY 1: If triage calculation is already completed, step is valid
          if (formData.totalTriage && formData.totalTriage > 0) {
            return null; // Step is valid - triage calculation was completed
          }
          
          // PRIORITY 2: If basic project data exists, allow manual completion
          if (formData.projectName && formData.rfaNumber) {
            return null; // Step is valid - basic project data exists, manual completion allowed
          }
          
          // PRIORITY 3: Advanced validation only if neither condition above is met
          const { hasPanelSchedules, hasSubmittals, needsLayoutBOM } = formData;
          
          // If panel schedules enabled, at least one panel field should have value
          if (hasPanelSchedules) {
            const panelFields = ['largeLMPs', 'mediumLMPs', 'smallLMPs', 'arp8', 'arp16', 'arp32', 'arp48'];
            const hasPanelData = panelFields.some(field => (formData[field] || 0) > 0);
            if (!hasPanelData) {
              return 'Panel schedules are enabled but no panel data provided';
            }
          }

          // If layout fields should be shown, validate room data
          const showLayoutFields = !hasSubmittals || (hasSubmittals && needsLayoutBOM);
          if (showLayoutFields) {
            if (!formData.numOfRooms && !formData.overrideRooms) {
              return 'Please provide number of rooms or override value for layout calculation';
            }
          }

          // If submittal fields enabled, validate submittal data
          if (hasSubmittals) {
            if (!formData.numOfSubRooms && !formData.overrideSubRooms) {
              return 'Please provide number of rooms for submittal calculation';
            }
          }

          return null;
        }
      }
    },
  }), []);

  // Validate a single field
  const validateField = useCallback((fieldName, value, stepNumber = 1, allFormData = {}) => {
    const stepRules = validationRules[`step${stepNumber}`] || {};
    const errors = [];

    // Required field validation
    if (stepRules.required && stepRules.required.includes(fieldName)) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`);
      }
    }

    // Pattern validation
    if (stepRules.patterns && stepRules.patterns[fieldName] && value) {
      if (!stepRules.patterns[fieldName].test(value)) {
        errors.push(`${fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} format is invalid`);
      }
    }

    // Custom validation
    if (stepRules.custom && stepRules.custom[fieldName]) {
      const customError = stepRules.custom[fieldName](value, allFormData);
      if (customError) {
        errors.push(customError);
      }
    }

    return errors;
  }, [validationRules]);

  // Validate entire step
  const validateStep = useCallback((stepNumber, formData) => {
    const stepRules = validationRules[`step${stepNumber}`] || {};
    const stepErrors = {};
    let isValid = true;

    // Validate required fields
    if (stepRules.required) {
      stepRules.required.forEach(fieldName => {
        const fieldErrors = validateField(fieldName, formData[fieldName], stepNumber, formData);
        if (fieldErrors.length > 0) {
          stepErrors[fieldName] = fieldErrors;
          isValid = false;
        }
      });
    }

    // Run custom validations
    if (stepRules.custom) {
      Object.keys(stepRules.custom).forEach(validationName => {
        if (validationName !== 'triageConfiguration' && validationName !== 'revision') {
          const fieldErrors = validateField(validationName, formData[validationName], stepNumber, formData);
          if (fieldErrors.length > 0) {
            stepErrors[validationName] = fieldErrors;
            isValid = false;
          }
        } else if (validationName === 'revision') {
          // Special handling for revision validation
          const customError = stepRules.custom[validationName](formData.isRevision, formData);
          if (customError) {
            stepErrors['revision'] = [customError];
            isValid = false;
          }
        } else {
          // Special handling for triage configuration validation
          const customError = stepRules.custom[validationName](formData);
          if (customError) {
            stepErrors['_step'] = [customError];
            isValid = false;
          }
        }
      });
    }

    // Update validation state
    setValidationState(prev => ({
      ...prev,
      [`step${stepNumber}`]: { isValid, errors: stepErrors }
    }));

    return { isValid, errors: stepErrors };
  }, [validationRules, validateField]);

  // Mark field as touched
  const touchField = useCallback((fieldName) => {
    setFieldTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
  }, []);

  // Check if field should show error (touched and has error)
  const shouldShowFieldError = useCallback((fieldName) => {
    return fieldTouched[fieldName] && validationErrors[fieldName];
  }, [fieldTouched, validationErrors]);

  // Update field validation in real-time
  const updateFieldValidation = useCallback((fieldName, value, stepNumber = 1, allFormData = {}) => {
    const fieldErrors = validateField(fieldName, value, stepNumber, allFormData);
    
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (fieldErrors.length > 0) {
        newErrors[fieldName] = fieldErrors;
      } else {
        delete newErrors[fieldName];
      }
      return newErrors;
    });

    return fieldErrors.length === 0;
  }, [validateField]);

  // Clear validation errors for a field
  const clearFieldError = useCallback((fieldName) => {
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  // Clear all validation errors
  const clearAllErrors = useCallback(() => {
    setValidationErrors({});
    setFieldTouched({});
    setValidationState({});
  }, []);

  // Get validation state for a step
  const getStepValidationState = useCallback((stepNumber) => {
    return validationState[`step${stepNumber}`] || { isValid: false, errors: {} };
  }, [validationState]);

  // Get field errors
  const getFieldErrors = useCallback((fieldName) => {
    return validationErrors[fieldName] || [];
  }, [validationErrors]);

  // Check if step is valid
  const isStepValid = useCallback((stepNumber) => {
    const stepState = getStepValidationState(stepNumber);
    return stepState.isValid;
  }, [getStepValidationState]);

  // Get all validation errors for debugging
  const getAllErrors = useCallback(() => {
    return {
      fieldErrors: validationErrors,
      stepStates: validationState,
      touchedFields: fieldTouched
    };
  }, [validationErrors, validationState, fieldTouched]);

  return {
    // Validation functions
    validateField,
    validateStep,
    updateFieldValidation,

    // Field management
    touchField,
    clearFieldError,
    clearAllErrors,

    // State getters
    getStepValidationState,
    getFieldErrors,
    shouldShowFieldError,
    isStepValid,
    getAllErrors,

    // Current state
    validationErrors,
    fieldTouched,
    validationState
  };
};

export default useStepValidation;


