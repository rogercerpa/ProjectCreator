import React, { useState, useEffect, useRef, useCallback } from 'react';
import WizardLayout from '../components/WizardLayout';
import RevisionConfigurationDialog from '../components/RevisionConfigurationDialog';
import NotificationToast from '../../NotificationToast';
import dropdownOptionsService from '../../../services/DropdownOptionsService';
import triageCalculationService from '../../../services/TriageCalculationService';
import EditableProductTags from '../../EditableProductTags';
import { parseAgileDate, getUserTimezone, formatDateTimeLocal } from '../../../utils/dateUtils';
import { openPaidServicesEmail } from '../../../utils/emailTemplates';
import DASPaidServicesSection from '../../shared/DASPaidServicesSection';

const REP_EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const PRIVATE_USE_REGEX = /[\uE000-\uF8FF]/g;

const sanitizeTextValue = (value = '') => {
  if (typeof value !== 'string') return value;
  return value
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(PRIVATE_USE_REGEX, '')
    .replace(/\u00A0/g, ' ');
};

const sanitizePayloadStrings = (payload) => {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload === 'string') return sanitizeTextValue(payload);
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayloadStrings(item));
  }
  if (typeof payload === 'object') {
    const sanitized = {};
    Object.keys(payload).forEach((key) => {
      sanitized[key] = sanitizePayloadStrings(payload[key]);
    });
    return sanitized;
  }
  return payload;
};

const cleanRepContactFragment = (value = '') => {
  return value
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getPrimaryRepContactName = (value = '') => {
  if (!value) return '';
  const primarySegment = value.split(/[\/&;\n]+/)[0] || '';
  const cleaned = cleanRepContactFragment(primarySegment);
  if (!cleaned) return '';
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',');
    return `${(first || '').trim()} ${(last || '').trim()}`.replace(/\s+/g, ' ').trim();
  }
  return cleaned;
};

const createComparisonKey = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const buildRepSearchCandidates = (value = '') => {
  const base = sanitizeTextValue(value);
  if (!base) return [];
  const candidates = new Set([base]);
  const parts = base.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    candidates.add(`${first} ${last}`.trim());
    candidates.add(`${last} ${first}`.trim());
    candidates.add(first);
    candidates.add(last);
  } else if (parts.length === 1) {
    candidates.add(parts[0]);
  }
  return Array.from(candidates).filter(Boolean);
};

