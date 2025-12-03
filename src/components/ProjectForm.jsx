import React, { useState, useEffect } from 'react';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';
import EditableProductTags from './EditableProductTags';

function ProjectForm({ project, formData, onFormDataChange, onFormReset, onProjectCreated, onProjectUpdated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [triageResults, setTriageResults] = useState(null);
  const [isPasting, setIsPasting] = useState(false);
  const [showPanelSchedules, setShowPanelSchedules] = useState(false);
  
  const [dropdownOptions, setDropdownOptions] = useState(dropdownOptionsService.getOptions());

  // Load project data if editing
  useEffect(() => {
    if (project) {
      onFormDataChange({ ...formData, ...project });
    }
  }, [project]);

  // Load dropdown options and listen for changes
  useEffect(() => {
    const loadOptions = async () => {
      await dropdownOptionsService.loadFromSettings();
    };
    
    loadOptions();
    
    // Listen for option changes
    const unsubscribe = dropdownOptionsService.addListener((newOptions) => {
      setDropdownOptions(newOptions);
    });
    
    return unsubscribe;
  }, []);

  // Fix input field interactivity issue - ensure fields are properly initialized and interactive
  useEffect(() => {
    // Force a re-render and ensure input fields are interactive after component mounts
    const timer = setTimeout(() => {
      // Trigger a small state update to ensure proper rendering
      const updatedFormData = { ...formData };
      onFormDataChange(updatedFormData);
      
      // Focus and blur the first input field to ensure it's interactive
      const firstInput = document.querySelector('input[name="numOfRooms"]');
      if (firstInput) {
        firstInput.focus();
        firstInput.blur(); // Remove focus but ensure field is interactive
      }
    }, 100);

    // Additional timer for Electron-specific focus issues
    const electronTimer = setTimeout(() => {
      // Force all input fields to be interactive
      const allInputs = document.querySelectorAll('input[type="number"], input[type="text"]');
      allInputs.forEach(input => {
        // Force the input to be interactive by triggering focus/blur
        input.focus();
        input.blur();
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(electronTimer);
    };
  }, []); // Empty dependency array - only run once on mount

  // Set default regional team if none is selected
  useEffect(() => {
    if (!formData.regionalTeam && dropdownOptions.defaultRegionalTeam) {
      onFormDataChange({
        ...formData,
        regionalTeam: dropdownOptions.defaultRegionalTeam
      });
    }
  }, [dropdownOptions.defaultRegionalTeam]); // Only trigger when default changes

  // Set default triagedBy and qcBy from user profile (only if fields are empty)
  useEffect(() => {
    // Only set defaults if fields are currently empty
    if (formData.triagedBy || formData.qcBy) {
      return; // Don't overwrite existing values
    }
    
    const loadUserDefaults = async () => {
      try {
        if (window.electronAPI?.settingsLoad) {
          const settingsResult = await window.electronAPI.settingsLoad();
          if (settingsResult?.success && settingsResult.data?.workloadSettings?.userName) {
            const userName = settingsResult.data.workloadSettings.userName;
            const updates = {};
            
            // Set triagedBy if not already set
            if (!formData.triagedBy && userName) {
              updates.triagedBy = userName;
            }
            
            // Set qcBy if not already set
            if (!formData.qcBy && userName) {
              updates.qcBy = userName;
            }
            
            // Only update if there are changes
            if (Object.keys(updates).length > 0) {
              onFormDataChange({
                ...formData,
                ...updates
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load user defaults for WorkTask fields:', error);
      }
    };
    
    loadUserDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

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
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Determine if panel schedules should be shown based on RFA type
  const shouldShowPanelSchedules = (rfaType) => {
    return ['BOM (No Layout)', 'BOM (With Layout)', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE'].includes(rfaType);
  };

  // Determine if submittal triage should be shown based on RFA type
  const shouldShowSubmittalTriage = (rfaType) => {
    return ['SUBMITTAL', 'ControlsAtriusSub', 'AtriusSub'].includes(rfaType);
  };

  // Get default values from triage calculation service
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

  // RFA Info Pasting Functionality
  const handlePasteRFAInfo = async () => {
    setIsPasting(true);
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsedData = parseRFAInfo(clipboardText);
      
      if (parsedData) {
        onFormDataChange({ ...formData, ...parsedData });
        alert('RFA information pasted successfully!');
      } else {
        alert('Could not parse RFA information from clipboard. Please check the format.');
      }
    } catch (error) {
      console.error('Error pasting RFA info:', error);
      alert('Failed to read from clipboard. Please try copying the RFA information again.');
    } finally {
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

  const parseRFAInfo = (clipboardText) => {
    // Enhanced parsing based on actual Agile data format
    console.log('Parsing clipboard data:', clipboardText);
    
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
    
    // Extract Project Name and Container - Look for the specific format in your data
    // The data shows: "Haskell Jacksonville Headquarters Project Blue Sky 25-58944"
    const projectMatch = clipboardText.match(/([A-Za-z\s\-]+?)\s+(\d{2}-\d{5})/);
    if (projectMatch) {
      parsedData.projectName = cleanProjectName(projectMatch[1].trim());
      parsedData.projectContainer = projectMatch[2];
    } else {
      // Fallback: try to find any project name pattern
      const fallbackProjectMatch = clipboardText.match(/([A-Za-z\s\-]+)\s+(\d{2}-\d{5})/);
      if (fallbackProjectMatch) {
        parsedData.projectName = cleanProjectName(fallbackProjectMatch[1].trim());
        parsedData.projectContainer = fallbackProjectMatch[2];
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
    
    // Extract WorkTask fields - Look for "Triaged By:", "Design By:", "QC By:"
    const triagedMatch = clipboardText.match(/Triaged By:\s*([^\n\r]+)/i);
    if (triagedMatch) {
      parsedData.triagedBy = triagedMatch[1].trim();
    }
    
    const designMatch = clipboardText.match(/Design By:\s*([^\n\r]+)/i);
    if (designMatch) {
      parsedData.designBy = designMatch[1].trim();
    }
    
    const qcMatch = clipboardText.match(/QC By:\s*([^\n\r]+)/i);
    if (qcMatch) {
      parsedData.qcBy = qcMatch[1].trim();
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

  const calculateTriage = () => {
    // Use the triage calculation service to get accurate results
    const triageResults = triageCalculationService.calculateTriage(formData);
    
    // Update form data with calculated values
    const updatedFormData = {
      ...formData,
      totalTriage: triageResults.totalTriage,
      panelTime: triageResults.panelTime,
      layoutTime: triageResults.layoutTime,
      submittalTime: triageResults.submittalTime,
      pageBonus: triageResults.pageBonus,
      baseTotal: triageResults.baseTotal,
      selfQC: triageResults.selfQC,
      fluff: triageResults.fluff
    };
    
    onFormDataChange(updatedFormData);
    
    setTriageResults(triageResults);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
      const newErrors = {};

      requiredFields.forEach(field => {
        if (!formData[field]) {
          newErrors[field] = `${field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setIsSubmitting(false);
        return;
      }

      const projectData = {
        id: project?.id || Date.now().toString(),
        ...formData,
        createdAt: project?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: formData.dueDate || ''
      };

      console.log('Saving project data:', projectData);

      if (project) {
        onProjectUpdated(projectData);
      } else {
        onProjectCreated(projectData);
      }

      // Reset form after successful submission
      onFormReset();
      setTriageResults(null);
      setErrors({});

    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportDASBoard = async () => {
    try {
      alert('DAS Board export functionality will be implemented in the next phase.');
    } catch (error) {
      console.error('Error exporting to DAS Board:', error);
      alert('Failed to export to DAS Board.');
    }
  };

  const handleExportAgile = async () => {
    try {
      alert('Agile export functionality will be implemented in the next phase.');
    } catch (error) {
      console.error('Error exporting to Agile:', error);
      alert('Failed to export to Agile.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <h2>{project ? 'Edit Project' : 'Create New Project'}</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePasteRFAInfo}
            disabled={isPasting}
            className="btn btn-secondary"
          >
            {isPasting ? 'Pasting...' : 'Import From Agile'}
          </button>
          <button
            type="button"
            onClick={onFormReset}
            className="btn btn-secondary"
          >
            Reset Form
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-8 max-w-[1400px] mx-auto w-full custom-scrollbar">
        {/* Basic Project Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md">
          <h3>Basic Project Information</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectName">Project Name *</label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                className={errors.projectName ? 'error' : ''}
                placeholder="Enter project name"
              />
              {errors.projectName && <span className="error-message">{errors.projectName}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectContainer">Project Container *</label>
              <input
                type="text"
                id="projectContainer"
                name="projectContainer"
                value={formData.projectContainer}
                onChange={handleInputChange}
                className={errors.projectContainer ? 'error' : ''}
                placeholder="e.g., 25-58944"
              />
              {errors.projectContainer && <span className="error-message">{errors.projectContainer}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaNumber">RFA Number *</label>
              <input
                type="text"
                id="rfaNumber"
                name="rfaNumber"
                value={formData.rfaNumber}
                onChange={handleInputChange}
                className={errors.rfaNumber ? 'error' : ''}
                placeholder="Enter RFA number"
              />
              {errors.rfaNumber && <span className="error-message">{errors.rfaNumber}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaType">RFA Type *</label>
              <select
                id="rfaType"
                name="rfaType"
                value={formData.rfaType}
                onChange={handleInputChange}
                className={errors.rfaType ? 'error' : ''}
              >
                <option value="">Select RFA Type</option>
                {dropdownOptions.rfaTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.rfaType && <span className="error-message">{errors.rfaType}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="agentNumber">Agent Number *</label>
              <input
                type="text"
                id="agentNumber"
                name="agentNumber"
                value={formData.agentNumber}
                onChange={handleInputChange}
                className={errors.agentNumber ? 'error' : ''}
                placeholder="Enter agent number"
              />
              {errors.agentNumber && <span className="error-message">{errors.agentNumber}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="regionalTeam">Regional Team *</label>
              <select
                id="regionalTeam"
                name="regionalTeam"
                value={formData.regionalTeam}
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="nationalAccount">National Account</label>
              <select
                id="nationalAccount"
                name="nationalAccount"
                value={formData.nationalAccount}
                onChange={handleInputChange}
              >
                {dropdownOptions.nationalAccounts.map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="saveLocation">Save Location</label>
              <select
                id="saveLocation"
                name="saveLocation"
                value={formData.saveLocation}
                onChange={handleInputChange}
              >
                {dropdownOptions.saveLocations.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="requestedDate">Requested Date</label>
              <input
                type="datetime-local"
                id="requestedDate"
                name="requestedDate"
                value={formData.requestedDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ecd">ECD</label>
              <input
                type="datetime-local"
                id="ecd"
                name="ecd"
                value={formData.ecd}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="submittedDate">Submitted Date</label>
              <input
                type="datetime-local"
                id="submittedDate"
                name="submittedDate"
                value={formData.submittedDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="complexity">Complexity</label>
              <select
                id="complexity"
                name="complexity"
                value={formData.complexity}
                onChange={handleInputChange}
              >
                <option value="">Select Complexity</option>
                {dropdownOptions.complexityLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaValue">RFA Value</label>
              <input
                type="text"
                id="rfaValue"
                name="rfaValue"
                value={formData.rfaValue}
                onChange={handleInputChange}
                placeholder="Enter RFA value"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="">Select Status</option>
                {dropdownOptions.statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <EditableProductTags
                label="Products"
                options={dropdownOptions.productOptions || []}
                selectedValues={Array.isArray(formData.products) ? formData.products : (formData.products ? [formData.products] : [])}
                onChange={(selectedProducts) => {
                  onFormDataChange({ ...formData, products: selectedProducts });
                }}
              />
              <small className="field-hint">Hover over products to remove them. Use the dropdown to add products.</small>
            </div>

          </div>
        </div>

        {/* WorkTask Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md">
          <h3>👥 WorkTask</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="triagedBy">Triaged By</label>
              <select
                id="triagedBy"
                name="triagedBy"
                value={formData.triagedBy || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Triaged By</option>
                {dropdownOptions.assignedToOptions.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="designBy">Design By</label>
              <select
                id="designBy"
                name="designBy"
                value={formData.designBy || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Design By</option>
                {dropdownOptions.assignedToOptions.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="qcBy">QC By</label>
              <select
                id="qcBy"
                name="qcBy"
                value={formData.qcBy || ''}
                onChange={handleInputChange}
              >
                <option value="">Select QC By</option>
                {dropdownOptions.assignedToOptions.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Additional Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md">
          <h3>📋 Additional Information</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="repContacts">Rep Contacts</label>
              <input
                type="text"
                id="repContacts"
                name="repContacts"
                value={formData.repContacts}
                onChange={handleInputChange}
                placeholder="e.g., Vranesh, Eileen"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dueDate">Due Date</label>
              <input
                type="datetime-local"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Triage Calculation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md">
          <h3>Triage Calculation</h3>
          
          {/* Current Settings Display */}
          <div className="triage-subsection">
            <h4>Current Calculation Settings</h4>
            <div className="settings-display">
              <div className="settings-grid">
                <div className="setting-item">
                  <strong>LMP Multipliers:</strong>
                  <span>Small: {triageCalculationService.getSettings().lmpMultipliers.small} min</span>
                  <span>Medium: {triageCalculationService.getSettings().lmpMultipliers.medium} min</span>
                  <span>Large: {triageCalculationService.getSettings().lmpMultipliers.large} min</span>
                </div>
                <div className="setting-item">
                  <strong>ARP Multipliers:</strong>
                  <span>ARP8: {triageCalculationService.getSettings().arpMultipliers.arp8} min</span>
                  <span>ARP16: {triageCalculationService.getSettings().arpMultipliers.arp16} min</span>
                  <span>ARP32: {triageCalculationService.getSettings().arpMultipliers.arp32} min</span>
                  <span>ARP48: {triageCalculationService.getSettings().arpMultipliers.arp48} min</span>
                </div>
                <div className="setting-item">
                  <strong>Room Multipliers:</strong>
                  <span>Layout: {triageCalculationService.getSettings().roomMultiplier} min/room</span>
                  <span>Riser: {triageCalculationService.getSettings().riserMultiplier} min/room</span>
                </div>
                <div className="setting-item">
                  <strong>Defaults:</strong>
                  <span>Review Setup: {triageCalculationService.getSettings().defaultReviewSetup} hr</span>
                  <span>SOO: {triageCalculationService.getSettings().defaultSOO} hr</span>
                  <span>Pages: {triageCalculationService.getSettings().defaultNumOfPages}</span>
                </div>
              </div>
              <div className="settings-note">
                <small>💡 These values can be adjusted in the Settings page</small>
              </div>
            </div>
          </div>



          
          {/* Unified Triage Calculation Section */}
          <div className="triage-subsection">
            <h4>Triage Configuration</h4>
            
            {/* Panel Schedules Question */}
            <div className="flex flex-col gap-1.5">
              <h5>Panel Schedules (YES or NO):</h5>
              <label>
                <input
                  type="radio"
                  name="hasPanelSchedules"
                  value="false"
                  checked={!formData.hasPanelSchedules}
                  onChange={() => onFormDataChange({ ...formData, hasPanelSchedules: false })}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="hasPanelSchedules"
                  value="true"
                  checked={formData.hasPanelSchedules}
                  onChange={() => onFormDataChange({ ...formData, hasPanelSchedules: true })}
                />
                Yes
              </label>
            </div>

            {/* Submittal Section Question */}
            <div className="flex flex-col gap-1.5">
              <h5>Submittal Section (YES or NO):</h5>
              <label>
                <input
                  type="radio"
                  name="hasSubmittals"
                  value="false"
                  checked={!formData.hasSubmittals}
                  onChange={() => onFormDataChange({ ...formData, hasSubmittals: false, needsLayoutBOM: false })}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="hasSubmittals"
                  value="true"
                  checked={formData.hasSubmittals}
                  onChange={() => onFormDataChange({ ...formData, hasSubmittals: true })}
                />
                Yes
              </label>
            </div>

            {/* Conditional Layout/BOM Question */}
            {formData.hasSubmittals && (
              <div className="flex flex-col gap-1.5">
                <h5>Needs Layout/BOM created (YES or NO):</h5>
                <label>
                  <input
                    type="radio"
                    name="needsLayoutBOM"
                    value="false"
                    checked={!formData.needsLayoutBOM}
                    onChange={() => onFormDataChange({ ...formData, needsLayoutBOM: false })}
                  />
                  No
                </label>
                <label>
                  <input
                    type="radio"
                    name="needsLayoutBOM"
                    value="true"
                    checked={formData.needsLayoutBOM}
                    onChange={() => onFormDataChange({ ...formData, needsLayoutBOM: true })}
                  />
                  Yes
                </label>
              </div>
            )}
          </div>

          {/* Dynamic Triage Fields Section */}
          <div className="triage-subsection">
            <h4>Triage Calculation Fields</h4>
            
            {/* Panel Schedule Fields - Show only when hasPanelSchedules = true */}
            {formData.hasPanelSchedules && (
              <div className="panel-fields">
                <h5>Panel Schedule Fields:</h5>
                
                <div className="lmp-section">
                  <h6>LMPs:</h6>
                  <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="largeLMPs">Large</label>
                      <input
                        type="number"
                        id="largeLMPs"
                        name="largeLMPs"
                        value={formData.largeLMPs}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="mediumLMPs">Medium</label>
                      <input
                        type="number"
                        id="mediumLMPs"
                        name="mediumLMPs"
                        value={formData.mediumLMPs}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="smallLMPs">Small</label>
                      <input
                        type="number"
                        id="smallLMPs"
                        name="smallLMPs"
                        value={formData.smallLMPs}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="nlight-section">
                  <h6>nLight ARPs:</h6>
                  <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="arp8">ARP 8</label>
                      <input
                        type="number"
                        id="arp8"
                        name="arp8"
                        value={formData.arp8}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="arp16">ARP 16</label>
                      <input
                        type="number"
                        id="arp16"
                        name="arp16"
                        value={formData.arp16}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="arp32">ARP 32</label>
                      <input
                        type="number"
                        id="arp32"
                        name="arp32"
                        value={formData.arp32}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="arp48">ARP 48</label>
                      <input
                        type="number"
                        id="arp48"
                        name="arp48"
                        value={formData.arp48}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="esheets-section">
                  <h6>Panel Schedules (Shown on E-Sheets):</h6>
                  <div className="flex flex-col gap-1.5">
                    <label>
                      <input
                        type="radio"
                        name="esheetsSchedules"
                        value={2}
                        checked={formData.esheetsSchedules === 2}
                        onChange={(e) => {
                          onFormDataChange({ ...formData, esheetsSchedules: parseInt(e.target.value) });
                        }}
                      />
                      No
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="esheetsSchedules"
                        value={1}
                        checked={formData.esheetsSchedules === 1}
                        onChange={(e) => {
                          onFormDataChange({ ...formData, esheetsSchedules: parseInt(e.target.value) });
                        }}
                      />
                      Yes
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Layout Fields - Show when hasSubmittals = false OR (hasSubmittals = true AND needsLayoutBOM = true) */}
            {(!formData.hasSubmittals || (formData.hasSubmittals && formData.needsLayoutBOM)) && (
              <div className="layout-fields">
                <h5>Layout Fields:</h5>
                <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="numOfRooms"># of Rooms:</label>
                    <input
                      type="number"
                      id="numOfRooms"
                      name="numOfRooms"
                      value={formData.numOfRooms || 0}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                    <span className="field-hint">(qty of rooms)</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="overrideRooms">Override:</label>
                    <input
                      type="number"
                      id="overrideRooms"
                      name="overrideRooms"
                      value={formData.overrideRooms}
                      onChange={handleInputChange}
                      min="0"
                      step="0.25"
                      placeholder="0"
                    />
                    <span className="field-hint">(hr)</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="roomMultiplier">Room Multiplier:</label>
                    <input
                      type="number"
                      id="roomMultiplier"
                      name="roomMultiplier"
                      value={formData.roomMultiplier || 2}
                      onChange={handleInputChange}
                      min="0"
                      step="0.5"
                      placeholder="2"
                    />
                    <span className="field-hint">(min/room)</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="reviewSetup">Review/Setup Time:</label>
                    <input
                      type="number"
                      id="reviewSetup"
                      name="reviewSetup"
                      value={formData.reviewSetup}
                      onChange={handleInputChange}
                      min="0"
                      step="0.25"
                      placeholder="0.5"
                    />
                    <span className="field-hint">(hr)</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="numOfPages"># of Lighting Pages:</label>
                    <input
                      type="number"
                      id="numOfPages"
                      name="numOfPages"
                      value={formData.numOfPages}
                      onChange={handleInputChange}
                      min="1"
                      step="1"
                      placeholder="1"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="specReview">Spec Review:</label>
                    <input
                      type="number"
                      id="specReview"
                      name="specReview"
                      value={formData.specReview}
                      onChange={handleInputChange}
                      min="0"
                      step="0.25"
                      placeholder="0.0"
                    />
                    <span className="field-hint">(hr)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submittal Fields - Show only when hasSubmittals = true */}
            {formData.hasSubmittals && (
              <div className="submittal-fields">
                <h5>Submittal Fields:</h5>
                <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="numOfSubRooms"># of Rooms:</label>
                    <input
                      type="number"
                      id="numOfSubRooms"
                      name="numOfSubRooms"
                      value={formData.numOfSubRooms}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                    <span className="field-hint">(qty. of rooms)</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="riserMultiplier">Riser Multiplier:</label>
                    <input
                      type="number"
                      id="riserMultiplier"
                      name="riserMultiplier"
                      value={formData.riserMultiplier}
                      onChange={handleInputChange}
                      min="0"
                      step="0.5"
                      placeholder="1"
                    />
                    <span className="field-hint">(min/room)</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="soo">Sequence of Operation:</label>
                    <input
                      type="number"
                      id="soo"
                      name="soo"
                      value={formData.soo}
                      onChange={handleInputChange}
                      min="0"
                      step="0.25"
                      placeholder="0.5"
                    />
                    <span className="field-hint">(hr)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Photometrics Section */}
          {formData.showPhotometrics && (
            <div className="triage-subsection">
              <h4>Photometrics:</h4>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="photoSoftware">Photo Software:</label>
                <select
                  id="photoSoftware"
                  name="photoSoftware"
                  value={formData.photoSoftware}
                  onChange={handleInputChange}
                >
                  {dropdownOptions.photoSoftware.map(software => (
                    <option key={software} value={software}>{software}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Triage Results */}
          <div className="triage-subsection">
            <h4>Triage Results:</h4>
            <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="selfQC">Self QC:</label>
                <input
                  type="number"
                  id="selfQC"
                  name="selfQC"
                  value={formData.selfQC || 0}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0.0"
                />
                <span className="field-hint">(hr) - Auto-calculated, can be overridden</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fluff">Fluff:</label>
                <input
                  type="number"
                  id="fluff"
                  name="fluff"
                  value={formData.fluff}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0.0"
                />
                <span className="field-hint">(hr) - Auto-calculated, can be overridden</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="totalTriage">Total Triage Time:</label>
                <input
                  type="number"
                  id="totalTriage"
                  name="totalTriage"
                  value={formData.totalTriage}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0.0"
                />
                <span className="field-hint">(hr) - Auto-calculated, can be overridden</span>
              </div>
            </div>
          </div>

          {/* First Available Section */}
          <div className="triage-subsection">
            <h4>Assignment:</h4>
            <div className="flex flex-col gap-1.5">
              <label>
                <input
                  type="radio"
                  name="firstAvailable"
                  value={false}
                  checked={!formData.firstAvailable}
                  onChange={() => onFormDataChange({ ...formData, firstAvailable: false })}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="firstAvailable"
                  value={true}
                  checked={formData.firstAvailable}
                  onChange={() => onFormDataChange({ ...formData, firstAvailable: true })}
                />
                Yes
              </label>
              <span className="field-hint">: Assign to first available (Do this last)</span>
            </div>
          </div>

          <div className="triage-actions">
            <button
              type="button"
              onClick={calculateTriage}
              className="btn btn-primary"
            >
              Calculate Triage
            </button>
            

          </div>

          {triageResults && (
            <div className="triage-results">
              <h4>Detailed Triage Breakdown</h4>
              <div className="triage-configuration-summary">
                <h5>Active Sections:</h5>
                <ul>
                  <li>Panel Schedules: {formData.hasPanelSchedules ? 'YES' : 'NO'}</li>
                  <li>Submittal Section: {formData.hasSubmittals ? 'YES' : 'NO'}</li>
                  {formData.hasSubmittals && (
                    <li>Needs Layout/BOM: {formData.needsLayoutBOM ? 'YES' : 'NO'}</li>
                  )}
                </ul>
                <p><strong>Sections Contributing to Calculation:</strong></p>
                <ul>
                  {triageResults.showPanelFields && <li>✓ Panel Schedule Fields</li>}
                  {triageResults.showLayoutFields && <li>✓ Layout Fields</li>}
                  {triageResults.showSubmittalFields && <li>✓ Submittal Fields</li>}
                </ul>
              </div>
              <div className="triage-breakdown">
                {triageResults.showLayoutFields && (
                  <div className="breakdown-item">
                    <strong>Layout Time:</strong> {triageResults.layoutTime} hours
                  </div>
                )}
                {triageResults.showSubmittalFields && (
                  <div className="breakdown-item">
                    <strong>Submittal Time:</strong> {triageResults.submittalTime} hours
                  </div>
                )}
                {triageResults.showPanelFields && (
                  <div className="breakdown-item">
                    <strong>Panel Time:</strong> {triageResults.panelTime} hours
                  </div>
                )}
                {triageResults.showLayoutFields && (
                  <div className="breakdown-item">
                    <strong>Page Bonus:</strong> {triageResults.pageBonus} hours
                  </div>
                )}
                <div className="breakdown-item">
                  <strong>Base Total:</strong> {triageResults.baseTotal} hours
                </div>
                <div className="breakdown-item">
                  <strong>Self QC:</strong> {triageResults.selfQC} hours
                </div>
                <div className="breakdown-item">
                  <strong>Fluff:</strong> {triageResults.fluff} hours
                </div>
                <div className="breakdown-item total">
                  <strong>Total Triage Time:</strong> {triageResults.totalTriage} hours
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Saving...' : (project ? 'Update Project' : 'Create Project')}
          </button>
          
          <button
            type="button"
            onClick={handleExportDASBoard}
            className="btn btn-secondary"
          >
            Export to DAS Board
          </button>
          
          <button
            type="button"
            onClick={handleExportAgile}
            className="btn btn-secondary"
          >
            Export to Agile
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProjectForm;
