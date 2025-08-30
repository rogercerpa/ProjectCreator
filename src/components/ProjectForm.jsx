import React, { useState, useEffect } from 'react';
import './ProjectForm.css';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';

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

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    console.log('handleInputChange called:', { name, value, type }); // Debug log
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    console.log('Processed value:', processedValue); // Debug log
    
    const newFormData = { ...formData, [name]: processedValue };
    
    // Handle RFA type changes to show/hide triage sections
    if (name === 'rfaType') {
      newFormData.showPanelSchedules = shouldShowPanelSchedules(value);
      newFormData.showSubmittalTriage = shouldShowSubmittalTriage(value);
      newFormData.showPhotometrics = value === 'PHOTOMETRICS';
      
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
    
    console.log('Updating form data:', newFormData); // Debug log
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
    console.log('Triage settings:', triageSettings); // Debug log
    return {
      roomMultiplier: triageSettings.roomMultiplier,
      riserMultiplier: triageSettings.riserMultiplier,
      reviewSetup: triageSettings.defaultReviewSetup,
      soo: triageSettings.defaultSOO,
      numOfPages: triageSettings.defaultNumOfPages
    };
  };

  // Debug: Log current form data
  console.log('Current form data in ProjectForm:', formData);

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
    
    // Extract RFA Number and Revision
    const rfaMatch = clipboardText.match(/Request for Assistance (\d+)-(\d+)/);
    if (rfaMatch) {
      parsedData.rfaNumber = rfaMatch[1];
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
    const projectMatch = clipboardText.match(/Haskell (.+?) (\d{2}-\d{5})/);
    if (projectMatch) {
      parsedData.projectName = projectMatch[1].trim();
      parsedData.projectContainer = projectMatch[2];
    } else {
      // Fallback: try to find any project name pattern
      const fallbackProjectMatch = clipboardText.match(/([A-Za-z\s]+)\s+(\d{2}-\d{5})/);
      if (fallbackProjectMatch) {
        parsedData.projectName = fallbackProjectMatch[1].trim();
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
      parsedData.products = productsMatch[1].trim();
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
    <div className="project-form-container">
      <div className="form-header">
        <h2>{project ? 'Edit Project' : 'Create New Project'}</h2>
        <div className="form-actions">
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

      <form onSubmit={handleSubmit} className="project-form">
        {/* Basic Project Information */}
        <div className="form-section">
          <h3>Basic Project Information</h3>
          <div className="form-grid">
            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
              <label htmlFor="requestedDate">Requested Date</label>
              <input
                type="datetime-local"
                id="requestedDate"
                name="requestedDate"
                value={formData.requestedDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ecd">ECD</label>
              <input
                type="datetime-local"
                id="ecd"
                name="ecd"
                value={formData.ecd}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="submittedDate">Submitted Date</label>
              <input
                type="datetime-local"
                id="submittedDate"
                name="submittedDate"
                value={formData.submittedDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
              <label htmlFor="products">Products</label>
              <select
                id="products"
                name="products"
                value={formData.products}
                onChange={handleInputChange}
              >
                <option value="">Select Products</option>
                {dropdownOptions.productOptions.map(product => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="assignedTo">Assigned To</label>
              <select
                id="assignedTo"
                name="assignedTo"
                value={formData.assignedTo}
                onChange={handleInputChange}
              >
                <option value="">Select Assigned To</option>
                {dropdownOptions.assignedToOptions.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
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

            <div className="form-group">
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
        <div className="form-section">
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
          
          {/* Panel Schedules Section */}
          <div className="triage-subsection">
            <h4>Panel Schedules</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>
                  <input
                    type="radio"
                    name="showPanelSchedules"
                    value={false}
                    checked={!formData.showPanelSchedules}
                    onChange={() => onFormDataChange({ ...formData, showPanelSchedules: false })}
                  />
                  No
                </label>
                <label>
                  <input
                    type="radio"
                    name="showPanelSchedules"
                    value={true}
                    checked={formData.showPanelSchedules}
                    onChange={() => onFormDataChange({ ...formData, showPanelSchedules: true })}
                  />
                  Yes
                </label>
              </div>
            </div>
            
            {formData.showPanelSchedules && (
              <div className="panel-schedules-grid">
                <div className="lmp-section">
                  <h5>LMPs:</h5>
                  <div className="form-grid">
                    <div className="form-group">
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
                    <div className="form-group">
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
                    <div className="form-group">
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
                  <h5>nLight:</h5>
                  <div className="form-grid">
                    <div className="form-group">
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
                    <div className="form-group">
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
                    <div className="form-group">
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
                    <div className="form-group">
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
                  <h5>Panel Schedules (Shown on E-Sheets):</h5>
                  <div className="form-group">
                    <label>
                      <input
                        type="radio"
                        name="esheetsSchedules"
                        value={2}
                        checked={formData.esheetsSchedules === 2}
                        onChange={(e) => {
                          console.log('E-sheets radio changed:', e.target.value); // Debug log
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
                          console.log('E-sheets radio changed:', e.target.value); // Debug log
                          onFormDataChange({ ...formData, esheetsSchedules: parseInt(e.target.value) });
                        }}
                      />
                      Yes
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Layout Section */}
          <div className="triage-subsection">
            <h4>Layouts:</h4>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="numOfRooms"># of Rooms:</label>
                <input
                  type="number"
                  id="numOfRooms"
                  name="numOfRooms"
                  value={formData.numOfRooms}
                  onChange={handleInputChange}
                  min="0"
                  step="1"
                  placeholder="0"
                />
                <span className="field-hint">(qty of rooms)</span>
              </div>
              <div className="form-group">
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
              <div className="form-group">
                <label htmlFor="roomMultiplier">Room Multiplier:</label>
                <input
                  type="number"
                  id="roomMultiplier"
                  name="roomMultiplier"
                  value={formData.roomMultiplier}
                  onChange={handleInputChange}
                  min="0"
                  step="0.5"
                  placeholder="2"
                />
                <span className="field-hint">(min/room)</span>
              </div>
              <div className="form-group">
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
              <div className="form-group">
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
              <div className="form-group">
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

          {/* Submittal Section */}
          {formData.showSubmittalTriage && (
            <div className="triage-subsection">
              <h4>Submittals:</h4>
              <div className="form-grid">
                <div className="form-group">
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
                <div className="form-group">
                  <label htmlFor="overrideSubRooms">Override:</label>
                  <input
                    type="number"
                    id="overrideSubRooms"
                    name="overrideSubRooms"
                    value={formData.overrideSubRooms}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                    placeholder="0"
                  />
                  <span className="field-hint">(hr)</span>
                </div>
                <div className="form-group">
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
                <div className="form-group">
                  <label htmlFor="soo">SOO:</label>
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

          {/* Photometrics Section */}
          {formData.showPhotometrics && (
            <div className="triage-subsection">
              <h4>Photometrics:</h4>
              <div className="form-group">
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
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="selfQC">Self QC:</label>
                <input
                  type="number"
                  id="selfQC"
                  name="selfQC"
                  value={formData.selfQC}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0.0"
                />
                <span className="field-hint">(hr) - Auto-calculated, can be overridden</span>
              </div>
              <div className="form-group">
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
              <div className="form-group">
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
            <div className="form-group">
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
              <div className="triage-breakdown">
                <div className="breakdown-item">
                  <strong>Layout Time:</strong> {triageResults.layoutTime} hours
                </div>
                <div className="breakdown-item">
                  <strong>Submittal Time:</strong> {triageResults.submittalTime} hours
                </div>
                <div className="breakdown-item">
                  <strong>Panel Time:</strong> {triageResults.panelTime} hours
                </div>
                <div className="breakdown-item">
                  <strong>Page Bonus:</strong> {triageResults.pageBonus} hours
                </div>
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