const pickBestAgencyEmail = (agencies, comparisonKey, plainTarget) => {
  if (!Array.isArray(agencies)) return null;
  const targetLower = (plainTarget || '').toLowerCase();
  let fallback = null;

  for (const agency of agencies) {
    const email = agency?.contactEmail || agency?.email;
    if (!email) continue;
    const contactName = agency?.contactName || '';
    const contactKey = createComparisonKey(contactName);
    if (comparisonKey && contactKey && contactKey === comparisonKey) {
      return email;
    }
    if (
      !fallback &&
      comparisonKey &&
      contactKey &&
      (contactKey.includes(comparisonKey) || comparisonKey.includes(contactKey))
    ) {
      fallback = email;
      continue;
    }
    if (!fallback && targetLower && contactName.toLowerCase().includes(targetLower)) {
      fallback = email;
    }
  }

  return fallback;
};

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
  const latestFormDataRef = useRef(formData);
  const repEmailLookupRef = useRef({ lastQuery: null, pendingQuery: null });
  const [repEmailLookupStatus, setRepEmailLookupStatus] = useState({ state: 'idle', message: '' });
  const [repEmailOptions, setRepEmailOptions] = useState([]);
  const repEmailSearchAbortRef = useRef(0);
  const handleRepEmailListChange = useCallback((nextList) => {
    const sanitizedList = (nextList || [])
      .map((entry) => ({
        email: sanitizeTextValue(entry?.email || ''),
        name: sanitizeTextValue(entry?.name || ''),
        agencyName: sanitizeTextValue(entry?.agencyName || '')
      }))
      .filter((entry) => entry.email);
    
    onFormDataChange({
      ...formData,
      dasRepEmailList: sanitizedList,
      dasRepEmail: sanitizedList.map((entry) => entry.email).join('; ')
    });
  }, [formData, onFormDataChange]);

  const fetchRepEmailOptions = useCallback(async (terms, options = {}) => {
    if (typeof window === 'undefined' || !window.electronAPI?.agenciesSearch) {
      return [];
    }
    
    const normalizedTerms = (Array.isArray(terms) ? terms : [terms])
      .map((term) => (term || '').trim())
      .filter((term) => term.length >= 2);
    
    if (normalizedTerms.length === 0) {
      if (!options.keepExisting) {
        setRepEmailOptions([]);
      }
      if (options.updateStatus !== false) {
        setRepEmailLookupStatus({ state: 'idle', message: '' });
      }
      return [];
    }
    
    const requestId = Date.now();
    repEmailSearchAbortRef.current = requestId;
    
    if (options.updateStatus !== false) {
      setRepEmailLookupStatus({ state: 'searching', message: 'Searching agency directory…' });
    }
    
    const seenEmails = new Set();
    const matches = [];
    
    try {
      for (const term of normalizedTerms) {
        const result = await window.electronAPI.agenciesSearch(term, { region: 'all', role: 'all' });
        
        if (repEmailSearchAbortRef.current !== requestId) {
          return matches;
        }
        
        if (result?.success && Array.isArray(result.agencies)) {
          result.agencies.forEach((agency) => {
            const email = agency?.contactEmail;
            if (!email || seenEmails.has(email)) {
              return;
            }
            
            seenEmails.add(email);
            matches.push({
              email,
              name: agency?.contactName || agency?.agentName || '',
              agencyName: agency?.agencyName || '',
              label: `${agency?.contactName || 'Unknown'} • ${agency?.agencyName || 'Agency'}`,
            });
          });
        }
      }
      
      setRepEmailOptions(matches);
      
      if (options.updateStatus !== false) {
        if (matches.length === 0) {
          setRepEmailLookupStatus({ state: 'notFound', message: 'No rep contact email found in agency directory.' });
        } else {
          setRepEmailLookupStatus({ state: 'ready', message: '' });
        }
      }
      
      return matches;
    } catch (error) {
      console.warn('Failed to search agency directory:', error);
      if (options.updateStatus !== false) {
        setRepEmailLookupStatus({ state: 'error', message: 'Rep email lookup failed.' });
      }
      return [];
    }
  }, []);

  const handleRepEmailSearch = useCallback(async (query) => {
    return fetchRepEmailOptions(query, { keepExisting: false });
  }, [fetchRepEmailOptions]);

  useEffect(() => {
    latestFormDataRef.current = formData;
  }, [formData]);
  
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

  const paidServiceEligibleTypes = ['BOM (No Layout)', 'BOM (With Layout)', 'SUBMITTAL'];
  const shouldAutoShowPaidServices = paidServiceEligibleTypes.includes(formData.rfaType);
  const shouldRenderPaidServices = shouldAutoShowPaidServices || formData.dasPaidServiceForced || formData.dasPaidServiceEnabled;

  const handlePaidServicesForceToggle = (checked) => {
    if (!onFormDataChange) return;
    const updates = {
      dasPaidServiceForced: checked
    };

    if (checked) {
      updates.dasPaidServiceEnabled = true;
    } else if (!shouldAutoShowPaidServices) {
      updates.dasPaidServiceEnabled = false;
    }

    onFormDataChange({
      ...formData,
      ...updates
    });
  };

  const handlePaidServicesEmailDraft = () => {
    const result = openPaidServicesEmail(formData);
    if (result.success) {
      setToast({
        show: true,
        message: 'Outlook email draft prepared with paid services details.',
        type: 'success'
      });
    } else if (result.missingFields?.length) {
      setToast({
        show: true,
        message: `Add ${result.missingFields.join(', ')} before drafting the email.`,
        type: 'error'
      });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI?.agenciesSearch) {
      return;
    }

    const repRaw = formData.repContacts;
    if (!repRaw || repRaw.trim().length < 3) {
      repEmailLookupRef.current.lastQuery = null;
      repEmailLookupRef.current.pendingQuery = null;
      setRepEmailLookupStatus({ state: 'idle', message: '' });
      setRepEmailOptions([]);
      return;
    }

    if (formData.dasRepEmail && formData.dasRepEmail.trim()) {
      return;
    }

    const inlineEmailMatch = repRaw.match(REP_EMAIL_REGEX);
    if (inlineEmailMatch) {
      const latest = latestFormDataRef.current;
        if (!(latest.dasRepEmailList || []).length) {
          handleRepEmailListChange([{
            email: inlineEmailMatch[0],
            name: getPrimaryRepContactName(repRaw),
            agencyName: ''
          }]);
        }
        repEmailLookupRef.current.lastQuery = createComparisonKey(repRaw);
        setRepEmailLookupStatus({ state: 'ready', message: '' });
      return;
    }

    const primaryName = getPrimaryRepContactName(repRaw);
    if (!primaryName) {
      return;
    }

    const comparisonKey = createComparisonKey(primaryName);
    if (!comparisonKey) {
      return;
    }

    if (
      repEmailLookupRef.current.pendingQuery === comparisonKey ||
      repEmailLookupRef.current.lastQuery === comparisonKey
    ) {
      return;
    }

    repEmailLookupRef.current.pendingQuery = comparisonKey;
    setRepEmailLookupStatus({ state: 'searching', message: 'Searching agency directory…' });
    let cancelled = false;

    const runLookup = async () => {
      const candidates = buildRepSearchCandidates(primaryName);
      const matches = await fetchRepEmailOptions(candidates, { keepExisting: false });
      if (cancelled) return;
      repEmailLookupRef.current.pendingQuery = null;
      repEmailLookupRef.current.lastQuery = comparisonKey;
      
      if (matches.length === 1 && !(latestFormDataRef.current.dasRepEmailList || []).length) {
        handleRepEmailListChange([matches[0]]);
      } else if (matches.length === 0 && !(latestFormDataRef.current.dasRepEmailList || []).length) {
        setRepEmailLookupStatus({ state: 'notFound', message: 'No rep contact email found in agency directory.' });
      }
    };

    runLookup();

    return () => {
      cancelled = true;
    };
  }, [fetchRepEmailOptions, formData.repContacts, handleRepEmailListChange]);

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
    if (typeof processedValue === 'string') {
      processedValue = sanitizeTextValue(processedValue);
    }
    
    const newFormData = { ...formData, [name]: processedValue };
    
    if (name === 'dasRepEmail') {
      const manualEmails = processedValue
        .split(/[;,]+/)
        .map((email) => sanitizeTextValue(email).trim())
        .filter(Boolean)
        .map((email) => ({ email, name: '', agencyName: '' }));
      newFormData.dasRepEmailList = manualEmails;
    }
    
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
        const sanitizedData = sanitizePayloadStrings(parsedData);
        // Track which fields were imported for visual feedback
        const importedFieldNames = Object.keys(sanitizedData);
        setImportedFields(importedFieldNames);
        
        // Enhanced data merging with conflict detection
        const updatedFormData = { ...formData };
        const conflictFields = [];
        
        // Check for existing data conflicts
        importedFieldNames.forEach(fieldName => {
          if (formData[fieldName] && formData[fieldName] !== '' && 
              formData[fieldName] !== sanitizedData[fieldName]) {
            conflictFields.push(fieldName);
          }
          updatedFormData[fieldName] = sanitizedData[fieldName];
        });
        
        onFormDataChange(updatedFormData);
        
        // Enhanced success message with details
        const importedCount = importedFieldNames.length;
        const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType'];
        const importedRequiredCount = requiredFields.filter(field => importedFieldNames.includes(field)).length;
        
        let successMessage = `✅ RFA imported! ${importedCount} fields • ${importedRequiredCount}/${requiredFields.length} required filled`;
        if (conflictFields.length > 0) {
          successMessage += ` • ${conflictFields.length} overwritten`;
        }
        
        showToast(successMessage, 'success');
        
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
      case 'dasCostPerPage':
        if (!allFormData.dasPaidServiceEnabled) return true;
        return Number(value) > 0;
      case 'dasLightingPages':
        if (!allFormData.dasPaidServiceEnabled) return true;
        return Number(value) > 0;
      case 'dasFee':
        if (!allFormData.dasPaidServiceEnabled) return true;
        return Number(value) > 0;
      case 'dasRepEmail':
        if (!allFormData.dasPaidServiceEnabled) return true;
        return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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
    const baseRequiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
    const paidServiceFields = formData.dasPaidServiceEnabled
      ? ['dasCostPerPage', 'dasLightingPages', 'dasFee', 'dasRepEmail']
      : [];
    const requiredFields = [...baseRequiredFields, ...paidServiceFields];

    const hasValue = (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') {
        return value.trim() !== '';
      }
      return true;
    };

    const validRequiredFields = requiredFields.filter((field) => {
      const value = formData[field];
      return hasValue(value) && validateField(field, value);
    });
    
    return {
      valid: validRequiredFields.length,
      total: requiredFields.length,
      percentage: requiredFields.length === 0 ? 100 : Math.round((validRequiredFields.length / requiredFields.length) * 100),
      complete: validRequiredFields.length === requiredFields.length
    };
  };

  return (
    <>
    {/* Toast Notification */}
    {toast.show && (
      <NotificationToast
        notification={{
          message: toast.message,
          type: toast.type
        }}
        onClose={() => setToast({ show: false, message: '', type: 'success' })}
        duration={5000}
      />
    )}
    
    <div className="max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Gradient Hero Header */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 dark:from-primary-800 dark:via-primary-900 dark:to-secondary-900 px-6 py-8 sm:px-8 sm:py-12">
        {/* Subtle gradient overlays */}
        <div
          aria-hidden="true"
          className="absolute -top-24 right-0 -z-10 transform-gpu blur-3xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-white to-primary-200 opacity-20"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute -bottom-24 left-0 -z-10 transform-gpu blur-3xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
            className="aspect-[1155/678] w-[72.1875rem] bg-gradient-to-tr from-secondary-300 to-primary-300 opacity-20"
          />
        </div>

        <div className="relative z-10">
          {/* Top Row: Step Badge, Progress, and Actions */}
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-4">
              {/* Step Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                <span className="text-white font-bold text-sm">Step 1</span>
                <span className="text-white/70 text-xs">of</span>
                <span className="text-white/90 font-semibold text-sm">2</span>
              </div>
              
              {/* Mini Progress Bar */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: '50%' }}
                  />
                </div>
                <span className="text-xs text-white/80 font-medium">50%</span>
              </div>
            </div>

            {/* Start Fresh Button */}
            <button
              type="button"
              onClick={handleStartFresh}
              disabled={isPasting}
              className="px-3 py-1.5 text-sm font-medium bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🗑️ Start Fresh
            </button>
          </div>

          {/* Title and Subtitle */}
          <div className="max-w-3xl mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Project Setup
            </h2>
            <p className="text-sm sm:text-base text-white/90 leading-relaxed">
              Import from Agile or fill in the basic project details - folders will be created automatically
            </p>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-3">
          
          {/* Revision Configuration Button */}
          {formData.isRevision && !revisionConfigured && (
            <button
              type="button"
              onClick={handleOpenRevisionDialog}
              className="px-4 py-2 text-sm font-semibold bg-warning-500 hover:bg-warning-600 text-white rounded shadow-lg transition-all"
              title="Configure revision settings to proceed"
            >
              🔄 Configure Revision
            </button>
          )}
          
          {/* Import from Agile Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={handlePasteRFAInfo}
              disabled={isPasting}
              className="min-w-[220px] px-4 py-2 text-sm font-semibold bg-white/90 hover:bg-white text-primary-700 rounded shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
            >
              {isPasting ? (
                <>
                  <span className="spinner w-4 h-4 border-2 border-primary-600 border-t-transparent"></span>
                  Processing Agile Data...
                </>
              ) : (
                <>
                  📋 Import From Agile
                </>
              )}
            </button>
            
            {/* Tooltip */}
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 max-w-xs text-center">
                💡 Copy RFA details from Agile and click import to auto-fill fields
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-6 shadow-md">
          <h3 className="form-section-header">📋 Basic Project Information</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
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
              <EditableProductTags
                label="Products"
                options={dropdownOptions.productOptions}
                selectedValues={Array.isArray(formData.products) ? formData.products : []}
                onChange={(selectedProducts) => {
                  const sanitizedProducts = (selectedProducts || [])
                    .map((product) => sanitizeTextValue(product))
                    .filter(Boolean);
                  onFormDataChange({ ...formData, products: sanitizedProducts });
                }}
                isFieldImported={isFieldImported('products')}
              />
              <small className="field-hint">Hover over products to remove them. Use the dropdown to add products.</small>
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

        <div className="mt-10 space-y-4">
          {!shouldAutoShowPaidServices && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Add DAS Paid Services?</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Enable this section if the request needs paid lighting pages even when RFA type does not auto-require it.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-primary-600"
                  checked={formData.dasPaidServiceForced || formData.dasPaidServiceEnabled}
                  onChange={(e) => handlePaidServicesForceToggle(e.target.checked)}
                />
                Show paid services section
              </label>
            </div>
          )}

          {shouldRenderPaidServices && (
            <DASPaidServicesSection
              formData={formData}
              onChange={onFormDataChange}
              errors={errors}
              showEmailButton
              onRequestEmail={handlePaidServicesEmailDraft}
              highlight={!shouldAutoShowPaidServices}
              repEmailStatus={repEmailLookupStatus}
              repEmailList={formData.dasRepEmailList}
              onRepEmailListChange={handleRepEmailListChange}
              repEmailOptions={repEmailOptions}
              onRepEmailSearch={handleRepEmailSearch}
            />
          )}
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
        <div className="mt-6 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-lg">
          {/* Header with Progress */}
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📊 Project Setup Progress
            </h4>
            <div className="flex items-center gap-3">
              <div className="relative w-32 h-2 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                    getValidationProgress().complete 
                      ? 'bg-gradient-to-r from-success-500 to-success-600' 
                      : 'bg-gradient-to-r from-primary-500 to-primary-600'
                  }`}
                  style={{ width: `${getValidationProgress().percentage}%` }}
                ></div>
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 min-w-[3rem] text-right">
                {getValidationProgress().percentage}%
              </span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Required Fields */}
            <div className={`p-4 rounded-lg border-2 transition-all ${
              getValidationProgress().complete 
                ? 'bg-success-50 dark:bg-success-900/20 border-success-500 dark:border-success-700' 
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Required Fields</p>
                  <p className={`text-2xl font-bold ${
                    getValidationProgress().complete 
                      ? 'text-success-600 dark:text-success-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {getValidationProgress().valid}/{getValidationProgress().total}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  getValidationProgress().complete 
                    ? 'bg-success-500 dark:bg-success-600' 
                    : 'bg-warning-500 dark:bg-warning-600'
                }`}>
                  <span className="text-lg">{getValidationProgress().complete ? '✓' : '⚠'}</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                {getValidationProgress().complete ? 'All complete!' : 'Need completion'}
              </p>
            </div>

            {/* Total Fields */}
            <div className="p-4 rounded-lg border-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Total Fields</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Object.values(formData).filter(value => 
                      value !== null && value !== undefined && value !== ''
                    ).length}/{Object.keys(formData).length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-info-500 dark:bg-info-600 flex items-center justify-center">
                  <span className="text-lg">📝</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Fields populated</p>
            </div>

            {/* Imported Fields */}
            {importedFields.length > 0 && (
              <div className="p-4 rounded-lg border-2 bg-white dark:bg-gray-800 border-primary-300 dark:border-primary-600">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Imported</p>
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {importedFields.length}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-500 dark:bg-primary-600 flex items-center justify-center">
                    <span className="text-lg">📋</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">From Agile</p>
              </div>
            )}
          </div>

          {/* Validation Feedback */}
          <div className="mt-4">
            {getValidationProgress().complete ? (
              <div className="p-4 rounded-lg bg-success-50 dark:bg-success-900/20 border-2 border-success-500 dark:border-success-700">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success-500 dark:bg-success-600 flex items-center justify-center">
                    <span className="text-lg">✓</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-success-900 dark:text-success-100 mb-1">
                      Ready to Proceed!
                    </p>
                    <p className="text-xs text-success-700 dark:text-success-300">
                      All required fields are complete. You can now create project folders and proceed to triage calculation.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-warning-50 dark:bg-warning-900/20 border-2 border-warning-500 dark:border-warning-700">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning-500 dark:bg-warning-600 flex items-center justify-center">
                    <span className="text-lg">⚠</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-warning-900 dark:text-warning-100 mb-1">
                      Action Required
                    </p>
                    <p className="text-xs text-warning-700 dark:text-warning-300 mb-2">
                      Please complete the required fields to continue to the next step.
                    </p>
                    <div className="mt-2 p-2 bg-warning-100 dark:bg-warning-900/30 rounded border border-warning-300 dark:border-warning-700">
                      <p className="text-xs font-medium text-warning-900 dark:text-warning-100">
                        Missing: {['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam']
                          .filter(field => !formData[field] || !validateField(field, formData[field]))
                          .map(field => field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
                          .join(', ')
                        }
                      </p>
                    </div>
                  </div>
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
