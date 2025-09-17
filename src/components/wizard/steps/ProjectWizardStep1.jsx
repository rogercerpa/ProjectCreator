import React, { useState, useEffect } from 'react';
import WizardLayout from '../components/WizardLayout';
import RevisionConfigurationDialog from '../components/RevisionConfigurationDialog';
import dropdownOptionsService from '../../../services/DropdownOptionsService';
import triageCalculationService from '../../../services/TriageCalculationService';

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
  onWizardReset
}) => {
  const [isPasting, setIsPasting] = useState(false);
  const [importedFields, setImportedFields] = useState([]);
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

  // Check if form has any data (to conditionally show Start Fresh button)
  const hasFormData = () => {
    const nonEmptyFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
    return nonEmptyFields.some(field => formData[field] && formData[field].toString().trim() !== '');
  };

  // Handle manual wizard reset with confirmation
  const handleStartFresh = () => {
    if (!hasFormData()) {
      // If form is already empty, just show a message
      alert('✨ Form is already clear and ready for new project creation!');
      return;
    }

    const confirmed = window.confirm(
      '🗑️ Clear all form data?\n\nThis will reset all fields and start fresh. This action cannot be undone.\n\nAre you sure you want to continue?'
    );
    
    if (confirmed && onWizardReset) {
      onWizardReset();
      
      // Show success feedback
      setTimeout(() => {
        alert('✅ Form cleared successfully! Ready to create a new project.');
      }, 100);
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
        
        // Auto-clear highlighting after 10 seconds
        setTimeout(() => {
          setImportedFields([]);
        }, 10000);
        
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
    
    // Extract RFA Type from the title line
    const titleMatch = clipboardText.match(/Request for Assistance \d+-\d+ - (.+)/);
    if (titleMatch) {
      const rfaTypeText = titleMatch[1].trim();
      
      // Map Agile RFA types to our form types
      const rfaTypeMapping = {
        'Controls BOM - Budget': 'BUDGET',
        'Controls BOM - BOM (No Layout)': 'BOM (No Layout)',
        'Controls BOM - BOM (With Layout)': 'BOM (With Layout)',
        'Controls Submittal - Submittal': 'SUBMITTAL',
        'Controls Submittal - Preprogramming': 'RELEASE',
        'Controls Design - Layout': 'BOM (With Layout)',
        'Controls Design - Controls Layout': 'BOM (With Layout)',
        'Controls Post-Installation - Graphical Interface': 'GRAPHICS',
        'Design - Photometric Lighting Layout': 'PHOTOMETRICS',
        'Controls Design - Design Consultation': 'Consultation',
        'Lithonia Reloc BOM - Budget': 'RelocBOM',
        'Lithonia Reloc / Controls BOM - Budget': 'RelocControlsBOM',
        'Lithonia Reloc BOM - BOM (With Layout)': 'RelocBOM',
        'Lithonia Reloc Submittal - Submittal': 'RelocSUB',
        'Lithonia Reloc / Controls Submittal - Submittal': 'RelocControlsSUB',
        'Controls / Lithonia Reloc Submittal - Submittal': 'RelocControlsSUB',
        'Atrius BOM - BOM (No Layout)': 'AtriusBOM',
        'Atrius BOM - BOM (With Layout)': 'AtriusLAYOUT',
        'Atrius Submittal - Submittal': 'AtriusSub',
        'Controls / Atrius Submittal - Submittal': 'ControlsAtriusSub',
        'Atrius Locator / Atrius Wayfinder BOM - BOM (With Layout)': 'ControlsAtriusLayout',
        'Atrius / Controls BOM - BOM (With Layout)': 'ControlsAtriusLayout',
        'Controls / Atrius BOM - BOM (No Layout)': 'ControlsAtriusLayout',
        'Controls / Lithonia Commercial Indoor / Controls Submittal - Submittal': 'SUBMITTAL',
        'Controls / Lithonia Commercial Indoor / Mark Architectural Lighting Submittal - Submittal': 'SUBMITTAL',
        'Controls Submittal - One-Line Diagram': 'SUBMITTAL',
        'Controls Submittal - Record Submittal': 'SUBMITTAL',
        'Controls / Peerless BOM - BOM (With Layout)': 'BOM (With Layout)',
        'Controls DC2DC / Controls BOM - BOM (With Layout)': 'CONTROLSDCLAYOUT',
        'Lithonia Outdoor / Other Design - Photometric Lighting Layout': 'PHOTOMETRICS',
        'Other / Lithonia Outdoor Design - Photometric Lighting Layout': 'PHOTOMETRICS'
      };
      
      parsedData.rfaType = rfaTypeMapping[rfaTypeText] || rfaTypeText;
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
      // Convert to datetime-local format
      try {
        const ecdDate = new Date(ecdMatch[1]);
        if (!isNaN(ecdDate.getTime())) {
          parsedData.ecd = ecdDate.toISOString().slice(0, 16);
        }
      } catch (error) {
        console.warn('Failed to parse ECD date:', ecdMatch[1], error);
      }
    }
    
    // Extract Requested Date - Look for "Requested Date: 09/04/2025 6:00 PM"
    const requestedMatch = clipboardText.match(/Requested Date:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
    if (requestedMatch) {
      // Convert to datetime-local format
      try {
        const requestedDate = new Date(requestedMatch[1]);
        if (!isNaN(requestedDate.getTime())) {
          parsedData.requestedDate = requestedDate.toISOString().slice(0, 16);
        }
      } catch (error) {
        console.warn('Failed to parse Requested Date:', requestedMatch[1], error);
      }
    }
    
    // Extract Submitted Date - Look for "Submitted Date: 08/28/2025 5:11 PM"
    const submittedMatch = clipboardText.match(/Submitted Date:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
    if (submittedMatch) {
      // Convert to datetime-local format
      try {
        const submittedDate = new Date(submittedMatch[1]);
        if (!isNaN(submittedDate.getTime())) {
          parsedData.submittedDate = submittedDate.toISOString().slice(0, 16);
        }
      } catch (error) {
        console.warn('Failed to parse Submitted Date:', submittedMatch[1], error);
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
        
        {importedFields.length > 0 && (
          <div className="import-feedback">
            <div className="feedback-content">
              <span className="import-success">
                ✅ {importedFields.length} fields imported successfully
              </span>
              <div className="imported-field-list">
                <strong>Imported:</strong>
                <span className="field-names">
                  {importedFields.slice(0, 3).map(field => 
                    field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
                  ).join(', ')}
                  {importedFields.length > 3 && ` and ${importedFields.length - 3} more`}
                </span>
              </div>
            </div>
            <div className="feedback-actions">
              <button
                type="button"
                onClick={clearImportedHighlight}
                className="btn btn-outline btn-small"
              >
                Clear Highlighting
              </button>
            </div>
          </div>
        )}

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
              <label htmlFor="requestedDate">Requested Date</label>
              <input
                type="datetime-local"
                id="requestedDate"
                name="requestedDate"
                value={formData.requestedDate || ''}
                onChange={handleInputChange}
              />
              {isFieldImported('requestedDate') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('ecd') ? 'imported-field' : ''}`}>
              <label htmlFor="ecd">ECD</label>
              <input
                type="datetime-local"
                id="ecd"
                name="ecd"
                value={formData.ecd || ''}
                onChange={handleInputChange}
              />
              {isFieldImported('ecd') && <span className="import-indicator">📋 Imported</span>}
            </div>

            <div className={`form-group ${isFieldImported('submittedDate') ? 'imported-field' : ''}`}>
              <label htmlFor="submittedDate">Submitted Date</label>
              <input
                type="datetime-local"
                id="submittedDate"
                name="submittedDate"
                value={formData.submittedDate || ''}
                onChange={handleInputChange}
              />
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

            <div className={`form-group ${isFieldImported('products') ? 'imported-field' : ''}`}>
              <label>Products</label>
              <div className="checkbox-group">
                {dropdownOptions.productOptions.map(product => (
                  <label key={product} className="checkbox-item">
                    <input
                      type="checkbox"
                      name="products"
                      value={product}
                      checked={Array.isArray(formData.products) ? formData.products.includes(product) : false}
                      onChange={(e) => {
                        const currentProducts = Array.isArray(formData.products) ? formData.products : [];
                        let newProducts;
                        if (e.target.checked) {
                          newProducts = [...currentProducts, product];
                        } else {
                          newProducts = currentProducts.filter(p => p !== product);
                        }
                        onFormDataChange({ ...formData, products: newProducts });
                      }}
                    />
                    <span className="checkbox-label">{product}</span>
                  </label>
                ))}
              </div>
              <small className="field-hint">Select one or more products</small>
              {isFieldImported('products') && <span className="import-indicator">📋 Imported</span>}
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
              <label htmlFor="dueDate">Due Date</label>
              <input
                type="datetime-local"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate || ''}
                onChange={handleInputChange}
              />
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
