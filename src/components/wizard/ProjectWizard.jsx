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
import DuplicateProjectDialog from './components/DuplicateProjectDialog';
import DuplicateProjectDetectionClient from '../../services/DuplicateProjectDetectionClient';
import performanceMonitoringService from '../../services/SimplePerformanceMonitoringService';

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
  
  // Smart assignment state
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  
  // Draft service state
  const [draftService] = useState(() => ProjectDraftService ? new ProjectDraftService() : null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastDraftSave, setLastDraftSave] = useState(null);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  // Duplicate detection state
  const [duplicateDetectionService] = useState(() => new DuplicateProjectDetectionClient());
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateWarningData, setDuplicateWarningData] = useState(null);
  const [isDuplicateDetectionRunning, setIsDuplicateDetectionRunning] = useState(false);
  const [duplicateCheckState, setDuplicateCheckState] = useState({
    completed: false,
    result: null,
    canCheck: false
  });

  // AE Markups file selection state (now integrated into revision progress modal)
  const [aeMarkupsFiles, setAEMarkupsFiles] = useState([]);
  const [aeMarkupsSelectedFiles, setAEMarkupsSelectedFiles] = useState([]);
  const [showAEMarkupsSelection, setShowAEMarkupsSelection] = useState(false);
  const [isAnalyzingAEMarkups, setIsAnalyzingAEMarkups] = useState(false);
  
  // Store form data when AE Markups dialog opens to prevent loss
  const formDataRef = useRef(null);
  
  // Promise resolver for waiting for AE Markups selection
  const aeMarkupsSelectionResolverRef = useRef(null);

  // Revision progress tracking
  const revisionProgress = useRevisionProgress();
  
  // Error dialog for revision errors
  const { errorState, showError, close: closeErrorDialog } = useErrorDialog();

  // Debounced validation to prevent excessive validation calls
  const [validationTimeout, setValidationTimeout] = useState(null);
  
  // Auto-dismiss notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [notification]);

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

  // Duplicate detection function
  const checkForDuplicateProject = useCallback(async (projectData) => {
    try {
      console.log('🔍 Running duplicate project detection...');
      setIsDuplicateDetectionRunning(true);
      
      const detectionResult = await duplicateDetectionService.checkForExistingProject(projectData);
      
      if (detectionResult.isDuplicate) {
        console.log('🚨 Duplicate project detected:', detectionResult);
        const uiData = duplicateDetectionService.formatForUI(detectionResult);
        setDuplicateWarningData(uiData.warningData);
        setShowDuplicateDialog(true);
        return true; // Indicates duplicate found - should block normal flow
      } else {
        console.log('✅ No duplicates found - safe to proceed');
        return false; // No duplicates - can proceed
      }
    } catch (error) {
      console.error('❌ Duplicate detection failed:', error);
      // On error, allow proceeding with warning
      return false;
    } finally {
      setIsDuplicateDetectionRunning(false);
    }
  }, [duplicateDetectionService]);

  // Handle duplicate dialog actions
  const handleDuplicateCreateRevision = useCallback(async (warningData) => {
    console.log('🔄 Creating revision from duplicate detection');
    
    // Close duplicate dialog
    setShowDuplicateDialog(false);
    setDuplicateWarningData(null);
    
    // Update form data to revision mode
    const revisionFormData = {
      ...formData,
      isRevision: true,
      previousRevisionPath: warningData.latestRFA.path
    };
    
    onFormDataChange(revisionFormData);
    
    // Navigate or stay on current step (revision workflow will handle the rest)
    console.log('Revision mode activated from duplicate detection');
  }, [formData, onFormDataChange]);

  const handleDuplicateProceedAnyway = useCallback(() => {
    console.log('⚠️ User chose to proceed with new project despite duplicate');
    setShowDuplicateDialog(false);
    setDuplicateWarningData(null);
    // Continue with normal new project flow
  }, []);

  const handleDuplicateCancel = useCallback(() => {
    console.log('❌ User cancelled project creation due to duplicate - clearing form data');
    setShowDuplicateDialog(false);
    setDuplicateWarningData(null);
    
    // Clear the form data so agent can resubmit
    resetWizardState();
    
    // Show confirmation message
    setNotification({
      type: 'info',
      message: 'Project form cleared. Agent can now resubmit the request.'
    });
  }, [resetWizardState]);

  // Handle duplicate check state changes from Step1
  const handleDuplicateCheckStateChange = useCallback((state) => {
    setDuplicateCheckState(state);
  }, []);

  // Wait for AE Markups selection function
  const waitForAEMarkupsSelection = useCallback(() => {
    return new Promise((resolve) => {
      console.log('⏳ Setting up promise to wait for AE Markups selection...');
      aeMarkupsSelectionResolverRef.current = resolve;
    });
  }, []);

  // AE Markups file selection functions
  const analyzeAEMarkupsFolder = useCallback(async (previousRevisionPath) => {
    try {
      console.log('🔍 Analyzing AE Markups folder for file selection...');
      setIsAnalyzingAEMarkups(true);
      
      const analysis = await window.electronAPI.revisionAnalyzeAEMarkups(previousRevisionPath);
      
      if (analysis.success && analysis.needsUserSelection) {
        console.log(`📊 AE Markups: ${analysis.fileCount} files found, showing embedded selection`);
        console.log('💾 Storing form data before selection:', formData);
        
        // Store current form data to prevent loss
        formDataRef.current = { ...formData };
        
        setAEMarkupsFiles(analysis.files);
        setShowAEMarkupsSelection(true); // Show selection within the progress modal
        return true; // Indicates user selection is needed
      } else if (analysis.success && !analysis.needsUserSelection) {
        console.log(`✅ AE Markups: ${analysis.fileCount} files found, auto-copying all`);
        // Auto-select all files for copying (≤ 3 files)
        const allFileNames = analysis.files.map(f => f.name);
        setAEMarkupsSelectedFiles(allFileNames);
        return false; // No user selection needed
      } else {
        console.log('⚠️ AE Markups folder not found or empty');
        setAEMarkupsSelectedFiles([]);
        return false; // No files to copy
      }
    } catch (error) {
      console.error('❌ Error analyzing AE Markups folder:', error);
      setAEMarkupsSelectedFiles([]);
      return false; // Fallback to no selection
    } finally {
      setIsAnalyzingAEMarkups(false);
    }
  }, []);

  const handleAEMarkupsConfirm = useCallback((selectedFiles) => {
    console.log('✅ AE Markups selection confirmed:', selectedFiles);
    setAEMarkupsSelectedFiles(selectedFiles);
    setShowAEMarkupsSelection(false); // Hide selection within the modal
    
    // Resolve the waiting promise to continue revision creation
    if (aeMarkupsSelectionResolverRef.current) {
      console.log('🔓 Resolving AE Markups selection promise with selected files');
      aeMarkupsSelectionResolverRef.current(selectedFiles);
      aeMarkupsSelectionResolverRef.current = null;
    }
  }, []);

  const handleAEMarkupsCancel = useCallback(() => {
    console.log('❌ AE Markups selection cancelled - using default behavior');
    setShowAEMarkupsSelection(false); // Hide selection within the modal
    setAEMarkupsSelectedFiles([]); // Default to copying all files (empty array = copy all)
    
    // Resolve the waiting promise to continue revision creation with empty selection
    if (aeMarkupsSelectionResolverRef.current) {
      console.log('🔓 Resolving AE Markups selection promise with empty selection (copy all)');
      aeMarkupsSelectionResolverRef.current([]);
      aeMarkupsSelectionResolverRef.current = null;
    }
  }, []);

  // Handle actual revision creation with AE Markups selection
  const handleRevisionCreation = useCallback(async (updatedFormData) => {
    try {
      console.log('🚀 Creating revision project with AE Markups selection...');
      
      // Start revision progress tracking
      revisionProgress.start('Creating Revision Project');
      
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

      // Create revision with AE Markups selection
      const revisionOptions = {
        previousRevisionPath: updatedFormData.previousRevisionPath,
        aeMarkupsSelectedFiles: updatedFormData.aeMarkupsSelectedFiles,
        ...updatedFormData.revisionOptions
      };
      
      console.log('📋 Revision options for creation:', revisionOptions);
      console.log('📋 Updated form data for creation:', updatedFormData);

      const folderCreationResult = await window.electronAPI.revisionCreate(updatedFormData, revisionOptions);

      // Clean up event listeners
      cleanupProgressListener();
      cleanupCompleteListener();
      cleanupErrorListener();
      
      if (!folderCreationResult.success) {
        throw new Error(`Failed to create revision: ${folderCreationResult.error}`);
      }
      
      // Store folder paths in formData for later use
      onFormDataChange({
        ...updatedFormData,
        projectPath: folderCreationResult.projectPath,
        rfaPath: folderCreationResult.rfaPath,
        agentFilesPath: folderCreationResult.agentFilesPath,
        previousRevisionPath: folderCreationResult.previousRevisionPath
      });

      setNotification({
        type: 'success',
        message: '✅ Revision project created successfully with selected AE Markups files!'
      });
      
    } catch (error) {
      console.error('❌ Error creating revision:', error);
      revisionProgress.error(error.message);
      setError(`Failed to create revision: ${error.message}`);
    }
  }, [revisionProgress, onFormDataChange]);

  // Continue revision creation after AE Markups selection (or cancellation)
  const continueRevisionCreationWithFiles = useCallback(async (selectedFiles) => {
    try {
      console.log('🚀 Continuing revision creation with AE Markups selection...');
      console.log('📋 Current formData prop:', JSON.stringify(formData, null, 2));
      console.log('💾 Stored formData from ref:', JSON.stringify(formDataRef.current, null, 2));
      console.log('📋 AE Markups selected files:', selectedFiles);
      
      // Use stored form data if current formData is incomplete
      const sourceFormData = formDataRef.current || formData;
      
      // Check if we have valid form data
      if (!sourceFormData || typeof sourceFormData !== 'object') {
        console.error('❌ No valid form data available:', {
          currentFormData: formData,
          storedFormData: formDataRef.current
        });
        throw new Error('Form data is not available - please try again');
      }
      
      // Log all current form data fields
      console.log('📋 Using form data source:', sourceFormData === formData ? 'current prop' : 'stored ref');
      console.log('📋 Available form fields:', Object.keys(sourceFormData));
      console.log('📋 Required fields check:', {
        projectName: sourceFormData.projectName,
        rfaType: sourceFormData.rfaType,
        rfaNumber: sourceFormData.rfaNumber,
        agentNumber: sourceFormData.agentNumber,
        projectContainer: sourceFormData.projectContainer,
        regionalTeam: sourceFormData.regionalTeam
      });
      
      // Ensure all required fields are preserved
      const updatedFormData = {
        ...sourceFormData, // Use the best available form data
        aeMarkupsSelectedFiles: selectedFiles // Add AE Markups selection
      };
      
      console.log('📋 Updated form data keys:', Object.keys(updatedFormData));
      
      // Check for the essential required fields
      const requiredFields = ['projectName', 'rfaType', 'rfaNumber', 'agentNumber', 'projectContainer'];
      const missingFields = requiredFields.filter(field => !updatedFormData[field] || updatedFormData[field].trim() === '');
      
      if (missingFields.length > 0) {
        console.error('❌ Missing required fields:', {
          missing: missingFields,
          projectName: updatedFormData.projectName,
          rfaType: updatedFormData.rfaType,
          rfaNumber: updatedFormData.rfaNumber,
          agentNumber: updatedFormData.agentNumber,
          projectContainer: updatedFormData.projectContainer,
          allFields: Object.keys(updatedFormData),
          formDataType: typeof formData
        });
        throw new Error(`Required project fields are missing: ${missingFields.join(', ')}`);
      }
      
      // Trigger actual revision creation with the selected files
      await handleRevisionCreation(updatedFormData);
      
    } catch (error) {
      console.error('❌ Error continuing revision creation:', error);
      setError(`Failed to continue revision creation: ${error.message}`);
    }
  }, [handleRevisionCreation]);

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

      // VALIDATION FIX: Use wizard's validation state instead of re-validating
      // This prevents stale formData from causing validation failures
      const currentStepValidation = wizard.getStepValidation(wizard.currentStep);
      
      console.log(`ProjectWizard: handleNext called for step ${wizard.currentStep}`, {
        hasWizardValidation: !!currentStepValidation,
        wizardValidationIsValid: currentStepValidation?.isValid,
        formDataHasTotalTriage: formData.totalTriage > 0,
        formDataTotalTriage: formData.totalTriage,
        formDataKeys: Object.keys(formData).filter(k => k.includes('triage') || k.includes('Triage'))
      });
      
      // If wizard validation hasn't been set yet, fall back to stepValidation
      if (!currentStepValidation || currentStepValidation.isValid === undefined) {
        console.warn('Wizard validation not set, performing validation check...');
        const validationResult = stepValidation.validateStep(wizard.currentStep, formData);
        
        console.log('Fallback validation result:', {
          isValid: validationResult?.isValid,
          errors: validationResult?.errors
        });
        
        if (!validationResult || !validationResult.isValid) {
          const errorMessage = validationResult && validationResult.errors 
            ? `Validation errors: ${Object.values(validationResult.errors).flat().join(', ')}`
            : 'Please fix the validation errors before proceeding';
          
          console.error('ProjectWizard: Validation failed:', errorMessage);
          setError(errorMessage);
          setNotification({
            type: 'warning',
            message: 'Please complete all required fields before proceeding'
          });
          return;
        }
      } else if (!currentStepValidation.isValid) {
        // Use wizard's validation result
        const errorMessage = currentStepValidation.errors && Object.keys(currentStepValidation.errors).length > 0
          ? `Validation errors: ${Object.values(currentStepValidation.errors).flat().join(', ')}`
          : 'Please fix the validation errors before proceeding';
        
        console.error('ProjectWizard: Wizard validation shows invalid:', {
          errors: currentStepValidation.errors,
          errorMessage
        });
        setError(errorMessage);
        setNotification({
          type: 'warning',
          message: 'Please complete all required fields before proceeding'
        });
        return;
      }
      
      console.log('ProjectWizard: Validation passed, proceeding with step completion');

      // ENHANCED ERROR HANDLING: Step completion with individual error tracking
      stepCompletionAttempted = true;
      
      // Special handling for Step 1 - Create partial project and folders
      if (wizard.currentStep === 1) {
        operationContext = 'step1-completion';
        
        // DUPLICATE DETECTION: Check if duplicate check is needed (only if user bypassed auto-check)
        if (duplicateCheckState.canCheck && !duplicateCheckState.completed) {
          console.log('🔍 Final duplicate check before Step 2 (user bypassed auto-check)...');
          operationContext = 'duplicate-check';
          
          try {
            setNotification({
              type: 'info',
              message: 'Final duplicate check before proceeding...'
            });
            
            const isDuplicate = await checkForDuplicateProject(formData);
            
            if (isDuplicate) {
              console.log('🚨 Final check found duplicate - blocking Step 2 navigation');
              setNotification({
                type: 'warning',
                message: 'Duplicate project detected - please review the options in the dialog'
              });
              return; // Stop navigation, duplicate dialog is showing
            } else {
              console.log('✅ Final check passed - safe to proceed to Step 2');
            }
          } catch (error) {
            console.error('❌ Final check failed:', error);
            // Continue anyway on error (non-blocking)
            setNotification({
              type: 'warning',
              message: 'Duplicate check failed, but proceeding anyway'
            });
          }
        }
        
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

                // SAFETY CHECK: Verify previousRevisionPath exists before proceeding
                if (!formData.previousRevisionPath) {
                  console.error('❌ Cannot create revision: previousRevisionPath is not set');
                  showError({
                    title: 'Previous Revision Required',
                    message: 'Please select the previous RFA folder manually before creating the revision.',
                    details: 'The previous revision path must be configured in Step 1 before proceeding.',
                    type: 'warning'
                  });
                  revisionProgress.close();
                  // Clean up event listeners
                  cleanupProgressListener();
                  cleanupCompleteListener();
                  cleanupErrorListener();
                  return;
                }

                // STEP 1: Analyze AE Markups folder before creating revision
                console.log('🔍 Step 1: Analyzing AE Markups folder...');
                const needsUserSelection = await analyzeAEMarkupsFolder(formData.previousRevisionPath);
                
                let selectedAEMarkupsFiles = aeMarkupsSelectedFiles; // Default to current state
                
                if (needsUserSelection) {
                  // User needs to select files - wait for selection
                  console.log('📋 AE Markups selection dialog opened - waiting for user input');
                  revisionProgress.updateProgress('Waiting for AE Markups file selection...', 15, { step: 'user_selection' });
                  
                  // Wait for user to make selection - this will return the selected files
                  selectedAEMarkupsFiles = await waitForAEMarkupsSelection();
                  
                  console.log('✅ AE Markups selection completed, continuing with files:', selectedAEMarkupsFiles);
                  revisionProgress.updateProgress('Continuing with revision creation...', 20, { step: 'resume_creation' });
                }
                
                // STEP 2: Create revision with real-time progress tracking
                console.log('🚀 Step 2: Creating revision project...');
                const revisionOptions = {
                  previousRevisionPath: formData.previousRevisionPath,
                  aeMarkupsSelectedFiles: selectedAEMarkupsFiles, // Use the files from selection
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

          // Create assignment for selected assignee if available
          if (selectedAssignee) {
            try {
              setNotification({
                type: 'info',
                message: `Assigning project to ${selectedAssignee.name}...`
              });

              const assignment = {
                id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                userId: selectedAssignee.id,
                projectId: savedProject.id,
                projectName: savedProject.projectName,
                rfaNumber: savedProject.rfaNumber,
                estimatedHours: savedProject.totalTriage || 0,
                startDate: new Date().toISOString().split('T')[0],
                dueDate: savedProject.dueDate || null,
                status: 'assigned',
                priority: savedProject.priority || 'medium',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              const assignmentResult = await window.electronAPI.workloadAssignmentSave(assignment);
              
              if (assignmentResult.success) {
                console.log('ProjectWizard: Assignment created successfully:', assignment);
                setNotification({
                  type: 'success',
                  message: `✅ Project assigned to ${selectedAssignee.name}!`
                });
              } else {
                console.error('ProjectWizard: Failed to create assignment:', assignmentResult.error);
                setNotification({
                  type: 'warning',
                  message: '⚠️ Project saved, but assignment failed. You can assign it manually from the Workload Dashboard.'
                });
              }
            } catch (assignmentError) {
              console.error('ProjectWizard: Error creating assignment:', assignmentError);
              // Don't fail the whole process if assignment fails
              setNotification({
                type: 'warning',
                message: '⚠️ Project saved, but assignment failed. You can assign it manually from the Workload Dashboard.'
              });
            }
          }

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
            onCheckForDuplicates={checkForDuplicateProject}
            isDuplicateDetectionRunning={isDuplicateDetectionRunning}
            onDuplicateCheckStateChange={handleDuplicateCheckStateChange}
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
              onAssigneeSelected={setSelectedAssignee}
            />
          </WizardErrorBoundary>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 bg-white dark:bg-gray-800 rounded-lg shadow-soft min-h-[600px] relative">
      {/* Notification Display */}
      {notification && (
        <div className={`
          fixed top-5 right-5 px-5 py-3 rounded-lg shadow-lg z-[1000]
          flex items-center gap-3 max-w-md animate-slideIn
          ${notification.type === 'success' 
            ? 'bg-success-100 border border-success-200 text-success-800 dark:bg-success-900/30 dark:border-success-700 dark:text-success-200' 
            : 'bg-error-100 border border-error-200 text-error-800 dark:bg-error-900/30 dark:border-error-700 dark:text-error-200'
          }
        `}>
          <span className="flex-1">{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="text-lg font-bold opacity-70 hover:opacity-100 transition-opacity"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-error-100 border border-error-200 text-error-800 dark:bg-error-900/30 dark:border-error-700 dark:text-error-200 px-5 py-3 rounded-lg mb-5 flex items-center justify-between">
          <span className="flex-1">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="text-lg font-bold hover:opacity-70 transition-opacity"
          >
            ×
          </button>
        </div>
      )}

      {/* Enhanced Draft Status */}
      {(projectDraft.isDraftSaving || isSavingDraft) && (
        <div className="fixed bottom-5 left-5 bg-primary-500 text-white px-4 py-2 rounded-full text-sm z-[1000] flex items-center gap-2 animate-pulse">
          <span className="spinner w-4 h-4 border-2"></span>
          <span>Saving draft...</span>
        </div>
      )}

      {(projectDraft.lastSaved || lastDraftSave) && !(projectDraft.isDraftSaving || isSavingDraft) && (
        <div className="fixed bottom-5 left-5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-full text-xs z-[1000]">
          <span>
            ✅ Last saved: {(lastDraftSave || projectDraft.lastSaved).toLocaleTimeString()}
            {currentDraftId && ` (Draft: ${currentDraftId.substring(6, 12)}...)`}
          </span>
        </div>
      )}

      {/* Wizard Content */}
      <div className="mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-6 py-4 -mx-4 -mb-4 rounded-b-lg">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left Navigation */}
          <div className="flex gap-3">
            {wizard.canGoToPrevious() && (
              <button
                onClick={() => {
                  wizard.previousStep();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={isLoading}
                className="btn-secondary"
              >
                ← Previous
              </button>
            )}
            
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>

          {/* Center Progress Indicators */}
          <div className="flex items-center gap-4">
            {Array.from({ length: 2 }, (_, i) => {
              const stepNumber = i + 1;
              const stepTitles = ['Project Setup', 'Triage & Complete'];
              const isActive = stepNumber === wizard.currentStep;
              const isCompleted = wizard.isStepCompleted(stepNumber);
              const isAccessible = wizard.isStepAccessible(stepNumber);
              
              return (
                <React.Fragment key={stepNumber}>
                  {i > 0 && (
                    <div className={`hidden sm:block h-0.5 w-12 ${
                      wizard.isStepCompleted(stepNumber - 1) 
                        ? 'bg-success-500' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  )}
                  <div
                    className={`flex flex-col items-center gap-2 ${
                      isAccessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    }`}
                    onClick={() => {
                      if (isAccessible) {
                        wizard.goToStep(stepNumber);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                      transition-all duration-300
                      ${isCompleted 
                        ? 'bg-success-500 text-white shadow-lg shadow-success-500/50' 
                        : isActive 
                          ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/50 ring-4 ring-primary-200 dark:ring-primary-900/50' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }
                    `}>
                      {isCompleted ? '✓' : stepNumber}
                    </div>
                    <div className="text-center">
                      <div className={`text-xs font-semibold ${
                        isActive ? 'text-primary-600 dark:text-primary-400' : 
                        isCompleted ? 'text-success-600 dark:text-success-400' : 
                        'text-gray-600 dark:text-gray-400'
                      }`}>
                        {stepTitles[i]}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {isCompleted ? 'Complete' : isActive ? 'Current' : 'Pending'}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Right Navigation */}
          <div>
            {wizard.currentStep < 2 ? (
              <button
                onClick={handleNext}
                disabled={isLoading || !wizard.canProceedToNext()}
                className="btn-primary"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner w-4 h-4 border-2"></span>
                    Saving...
                  </span>
                ) : (
                  'Next →'
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={isLoading || !wizard.canProceedToNext()}
                className="btn-primary"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="spinner w-4 h-4 border-2"></span>
                    Completing...
                  </span>
                ) : (
                  'Complete & Manage Project'
                )}
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
        showAEMarkupsSelection={showAEMarkupsSelection}
        aeMarkupsFiles={aeMarkupsFiles}
        onAEMarkupsConfirm={handleAEMarkupsConfirm}
        onAEMarkupsCancel={handleAEMarkupsCancel}
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

      {/* Duplicate Project Warning Dialog */}
      <DuplicateProjectDialog
        isOpen={showDuplicateDialog}
        warningData={duplicateWarningData}
        onCreateRevision={handleDuplicateCreateRevision}
        onProceedAnyway={handleDuplicateProceedAnyway}
        onCancel={handleDuplicateCancel}
      />

    </div>
  );
};

export default ProjectWizard;
