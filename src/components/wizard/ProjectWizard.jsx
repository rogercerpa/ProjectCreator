import React, { useState, useEffect, useCallback, useRef } from 'react';
import useWizardState from './hooks/useWizardState';
import useProjectDraft from './hooks/useProjectDraft';
import useStepValidation from './hooks/useStepValidation';
import WizardLayout from './components/WizardLayout';
import WizardErrorBoundary from './components/WizardErrorBoundary';
import ProjectWizardStep1 from './steps/ProjectWizardStep1';
import ProjectWizardStep2 from './steps/ProjectWizardStep2';
import RevisionProgressModal, { useRevisionProgress } from './components/RevisionProgressModal';
import ErrorDialog, { useErrorDialog } from './components/ErrorDialog';
import performanceMonitoringService from '../../services/SimplePerformanceMonitoringService';
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
  formData,
  onFormDataChange,
  onProjectCreated, 
  onProjectUpdated, 
  onCancel,
  onWizardReset,
  onNavigateToSettings,
  existingProject = null,
  mode = 'create' // 'create' or 'edit'
}) => {
  // Use formData from props (managed by App.jsx) instead of internal state
  // This ensures proper synchronization and persistence across navigation

  // Initialize hooks
  const wizard = useWizardState(formData, 2);
  const projectDraft = useProjectDraft(existingProject?.id);
  const stepValidation = useStepValidation();
  
  // Use refs to prevent infinite loops in useEffect
  const projectDraftRef = useRef(projectDraft);
  projectDraftRef.current = projectDraft;

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // Draft service state
  const [draftService] = useState(() => ProjectDraftService ? new ProjectDraftService() : null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastDraftSave, setLastDraftSave] = useState(null);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  // Revision progress tracking
  const revisionProgress = useRevisionProgress();
  
  // Error dialog for revision errors
  const { errorState, showError, close: closeErrorDialog } = useErrorDialog();

  // Debounced validation to prevent excessive validation calls
  const [validationTimeout, setValidationTimeout] = useState(null);

  // Handle form data changes with debounced validation
  const handleFormDataChange = useCallback((newFormData) => {
    // Update form data immediately via parent component (App.jsx)
    onFormDataChange(newFormData);
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
  }, [onFormDataChange, wizard, stepValidation]); // Updated dependencies

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

  // Reset wizard to clean state
  const resetWizardState = useCallback(() => {
    // Clear notifications and errors first
    setError(null);
    setNotification(null);
    setIsLoading(false);
    
    // Reset draft states
    if (projectDraft) {
      try {
        projectDraft.clearDraft();
      } catch (draftError) {
        console.warn('Failed to clear draft:', draftError);
      }
    }
    
    // Call parent reset function to reset form data (this will trigger re-render with clean data)
    if (onWizardReset) {
      onWizardReset();
    }
    
    // Reset wizard navigation state AFTER formData is cleared
    // This ensures wizard state resets with clean formData
    setTimeout(() => {
      wizard.resetWizard();
      console.log('Wizard reset completed - ready for new project');
    }, 50); // Small delay to ensure formData reset completes first
    
  }, [wizard, projectDraft, onWizardReset]);

  // Auto-scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [wizard.currentStep]);

  // Handle step navigation with enhanced error handling
  const handleNext = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    // Track step navigation performance
    const timerId = performanceMonitoringService.startTimer('wizard_step_navigation', {
      fromStep: wizard.currentStep,
      toStep: wizard.currentStep + 1,
      mode
    });

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
      
      // Special handling for Step 1 - Create partial project and folders
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
              type: 'info',
              message: 'Creating project folders and files...'
            });

            // Check if this is a revision project
            if (formData.isRevision) {
              console.log('ProjectWizard: Creating revision project');
              
              // Start revision progress tracking
              revisionProgress.start('Creating Revision Project');
              
              try {
                // Set up progress event listeners
                const cleanupProgressListener = window.electronAPI.onRevisionProgress((data) => {
                  revisionProgress.updateProgress(data.step, data.progress, data.details);
                });

                const cleanupCompleteListener = window.electronAPI.onRevisionComplete((data) => {
                  revisionProgress.complete(data.message);
                });

                const cleanupErrorListener = window.electronAPI.onRevisionError((data) => {
                  revisionProgress.error(data.error);
                });

                // Create revision with real-time progress tracking
                const revisionOptions = {
                  previousRevisionPath: formData.previousRevisionPath,
                  ...formData.revisionOptions
                };

                const folderCreationResult = await window.electronAPI.revisionCreate(formData, revisionOptions);

                // Clean up event listeners
                cleanupProgressListener();
                cleanupCompleteListener();
                cleanupErrorListener();
                
                if (!folderCreationResult.success) {
                  if (folderCreationResult.requiresManualSelection) {
                    // Manual selection needed - show error dialog
                    showError({
                      title: 'Previous Revision Required',
                      message: 'Previous revision not found automatically. Please select the previous RFA folder manually in the revision panel above, then try again.',
                      details: folderCreationResult.searchResult,
                      type: 'warning'
                    });
                    revisionProgress.close();
                    return; // Don't proceed until manual selection is complete
                  }
                  
                  throw new Error(`Failed to create revision: ${folderCreationResult.error}`);
                }
                
                // Success is handled by the onRevisionComplete event
                
                // Store folder paths in formData for later use
                onFormDataChange({
                  ...formData,
                  projectPath: folderCreationResult.projectPath,
                  rfaPath: folderCreationResult.rfaPath,
                  agentFilesPath: folderCreationResult.agentFilesPath,
                  previousRevisionPath: folderCreationResult.previousRevisionPath
                });

                setNotification({
                  type: 'success',
                  message: '✅ Revision project created successfully with files copied from previous revision!'
                });
                
              } catch (revisionError) {
                revisionProgress.error(revisionError.message);
                
                // Show error dialog for revision creation failures
                showError({
                  title: 'Revision Creation Failed',
                  message: 'Failed to create the revision project. Please check the error details and try again.',
                  details: revisionError.message,
                  showRetry: false
                });
                
                throw revisionError;
              }
              
            } else {
              // Standard new project creation
              console.log('ProjectWizard: Creating new project');
              
              const folderCreationResult = await window.electronAPI.projectCreateWithFolders(formData);
              
              if (!folderCreationResult.success) {
                throw new Error(`Failed to create project folder: ${folderCreationResult.error}`);
              }
              
              // Store folder paths in formData for later use
              onFormDataChange({
                ...formData,
                projectPath: folderCreationResult.projectPath,
                rfaPath: folderCreationResult.rfaPath,
                agentFilesPath: folderCreationResult.agentFilesPath
              });

              setNotification({
                type: 'success',
                message: '✅ Project basics saved and folders created! Ready for triage calculation.'
              });
            }
          } else {
            setNotification({
              type: 'warning',
              message: '⚠️ Auto-save encountered an issue, but your data is preserved.'
            });
          }
        } catch (step1Error) {
          console.error('Step 1 completion failed:', step1Error);
          setError('Failed to save project basics or create folders. Please try again.');
          setNotification({
            type: 'error',
            message: 'Unable to save project data or create folders. Check your connection and try again.'
          });
          return; // Don't proceed if step 1 fails
        }
      }
      
      // Special handling for Step 2 - Complete project creation and navigate to management
      if (wizard.currentStep === 2) {
        operationContext = 'step2-completion';
        try {
          setNotification({
            type: 'info',
            message: 'Completing project creation...'
          });

          // Complete the project creation
          const completeProject = {
            ...formData,
            status: 'active',
            completionStep: 2,
            updatedAt: new Date().toISOString(),
            sourceType: 'wizard',
            // Add the physical folder paths to the project (already created in Step 1)
            projectPath: formData.projectPath,
            rfaPath: formData.rfaPath,
            agentFilesPath: formData.agentFilesPath
          };

          console.log('ProjectWizard: Created complete project object:', completeProject);

          // CRITICAL FIX: Save project to persistent storage first
          setNotification({
            type: 'info',
            message: 'Saving project to database...'
          });

          const saveResult = await window.electronAPI.projectSave(completeProject);
          
          if (!saveResult.success) {
            throw new Error(`Failed to save project: ${saveResult.error}`);
          }

          console.log('ProjectWizard: Project saved successfully:', saveResult);

          // Use the saved project with proper ID and timestamps
          const savedProject = saveResult.project;

          // Navigate to project management
          console.log('ProjectWizard: About to call navigation function');
          console.log('ProjectWizard: mode =', mode);
          console.log('ProjectWizard: onProjectCreated =', typeof onProjectCreated);
          console.log('ProjectWizard: savedProject =', savedProject);

          if (mode === 'create' && typeof onProjectCreated === 'function') {
            console.log('ProjectWizard: Calling onProjectCreated with saved project:', savedProject);
            try {
              // Call the navigation function and wait for completion
              await onProjectCreated(savedProject);
              console.log('ProjectWizard: ✅ onProjectCreated completed successfully');
              
              setNotification({
                type: 'success',
                message: '🎉 Project saved and creation completed! Welcome to project management.'
              });
              
            } catch (navError) {
              console.error('ProjectWizard: ❌ Error in onProjectCreated:', navError);
              setNotification({
                type: 'warning',
                message: '✅ Project saved successfully, but navigation failed. Please check the Projects list.'
              });
              // Don't throw the error, project is saved successfully
            }
          } else if (typeof onProjectUpdated === 'function') {
            console.log('ProjectWizard: Calling onProjectUpdated with saved project:', savedProject);
            try {
              await onProjectUpdated(savedProject);
              console.log('ProjectWizard: ✅ onProjectUpdated completed successfully');
              
              setNotification({
                type: 'success',
                message: '🎉 Project updated and saved successfully! Welcome to project management.'
              });
              
            } catch (navError) {
              console.error('ProjectWizard: ❌ Error in onProjectUpdated:', navError);
              setNotification({
                type: 'warning',
                message: '✅ Project updated successfully, but navigation failed. Please check the Projects list.'
              });
              // Don't throw the error, project is saved successfully
            }
          } else {
            console.error('ProjectWizard: ❌ No valid navigation function available!');
            console.error('ProjectWizard: mode =', mode);
            console.error('ProjectWizard: onProjectCreated =', onProjectCreated);
            console.error('ProjectWizard: onProjectUpdated =', onProjectUpdated);
            
            setNotification({
              type: 'warning',
              message: '✅ Project saved successfully! Please navigate to the Projects list to view it.'
            });
          }

          // Wait a moment to ensure all UI updates are complete
          setTimeout(() => {
            console.log('ProjectWizard: All navigation and UI updates should be complete');
          }, 200);

          // Don't proceed to next step since we're navigating away
          return;

        } catch (step2Error) {
          console.error('Step 2 completion failed:', step2Error);
          setError('Failed to complete project creation. Please try again.');
          setNotification({
            type: 'error',
            message: 'Unable to complete project creation. Please verify your data and try again.'
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
      // End performance timer
      performanceMonitoringService.endTimer(timerId);
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
          projectDraftRef.current.enableAutoSave(formData, wizard.currentStep);
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
      projectDraftRef.current.disableAutoSave();
    };
  }, [formData, wizard.currentStep]); // Removed projectDraft from dependencies

  // Handle draft recovery
  useEffect(() => {
    if (mode === 'create' && !existingProject) {
      // Check for recoverable drafts
      const drafts = projectDraftRef.current.getDrafts();
      if (drafts.length > 0) {
        // Could show draft recovery dialog here
        // Temporarily disabled to prevent console spam
        // console.log('Recoverable drafts found:', drafts);
      }
    }
  }, [mode, existingProject]); // Removed projectDraft from dependencies


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
            onWizardReset={resetWizardState}
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
              onNavigateToSettings={onNavigateToSettings}
            />
          </WizardErrorBoundary>
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
        <div className="wizard-navigation-content">
          <div className="nav-left">
            {wizard.canGoToPrevious() && (
              <button
                onClick={() => {
                  wizard.previousStep();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
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
              {Array.from({ length: 2 }, (_, i) => {
                const stepNumber = i + 1;
                const stepTitles = ['Project Setup', 'Triage & Complete'];
                const stepStatuses = ['Basic Info & Folders', 'Calculations & Finish'];
                const isActive = stepNumber === wizard.currentStep;
                const isCompleted = wizard.isStepCompleted(stepNumber);
                const isAccessible = wizard.isStepAccessible(stepNumber);
                
                return (
                  <div
                    key={stepNumber}
                    className={`progress-step ${
                      isActive ? 'active' : ''
                    } ${
                      isCompleted ? 'completed' : ''
                    } ${
                      isAccessible ? 'accessible' : ''
                    }`}
                    onClick={() => {
                      if (isAccessible) {
                        wizard.goToStep(stepNumber);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    <div className="step-circle">
                      {isCompleted ? '✓' : stepNumber}
                    </div>
                    <div className="step-label">
                      {stepTitles[i]}
                    </div>
                    <div className="step-status">
                      {isCompleted ? 'Complete' : isActive ? 'Current' : 'Pending'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="nav-right">
            {wizard.currentStep < 2 ? (
              <button
                onClick={handleNext}
                disabled={isLoading || !wizard.canProceedToNext()}
                className="btn btn-primary"
              >
                {isLoading ? 'Saving...' : 'Next →'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={isLoading || !wizard.canProceedToNext()}
                className="btn btn-primary"
              >
                {isLoading ? 'Completing...' : 'Complete & Manage Project'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Revision Progress Modal */}
      <RevisionProgressModal
        isOpen={revisionProgress.isOpen}
        progress={revisionProgress.progress}
        currentStep={revisionProgress.currentStep}
        operationLog={revisionProgress.operationLog}
        onCancel={revisionProgress.close}
        canCancel={revisionProgress.progress < 100}
      />
      
      {/* Error Dialog for Revision Operations */}
      <ErrorDialog
        isOpen={errorState.isOpen}
        title={errorState.title}
        message={errorState.message}
        details={errorState.details}
        type={errorState.type}
        showRetry={errorState.showRetry}
        onClose={closeErrorDialog}
        onRetry={errorState.onRetry}
      />
    </div>
  );
};

export default ProjectWizard;
