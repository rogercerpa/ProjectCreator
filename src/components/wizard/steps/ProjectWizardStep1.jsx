import React, { useState, useEffect } from 'react';
import WizardLayout from '../components/WizardLayout';
import RevisionConfigurationDialog from '../components/RevisionConfigurationDialog';
import dropdownOptionsService from '../../../services/DropdownOptionsService';
import triageCalculationService from '../../../services/TriageCalculationService';
import MultiSelectDropdown from '../../MultiSelectDropdown';
import { parseAgileDate, getUserTimezone, formatDateTimeLocal } from '../../../utils/dateUtils';

/**
 * ProjectWizardStep1 - Basic Project Information
 * Extracted from ProjectForm.jsx lines 513-788
 * Preserves ALL original functionality, validation, and behavior
 */
const ProjectWizardStep1 = ({ 
  formData, 
  onFormDataChange, 
  errors = {}, 
  onFieldError,
  onFieldTouch,
  showImportedFields = false,
  onValidationChange,
  onWizardReset,
  onCheckForDuplicates,
  isDuplicateDetectionRunning = false,
  onDuplicateCheckStateChange
}) => {
  const [isPasting, setIsPasting] = useState(false);
  const [importedFields, setImportedFields] = useState([]);
  const [customProjectType, setCustomProjectType] = useState('');
  const [isCustomProjectTypeMode, setIsCustomProjectTypeMode] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  // SIMPLIFIED: Single state object for duplicate checking
  const [duplicateCheckState, setDuplicateCheckState] = useState({
    status: 'none', // 'none' | 'checking' | 'success' | 'duplicate' | 'error' | 'outdated'
    source: null,   // 'manual' | 'agile'
    result: null,   // check results
    timestamp: null,
    canOverride: false,
    showButton: false
  });

  // CLEAN: RFA version extraction from RFA number
  const extractRFAVersion = (rfaNumber) => {
    if (!rfaNumber) return null;
    
    // Parse "284443-0" → return "0"
    // Parse "284443-1" → return "1"
    const parts = rfaNumber.trim().split('-');
    return parts.length === 2 ? parts[1] : null;
  };

  // CLEAN: Project path building based on container year and project name first letter
  const buildProjectPath = (projectName, projectContainer) => {
    if (!projectName || !projectContainer) return null;
    
    try {
      console.log('🔧 UPDATED PATH BUILDING - Version 2.0');
      console.log(`📝 Input: projectName="${projectName}", projectContainer="${projectContainer}"`);
      
      // Extract year from container: "24-16071" → "2024"
      const containerParts = projectContainer.trim().split('-');
      const year = "20" + containerParts[0]; // "24" → "2024"
      console.log(`📅 Year extracted: ${containerParts[0]} → ${year}`);
      
      // Get first letter of project name: "YOKOTA B118" → "Y"
      const firstLetter = projectName.trim().charAt(0).toUpperCase();
      console.log(`🔤 First letter: ${firstLetter}`);
      
      // Build full project folder name with proper spacing
      // Add space before underscore to match actual folder structure
      const projectFolderName = `${projectName.trim()} _${projectContainer.trim()}`;
      console.log(`📂 Folder name: "${projectFolderName}" (note space before underscore)`);
      
      // Build complete path with lowercase 'das' to match server
      const projectPath = `\\\\10.3.10.30\\das\\${year} Projects\\${firstLetter}\\${projectFolderName}`;
      
      console.log(`📁 FINAL CORRECTED PATH: ${projectPath}`);
      console.log(`📁 Should match: \\\\10.3.10.30\\das\\2024 Projects\\Y\\YOKOTA B118 _24-16071`);
      return projectPath;
    } catch (error) {
      console.error('❌ Error building project path:', error);
      return null;
    }
  };

  // CLEAN: Check if RFA version is initial (-0) and requires duplicate check
  const shouldCheckForDuplicate = () => {
    const rfaVersion = extractRFAVersion(formData.rfaNumber);
    const isInitialVersion = rfaVersion === "0";
    
    console.log(`🔍 RFA version check: "${formData.rfaNumber}" → version "${rfaVersion}" → initial: ${isInitialVersion}`);
    return isInitialVersion;
  };

  // SIMPLIFIED: Project container format validation
  const isValidProjectContainer = (container) => {
    if (!container) return false;
    // Format: ##-##### (e.g., "24-61726")
    const regex = /^\d{2}-\d{5}$/;
    return regex.test(container.trim());
  };

  // CLEAN: Check if all required fields are ready for duplicate check
  const isReadyForDuplicateCheck = () => {
    const projectName = formData.projectName?.trim();
    const projectContainer = formData.projectContainer?.trim();
    const rfaNumber = formData.rfaNumber?.trim();
    
    return projectName && 
           projectName.length > 2 && 
           isValidProjectContainer(projectContainer) &&
           rfaNumber &&
           rfaNumber.length > 2;
  };

  // CLEAN: "-0 version only" duplicate check for manual entry
  useEffect(() => {
    const readyForCheck = isReadyForDuplicateCheck();
    const isInitialVersion = shouldCheckForDuplicate(); // Only true for "-0" versions
    
    // Only show button for manual entry AND initial versions (-0)
    const shouldShowButton = readyForCheck && 
                            isInitialVersion &&
                            duplicateCheckState.source !== 'agile' &&
                            !isDuplicateDetectionRunning &&
                            onCheckForDuplicates;

    // Update button visibility
    setDuplicateCheckState(prev => ({
      ...prev,
      showButton: shouldShowButton
    }));

    // Debounced auto-check for manual entry (only for -0 versions)
    if (readyForCheck && 
        isInitialVersion &&
        duplicateCheckState.status === 'none' && 
        duplicateCheckState.source !== 'agile' &&
        !isDuplicateDetectionRunning &&
        onCheckForDuplicates) {
      
      console.log('🎯 Manual entry ready for "-0" version - starting debounced duplicate check...');
      
      const timeoutId = setTimeout(async () => {
        await performDuplicateCheck('manual');
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }

    // Mark as outdated if fields ACTUALLY changed after successful check (only for -0 versions)
    if ((duplicateCheckState.status === 'success' || duplicateCheckState.status === 'duplicate') &&
        duplicateCheckState.source === 'manual' &&
        duplicateCheckState.result?.checkedFields &&
        isInitialVersion) {
      
      const checkedFields = duplicateCheckState.result.checkedFields;
      const fieldsChanged = 
        checkedFields.projectName !== formData.projectName ||
        checkedFields.projectContainer !== formData.projectContainer ||
        checkedFields.rfaNumber !== formData.rfaNumber;
      
      if (fieldsChanged) {
        console.log('🔄 Fields changed after successful check - marking as outdated');
        setDuplicateCheckState(prev => ({
          ...prev,
          status: 'outdated'
        }));
      }
    }

    // Reset state if version changes from -0 to something else
    if (!isInitialVersion && duplicateCheckState.status !== 'none') {
      console.log('🔄 RFA version changed from "-0" - resetting duplicate check state');
      setDuplicateCheckState(prev => ({
        ...prev,
        status: 'none',
        result: null,
        showButton: false
      }));
    }
  }, [formData.projectName, formData.projectContainer, formData.rfaNumber, isDuplicateDetectionRunning, onCheckForDuplicates]);

  // Notify parent of duplicate check state changes
  useEffect(() => {
    if (onDuplicateCheckStateChange) {
      onDuplicateCheckStateChange({
        completed: duplicateCheckState.status !== 'none' && duplicateCheckState.status !== 'checking',
        result: duplicateCheckState.result,
        canCheck: duplicateCheckState.showButton
      });
    }
  }, [duplicateCheckState, onDuplicateCheckStateChange]);

  // CLEAN: "-0 version only" duplicate check function with simple folder existence
  const performDuplicateCheck = async (source) => {
    if (!isReadyForDuplicateCheck() || !shouldCheckForDuplicate()) {
      console.error('❌ Duplicate check: Invalid conditions or not -0 version');
      return;
    }

    try {
      console.log(`🔍 Starting ${source} duplicate check for RFA "-0" version...`);
      
      // Set checking state
      setDuplicateCheckState(prev => ({
        ...prev,
        status: 'checking',
        source: source,
        canOverride: false
      }));

      // Build project path and check if folder exists
      const projectPath = buildProjectPath(formData.projectName, formData.projectContainer);
      if (!projectPath) {
        throw new Error('Could not build project path');
      }

      console.log(`📁 Simple folder existence check: ${projectPath}`);
      
      // Use simple folder existence check instead of complex duplicate detection
      const folderExists = await window.electronAPI.checkFolderExists(projectPath);
      
      // Store current field values for outdated detection
      const currentFields = {
        projectName: formData.projectName,
        projectContainer: formData.projectContainer,
        rfaNumber: formData.rfaNumber
      };
      
      // Set result state
      setDuplicateCheckState(prev => ({
        ...prev,
        status: folderExists ? 'duplicate' : 'success',
        result: {
          isDuplicate: folderExists,
          projectPath: projectPath,
          rfaVersion: extractRFAVersion(formData.rfaNumber),
          timestamp: new Date().toISOString(),
          source: source,
          checkedFields: currentFields  // Store for outdated detection
        },
        timestamp: new Date().toISOString(),
        canOverride: false
      }));

      if (folderExists) {
        console.log(`🚨 ${source} duplicate check: Project folder EXISTS - triggering dialog`);
        console.log(`📁 Existing folder: ${projectPath}`);
        
        // Trigger the duplicate dialog by calling the original function
        // This will show the dialog with options (Create Revision, Proceed Anyway, Cancel)
        if (onCheckForDuplicates) {
          console.log('🚨 Calling onCheckForDuplicates to trigger dialog...');
          const dialogTriggered = await onCheckForDuplicates(formData);
          console.log('🚨 Dialog trigger result:', dialogTriggered);
        }
      } else {
        console.log(`✅ ${source} duplicate check: Project folder NOT FOUND - safe to proceed`);
      }
      
    } catch (error) {
      console.error(`❌ ${source} duplicate check error:`, error);
      
      // Set error state with manual override option
      setDuplicateCheckState(prev => ({
        ...prev,
        status: 'error',
        result: {
          error: error.message,
          timestamp: new Date().toISOString(),
          source: source
        },
        timestamp: new Date().toISOString(),
        canOverride: true
      }));
    }
  };

  // CLEAN: Manual duplicate check handler
  const handleManualDuplicateCheck = async () => {
    await performDuplicateCheck('manual');
  };

  // CLEAN: Manual override handler for failed checks
  const handleManualOverride = () => {
    console.log('🚨 User manual override - proceeding despite check failure');
    setDuplicateCheckState(prev => ({
      ...prev,
      status: 'success',
      canOverride: false,
      result: {
        ...prev.result,
        overridden: true
      }
    }));
  };

  const [dropdownOptions, setDropdownOptions] = useState(() => {
    try {
      return dropdownOptionsService ? dropdownOptionsService.getOptions() : {};
    } catch (error) {
      console.error('Failed to get dropdown options in Step1:', error);
      return {};
    }
  });
  const [validatedFields, setValidatedFields] = useState({});
  const [fieldFocus, setFieldFocus] = useState({});
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Revision-related state
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionConfigured, setRevisionConfigured] = useState(false);
  const [revisionConfig, setRevisionConfig] = useState(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Load dropdown options and listen for changes (preserve original logic)
  useEffect(() => {
    const loadOptions = async () => {
      try {
        if (dropdownOptionsService && typeof dropdownOptionsService.loadFromSettings === 'function') {
          await dropdownOptionsService.loadFromSettings();
        }
      } catch (error) {
        console.error('Failed to load dropdown settings in Step1:', error);
      }
    };
    
    loadOptions();
    
    // Listen for option changes with defensive checks
    let unsubscribe;
    try {
      if (dropdownOptionsService && typeof dropdownOptionsService.addListener === 'function') {
        unsubscribe = dropdownOptionsService.addListener((newOptions) => {
          setDropdownOptions(newOptions || {});
        });
      }
    } catch (error) {
      console.error('Failed to set up dropdown listener in Step1:', error);
    }
    
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Failed to unsubscribe dropdown listener in Step1:', error);
        }
      }
    };
  }, []);

  // Effect to handle revision mode changes with automatic detection first
  useEffect(() => {
    if (formData.isRevision && !revisionConfigured && !hasAutoOpened) {
      // HTA-like: Try automatic detection first, only show dialog if it fails
      handleAutomaticRevisionDetection();
    } else if (!formData.isRevision) {
      // Reset revision state when switching away from revision mode
      setRevisionConfigured(false);
      setRevisionConfig(null);
      setShowRevisionDialog(false);
      setHasAutoOpened(false);
    }
  }, [formData.isRevision, revisionConfigured, hasAutoOpened]);

  // Initialize custom project type from saved data only on mount
  useEffect(() => {
    if (formData.projectType === 'Other' && formData.customProjectType) {
      setCustomProjectType(formData.customProjectType);
      setIsCustomProjectTypeMode(true);
    }
  }, []); // Empty dependency array - only run on mount

  // Set default regional team if none is selected
  useEffect(() => {
    if (!formData.regionalTeam && dropdownOptions.defaultRegionalTeam) {
      onFormDataChange({
        ...formData,
        regionalTeam: dropdownOptions.defaultRegionalTeam
      });
    }
  }, [dropdownOptions.defaultRegionalTeam]); // Only trigger when default changes

  // HTA-like automatic revision detection (try first before showing dialog)
  const handleAutomaticRevisionDetection = async () => {
    try {
      setHasAutoOpened(true); // Prevent re-triggering
      
      console.log('ProjectWizardStep1: Attempting automatic revision detection...');
      
      // Try automatic detection first
      const result = await window.electronAPI.revisionFindPrevious(formData);
      
      if (result.success && result.revisionPath) {
        // SUCCESS: Automatic detection worked!
        console.log('ProjectWizardStep1: Automatic detection SUCCESS:', result.revisionPath);
        
        const revisionInfo = {
          previousRevisionPath: result.revisionPath,
          projectPath: result.projectPath,
          searchMethod: 'automatic',
          foundInYear: result.foundInYear,
          rfaFolderName: result.rfaFolderName
        };
        
        setRevisionConfig(revisionInfo);
        setRevisionConfigured(true);
        
        // Update form data with automatic discovery
        const newFormData = {
          ...formData,
          previousRevisionPath: result.revisionPath,
          revisionOptions: revisionInfo
        };
        onFormDataChange(newFormData);
        
        console.log('✅ ProjectWizardStep1: Revision configured automatically!');
        
      } else {
        // FAILED: Show dialog for manual configuration
        console.log('ProjectWizardStep1: Automatic detection failed, showing configuration dialog');
        console.log('Reason:', result.reason);
        
        setTimeout(() => {
          setShowRevisionDialog(true);
        }, 300); // Small delay for smooth transition
      }
      
    } catch (error) {
      console.error('ProjectWizardStep1: Error during automatic detection:', error);
      
      // Fallback to manual configuration on error
      setTimeout(() => {
        setShowRevisionDialog(true);
      }, 300);
    }
  };

  // Revision handling functions
  const handleOpenRevisionDialog = () => {
    setShowRevisionDialog(true);
  };

  const handleRevisionDialogClose = () => {
    setShowRevisionDialog(false);
  };

  const handleRevisionDialogConfirm = (config) => {
    console.log('ProjectWizardStep1: Revision configured:', config);
    setRevisionConfig(config);
    setRevisionConfigured(true);
    
    // Update form data with revision configuration
    const newFormData = {
      ...formData,
      previousRevisionPath: config.previousRevisionPath,
      revisionOptions: config
    };
    onFormDataChange(newFormData);
  };

  // PRESERVED: Original handleInputChange logic from ProjectForm.jsx
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    const newFormData = { ...formData, [name]: processedValue };
    
    // Handle RFA type changes to show/hide triage sections
    if (name === 'rfaType') {
      newFormData.showPanelSchedules = shouldShowPanelSchedules(value);
      newFormData.showSubmittalTriage = shouldShowSubmittalTriage(value);
      newFormData.showPhotometrics = value === 'PHOTOMETRICS';
      
      // Set unified triage control fields based on RFA type
      newFormData.hasPanelSchedules = shouldShowPanelSchedules(value);
      newFormData.hasSubmittals = shouldShowSubmittalTriage(value);
      
      // For RFA types that traditionally include both submittal and layout (like BOM with Layout)
      // set needsLayoutBOM to true by default
      const includesBothSubmittalAndLayout = ['BOM (With Layout)', 'LAYOUT'].includes(value);
      if (shouldShowSubmittalTriage(value) && includesBothSubmittalAndLayout) {
        newFormData.needsLayoutBOM = true;
      } else if (shouldShowSubmittalTriage(value)) {
        newFormData.needsLayoutBOM = false; // Submittal only by default
      }
      
      // Set default values for new RFA types
      if (value && !formData.rfaType) {
        const defaults = getTriageDefaults();
        newFormData.roomMultiplier = defaults.roomMultiplier;
        newFormData.riserMultiplier = defaults.riserMultiplier;
        newFormData.reviewSetup = defaults.reviewSetup;
        newFormData.soo = defaults.soo;
        newFormData.numOfPages = defaults.numOfPages;
      }
    }
    
    onFormDataChange(newFormData);
    
    // Real-time validation
    const isValid = validateField(name, processedValue, newFormData);
    setValidatedFields(prev => ({ ...prev, [name]: isValid }));
    
    // Clear field error when user modifies field
    if (onFieldError && errors[name]) {
      onFieldError(name, null);
    }
    
    // Mark field as touched
    if (onFieldTouch) {
      onFieldTouch(name);
    }
    
    // Progressive field disclosure based on RFA Type
    if (name === 'rfaType' && value) {
      setShowAdvancedFields(true);
    }
  };

  // PRESERVED: Original helper functions from ProjectForm.jsx
  const shouldShowPanelSchedules = (rfaType) => {
    return ['BOM (No Layout)', 'BOM (With Layout)', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE'].includes(rfaType);
  };

  const shouldShowSubmittalTriage = (rfaType) => {
    return ['SUBMITTAL', 'ControlsAtriusSub', 'AtriusSub'].includes(rfaType);
  };

  const getTriageDefaults = () => {
    const triageSettings = triageCalculationService.getSettings();
    return {
      roomMultiplier: triageSettings.roomMultiplier,
      riserMultiplier: triageSettings.riserMultiplier,
      reviewSetup: triageSettings.defaultReviewSetup,
      soo: triageSettings.defaultSOO,
      numOfPages: triageSettings.defaultNumOfPages
    };
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Check if form has any data (to conditionally show Start Fresh button)
  const hasFormData = () => {
    const nonEmptyFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType'];
    return nonEmptyFields.some(field => formData[field] && formData[field].toString().trim() !== '');
  };

  // Handle manual wizard reset with toast notification
  const handleStartFresh = () => {
    if (!hasFormData()) {
      // If form is already empty, just show a toast
      showToast('✨ Form is already clear and ready for new project creation!', 'info');
      return;
    }

    // Capture default regional team BEFORE reset
    const defaultRegion = dropdownOptions.defaultRegionalTeam;
    
    // Reset the form (this clears all data via App.jsx handleFormReset)
    if (onWizardReset) {
      onWizardReset();
      
      // If there's a default regional team, set it after reset completes
      // We need to wait for the reset state to propagate, then set just the regional team
      if (defaultRegion) {
        // Wait for reset to complete and re-render
        setTimeout(() => {
          // Create a clean form object matching App.jsx's handleFormReset structure
          // with ONLY the regional team field populated
          const cleanFormWithRegion = {
            projectName: '',
            rfaNumber: '',
            agentNumber: '',
            projectContainer: '',
            rfaType: '',
            regionalTeam: defaultRegion,  // Only this field should be set
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
            largeLMPs: 0,
            mediumLMPs: 0,
            smallLMPs: 0,
            arp8: 0,
            arp16: 0,
            arp32: 0,
            arp48: 0,
            esheetsSchedules: 2,
            showPanelSchedules: false,
            numOfRooms: 0,
            overrideRooms: 0,
            roomMultiplier: 2,
            reviewSetup: 0.5,
            numOfPages: 1,
            specReview: 0,
            numOfSubRooms: 0,
            overrideSubRooms: 0,
            riserMultiplier: 1,
            soo: 0.5,
            photoSoftware: 'VL',
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
            firstAvailable: false
          };
          
          onFormDataChange(cleanFormWithRegion);
        }, 200);
      }
      
      // Show success toast
      showToast('✅ Form cleared! Ready to create a new project.', 'success');
    }
  };

  // ENHANCED: Advanced Agile import functionality with detailed feedback
  const handlePasteRFAInfo = async () => {
    setIsPasting(true);
    const startTime = performance.now();
    
    try {
      const clipboardText = await navigator.clipboard.readText();
      
      // Enhanced clipboard validation
      if (!clipboardText || clipboardText.trim().length === 0) {
        alert('⚠️ Clipboard is empty. Please copy RFA information from Agile first.');
        return;
      }

      // Show parsing progress for large data
      if (clipboardText.length > 1000) {
        console.log('Processing large Agile data...');
      }

      // Parse data with performance tracking
      const parseStartTime = performance.now();
      const parsedData = parseRFAInfo(clipboardText);
      const parseTime = performance.now() - parseStartTime;
      
      console.log(`Data parsing completed in ${parseTime.toFixed(2)}ms`);
      
      // Log performance warning if parsing takes too long
      if (parseTime > 1000) {
        console.warn(`⚠️ Slow parsing detected: ${parseTime.toFixed(2)}ms - consider optimizing parseRFAInfo function`);
      }
      
      if (parsedData) {
        // Track which fields were imported for visual feedback
        const importedFieldNames = Object.keys(parsedData);
        setImportedFields(importedFieldNames);
        
        // Enhanced data merging with conflict detection
        const updatedFormData = { ...formData };
        const conflictFields = [];
        
        // Check for existing data conflicts
        importedFieldNames.forEach(fieldName => {
          if (formData[fieldName] && formData[fieldName] !== '' && 
              formData[fieldName] !== parsedData[fieldName]) {
            conflictFields.push(fieldName);
          }
          updatedFormData[fieldName] = parsedData[fieldName];
        });
        
        onFormDataChange(updatedFormData);
        
        // Enhanced success message with details
        const importedCount = importedFieldNames.length;
        const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType'];
        const importedRequiredCount = requiredFields.filter(field => importedFieldNames.includes(field)).length;
        
        let successMessage = `✅ RFA information imported successfully!\n\n`;
        successMessage += `📊 Import Summary:\n`;
        successMessage += `• ${importedCount} total fields imported\n`;
        successMessage += `• ${importedRequiredCount}/${requiredFields.length} required fields filled\n`;
        
        if (conflictFields.length > 0) {
          successMessage += `• ${conflictFields.length} existing fields were overwritten\n`;
        }
        
        successMessage += `\n💡 Fields with blue highlighting were imported from Agile.`;
        
        alert(successMessage);
        
        // Auto-clear highlighting after 3 seconds
        setTimeout(() => {
          setImportedFields([]);
        }, 3000);
        
        // CLEAN: "-0 version only" duplicate check for Agile import
        const rfaVersion = extractRFAVersion(updatedFormData.rfaNumber);
        const isInitialVersion = rfaVersion === "0";
        
        if (onCheckForDuplicates && 
            updatedFormData.projectName && 
            updatedFormData.projectContainer && 
            updatedFormData.rfaNumber &&
            isInitialVersion) {
          
          console.log(`🔍 Agile import: RFA version is "-0" - running duplicate check...`);
          
          // Mark as Agile import source
          setDuplicateCheckState(prev => ({
            ...prev,
            source: 'agile',
            showButton: false // No manual button for Agile imports
          }));
          
          // Run duplicate check immediately during import (only for -0 versions)
          setTimeout(async () => {
            try {
              // Set checking state
              setDuplicateCheckState(prev => ({
                ...prev,
                status: 'checking'
              }));

              // Build project path and check if folder exists
              const projectPath = buildProjectPath(updatedFormData.projectName, updatedFormData.projectContainer);
              console.log(`📁 Agile import: Simple folder existence check: ${projectPath}`);

              const folderExists = await window.electronAPI.checkFolderExists(projectPath);
              
              // Set result state
              setDuplicateCheckState(prev => ({
                ...prev,
                status: folderExists ? 'duplicate' : 'success',
                result: {
                  isDuplicate: folderExists,
                  projectPath: projectPath,
                  rfaVersion: rfaVersion,
                  timestamp: new Date().toISOString(),
                  source: 'agile'
                },
                timestamp: new Date().toISOString()
              }));

              if (folderExists) {
                console.log('🚨 Agile import: Project folder EXISTS for "-0" version - triggering dialog');
                console.log(`📁 Existing folder: ${projectPath}`);
                
                // Trigger the duplicate dialog for Agile import
                if (onCheckForDuplicates) {
                  console.log('🚨 Agile import: Calling onCheckForDuplicates to trigger dialog...');
                  const dialogTriggered = await onCheckForDuplicates(updatedFormData);
                  console.log('🚨 Agile import: Dialog trigger result:', dialogTriggered);
                }
              } else {
                console.log('✅ Agile import: Project folder NOT FOUND for "-0" version - safe to proceed');
              }
            } catch (error) {
              console.error('❌ Agile import duplicate check error:', error);
              setDuplicateCheckState(prev => ({
                ...prev,
                status: 'error',
                result: {
                  error: error.message,
                  timestamp: new Date().toISOString(),
                  source: 'agile'
                },
                timestamp: new Date().toISOString(),
                canOverride: true
              }));
            }
          }, 100); // Small delay to ensure UI updates complete first
        } else if (updatedFormData.rfaNumber && !isInitialVersion) {
          console.log(`✅ Agile import: RFA version is "${rfaVersion}" (not "-0") - no duplicate check needed`);
        }
        
      } else {
        alert(`❌ Could not parse RFA information from clipboard.\n\n` +
              `Please ensure you've copied the complete RFA details from Agile.\n\n` +
              `💡 Tip: Copy from the RFA summary section that includes:\n` +
              `• Request for Assistance number\n` +
              `• Project name and container\n` +
              `• Agent/Rep information\n` +
              `• Dates and status information`);
      }
    } catch (error) {
      console.error('Error pasting RFA info:', error);
      
      let errorMessage = '❌ Failed to import from clipboard.\n\n';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Permission denied. Please allow clipboard access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No data found in clipboard. Please copy RFA information first.';
      } else {
        errorMessage += 'An unexpected error occurred. Please try copying the RFA information again.';
      }
      
      alert(errorMessage);
    } finally {
      const totalTime = performance.now() - startTime;
      console.log(`Total Agile import process completed in ${totalTime.toFixed(2)}ms`);
      setIsPasting(false);
    }
  };

  const cleanProjectName = (projectName) => {
    if (!projectName) return '';
    
    // Remove common unwanted identifiers that might appear in clipboard data
    const unwantedWords = ['Tasks', 'BOM', 'Header', 'Details', 'Notes', 'Documents', 'Loading'];
    
    let cleaned = projectName.trim();
    
    // Remove unwanted words (case insensitive)
    unwantedWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '').trim();
    });
    
    // Clean up extra spaces and normalize
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  };

  const checkNationalAccount = (projectName) => {
    if (!projectName) return 'Default';
    
    const nationalAccountKeywords = {
      "Arby's": "ARBYS",
      "Arbys": "ARBYS",
      "McDonald's": "MCDONALDS",
      "McDonalds": "MCDONALDS",
      "Walmart": "WALMART",
      "Target": "TARGET",
      "Home Depot": "HOMEDEPOT",
      "Lowes": "LOWES",
      "Kroger": "KROGER",
      "CVS": "CVS",
      "Walgreens": "WALGREENS"
    };
    
    for (const [keyword, account] of Object.entries(nationalAccountKeywords)) {
      if (projectName.toLowerCase().includes(keyword.toLowerCase())) {
        return account;
      }
    }
    
    return 'Default';
  };

  // SMART RFA TYPE MATCHER - Intelligently matches clipboard RFA types to dropdown options
  const smartMatchRFAType = (clipboardRFAType) => {
    if (!clipboardRFAType) return null;
    
    const inputText = clipboardRFAType.toLowerCase().trim();
    const availableTypes = dropdownOptions.rfaTypes || [];
    
    console.log('🔍 Smart RFA Type Matching:', { input: clipboardRFAType, availableTypes });
    
    // Step 1: Try exact match (case-insensitive)
    const exactMatch = availableTypes.find(type => type.toLowerCase() === inputText);
    if (exactMatch) {
      console.log('✅ Exact match found:', exactMatch);
      return exactMatch;
    }
    
    // Step 2: Hardcoded mapping for known Agile formats (backwards compatibility)
    const hardcodedMapping = {
      'controls bom - budget': 'BUDGET',
      'controls bom - bom (no layout)': 'BOM (No Layout)',
      'controls bom - bom (with layout)': 'BOM (With Layout)',
      'controls submittal - submittal': 'SUBMITTAL',
      'controls submittal - preprogramming': 'RELEASE',
      'controls design - layout': 'BOM (With Layout)',
      'controls design - controls layout': 'BOM (With Layout)',
      'controls post-installation - graphical interface': 'GRAPHICS',
      'design - photometric lighting layout': 'PHOTOMETRICS',
      'controls design - design consultation': 'Consultation',
      'lithonia reloc bom - budget': 'RelocBOM',
      'lithonia reloc / controls bom - budget': 'RelocControlsBOM',
      'lithonia reloc bom - bom (with layout)': 'RelocBOM',
      'lithonia reloc submittal - submittal': 'RelocSUB',
      'lithonia reloc / controls submittal - submittal': 'RelocControlsSUB',
      'controls / lithonia reloc submittal - submittal': 'RelocControlsSUB',
      'atrius bom - bom (no layout)': 'AtriusBOM',
      'atrius bom - bom (with layout)': 'AtriusLAYOUT',
      'atrius submittal - submittal': 'AtriusSub',
      'controls / atrius submittal - submittal': 'ControlsAtriusSub',
      'atrius locator / atrius wayfinder bom - bom (with layout)': 'ControlsAtriusLayout',
      'atrius / controls bom - bom (with layout)': 'ControlsAtriusLayout',
      'controls / atrius bom - bom (no layout)': 'ControlsAtriusLayout',
      'controls / lithonia commercial indoor / controls submittal - submittal': 'SUBMITTAL',
      'controls / lithonia commercial indoor / mark architectural lighting submittal - submittal': 'SUBMITTAL',
      'controls submittal - one-line diagram': 'SUBMITTAL',
      'controls submittal - record submittal': 'SUBMITTAL',
      'controls / peerless bom - bom (with layout)': 'BOM (With Layout)',
      'controls dc2dc / controls bom - bom (with layout)': 'CONTROLSDCLAYOUT',
      'lithonia outdoor / other design - photometric lighting layout': 'PHOTOMETRICS',
      'other / lithonia outdoor design - photometric lighting layout': 'PHOTOMETRICS'
    };
    
    const hardcoded = hardcodedMapping[inputText];
    if (hardcoded && availableTypes.includes(hardcoded)) {
      console.log('✅ Hardcoded mapping found:', hardcoded);
      return hardcoded;
    }
    
    // Step 3: Intelligent keyword-based matching with priority scoring
    const keywords = {
      // High priority keywords (specific types)
      'consultation': { match: 'Consultation', priority: 100 },
      'photometric': { match: 'PHOTOMETRICS', priority: 100 },
      'graphics': { match: 'GRAPHICS', priority: 100 },
      'graphical interface': { match: 'GRAPHICS', priority: 100 },
      'preprogramming': { match: 'RELEASE', priority: 100 },
      
      // Reloc variations
      'reloc': { match: 'Reloc', priority: 90, partial: true },
      'relocation': { match: 'Reloc', priority: 90, partial: true },
      
      // Atrius variations
      'atrius': { match: 'Atrius', priority: 85, partial: true },
      
      // Controls variations
      'controls bom - budget': { match: 'Controls BOM - Budget', priority: 95 },
      'controls bom - layout': { match: 'Controls BOM - Layout', priority: 95 },
      
      // BOM with layout keywords (higher priority)
      'with layout': { match: 'BOM (With Layout)', priority: 80 },
      'bom with layout': { match: 'BOM (With Layout)', priority: 80 },
      'bom (with layout)': { match: 'BOM (With Layout)', priority: 80 },
      'layout': { match: 'LAYOUT', priority: 75 },
      
      // BOM without layout
      'no layout': { match: 'BOM (No Layout)', priority: 80 },
      'bom (no layout)': { match: 'BOM (No Layout)', priority: 80 },
      'bom no layout': { match: 'BOM (No Layout)', priority: 80 },
      
      // Budget keywords
      'budget': { match: 'BUDGET', priority: 70 },
      
      // Submittal keywords
      'submittal': { match: 'SUBMITTAL', priority: 70 },
      'submittals': { match: 'SUBMITTAL', priority: 70 },
      
      // Release keywords
      'release': { match: 'RELEASE', priority: 70 }
    };
    
    let bestMatch = null;
    let highestScore = 0;
    
    // Check each keyword
    for (const [keyword, config] of Object.entries(keywords)) {
      if (inputText.includes(keyword)) {
        // Find matching type in available options
        const matchingTypes = availableTypes.filter(type => {
          if (config.partial) {
            return type.toLowerCase().includes(config.match.toLowerCase());
          }
          return type.toLowerCase() === config.match.toLowerCase() || 
                 type.toLowerCase().includes(config.match.toLowerCase());
        });
        
        if (matchingTypes.length > 0) {
          // Handle multiple matches - prefer more specific ones
          let selectedType = matchingTypes[0];
          
          // Special handling for reloc/controls combinations
          if (keyword === 'reloc' || keyword === 'relocation') {
            if (inputText.includes('controls') && matchingTypes.some(t => t.toLowerCase().includes('controls'))) {
              selectedType = matchingTypes.find(t => t.toLowerCase().includes('controls')) || selectedType;
            }
            if (inputText.includes('submittal') && matchingTypes.some(t => t.toLowerCase().includes('sub'))) {
              selectedType = matchingTypes.find(t => t.toLowerCase().includes('sub')) || selectedType;
            }
            if (inputText.includes('bom') && matchingTypes.some(t => t.toLowerCase().includes('bom'))) {
              selectedType = matchingTypes.find(t => t.toLowerCase().includes('bom')) || selectedType;
            }
          }
          
          if (config.priority > highestScore) {
            highestScore = config.priority;
            bestMatch = selectedType;
          }
        }
      }
    }
    
    if (bestMatch) {
      console.log('✅ Keyword match found:', bestMatch, '(score:', highestScore + ')');
      return bestMatch;
    }
    
    // Step 4: Fallback - partial substring matching
    const partialMatch = availableTypes.find(type => 
      type.toLowerCase().includes(inputText) || inputText.includes(type.toLowerCase())
    );
    
    if (partialMatch) {
      console.log('⚠️ Partial match found:', partialMatch);
      return partialMatch;
    }
    
    console.log('❌ No match found for:', clipboardRFAType);
    return null;
  };

  // PRESERVED: Complete parseRFAInfo function from original component
  const parseRFAInfo = (clipboardText) => {
    // Enhanced parsing based on actual Agile data format
    console.log('=== AGILE DATA DEBUG ===');
    console.log('Full clipboard data length:', clipboardText.length);
    console.log('First 500 characters:', clipboardText.substring(0, 500));
    console.log('Last 200 characters:', clipboardText.substring(Math.max(0, clipboardText.length - 200)));
    console.log('All lines:', clipboardText.split('\n').map((line, i) => `${i + 1}: ${line}`));
    console.log('=== END DEBUG ===');
    
    const parsedData = {};
    
    // Extract RFA Number and Revision - Fix to include full number with dash
    const rfaMatch = clipboardText.match(/Request for Assistance (\d+)-(\d+)/);
    if (rfaMatch) {
      parsedData.rfaNumber = `${rfaMatch[1]}-${rfaMatch[2]}`; // Include the dash and revision number
      const revisionNumber = rfaMatch[2];
      parsedData.isRevision = revisionNumber !== '0';
    }
    
    // Extract RFA Type from the title line with SMART MATCHING
    const titleMatch = clipboardText.match(/Request for Assistance \d+-\d+ - (.+)/);
    if (titleMatch) {
      const rfaTypeText = titleMatch[1].trim();
      console.log('📋 Extracted RFA Type from clipboard:', rfaTypeText);
      
      // Use smart matching function
      const matchedType = smartMatchRFAType(rfaTypeText);
      
      if (matchedType) {
        parsedData.rfaType = matchedType;
        console.log('✅ RFA Type set to:', matchedType);
      } else {
        // If no match found, leave as-is for user to manually select
        console.warn('⚠️ Could not automatically match RFA type:', rfaTypeText);
        parsedData.rfaType = null;
      }
    }
    
    // Extract Project Name and Container - Enhanced pattern matching
    // Look for patterns like: "CLT1 DC1 25-15237" or "Haskell Jacksonville Headquarters Project Blue Sky 25-58944"
    console.log('Looking for project name and container in:', clipboardText.substring(0, 200) + '...');
    
    // Try multiple patterns for better matching - updated for actual Agile format
    const projectPatterns = [
      // Pattern 1: Short format like "CLT1 DC1 25-15237" (most common in Agile)
      /([A-Za-z0-9\s\-\.&,()'\/]{2,20}?)\s+(\d{2}-\d{5})/,
      // Pattern 2: Long format like "FLORIDA SHERIFF'S ASSN YOUTH LEARNING & BLACKBURN/ 25-58874"
      /([A-Za-z0-9\s\-\.&,()'\/]{10,100}?)\s+(\d{2}-\d{5})/,
      // Pattern 3: With "Project Name:" prefix
      /Project Name:\s*([A-Za-z0-9\s\-\.&,()'\/]+?)\s+(\d{2}-\d{5})/i,
      // Pattern 4: With "Project Container:" prefix
      /Project Container:\s*(\d{2}-\d{5})/i,
      // Pattern 5: Look for any alphanumeric text followed by container pattern (very flexible)
      /([A-Za-z0-9\s\-\.&,()'\/]{3,}?)\s+(\d{2}-\d{5})/
    ];
    
    // First try to find the pattern after "BOM" line specifically (most reliable for Agile)
    // Updated regex to handle long names with special characters like apostrophes, ampersands, slashes
    // Use a more efficient approach: find the line after BOM, then extract name and container
    const bomLineIndex = clipboardText.indexOf('BOM');
    if (bomLineIndex !== -1) {
      const afterBom = clipboardText.substring(bomLineIndex);
      const bomMatch = afterBom.match(/BOM\s*\n\s*([^\n]+?)\s+(\d{2}-\d{5})/);
      if (bomMatch) {
        console.log('Found project match after BOM line:', bomMatch);
        parsedData.projectName = cleanProjectName(bomMatch[1].trim());
        parsedData.projectContainer = bomMatch[2];
      }
    }
    
    // If BOM pattern didn't work, try the general patterns
    if (!parsedData.projectName || !parsedData.projectContainer) {
      let projectMatch = null;
      let patternUsed = '';
      
      for (let i = 0; i < projectPatterns.length; i++) {
        const match = clipboardText.match(projectPatterns[i]);
        if (match) {
          projectMatch = match;
          patternUsed = `Pattern ${i + 1}`;
          console.log(`Found project match using ${patternUsed}:`, match);
          break;
        }
      }
      
      if (projectMatch) {
        if (projectMatch.length >= 3) {
          // Pattern with both name and container
          parsedData.projectName = cleanProjectName(projectMatch[1].trim());
          parsedData.projectContainer = projectMatch[2];
        } else if (projectMatch.length === 2) {
          // Pattern with only container
          parsedData.projectContainer = projectMatch[1];
          // Try to find project name separately
          const nameMatch = clipboardText.match(/([A-Za-z0-9\s\-\.&,()'\/]{3,}?)(?=\s+\d{2}-\d{5})/);
          if (nameMatch) {
            parsedData.projectName = cleanProjectName(nameMatch[1].trim());
          }
        }
        
        console.log(`Project parsing result (${patternUsed}):`, {
          projectName: parsedData.projectName,
          projectContainer: parsedData.projectContainer
        });
      } else {
        console.warn('No project name/container pattern matched in clipboard data');
        console.log('Available text patterns:', clipboardText.match(/[A-Za-z0-9\s\-\.&,()'\/]{3,}?\s+\d{2}-\d{5}/g));
      }
    }
    
    // Extract Agent Number (Rep) - Look for "Rep: 441"
    const repMatch = clipboardText.match(/Rep:\s*(\d+)/);
    if (repMatch) {
      parsedData.agentNumber = repMatch[1];
    }
    
    // Extract ECD (Estimated Completion Date) - Look for "ECD: 09/04/2025 6:00 PM"
    const ecdMatch = clipboardText.match(/ECD:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
    if (ecdMatch) {
      // Parse date WITHOUT timezone conversion
      const ecdLocal = parseAgileDate(ecdMatch[1]);
      if (ecdLocal) {
        parsedData.ecd = ecdLocal;
        console.log('✅ ECD parsed (no timezone conversion):', ecdMatch[1], '→', ecdLocal);
      }
    }
    
    // Extract Requested Date - Look for "Requested Date: 09/04/2025 6:00 PM"
    const requestedMatch = clipboardText.match(/Requested Date:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
    if (requestedMatch) {
      // Parse date WITHOUT timezone conversion
      const requestedLocal = parseAgileDate(requestedMatch[1]);
      if (requestedLocal) {
        parsedData.requestedDate = requestedLocal;
        console.log('✅ Requested Date parsed (no timezone conversion):', requestedMatch[1], '→', requestedLocal);
      }
    }
    
    // Extract Submitted Date - Look for "Submitted Date: 08/28/2025 5:11 PM"
    const submittedMatch = clipboardText.match(/Submitted Date:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
    if (submittedMatch) {
      // Parse date WITHOUT timezone conversion
      const submittedLocal = parseAgileDate(submittedMatch[1]);
      if (submittedLocal) {
        parsedData.submittedDate = submittedLocal;
        console.log('✅ Submitted Date parsed (no timezone conversion):', submittedMatch[1], '→', submittedLocal);
      }
    }
    
    // Extract Complexity - Look for "Complexity: Level 1"
    const complexityMatch = clipboardText.match(/Complexity:\s*Level (\d+)/);
    if (complexityMatch) {
      parsedData.complexity = `Level ${complexityMatch[1]}`;
    }
    
    // Extract RFA Value - Look for "RFA Value:" field
    const rfaValueMatch = clipboardText.match(/RFA Value:\s*([^\n\r]+)/);
    if (rfaValueMatch) {
      parsedData.rfaValue = rfaValueMatch[1].trim();
    }
    
    // Extract Status - Look for "Status: In Progress"
    const statusMatch = clipboardText.match(/Status:\s*([^\n\r]+)/);
    if (statusMatch) {
      parsedData.status = statusMatch[1].trim();
    }
    
    // Extract Products - Look for "Products on This Request: Controls - nLight"
    const productsMatch = clipboardText.match(/Products on This Request:\s*([^\n\r]+)/);
    if (productsMatch) {
      // Split products by comma and clean up each product
      const productsText = productsMatch[1].trim();
      const productsArray = productsText.split(',').map(p => p.trim()).filter(p => p.length > 0);
      parsedData.products = productsArray;
    }
    
    // Extract Assigned To - Look for "Assigned To: Cerpa, Roger"
    const assignedMatch = clipboardText.match(/Assigned To:\s*([^\n\r]+)/);
    if (assignedMatch) {
      parsedData.assignedTo = assignedMatch[1].trim();
    }
    
    // Extract Rep Contacts - Look for "Rep Contacts: Vranesh, Eileen"
    const contactsMatch = clipboardText.match(/Rep Contacts:\s*([^\n\r]+)/);
    if (contactsMatch) {
      parsedData.repContacts = contactsMatch[1].trim();
    }
    
    // Extract National Account - Look for "National Account:" field
    const naMatch = clipboardText.match(/National Account:\s*([^\n\r]+)/);
    if (naMatch) {
      const naText = naMatch[1].trim();
      if (naText && naText !== '') {
        parsedData.nationalAccount = naText;
      } else {
        // Auto-detect national account based on project name
        parsedData.nationalAccount = checkNationalAccount(parsedData.projectName || '');
      }
    } else {
      // Auto-detect national account based on project name
      parsedData.nationalAccount = checkNationalAccount(parsedData.projectName || '');
    }
    
    // Set room multiplier for budget projects
    if (parsedData.rfaType === 'BUDGET') {
      parsedData.roomMultiplier = 1;
    }
    
    // Set default values for missing fields
    if (!parsedData.roomMultiplier) {
      parsedData.roomMultiplier = 2;
    }
    if (!parsedData.riserMultiplier) {
      parsedData.riserMultiplier = 1;
    }
    if (!parsedData.reviewSetup) {
      parsedData.reviewSetup = 0.5;
    }
    if (!parsedData.soo) {
      parsedData.soo = 0.5;
    }
    if (!parsedData.numOfPages) {
      parsedData.numOfPages = 1;
    }
    
    // Set default save location to Triage
    if (!parsedData.saveLocation) {
      parsedData.saveLocation = 'Triage';
    }
    
    // Set due date to match requested date as default
    if (parsedData.requestedDate && !parsedData.dueDate) {
      parsedData.dueDate = parsedData.requestedDate;
    }
    
    console.log('Parsed data:', parsedData);
    
    // Validate that we have at least the essential data
    const essentialFields = ['rfaNumber', 'rfaType', 'projectName', 'projectContainer', 'agentNumber'];
    const missingFields = essentialFields.filter(field => !parsedData[field]);
    
    if (missingFields.length > 0) {
      console.warn('Missing essential fields:', missingFields);
      console.warn('Available data:', parsedData);
    }
    
    // Only return data if we have at least some essential information
    if (Object.keys(parsedData).length > 0) {
      return parsedData;
    }
    
    return null;
  };

  // Enhanced field validation function
  const validateField = (fieldName, value, allFormData = formData) => {
    switch (fieldName) {
      case 'projectName':
        return value && value.trim().length >= 3;
      case 'rfaNumber':
        return value && /^\d+-\d+$/.test(value);
      case 'agentNumber':
        return value && /^\d+$/.test(value);
      case 'projectContainer':
        return value && /^\d{2}-\d{5}$/.test(value);
      case 'rfaType':
        return value && value !== '';
      case 'regionalTeam':
        return value && value !== '';
      default:
        return true; // Non-required fields are always valid
    }
  };

  // Handle field focus for enhanced UX
  const handleFieldFocus = (fieldName) => {
    setFieldFocus(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleFieldBlur = (fieldName) => {
    setFieldFocus(prev => ({ ...prev, [fieldName]: false }));
    
    // Validate on blur
    const isValid = validateField(fieldName, formData[fieldName]);
    setValidatedFields(prev => ({ ...prev, [fieldName]: isValid }));
  };

  // Helper function to determine field state classes
  const getFieldClasses = (fieldName) => {
    const classes = [];
    
    if (errors[fieldName]) {
      classes.push('error');
    } else if (validatedFields[fieldName] === true && formData[fieldName]) {
      classes.push('valid');
    }
    
    if (isFieldImported(fieldName)) {
      classes.push('imported-field');
    }
    
    return classes.join(' ');
  };

  // Helper function to determine if field was imported
  const isFieldImported = (fieldName) => {
    return showImportedFields && importedFields.includes(fieldName);
  };

  // Clear imported field highlighting
  const clearImportedHighlight = () => {
    setImportedFields([]);
  };

  // Save custom project type to dropdown options
  const saveCustomProjectType = async (customType) => {
    try {
      // Don't save if it's already in the list or if it's empty
      if (!customType || !customType.trim() || dropdownOptions.projectTypes?.includes(customType.trim())) {
        return;
      }

      const trimmedType = customType.trim();
      
      // Add to dropdown options (insert before "Other")
      const currentTypes = dropdownOptions.projectTypes || [];
      const otherIndex = currentTypes.indexOf('Other');
      let newTypes;
      
      if (otherIndex !== -1) {
        // Insert before "Other"
        newTypes = [...currentTypes.slice(0, otherIndex), trimmedType, ...currentTypes.slice(otherIndex)];
      } else {
        // If "Other" not found, just add at the end
        newTypes = [...currentTypes, trimmedType];
      }

      // Update dropdown options service
      if (dropdownOptionsService && typeof dropdownOptionsService.updateOptions === 'function') {
        dropdownOptionsService.updateOptions({
          ...dropdownOptions,
          projectTypes: newTypes
        });
      }

      // Also save to settings for persistence
      if (window.electronAPI && window.electronAPI.settingsLoad) {
        try {
          const result = await window.electronAPI.settingsLoad();
          if (result && result.success && result.data) {
            const updatedSettings = {
              ...result.data,
              projectTypes: newTypes
            };
            
            if (window.electronAPI.settingsSave) {
              await window.electronAPI.settingsSave(updatedSettings);
            }
          }
        } catch (error) {
          console.warn('Could not save custom project type to settings:', error);
        }
      }

      console.log(`✅ Custom project type "${trimmedType}" saved to options`);
      
    } catch (error) {
      console.error('Error saving custom project type:', error);
    }
  };

  // Progress calculation for validation feedback
  const getValidationProgress = () => {
    const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
    const validRequiredFields = requiredFields.filter(field => 
      formData[field] && formData[field].trim() !== '' && validateField(field, formData[field])
    );
    
    return {
      valid: validRequiredFields.length,
      total: requiredFields.length,
      percentage: Math.round((validRequiredFields.length / requiredFields.length) * 100),
      complete: validRequiredFields.length === requiredFields.length
    };
  };

  return (
    <>
    {/* Toast Notification */}
    {toast.show && (
      <div className={`toast-notification toast-${toast.type}`}>
        {toast.message}
      </div>
    )}
    
    <div className="wizard-layout">
      {/* Unified Modern Header with Import Actions */}
      <div className="unified-header">
        {/* Header Info - Top Section */}
        <div className="header-info">
          <div className="step-badge">
            <span className="step-badge-number">1</span>
            <span className="step-badge-divider">of</span>
            <span className="step-badge-total">2</span>
          </div>
          
          <h2 className="step-title">Project Setup</h2>
          <p className="step-subtitle">Import from Agile or fill in the basic project details - folders will be created automatically</p>
        </div>

        {/* Header Actions - Bottom Section */}
        <div className="header-actions">
          <div className="action-group right-action">
            <button
              type="button"
              onClick={handleStartFresh}
              disabled={isPasting}
              className="btn btn-outline start-fresh-btn"
            >
              🗑️ Start Fresh
            </button>
          </div>
        </div>
        

        {/* Header Action Buttons - Bottom Left Corner */}
        <div className="import-button-container">
          
          {/* Revision Configuration Button - Show when revision is selected but not configured */}
          {formData.isRevision && !revisionConfigured && (
            <div className="revision-config-button-container">
              <button
                type="button"
                onClick={handleOpenRevisionDialog}
                className="btn btn-warning revision-config-header-btn"
                title="Configure revision settings to proceed"
              >
                🔄 Configure Revision
              </button>
            </div>
          )}
          
          <div className="tooltip-container">
            <button
              type="button"
              onClick={handlePasteRFAInfo}
              disabled={isPasting}
              className="btn btn-secondary import-btn"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
            >
              {isPasting ? (
                <>
                  <span className="spinner"></span>
                  Processing Agile Data...
                </>
              ) : (
                <>
                  📋 Import From Agile
                </>
              )}
            </button>
            
            {showTooltip && (
              <div className="tooltip">
                <span className="tooltip-text">
                  💡 Copy RFA details from Agile and click import to auto-fill fields
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CLEAN: Simplified Duplicate Check Section */}
      {duplicateCheckState.showButton && (
        <div className="duplicate-check-section" style={{
          background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
          borderBottom: '1px solid #dee2e6',
          padding: '15px 20px',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <div className="duplicate-check-container" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            maxWidth: '800px',
            width: '100%',
          }}>
            <button
              type="button"
              onClick={handleManualDuplicateCheck}
              disabled={duplicateCheckState.status === 'checking' || isDuplicateDetectionRunning}
              className={`btn duplicate-check-btn ${
                duplicateCheckState.status === 'success' ? 'btn-success' :
                duplicateCheckState.status === 'duplicate' ? 'btn-warning' :
                duplicateCheckState.status === 'error' ? 'btn-danger' :
                duplicateCheckState.status === 'outdated' ? 'btn-warning' :
                'btn-outline'
              }`}
              title="Check if this project already exists in the system"
            >
              {duplicateCheckState.status === 'checking' ? (
                <>
                  <span className="spinner"></span>
                  Checking for duplicates...
                </>
              ) : duplicateCheckState.status === 'success' ? (
                <>
                  ✅ No Duplicates Found
                </>
              ) : duplicateCheckState.status === 'duplicate' ? (
                <>
                  ⚠️ Duplicates Found - Click for Details
                </>
              ) : duplicateCheckState.status === 'error' ? (
                <>
                  ❌ Check Failed - Try Again
                </>
              ) : duplicateCheckState.status === 'outdated' ? (
                <>
                  ⚠️ Outdated - Check Again
                </>
              ) : (
                <>
                  🔍 Check for Existing Projects
                </>
              )}
            </button>

            {/* Manual Override Button for Errors */}
            {duplicateCheckState.status === 'error' && duplicateCheckState.canOverride && (
              <button
                type="button"
                onClick={handleManualOverride}
                className="btn btn-secondary"
                title="Continue despite check failure"
              >
                Continue Anyway
              </button>
            )}
            
            {/* Success Message */}
            {duplicateCheckState.status === 'success' && (
              <div className="duplicate-check-success">
                <span className="success-icon">✅</span>
                <span className="success-text">
                  {duplicateCheckState.result?.overridden 
                    ? 'Proceeding with manual override' 
                    : 'Safe to proceed - no existing projects found'}
                </span>
              </div>
            )}

            {/* Outdated Warning */}
            {duplicateCheckState.status === 'outdated' && (
              <div className="duplicate-check-warning" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#856404',
                fontSize: '14px',
                fontWeight: '500',
                padding: '8px 12px',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                border: '1px solid #ffeaa7'
              }}>
                <span>⚠️ Project details changed - check for duplicates again</span>
              </div>
            )}

            {/* Project Container Format Validation */}
            {formData.projectContainer && !isValidProjectContainer(formData.projectContainer) && (
              <div className="format-validation-warning" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#721c24',
                fontSize: '14px',
                fontWeight: '500',
                padding: '8px 12px',
                backgroundColor: '#f8d7da',
                borderRadius: '4px',
                border: '1px solid #f5c6cb'
              }}>
                <span>❌ Invalid project container format. Expected: ##-##### (e.g., "24-61726")</span>
              </div>
            )}

            {/* RFA Version Information */}
            {formData.rfaNumber && (
              <div className="rfa-version-info" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: extractRFAVersion(formData.rfaNumber) === "0" ? '#0c5460' : '#856404',
                fontSize: '14px',
                fontWeight: '500',
                padding: '8px 12px',
                backgroundColor: extractRFAVersion(formData.rfaNumber) === "0" ? '#d1ecf1' : '#fff3cd',
                borderRadius: '4px',
                border: extractRFAVersion(formData.rfaNumber) === "0" ? '1px solid #b8daff' : '1px solid #ffeaa7'
              }}>
                {extractRFAVersion(formData.rfaNumber) === "0" ? (
                  <span>🆕 Initial RFA version (-0) - will check for existing project</span>
                ) : (
                  <span>🔄 Revision RFA version (-{extractRFAVersion(formData.rfaNumber)}) - no duplicate check needed</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="wizard-content">
        <div className="wizard-step-content">

        {/* PRESERVED: Exact form structure from ProjectForm.jsx lines 513-788 */}
        <div className="form-section">
          <h3>Basic Project Information</h3>
          <div className="form-grid">
            <div className={`form-group ${getFieldClasses('projectName')}`}>
              <label htmlFor="projectName">Project Name *</label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName || ''}
                onChange={handleInputChange}
                onFocus={() => handleFieldFocus('projectName')}
                onBlur={() => handleFieldBlur('projectName')}
                className={getFieldClasses('projectName')}
                placeholder="Enter project name (minimum 3 characters)"
              />
              {errors.projectName && <span className="error-message">{errors.projectName}</span>}
              {validatedFields.projectName === true && formData.projectName && (
                <span className="validation-success">✓ Valid project name</span>
              )}
              {fieldFocus.projectName && (
                <span className="field-hint">Enter a descriptive project name (at least 3 characters)</span>
              )}
              {isFieldImported('projectName') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('projectType') ? 'imported-field' : ''}`}>
              <label htmlFor="projectType">Project Type</label>
              {isCustomProjectTypeMode ? (
                <input
                  type="text"
                  id="projectType"
                  name="projectType"
                  value={customProjectType}
                  onChange={(e) => {
                    setCustomProjectType(e.target.value);
                    // Only update formData with the custom type value, keep projectType as 'Other'
                    onFormDataChange({ 
                      ...formData, 
                      projectType: 'Other',
                      customProjectType: e.target.value 
                    });
                  }}
                  onKeyDown={(e) => {
                    // Allow user to press Escape to revert to dropdown
                    if (e.key === 'Escape') {
                      setIsCustomProjectTypeMode(false);
                      setCustomProjectType('');
                      onFormDataChange({ 
                        ...formData, 
                        projectType: '',
                        customProjectType: '' 
                      });
                    }
                    // Save custom type when user presses Enter
                    if (e.key === 'Enter' && customProjectType.trim()) {
                      const trimmedType = customProjectType.trim();
                      saveCustomProjectType(trimmedType);
                      // Update formData with the final custom type name
                      onFormDataChange({ 
                        ...formData, 
                        projectType: trimmedType,
                        customProjectType: trimmedType 
                      });
                      setIsCustomProjectTypeMode(false);
                    }
                  }}
                  onBlur={(e) => {
                    // Save custom type when user finishes editing
                    if (e.target.value.trim()) {
                      const trimmedType = e.target.value.trim();
                      saveCustomProjectType(trimmedType);
                      // Update formData with the final custom type name
                      onFormDataChange({ 
                        ...formData, 
                        projectType: trimmedType,
                        customProjectType: trimmedType 
                      });
                      setIsCustomProjectTypeMode(false);
                    } else {
                      // If field is empty, revert back to dropdown
                      setIsCustomProjectTypeMode(false);
                      setCustomProjectType('');
                      onFormDataChange({ 
                        ...formData, 
                        projectType: '',
                        customProjectType: '' 
                      });
                    }
                  }}
                  className={errors.projectType ? 'error' : ''}
                  placeholder="Enter custom project type (press Enter to save, Esc to cancel)"
                  autoFocus
                />
              ) : (
                <select
                  id="projectType"
                  name="projectType"
                  value={formData.projectType || ''}
                  onChange={(e) => {
                    if (e.target.value === 'Other') {
                      setIsCustomProjectTypeMode(true);
                      setCustomProjectType('');
                      onFormDataChange({ 
                        ...formData, 
                        projectType: 'Other',
                        customProjectType: '' 
                      });
                    } else {
                      setIsCustomProjectTypeMode(false);
                      setCustomProjectType('');
                      onFormDataChange({ 
                        ...formData, 
                        projectType: e.target.value,
                        customProjectType: '' 
                      });
                    }
                  }}
                  className={errors.projectType ? 'error' : ''}
                >
                  <option value="">Select Project Type</option>
                  {(dropdownOptions.projectTypes || []).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              )}
              {errors.projectType && <span className="error-message">{errors.projectType}</span>}
              {isFieldImported('projectType') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${getFieldClasses('projectContainer')}`}>
              <label htmlFor="projectContainer">Project Container *</label>
              <input
                type="text"
                id="projectContainer"
                name="projectContainer"
                value={formData.projectContainer || ''}
                onChange={handleInputChange}
                onFocus={() => handleFieldFocus('projectContainer')}
                onBlur={() => handleFieldBlur('projectContainer')}
                className={getFieldClasses('projectContainer')}
                placeholder="e.g., 25-58944"
                pattern="\d{2}-\d{5}"
              />
              {errors.projectContainer && <span className="error-message">{errors.projectContainer}</span>}
              {validatedFields.projectContainer === true && formData.projectContainer && (
                <span className="validation-success">✓ Valid container format</span>
              )}
              {fieldFocus.projectContainer && (
                <span className="field-hint">Format: XX-XXXXX (e.g., 25-58944)</span>
              )}
              {isFieldImported('projectContainer') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('rfaNumber') ? 'imported-field' : ''}`}>
              <label htmlFor="rfaNumber">RFA Number *</label>
              <input
                type="text"
                id="rfaNumber"
                name="rfaNumber"
                value={formData.rfaNumber || ''}
                onChange={handleInputChange}
                className={errors.rfaNumber ? 'error' : ''}
                placeholder="Enter RFA number"
              />
              {errors.rfaNumber && <span className="error-message">{errors.rfaNumber}</span>}
              {isFieldImported('rfaNumber') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('isRevision') ? 'imported-field' : ''}`}>
              <label>Revision Type *</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value={false}
                    checked={!formData.isRevision}
                    onChange={handleInputChange}
                  />
                  New Project
                </label>
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value={true}
                    checked={formData.isRevision}
                    onChange={handleInputChange}
                  />
                  Revision
                </label>
              </div>
              {isFieldImported('isRevision') && <span className="import-indicator">📋 Imported</span>}
            </div>

            {/* Revision Configuration Summary - Show only when revision is configured */}
            {formData.isRevision && revisionConfigured && (
              <div className="revision-config-summary">
                <div className="revision-summary-content">
                  <div className="summary-icon">✅</div>
                  <div className="summary-text">
                    <strong>Revision Configured:</strong> {Object.values(revisionConfig?.copyOptions || {}).filter(Boolean).length} items selected
                  </div>
                </div>
              </div>
            )}

            <div className={`form-group ${isFieldImported('rfaType') ? 'imported-field' : ''}`}>
              <label htmlFor="rfaType">RFA Type *</label>
              <select
                id="rfaType"
                name="rfaType"
                value={formData.rfaType || ''}
                onChange={handleInputChange}
                className={errors.rfaType ? 'error' : ''}
              >
                <option value="">Select RFA Type</option>
                {dropdownOptions.rfaTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.rfaType && <span className="error-message">{errors.rfaType}</span>}
              {isFieldImported('rfaType') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('agentNumber') ? 'imported-field' : ''}`}>
              <label htmlFor="agentNumber">Agent Number *</label>
              <input
                type="text"
                id="agentNumber"
                name="agentNumber"
                value={formData.agentNumber || ''}
                onChange={handleInputChange}
                className={errors.agentNumber ? 'error' : ''}
                placeholder="Enter agent number"
              />
              {errors.agentNumber && <span className="error-message">{errors.agentNumber}</span>}
              {isFieldImported('agentNumber') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className="form-group">
              <label htmlFor="regionalTeam">Regional Team *</label>
              <select
                id="regionalTeam"
                name="regionalTeam"
                value={formData.regionalTeam || ''}
                onChange={handleInputChange}
                className={errors.regionalTeam ? 'error' : ''}
              >
                <option value="">Select Regional Team</option>
                {dropdownOptions.regionalTeams.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              {errors.regionalTeam && <span className="error-message">{errors.regionalTeam}</span>}
            </div>

            <div className={`form-group ${isFieldImported('nationalAccount') ? 'imported-field' : ''}`}>
              <label htmlFor="nationalAccount">National Account</label>
              <select
                id="nationalAccount"
                name="nationalAccount"
                value={formData.nationalAccount || 'Default'}
                onChange={handleInputChange}
              >
                {dropdownOptions.nationalAccounts.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
              {isFieldImported('nationalAccount') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className="form-group">
              <label htmlFor="saveLocation">Save Location</label>
              <select
                id="saveLocation"
                name="saveLocation"
                value={formData.saveLocation || 'Server'}
                onChange={handleInputChange}
              >
                {dropdownOptions.saveLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            <div className={`form-group ${isFieldImported('requestedDate') ? 'imported-field' : ''}`}>
              <label htmlFor="requestedDate">Requested Date <span className="timezone-indicator">({getUserTimezone().abbreviation})</span></label>
              <input
                type="datetime-local"
                id="requestedDate"
                name="requestedDate"
                value={formData.requestedDate || ''}
                onChange={handleInputChange}
              />
              <small className="field-hint">Time is saved in your local timezone ({getUserTimezone().abbreviation})</small>
              {isFieldImported('requestedDate') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('ecd') ? 'imported-field' : ''}`}>
              <label htmlFor="ecd">ECD <span className="timezone-indicator">({getUserTimezone().abbreviation})</span></label>
              <input
                type="datetime-local"
                id="ecd"
                name="ecd"
                value={formData.ecd || ''}
                onChange={handleInputChange}
              />
              <small className="field-hint">Estimated Completion Date in your local timezone ({getUserTimezone().abbreviation})</small>
              {isFieldImported('ecd') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('submittedDate') ? 'imported-field' : ''}`}>
              <label htmlFor="submittedDate">Submitted Date <span className="timezone-indicator">({getUserTimezone().abbreviation})</span></label>
              <input
                type="datetime-local"
                id="submittedDate"
                name="submittedDate"
                value={formData.submittedDate || ''}
                onChange={handleInputChange}
              />
              <small className="field-hint">Date in your local timezone ({getUserTimezone().abbreviation})</small>
              {isFieldImported('submittedDate') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('complexity') ? 'imported-field' : ''}`}>
              <label htmlFor="complexity">Complexity</label>
              <select
                id="complexity"
                name="complexity"
                value={formData.complexity || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Complexity</option>
                {dropdownOptions.complexityLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              {isFieldImported('complexity') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('rfaValue') ? 'imported-field' : ''}`}>
              <label htmlFor="rfaValue">RFA Value</label>
              <input
                type="text"
                id="rfaValue"
                name="rfaValue"
                value={formData.rfaValue || ''}
                onChange={handleInputChange}
                placeholder="Enter RFA value"
              />
              {isFieldImported('rfaValue') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('status') ? 'imported-field' : ''}`}>
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Status</option>
                {dropdownOptions.statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              {isFieldImported('status') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group form-group-full ${isFieldImported('projectNotes') ? 'imported-field' : ''}`}>
              <label htmlFor="projectNotes">Project Notes</label>
              <textarea
                id="projectNotes"
                name="projectNotes"
                value={formData.projectNotes || ''}
                onChange={handleInputChange}
                placeholder="Enter project notes or comments (optional)"
                rows="3"
              />
              <small className="field-hint">Optional notes about the project. Required when marking project as completed.</small>
              {isFieldImported('projectNotes') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className="form-group">
              <MultiSelectDropdown
                label="Products"
                options={dropdownOptions.productOptions}
                selectedValues={Array.isArray(formData.products) ? formData.products : []}
                onChange={(selectedProducts) => {
                  onFormDataChange({ ...formData, products: selectedProducts });
                }}
                placeholder="Select products"
                isFieldImported={isFieldImported('products')}
              />
              <small className="field-hint">Select one or more products</small>
            </div>

            <div className={`form-group ${isFieldImported('assignedTo') ? 'imported-field' : ''}`}>
              <label htmlFor="assignedTo">Assigned To</label>
              <select
                id="assignedTo"
                name="assignedTo"
                value={formData.assignedTo || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Assigned To</option>
                {dropdownOptions.assignedToOptions.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
              {isFieldImported('assignedTo') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('repContacts') ? 'imported-field' : ''}`}>
              <label htmlFor="repContacts">Rep Contacts</label>
              <input
                type="text"
                id="repContacts"
                name="repContacts"
                value={formData.repContacts || ''}
                onChange={handleInputChange}
                placeholder="e.g., Vranesh, Eileen"
              />
              {isFieldImported('repContacts') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date <span className="timezone-indicator">({getUserTimezone().abbreviation})</span></label>
              <input
                type="datetime-local"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate || ''}
                onChange={handleInputChange}
              />
              <small className="field-hint">Due date in your local timezone ({getUserTimezone().abbreviation})</small>
            </div>
          </div>
        </div>

        {/* Advanced Fields Toggle */}
        {formData.rfaType && !showAdvancedFields && (
          <div className="advanced-fields-toggle">
            <button
              type="button"
              onClick={() => setShowAdvancedFields(true)}
              className="btn btn-outline"
            >
              📝 Show Optional Fields
            </button>
            <span className="toggle-hint">Add dates, status, and additional project details</span>
          </div>
        )}

        {/* Enhanced Progress Summary */}
        <div className="step-summary">
          <div className="summary-header">
            <h4>Project Setup Progress</h4>
            <div className="progress-indicator">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${getValidationProgress().percentage}%` }}
                ></div>
              </div>
              <span className="progress-text">
                {getValidationProgress().percentage}% Complete
              </span>
            </div>
          </div>
          
          <div className="summary-grid">
            <div className={`summary-item ${getValidationProgress().complete ? 'complete' : ''}`}>
              <span className="summary-label">Required Fields:</span>
              <span className="summary-value">
                {getValidationProgress().valid}/{getValidationProgress().total} Valid
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Fields:</span>
              <span className="summary-value">
                {Object.values(formData).filter(value => 
                  value !== null && value !== undefined && value !== ''
                ).length}/{Object.keys(formData).length} Filled
              </span>
            </div>
            {importedFields.length > 0 && (
              <div className="summary-item imported">
                <span className="summary-label">Imported:</span>
                <span className="summary-value">{importedFields.length} from Agile</span>
              </div>
            )}
          </div>

          {/* Validation Feedback */}
          <div className="validation-feedback">
            {getValidationProgress().complete ? (
              <div className="feedback-success">
                ✅ All required fields are complete! Ready to create project folders and proceed to triage calculation.
              </div>
            ) : (
              <div className="feedback-incomplete">
                ⚠️ Please complete the required fields to continue to the next step.
                <div className="missing-fields">
                  Missing: {['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam']
                    .filter(field => !formData[field] || !validateField(field, formData[field]))
                    .map(field => field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
                    .join(', ')
                  }
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
    
    {/* Revision Configuration Dialog */}
    <RevisionConfigurationDialog
      isOpen={showRevisionDialog}
      onClose={handleRevisionDialogClose}
      onConfirm={handleRevisionDialogConfirm}
      projectData={formData}
    />
    </>
  );
};

export default ProjectWizardStep1;
