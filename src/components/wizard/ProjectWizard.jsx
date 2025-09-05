import React, { useState, useEffect, useCallback } from 'react';
import useWizardState from './hooks/useWizardState';
import useProjectDraft from './hooks/useProjectDraft';
import useStepValidation from './hooks/useStepValidation';
import WizardLayout from './components/WizardLayout';
import WizardErrorBoundary from './components/WizardErrorBoundary';
import ProjectWizardStep1 from './steps/ProjectWizardStep1';
import ProjectWizardStep2 from './steps/ProjectWizardStep2';
import './ProjectWizard.css';

// Import draft service for server-side partial saves
const ProjectDraftService = window.electron ? 
  window.electron.require('./src/services/ProjectDraftService') : 
  null;

/**
 * Main Project Creation Wizard Container
 * Manages the multi-step project creation process
 * Handles data persistence, validation, and step navigation
 */
const ProjectWizard = ({ 
  onProjectCreated, 
  onProjectUpdated, 
  onCancel,
  existingProject = null,
  mode = 'create' // 'create' or 'edit'
}) => {
  // Initialize form data with the same structure as original ProjectForm
  const initialFormData = {
    projectName: '',
    rfaNumber: '',
    agentNumber: '',
    projectContainer: '',
    rfaType: '',
    regionalTeam: '',
    ecd: '',
    nationalAccount: 'Default',
    complexity: '',
    rfaValue: '',
    status: '',
    products: '',
    assignedTo: '',
    repContacts: '',
    requestedDate: '',
    submittedDate: '',
    // Unified Triage Control Fields
    hasPanelSchedules: false,
    hasSubmittals: false,
    needsLayoutBOM: false,
    // Panel Schedule Fields
    largeLMPs: 0,
    mediumLMPs: 0,
    smallLMPs: 0,
    arp8: 0,
    arp16: 0,
    arp32: 0,
    arp48: 0,
    esheetsSchedules: 2, // 1 = Yes, 2 = No
    showPanelSchedules: false, // Keep for backward compatibility
    // Layout Fields
    numOfRooms: 0,
    overrideRooms: 0,
    roomMultiplier: 2,
    reviewSetup: 0.5,
    numOfPages: 1,
    specReview: 0,
    // Submittal Fields
    numOfSubRooms: 0,
    overrideSubRooms: 0,
    riserMultiplier: 1,
    soo: 0.5,
    // Photometrics Fields
    photoSoftware: 'VL',
    // Triage Results
    saveLocation: 'Server',
    isRevision: false,
    dueDate: '',
    totalTriage: 0,
    panelTime: 0,
    layoutTime: 0,
    submittalTime: 0,
    pageBonus: 0,
    baseTotal: 0,
    selfQC: 0,
    fluff: 0,
    // Additional Fields
    firstAvailable: false
  };

  // Merge existing project data if in edit mode
  const [formData, setFormData] = useState(() => {
    if (existingProject) {
      return { ...initialFormData, ...existingProject };
    }
    return initialFormData;
  });

  // Initialize hooks
  const wizard = useWizardState(formData, 3);
  const projectDraft = useProjectDraft(existingProject?.id);
  const stepValidation = useStepValidation();

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // Draft service state
  const [draftService] = useState(() => ProjectDraftService ? new ProjectDraftService() : null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastDraftSave, setLastDraftSave] = useState(null);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  // Debounced validation to prevent excessive validation calls
  const [validationTimeout, setValidationTimeout] = useState(null);

  // Handle form data changes with debounced validation
  const handleFormDataChange = useCallback((newFormData) => {
    // Update form data immediately for responsive UI
    setFormData(newFormData);
    wizard.updateWizardData(newFormData);
    
    // DEBOUNCING: Clear existing validation timeout
    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }
    
    // DEBOUNCING: Set new timeout for validation
    const timeout = setTimeout(() => {
      try {
        // Validate current step when data changes (debounced)
        const validationResult = stepValidation.validateStep(wizard.currentStep, newFormData);
        wizard.setStepValidation(wizard.currentStep, validationResult.isValid, validationResult.errors);
      } catch (validationError) {
        console.warn('Validation error during debounced update:', validationError);
      }
    }, 300); // 300ms debounce delay
    
    setValidationTimeout(timeout);
  }, [wizard, stepValidation]); // CRITICAL FIX: Include only stable dependencies

  // Cleanup validation timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
    };
  }, []); // Empty dependency array - only cleanup on unmount

  // Handle field errors
  const handleFieldError = useCallback((fieldName, error) => {
    stepValidation.clearFieldError(fieldName);
  }, []); // CRITICAL FIX: stepValidation is stable from hook

  // Handle field touch
  const handleFieldTouch = useCallback((fieldName) => {
    stepValidation.touchField(fieldName);
  }, []); // CRITICAL FIX: stepValidation is stable from hook

  // Handle step navigation with enhanced error handling
  const handleNext = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    // Enhanced error tracking
    let operationContext = 'initialization';
    let stepCompletionAttempted = false;

    try {
      // ENHANCED ERROR HANDLING: Validate prerequisites
      operationContext = 'validation';
      
      if (!wizard || !stepValidation || !formData) {
        throw new Error('Required wizard components not available');
      }

      // Validate current step
      const validationResult = stepValidation.validateStep(wizard.currentStep, formData);
      
      if (!validationResult || !validationResult.isValid) {
        const errorMessage = validationResult && validationResult.errors 
          ? `Validation errors: ${Object.values(validationResult.errors).flat().join(', ')}`
          : 'Please fix the validation errors before proceeding';
        
        setError(errorMessage);
        setNotification({
          type: 'warning',
          message: 'Please complete all required fields before proceeding'
        });
        return;
      }

      // ENHANCED ERROR HANDLING: Step completion with individual error tracking
      stepCompletionAttempted = true;
      
      // Special handling for Step 1 - Create partial project
      if (wizard.currentStep === 1) {
        operationContext = 'step1-completion';
        try {
          // Inline step 1 completion logic to avoid circular dependencies
          setNotification({
            type: 'info',
            message: 'Saving project basics...'
          });

          const draftResult = await savePartialDraft(1, {
            stepName: 'Basic Project Information',
            hasRequiredFields: true,
            readyForTriage: true
          });

          if (draftResult.success) {
            setNotification({
              type: 'success',
              message: '✅ Project basics saved! You can safely continue.'
            });
          } else {
            setNotification({
              type: 'warning',
              message: '⚠️ Auto-save encountered an issue, but your data is preserved.'
            });
          }
        } catch (step1Error) {
          console.error('Step 1 completion failed:', step1Error);
          setError('Failed to save project basics. Please try again.');
          setNotification({
            type: 'error',
            message: 'Unable to save project data. Check your connection and try again.'
          });
          return; // Don't proceed if step 1 fails
        }
      }
      
      // Special handling for Step 2 - Complete triage calculations
      if (wizard.currentStep === 2) {
        operationContext = 'step2-completion';
        try {
          // Inline step 2 completion logic to avoid circular dependencies
          setNotification({
            type: 'info',
            message: 'Finalizing project with triage calculations...'
          });

          const completeProject = {
            ...formData,
            updatedAt: new Date().toISOString(),
            status: 'active',
            completionStep: 2,
            sourceType: 'wizard'
          };

          if (mode === 'create' && typeof onProjectCreated === 'function') {
            onProjectCreated(completeProject);
          } else if (typeof onProjectUpdated === 'function') {
            onProjectUpdated(completeProject);
          }

          setNotification({
            type: 'success',
            message: '🎉 Triage calculations completed! Proceeding to project management.'
          });
        } catch (step2Error) {
          console.error('Step 2 completion failed:', step2Error);
          setError('Failed to finalize triage calculations. Please try again.');
          setNotification({
            type: 'error',
            message: 'Unable to complete triage calculations. Please verify your data and try again.'
          });
          return; // Don't proceed if step 2 fails
        }
      }

      // ENHANCED ERROR HANDLING: Draft saving with retry logic
      operationContext = 'draft-saving';
      let draftSaveSuccess = false;
      let draftRetries = 0;
      const maxDraftRetries = 2;

      while (!draftSaveSuccess && draftRetries <= maxDraftRetries) {
        try {
          const draftResult = await projectDraft.saveDraft(formData, wizard.currentStep + 1);
          if (draftResult && (draftResult.success || draftResult.fallback)) {
            draftSaveSuccess = true;
          } else {
            throw new Error(draftResult ? draftResult.error : 'Unknown draft save error');
          }
        } catch (draftError) {
          draftRetries++;
          console.warn(`Draft save attempt ${draftRetries} failed:`, draftError);
          
          if (draftRetries > maxDraftRetries) {
            // Don't fail navigation for draft save issues - just warn user
            setNotification({
              type: 'warning',
              message: '⚠️ Auto-save encountered issues, but your progress is preserved in this session.'
            });
            break;
          }
          
          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // ENHANCED ERROR HANDLING: Navigation with validation
      operationContext = 'navigation';
      const completedStep = wizard.currentStep;
      
      if (typeof wizard.nextStep !== 'function') {
        throw new Error('Navigation function not available');
      }
      
      // Move to next step
      wizard.nextStep();
      
      // Success notification with context
      setNotification({
        type: 'success',
        message: `✅ Step ${completedStep} completed successfully! ${
          draftSaveSuccess ? 'Progress saved.' : 'Progress preserved in session.'
        }`
      });

    } catch (err) {
      console.error(`Error in ${operationContext}:`, err);
      
      // ENHANCED ERROR HANDLING: Context-specific error messages
      let userMessage = 'An unexpected error occurred. Please try again.';
      let notificationType = 'error';
      
      switch (operationContext) {
        case 'validation':
          userMessage = 'Unable to validate form data. Please refresh the page and try again.';
          break;
        case 'step1-completion':
          userMessage = 'Failed to save project basics. Please check your connection and try again.';
          break;
        case 'step2-completion':
          userMessage = 'Failed to complete triage calculations. Please verify your inputs and try again.';
          break;
        case 'draft-saving':
          userMessage = 'Unable to save progress. Your data is preserved in this session.';
          notificationType = 'warning';
          break;
        case 'navigation':
          userMessage = 'Navigation error occurred. Please refresh the page.';
          break;
        default:
          userMessage = err.message || 'Failed to proceed to next step';
      }
      
      setError(userMessage);
      setNotification({
        type: notificationType,
        message: userMessage
      });
      
      // ENHANCED ERROR HANDLING: Recovery suggestions
      if (stepCompletionAttempted && operationContext !== 'navigation') {
        setTimeout(() => {
          setNotification({
            type: 'info',
            message: '💡 Try refreshing the page if problems persist, or contact support with Error Context: ' + operationContext
          });
        }, 3000);
      }
      
    } finally {
      setIsLoading(false);
    }
  }, [formData, wizard, stepValidation, projectDraft]); // Remove circular dependencies

  // Save partial project draft using new service
  const savePartialDraft = useCallback(async (currentStep, metadata = {}) => {
    // DEFENSIVE CHECK: Ensure draft service is available
    if (!draftService) {
      console.warn('Draft service not available - using fallback storage');
      try {
        // Fallback to localStorage if draft service fails
        const fallbackData = {
          formData,
          currentStep,
          timestamp: Date.now(),
          fallback: true
        };
        localStorage.setItem('wizard_fallback_draft', JSON.stringify(fallbackData));
        return { success: true, draftId: 'fallback_' + Date.now(), fallback: true };
      } catch (error) {
        console.error('Fallback draft save failed:', error);
        return { success: false, error: 'Draft service not available and fallback failed' };
      }
    }

    setIsSavingDraft(true);
    try {
      // DEFENSIVE CHECK: Ensure draftService has required method
      if (typeof draftService.savePartialProject !== 'function') {
        throw new Error('Draft service savePartialProject method not available');
      }

      const result = await draftService.savePartialProject(formData, currentStep, {
        ...metadata,
        mode,
        wizardSessionId: (wizard && wizard.sessionId) || Date.now().toString(),
        userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || 'Unknown'
      });

      // DEFENSIVE CHECK: Validate result structure
      if (result && typeof result === 'object' && result.success) {
        setCurrentDraftId(result.draftId);
        setLastDraftSave(new Date());
        console.log(`Partial project saved: ${result.draftId} at step ${currentStep}`);
      } else {
        console.warn('Draft service returned unexpected result:', result);
      }

      return result || { success: false, error: 'Invalid draft service response' };
    } catch (error) {
      console.error('Error saving partial draft:', error);
      // Try fallback storage on service failure
      try {
        const fallbackData = {
          formData,
          currentStep,
          timestamp: Date.now(),
          fallback: true,
          error: error.message
        };
        localStorage.setItem('wizard_fallback_draft', JSON.stringify(fallbackData));
        return { success: true, draftId: 'fallback_' + Date.now(), fallback: true, warning: 'Used fallback storage' };
      } catch (fallbackError) {
        return { success: false, error: error.message };
      }
    } finally {
      setIsSavingDraft(false);
    }
  }, [draftService, formData, mode, wizard]); // Fixed dependencies

  // Removed step completion functions to eliminate circular dependencies

  // Handle step 3 - Redirect to project management
  const handleStep3Navigation = useCallback(() => {
    // Step 3 will redirect to project management page
    // This is handled in the parent component
    setNotification({
      type: 'success',
      message: 'Project creation completed! Welcome to project management.'
    });
  }, []);

  // Debounced auto-save functionality to prevent excessive saves
  const [autoSaveTimeout, setAutoSaveTimeout] = useState(null);
  
  useEffect(() => {
    // DEBOUNCING: Clear existing auto-save timeout
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // DEBOUNCING: Only auto-save if we have meaningful data
    if (Object.keys(formData).length > 0) {
      const timeout = setTimeout(() => {
        try {
          projectDraft.enableAutoSave(formData, wizard.currentStep);
        } catch (autoSaveError) {
          console.warn('Auto-save setup failed:', autoSaveError);
        }
      }, 1000); // 1 second debounce for auto-save setup
      
      setAutoSaveTimeout(timeout);
    }

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      projectDraft.disableAutoSave();
    };
  }, [formData, wizard.currentStep, projectDraft]); // Keep necessary dependencies

  // Handle draft recovery
  useEffect(() => {
    if (mode === 'create' && !existingProject) {
      // Check for recoverable drafts
      const drafts = projectDraft.getDrafts();
      if (drafts.length > 0) {
        // Could show draft recovery dialog here
        console.log('Recoverable drafts found:', drafts);
      }
    }
  }, [mode, existingProject, projectDraft]);

  // Handle Step 3 navigation - moved from render function to fix React violation
  useEffect(() => {
    if (wizard.currentStep === 3) {
      handleStep3Navigation();
    }
  }, [wizard.currentStep, handleStep3Navigation]); // currentStep and handleStep3Navigation are stable

  // Render current step content
  const renderStepContent = () => {
    switch (wizard.currentStep) {
      case 1:
        return (
          <ProjectWizardStep1
            formData={formData}
            onFormDataChange={handleFormDataChange}
            errors={stepValidation.validationErrors}
            onFieldError={handleFieldError}
            onFieldTouch={handleFieldTouch}
            showImportedFields={true}
            onValidationChange={(isValid, errors) => {
              wizard.setStepValidation(1, isValid, errors);
            }}
          />
        );
      
      case 2:
        return (
          <WizardErrorBoundary
            step={2}
            stepName="Triage Calculation"
            formData={formData}
            onGoBack={() => wizard.goToStep(1)}
          >
            <ProjectWizardStep2
              formData={formData}
              onFormDataChange={handleFormDataChange}
              errors={stepValidation.validationErrors}
              onFieldError={handleFieldError}
              onFieldTouch={handleFieldTouch}
              onValidationChange={(isValid, errors) => {
                wizard.setStepValidation(2, isValid, errors);
              }}
            />
          </WizardErrorBoundary>
        );
      
      case 3:
        return (
          <WizardLayout
            title="Project Management"
            subtitle="Manage project files, uploads, and integrations"
            step={3}
            totalSteps={3}
          >
            <div className="step-content">
              <div className="step-placeholder">
                <h3>Step 3: Project Management</h3>
                <p>Redirecting to project management page...</p>
                <div className="completion-summary">
                  <h4>Project Creation Complete!</h4>
                  <p><strong>Project:</strong> {formData.projectName}</p>
                  <p><strong>RFA:</strong> {formData.rfaNumber}</p>
                  <p><strong>Triage Time:</strong> {formData.totalTriage} hours</p>
                </div>
              </div>
            </div>
          </WizardLayout>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="project-wizard">
      {/* Notification Display */}
      {notification && (
        <div className={`wizard-notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="wizard-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Enhanced Draft Status */}
      {(projectDraft.isDraftSaving || isSavingDraft) && (
        <div className="draft-status saving">
          <span className="spinner"></span>
          <span>Saving draft...</span>
        </div>
      )}

      {(projectDraft.lastSaved || lastDraftSave) && !(projectDraft.isDraftSaving || isSavingDraft) && (
        <div className="draft-info">
          <span>
            ✅ Last saved: {(lastDraftSave || projectDraft.lastSaved).toLocaleTimeString()}
            {currentDraftId && ` (Draft: ${currentDraftId.substring(6, 12)}...)`}
          </span>
        </div>
      )}

      {/* Wizard Content */}
      <div className="wizard-main">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="wizard-navigation">
        <div className="nav-left">
          {wizard.canGoToPrevious() && (
            <button
              onClick={wizard.previousStep}
              disabled={isLoading}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
          )}
          
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-outline"
          >
            Cancel
          </button>
        </div>

        <div className="nav-center">
          <div className="step-progress">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i + 1}
                className={`progress-step ${
                  i + 1 === wizard.currentStep ? 'active' : ''
                } ${
                  wizard.isStepCompleted(i + 1) ? 'completed' : ''
                } ${
                  wizard.isStepAccessible(i + 1) ? 'accessible' : ''
                }`}
                onClick={() => wizard.isStepAccessible(i + 1) && wizard.goToStep(i + 1)}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="nav-right">
          {wizard.currentStep < 3 ? (
            <button
              onClick={handleNext}
              disabled={isLoading || !wizard.canProceedToNext()}
              className="btn btn-primary"
            >
              {isLoading ? 'Saving...' : 'Next →'}
            </button>
          ) : (
            <button
              onClick={() => {
                // Complete the wizard and redirect to project management
                if (onProjectUpdated) {
                  onProjectUpdated({
                    ...formData,
                    status: 'active',
                    completionStep: 3,
                    updatedAt: new Date().toISOString()
                  });
                }
              }}
              disabled={isLoading}
              className="btn btn-primary"
            >
              Complete Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectWizard;
