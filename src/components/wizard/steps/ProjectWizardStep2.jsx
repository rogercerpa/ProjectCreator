import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import WizardLayout from '../components/WizardLayout';
import dropdownOptionsService from '../../../services/DropdownOptionsService';
import triageCalculationService from '../../../services/TriageCalculationService';

/**
 * ProjectWizardStep2 - Triage Calculation
 * Extracted from ProjectForm.jsx lines 790-1367
 * Preserves ALL original calculation logic, functions, and behavior
 */
const ProjectWizardStep2 = ({
  formData,
  onFormDataChange,
  errors = {},
  onFieldError,
  onFieldTouch,
  onValidationChange
}) => {
  // Initialize all hooks first (CRITICAL: Hooks must always be called in same order)
  const [triageResults, setTriageResults] = useState(null);
  const [dropdownOptions, setDropdownOptions] = useState(() => {
    try {
      return dropdownOptionsService ? dropdownOptionsService.getOptions() : {};
    } catch (error) {
      console.error('Failed to get dropdown options:', error);
      return {
        photoSoftware: ['VL', 'AGI32', 'DIALux']
      };
    }
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [calculationHistory, setCalculationHistory] = useState([]);
  const [realTimePreview, setRealTimePreview] = useState(null);
  const [showTooltips, setShowTooltips] = useState({});
  
  // Use useRef for timeout to avoid dependency issues
  const previewUpdateTimeoutRef = useRef(null);

  // Cleanup timeout on unmount (CRITICAL: Must be before any conditional returns)
  useEffect(() => {
    return () => {
      if (previewUpdateTimeoutRef.current) {
        clearTimeout(previewUpdateTimeoutRef.current);
        previewUpdateTimeoutRef.current = null;
      }
    };
  }, []);

  // Get current triage settings for display (moved to top)
  const currentSettings = useMemo(() => {
    try {
      return triageCalculationService ? triageCalculationService.getSettings() : {
        lmpMultipliers: { small: 15, medium: 30, large: 45 },
        arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
        roomMultiplier: 2,
        riserMultiplier: 1,
        defaultReviewSetup: 0.5,
        defaultSOO: 0.5,
        defaultNumOfPages: 1
      };
    } catch (error) {
      console.error('Failed to get triage settings:', error);
      return {
        lmpMultipliers: { small: 15, medium: 30, large: 45 },
        arpMultipliers: { arp8: 5, arp16: 10, arp32: 20, arp48: 25 },
        roomMultiplier: 2,
        riserMultiplier: 1,
        defaultReviewSetup: 0.5,
        defaultSOO: 0.5,
        defaultNumOfPages: 1
      };
    }
  }, []);

  // Memoized radio button handlers to prevent function recreation (moved to top)
  const handlePanelSchedulesChange = useCallback((value) => {
    const hasPanelSchedules = value === 'true';
    onFormDataChange(prev => ({ ...prev, hasPanelSchedules }));
  }, [onFormDataChange]);

  const handleSubmittalsChange = useCallback((value) => {
    const hasSubmittals = value === 'true';
    onFormDataChange(prev => ({
      ...prev, 
      hasSubmittals,
      needsLayoutBOM: hasSubmittals ? prev.needsLayoutBOM : false
    }));
  }, [onFormDataChange]);

  const handleLayoutBOMChange = useCallback((value) => {
    const needsLayoutBOM = value === 'true';
    onFormDataChange(prev => ({ ...prev, needsLayoutBOM }));
  }, [onFormDataChange]);

  const handleEsheetsChange = useCallback((value) => {
    const esheetsSchedules = parseInt(value);
    onFormDataChange(prev => ({ ...prev, esheetsSchedules }));
  }, [onFormDataChange]);

  const handleFirstAvailableChange = useCallback((value) => {
    const firstAvailable = value === 'true';
    onFormDataChange(prev => ({ ...prev, firstAvailable }));
  }, [onFormDataChange]);

  // Load dropdown options and listen for changes (preserve original logic)
  useEffect(() => {
    const loadOptions = async () => {
      try {
        await dropdownOptionsService.loadFromSettings();
      } catch (error) {
        console.error('Failed to load dropdown settings:', error);
      }
    };
    
    loadOptions();
    
    // Listen for option changes with error handling
    let unsubscribe;
    try {
      unsubscribe = dropdownOptionsService.addListener((newOptions) => {
        setDropdownOptions(newOptions || {});
      });
    } catch (error) {
      console.error('Failed to set up dropdown listener:', error);
    }
    
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Failed to unsubscribe from dropdown listener:', error);
        }
      }
    };
  }, []);

  // DEFENSIVE CHECKS: After all hooks are initialized to prevent hook order violations
  if (!formData || typeof formData !== 'object') {
    console.error('ProjectWizardStep2: Invalid formData provided:', formData);
    return (
      <div className="wizard-error">
        <h3>⚠️ Data Error</h3>
        <p>No project data available. Please go back to Step 1 and try again.</p>
      </div>
    );
  }
  
  if (!dropdownOptionsService || !triageCalculationService) {
    console.error('ProjectWizardStep2: Required services not available');
    return (
      <div className="wizard-error">
        <h3>⚠️ Service Error</h3>
        <p>Required calculation services are not available. Please reload the page and try again.</p>
      </div>
    );
  }

  // PRESERVED: Original helper functions from ProjectForm.jsx (moved before handleInputChange)
  const shouldShowPanelSchedules = (rfaType) => {
    return ['BOM (No Layout)', 'BOM (With Layout)', 'BUDGET', 'LAYOUT', 'SUBMITTAL', 'RELEASE'].includes(rfaType);
  };

  const shouldShowSubmittalTriage = (rfaType) => {
    return ['SUBMITTAL', 'ControlsAtriusSub', 'AtriusSub'].includes(rfaType);
  };

  const getTriageDefaults = () => {
    try {
      const triageSettings = triageCalculationService.getSettings();
      return {
        roomMultiplier: triageSettings.roomMultiplier || 1.0,
        riserMultiplier: triageSettings.riserMultiplier || 1.0,
        reviewSetup: triageSettings.defaultReviewSetup || 1.0,
        soo: triageSettings.defaultSOO || 0.5,
        numOfPages: triageSettings.defaultNumOfPages || 1
      };
    } catch (error) {
      console.error('Failed to get triage defaults:', error);
      return {
        roomMultiplier: 1.0,
        riserMultiplier: 1.0,
        reviewSetup: 1.0,
        soo: 0.5,
        numOfPages: 1
      };
    }
  };

  // CRITICAL FIX: Move validation and completion functions BEFORE updateRealTimePreview/handleInputChange
  // Validation for triage fields (moved up to fix hoisting issue) - MEMOIZED
  const validateTriageInputs = useCallback(() => {
    const errors = {};
    
    if (formData.hasPanelSchedules) {
      if (!formData.largeLMPs && !formData.mediumLMPs && !formData.smallLMPs && 
          !formData.arp8 && !formData.arp16 && !formData.arp32 && !formData.arp48) {
        errors.panels = 'At least one LMP or ARP value is required for panel calculations';
      }
    }
    
    if (!formData.hasSubmittals || (formData.hasSubmittals && formData.needsLayoutBOM)) {
      if (!formData.numOfRooms || formData.numOfRooms === 0) {
        errors.rooms = 'Number of rooms is required for layout calculations';
      }
    }
    
    if (formData.hasSubmittals) {
      if (!formData.numOfSubRooms || formData.numOfSubRooms === 0) {
        errors.subRooms = 'Number of rooms is required for submittal calculations';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Get step completion status (moved up to fix hoisting issue) - MEMOIZED
  const getStepCompletionStatus = useCallback(() => {
    const hasTriageConfig = formData.hasPanelSchedules !== undefined && formData.hasSubmittals !== undefined;
    const hasRequiredFields = validateTriageInputs();
    const hasCalculationResults = triageResults !== null;
    
    return {
      configComplete: hasTriageConfig,
      fieldsComplete: hasRequiredFields,
      calculationComplete: hasCalculationResults,
      overallComplete: hasTriageConfig && hasRequiredFields && hasCalculationResults
    };
  }, [formData, triageResults, validateTriageInputs]);

  // Real-time preview calculation with defensive checks (moved after helper functions) - MEMOIZED
  const updateRealTimePreview = useCallback((data) => {
    try {
      // DEFENSIVE CHECK: Ensure data is valid
      if (!data || typeof data !== 'object') {
        console.warn('Invalid data provided to updateRealTimePreview');
        setRealTimePreview(null);
        return;
      }

      // DEFENSIVE CHECK: Ensure getStepCompletionStatus is available
      if (typeof getStepCompletionStatus !== 'function') {
        console.warn('getStepCompletionStatus function not available');
        setRealTimePreview(null);
        return;
      }

      const completionStatus = getStepCompletionStatus();
      if (!completionStatus || typeof completionStatus !== 'object') {
        console.warn('getStepCompletionStatus returned invalid result');
        setRealTimePreview(null);
        return;
      }

      if (completionStatus.fieldsComplete) {
        // DEFENSIVE CHECK: Ensure triageCalculationService is available
        if (!triageCalculationService || typeof triageCalculationService.calculateTriage !== 'function') {
          console.warn('Triage calculation service not available');
          setRealTimePreview(null);
          return;
        }

        const previewResults = triageCalculationService.calculateTriage(data);
        
        // DEFENSIVE CHECK: Validate preview results
        if (previewResults && typeof previewResults === 'object') {
          setRealTimePreview(previewResults);
        } else {
          console.warn('Invalid preview results from triage calculation');
          setRealTimePreview(null);
        }
      } else {
        setRealTimePreview(null);
      }
    } catch (error) {
      console.warn('Preview calculation failed:', error);
      setRealTimePreview(null);
    }
  }, [getStepCompletionStatus]); // Now that getStepCompletionStatus is memoized, we can include it

  // PRESERVED: Original handleInputChange logic from ProjectForm.jsx - MEMOIZED
  const handleInputChange = useCallback((e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    // Use functional update to avoid dependency on formData
    onFormDataChange(currentFormData => {
      const newFormData = { ...currentFormData, [name]: processedValue };
      
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
        if (value && !currentFormData.rfaType) {
          const defaults = getTriageDefaults();
          newFormData.roomMultiplier = defaults.roomMultiplier;
          newFormData.riserMultiplier = defaults.riserMultiplier;
          newFormData.reviewSetup = defaults.reviewSetup;
          newFormData.soo = defaults.soo;
          newFormData.numOfPages = defaults.numOfPages;
        }
      }
      
      // Real-time preview update (debounced) - move inside functional update
      if (previewUpdateTimeoutRef.current) {
        clearTimeout(previewUpdateTimeoutRef.current);
      }
      
      previewUpdateTimeoutRef.current = setTimeout(() => {
        updateRealTimePreview(newFormData);
      }, 500); // 500ms debounce
      
      return newFormData;
    });
    
    // Clear field error when user modifies field
    if (onFieldError && errors[name]) {
      onFieldError(name, null);
    }
    
    // Mark field as touched
    if (onFieldTouch) {
      onFieldTouch(name);
    }

    // Clear triage results when any field changes
    setTriageResults(null);
  }, [onFormDataChange, onFieldError, onFieldTouch, errors, updateRealTimePreview]);

  // REMOVED: Duplicate helper functions (moved above handleInputChange)

  // PRESERVED: Original calculateTriage function from ProjectForm.jsx
  const calculateTriage = () => {
    setIsCalculating(true);
    
    try {
      // DEFENSIVE CHECK: Ensure triage calculation service is available
      if (!triageCalculationService || typeof triageCalculationService.calculateTriage !== 'function') {
        throw new Error('Triage calculation service not available');
      }

      // DEFENSIVE CHECK: Ensure form data is valid
      if (!formData || typeof formData !== 'object') {
        throw new Error('Invalid form data for triage calculation');
      }

      // Use the triage calculation service to get accurate results
      const calculationResults = triageCalculationService.calculateTriage(formData);
      
      // DEFENSIVE CHECK: Ensure calculation results are valid
      if (!calculationResults || typeof calculationResults !== 'object') {
        throw new Error('Invalid calculation results from triage service');
      }

      // DEFENSIVE CHECK: Ensure required properties exist with fallbacks
      const safeResults = {
        totalTriage: calculationResults.totalTriage || 0,
        panelTime: calculationResults.panelTime || 0,
        layoutTime: calculationResults.layoutTime || 0,
        submittalTime: calculationResults.submittalTime || 0,
        pageBonus: calculationResults.pageBonus || 0,
        baseTotal: calculationResults.baseTotal || 0,
        selfQC: calculationResults.selfQC || 0,
        fluff: calculationResults.fluff || 0
      };
      
      // Update form data with calculated values
      const updatedFormData = {
        ...formData,
        ...safeResults
      };
      
      onFormDataChange(updatedFormData);
      setTriageResults(calculationResults);
      
      // Add to calculation history for user reference
      setCalculationHistory(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        result: calculationResults.totalTriage,
        config: {
          hasPanelSchedules: formData.hasPanelSchedules,
          hasSubmittals: formData.hasSubmittals,
          needsLayoutBOM: formData.needsLayoutBOM,
          rfaType: formData.rfaType
        }
      }]);
      
      console.log('Triage calculation completed:', calculationResults);
      
    } catch (error) {
      console.error('Error calculating triage:', error);
      setValidationErrors({ calculation: 'Error calculating triage. Please check your inputs.' });
    } finally {
      setIsCalculating(false);
    }
  };



  // Tooltip management
  const showTooltip = (fieldName) => {
    setShowTooltips(prev => ({ ...prev, [fieldName]: true }));
  };

  const hideTooltip = (fieldName) => {
    setShowTooltips(prev => ({ ...prev, [fieldName]: false }));
  };

  // Contextual help content
  const getTooltipContent = (fieldName) => {
    const tooltips = {
      largeLMPs: "Large LMPs are typically 277V panels or panels with complex configurations. Each counts as 45 minutes of work.",
      mediumLMPs: "Medium LMPs are standard 208V panels or moderately complex configurations. Each counts as 30 minutes of work.",
      smallLMPs: "Small LMPs are simple 120V panels or basic configurations. Each counts as 15 minutes of work.",
      arp8: "ARP8 nodes handle 8 zones. Count all ARP8 devices in the project. Each counts as 5 minutes.",
      arp16: "ARP16 nodes handle 16 zones. Count all ARP16 devices in the project. Each counts as 10 minutes.",
      arp32: "ARP32 nodes handle 32 zones. Count all ARP32 devices in the project. Each counts as 20 minutes.",
      arp48: "ARP48 nodes handle 48 zones. Count all ARP48 devices in the project. Each counts as 25 minutes.",
      numOfRooms: "Count all rooms that need lighting layout work. This includes offices, conference rooms, common areas, etc.",
      numOfSubRooms: "For submittal work, count rooms that need control documentation. May differ from layout room count.",
      roomMultiplier: "Minutes per room for layout work. Default is 2 minutes per room but can be adjusted based on complexity.",
      riserMultiplier: "Minutes per room for submittal riser work. Default is 1 minute per room.",
      reviewSetup: "Time for initial review and project setup. Default is 0.5 hours but can be adjusted.",
      soo: "Sequence of Operation document time. Default is 0.5 hours for standard SOO.",
      numOfPages: "Number of lighting pages in the drawings. Additional pages over 3 get a time bonus.",
      specReview: "Time for specification review if required. Add hours based on spec complexity.",
      esheetsSchedules: "Whether panel schedules will be shown on electrical sheets. Affects calculation multiplier.",
      selfQC: "Self quality control time - automatically calculated based on total project time.",
      fluff: "Additional buffer time - automatically calculated as 10% of base time.",
      totalTriage: "Final estimated time including all components, self-QC, and fluff time."
    };
    
    return tooltips[fieldName] || "No help available for this field.";
  };

  // Removed duplicate hooks - already defined at top

  return (
    <WizardLayout
      title="Project Triage Calculation"
      subtitle="Configure and calculate the estimated time for this project"
      step={2}
      totalSteps={3}
    >
      <div className="wizard-step-content">
        {/* Project Context Summary */}
        <div className="project-context">
          <h4>Project: {formData.projectName || 'Untitled Project'}</h4>
          <div className="context-grid">
            <span><strong>RFA:</strong> {formData.rfaNumber || 'N/A'}</span>
            <span><strong>Type:</strong> {formData.rfaType || 'Not Selected'}</span>
            <span><strong>Agent:</strong> {formData.agentNumber || 'N/A'}</span>
            <span><strong>Team:</strong> {formData.regionalTeam || 'N/A'}</span>
          </div>
        </div>

        {/* PRESERVED: Current Settings Display from ProjectForm.jsx lines 794-828 */}
        <div className="triage-subsection">
          <h4>Current Calculation Settings</h4>
          <div className="settings-display">
            <div className="settings-grid">
              <div className="setting-item">
                <strong>LMP Multipliers:</strong>
                <span>Small: {currentSettings.lmpMultipliers.small} min</span>
                <span>Medium: {currentSettings.lmpMultipliers.medium} min</span>
                <span>Large: {currentSettings.lmpMultipliers.large} min</span>
              </div>
              <div className="setting-item">
                <strong>ARP Multipliers:</strong>
                <span>ARP8: {currentSettings.arpMultipliers.arp8} min</span>
                <span>ARP16: {currentSettings.arpMultipliers.arp16} min</span>
                <span>ARP32: {currentSettings.arpMultipliers.arp32} min</span>
                <span>ARP48: {currentSettings.arpMultipliers.arp48} min</span>
              </div>
              <div className="setting-item">
                <strong>Room Multipliers:</strong>
                <span>Layout: {currentSettings.roomMultiplier} min/room</span>
                <span>Riser: {currentSettings.riserMultiplier} min/room</span>
              </div>
              <div className="setting-item">
                <strong>Defaults:</strong>
                <span>Review Setup: {currentSettings.defaultReviewSetup} hr</span>
                <span>SOO: {currentSettings.defaultSOO} hr</span>
                <span>Pages: {currentSettings.defaultNumOfPages}</span>
              </div>
            </div>
            <div className="settings-note">
              <small>💡 These values can be adjusted in the Settings page</small>
            </div>
          </div>
        </div>

        {/* PRESERVED: Unified Triage Configuration Section from ProjectForm.jsx lines 834-913 */}
        <div className="triage-subsection">
          <h4>Triage Configuration</h4>
          
          {/* Panel Schedules Question */}
          <div className="form-group">
            <h5>Panel Schedules (YES or NO):</h5>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="hasPanelSchedules"
                  value="false"
                  checked={!formData.hasPanelSchedules}
                  onChange={() => handlePanelSchedulesChange('false')}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="hasPanelSchedules"
                  value="true"
                  checked={formData.hasPanelSchedules}
                  onChange={() => handlePanelSchedulesChange('true')}
                />
                Yes
              </label>
            </div>
          </div>

          {/* Submittal Section Question */}
          <div className="form-group">
            <h5>Submittal Section (YES or NO):</h5>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="hasSubmittals"
                  value="false"
                  checked={!formData.hasSubmittals}
                  onChange={() => handleSubmittalsChange('false')}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="hasSubmittals"
                  value="true"
                  checked={formData.hasSubmittals}
                  onChange={() => handleSubmittalsChange('true')}
                />
                Yes
              </label>
            </div>
          </div>

          {/* Conditional Layout/BOM Question */}
          {formData.hasSubmittals && (
            <div className="form-group">
              <h5>Needs Layout/BOM created (YES or NO):</h5>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="needsLayoutBOM"
                    value="false"
                    checked={!formData.needsLayoutBOM}
                    onChange={() => handleLayoutBOMChange('false')}
                  />
                  No
                </label>
                <label>
                  <input
                    type="radio"
                    name="needsLayoutBOM"
                    value="true"
                    checked={formData.needsLayoutBOM}
                    onChange={() => handleLayoutBOMChange('true')}
                  />
                  Yes
                </label>
              </div>
            </div>
          )}
        </div>

        {/* PRESERVED: Dynamic Triage Fields Section from ProjectForm.jsx lines 916-1201 */}
        <div className="triage-subsection">
          <h4>Triage Calculation Fields</h4>
          
          {/* Panel Schedule Fields - Show only when hasPanelSchedules = true */}
          {formData.hasPanelSchedules && (
            <div className="panel-fields">
              <h5>Panel Schedule Fields:</h5>
              
              <div className="lmp-section">
                <h6>LMPs:</h6>
                <div className="form-grid">
                                      <div className="form-group enhanced-field">
                      <label htmlFor="largeLMPs">
                        Large
                        <span 
                          className="help-icon"
                          onMouseEnter={() => showTooltip('largeLMPs')}
                          onMouseLeave={() => hideTooltip('largeLMPs')}
                        >
                          ❓
                        </span>
                      </label>
                      <input
                        type="number"
                        id="largeLMPs"
                        name="largeLMPs"
                        value={formData.largeLMPs || 0}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                      {showTooltips.largeLMPs && (
                        <div className="tooltip">
                          {getTooltipContent('largeLMPs')}
                        </div>
                      )}
                      {formData.largeLMPs > 0 && (
                        <div className="field-preview">
                          {formData.largeLMPs} × {currentSettings.lmpMultipliers.large} min = {(formData.largeLMPs * currentSettings.lmpMultipliers.large / 60).toFixed(2)} hrs
                        </div>
                      )}
                    </div>
                  <div className="form-group">
                    <label htmlFor="mediumLMPs">Medium</label>
                    <input
                      type="number"
                      id="mediumLMPs"
                      name="mediumLMPs"
                      value={formData.mediumLMPs || 0}
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
                      value={formData.smallLMPs || 0}
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
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="arp8">ARP 8</label>
                    <input
                      type="number"
                      id="arp8"
                      name="arp8"
                      value={formData.arp8 || 0}
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
                      value={formData.arp16 || 0}
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
                      value={formData.arp32 || 0}
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
                      value={formData.arp48 || 0}
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
                <div className="form-group">
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        name="esheetsSchedules"
                        value={2}
                        checked={formData.esheetsSchedules === 2}
                        onChange={() => handleEsheetsChange('2')}
                      />
                      No
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="esheetsSchedules"
                        value={1}
                        checked={formData.esheetsSchedules === 1}
                        onChange={() => handleEsheetsChange('1')}
                      />
                      Yes
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Layout Fields - Show when hasSubmittals = false OR (hasSubmittals = true AND needsLayoutBOM = true) */}
          {(!formData.hasSubmittals || (formData.hasSubmittals && formData.needsLayoutBOM)) && (
            <div className="layout-fields">
              <h5>Layout Fields:</h5>
              <div className="form-grid">
                                  <div className="form-group enhanced-field">
                    <label htmlFor="numOfRooms">
                      # of Rooms:
                      <span 
                        className="help-icon"
                        onMouseEnter={() => showTooltip('numOfRooms')}
                        onMouseLeave={() => hideTooltip('numOfRooms')}
                      >
                        ❓
                      </span>
                    </label>
                    <input
                      type="number"
                      id="numOfRooms"
                      name="numOfRooms"
                      value={formData.numOfRooms || 0}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                      className={validationErrors.rooms ? 'error' : ''}
                    />
                    <span className="field-hint">(qty of rooms)</span>
                    {validationErrors.rooms && <span className="error-message">{validationErrors.rooms}</span>}
                    {showTooltips.numOfRooms && (
                      <div className="tooltip">
                        {getTooltipContent('numOfRooms')}
                      </div>
                    )}
                    {formData.numOfRooms > 0 && formData.roomMultiplier && (
                      <div className="field-preview">
                        {formData.numOfRooms} rooms × {formData.roomMultiplier} min = {(formData.numOfRooms * formData.roomMultiplier / 60).toFixed(2)} hrs
                      </div>
                    )}
                  </div>
                <div className="form-group">
                  <label htmlFor="overrideRooms">Override:</label>
                  <input
                    type="number"
                    id="overrideRooms"
                    name="overrideRooms"
                    value={formData.overrideRooms || 0}
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
                    value={formData.roomMultiplier || 2}
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
                    value={formData.reviewSetup || 0.5}
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
                    value={formData.numOfPages || 1}
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
                    value={formData.specReview || 0}
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
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="numOfSubRooms"># of Rooms:</label>
                  <input
                    type="number"
                    id="numOfSubRooms"
                    name="numOfSubRooms"
                    value={formData.numOfSubRooms || 0}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="0"
                    className={validationErrors.subRooms ? 'error' : ''}
                  />
                  <span className="field-hint">(qty. of rooms)</span>
                  {validationErrors.subRooms && <span className="error-message">{validationErrors.subRooms}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="riserMultiplier">Riser Multiplier:</label>
                  <input
                    type="number"
                    id="riserMultiplier"
                    name="riserMultiplier"
                    value={formData.riserMultiplier || 1}
                    onChange={handleInputChange}
                    min="0"
                    step="0.5"
                    placeholder="1"
                  />
                  <span className="field-hint">(min/room)</span>
                </div>
                <div className="form-group">
                  <label htmlFor="soo">Sequence of Operation:</label>
                  <input
                    type="number"
                    id="soo"
                    name="soo"
                    value={formData.soo || 0.5}
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

        {/* PRESERVED: Photometrics Section from ProjectForm.jsx lines 1204-1221 */}
        {formData.showPhotometrics && (
          <div className="triage-subsection">
            <h4>Photometrics:</h4>
            <div className="form-group">
              <label htmlFor="photoSoftware">Photo Software:</label>
              <select
                id="photoSoftware"
                name="photoSoftware"
                value={formData.photoSoftware || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Software</option>
                {(dropdownOptions.photoSoftware || []).map(software => (
                  <option key={software} value={software}>{software}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* PRESERVED: Triage Results Section from ProjectForm.jsx lines 1224-1270 */}
        <div className="triage-subsection">
          <h4>Triage Results:</h4>
          <div className="form-grid">
            <div className="form-group">
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
            <div className="form-group">
              <label htmlFor="fluff">Fluff:</label>
              <input
                type="number"
                id="fluff"
                name="fluff"
                value={formData.fluff || 0}
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
                value={formData.totalTriage || 0}
                onChange={handleInputChange}
                min="0"
                step="0.25"
                placeholder="0.0"
              />
              <span className="field-hint">(hr) - Auto-calculated, can be overridden</span>
            </div>
          </div>
        </div>

        {/* PRESERVED: First Available Section from ProjectForm.jsx lines 1273-1298 */}
        <div className="triage-subsection">
          <h4>Assignment:</h4>
          <div className="form-group">
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="firstAvailable"
                  value={false}
                  checked={!formData.firstAvailable}
                  onChange={() => handleFirstAvailableChange('false')}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="firstAvailable"
                  value={true}
                  checked={formData.firstAvailable}
                  onChange={() => handleFirstAvailableChange('true')}
                />
                Yes
              </label>
            </div>
            <span className="field-hint">: Assign to first available (Do this last)</span>
          </div>
        </div>

        {/* Real-Time Preview */}
        {realTimePreview && !triageResults && (
          <div className="real-time-preview">
            <h4>📊 Live Preview</h4>
            <div className="preview-breakdown">
              <div className="preview-grid">
                {realTimePreview.showLayoutFields && (
                  <div className="preview-item">
                    <span className="preview-label">Layout:</span>
                    <span className="preview-value">{realTimePreview.layoutTime} hrs</span>
                  </div>
                )}
                {realTimePreview.showSubmittalFields && (
                  <div className="preview-item">
                    <span className="preview-label">Submittal:</span>
                    <span className="preview-value">{realTimePreview.submittalTime} hrs</span>
                  </div>
                )}
                {realTimePreview.showPanelFields && (
                  <div className="preview-item">
                    <span className="preview-label">Panel:</span>
                    <span className="preview-value">{realTimePreview.panelTime} hrs</span>
                  </div>
                )}
                <div className="preview-item total">
                  <span className="preview-label">Estimated Total:</span>
                  <span className="preview-value">{realTimePreview.totalTriage} hrs</span>
                </div>
              </div>
              <div className="preview-note">
                💡 This is a live preview. Click "Calculate Triage" for the final breakdown.
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Calculate Button */}
        <div className="triage-actions">
          <button
            type="button"
            onClick={calculateTriage}
            disabled={isCalculating || !getStepCompletionStatus().fieldsComplete}
            className="btn btn-primary calculate-btn"
          >
            {isCalculating ? (
              <>
                <span className="spinner"></span>
                Calculating...
              </>
            ) : (
              <>
                🧮 Calculate Triage
              </>
            )}
          </button>
          
          {calculationHistory.length > 0 && (
            <div className="calculation-history">
              <small>Previous calculations: {calculationHistory.length}</small>
            </div>
          )}
        </div>

        {/* Validation Errors */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="validation-errors">
            {Object.values(validationErrors).map((error, index) => (
              <div key={index} className="error-message">⚠️ {error}</div>
            ))}
          </div>
        )}

        {/* PRESERVED: Triage Results Display from ProjectForm.jsx lines 1312-1366 */}
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

        {/* Step Progress Summary */}
        <div className="step-summary">
          <div className="summary-header">
            <h4>Step 2 Progress</h4>
            <div className="completion-indicator">
              {getStepCompletionStatus().overallComplete ? (
                <span className="complete">✅ Complete</span>
              ) : (
                <span className="incomplete">⏳ In Progress</span>
              )}
            </div>
          </div>
          
          <div className="progress-checklist">
            <div className={`checklist-item ${getStepCompletionStatus().configComplete ? 'complete' : ''}`}>
              <span className="checkbox">{getStepCompletionStatus().configComplete ? '✅' : '☐'}</span>
              <span>Triage configuration set (Panel Schedules & Submittal decisions)</span>
            </div>
            <div className={`checklist-item ${getStepCompletionStatus().fieldsComplete ? 'complete' : ''}`}>
              <span className="checkbox">{getStepCompletionStatus().fieldsComplete ? '✅' : '☐'}</span>
              <span>Required fields completed based on configuration</span>
            </div>
            <div className={`checklist-item ${getStepCompletionStatus().calculationComplete ? 'complete' : ''}`}>
              <span className="checkbox">{getStepCompletionStatus().calculationComplete ? '✅' : '☐'}</span>
              <span>Triage calculation performed and results reviewed</span>
            </div>
          </div>

          {getStepCompletionStatus().overallComplete && (
            <div className="completion-message">
              🎉 Triage calculation complete! Total estimated time: <strong>{formData.totalTriage} hours</strong>
              <br />
              Ready to proceed to project management.
            </div>
          )}
        </div>
      </div>
    </WizardLayout>
  );
};

export default ProjectWizardStep2;
