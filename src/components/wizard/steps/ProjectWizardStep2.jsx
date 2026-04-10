import React, { useState, useEffect, useRef } from 'react';
import WizardLayout from '../components/WizardLayout';
import dropdownOptionsService from '../../../services/DropdownOptionsService';
import triageCalculationService from '../../../services/TriageCalculationService';
import SmartAssignmentService from '../../../services/SmartAssignmentService';
import workloadPersistenceAdapter from '../../../services/WorkloadPersistenceAdapter';
import { getUserTimezone } from '../../../utils/dateUtils';

// Tooltip Component
const Tooltip = ({ text, children }) => (
  <span className="group relative inline-flex">
    {children}
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-gray-100 dark:text-gray-900">
      {text}
    </span>
  </span>
);

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    let startTime = null;
    const startValue = 0;
    const endValue = value;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuad = progress * (2 - progress); // Ease out animation
      setDisplayValue(Math.floor(startValue + (endValue - startValue) * easeOutQuad));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  return <>{displayValue}</>;
};

// Confetti Component
const Confetti = ({ active }) => {
  if (!active) return null;

  const colors = ['#007239', '#004d32', '#409f68', '#0099d8', '#000000', '#485865'];
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  return (
    <div className="confetti-container">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`
          }}
        />
      ))}
    </div>
  );
};

/**
 * ProjectWizardStep2 - Simplified Triage Calculation
 * DIRECT COPY from working ProjectForm.jsx triage section (lines 790-1367)
 * Prioritizes functionality over optimization
 */
const ProjectWizardStep2 = ({
  formData,
  existingProjects = [],
  currentProjectId = null,
  onFormDataChange,
  errors = {},
  onFieldError,
  onFieldTouch,
  onValidationChange,
  onNavigateToSettings,
  onAssigneeSelected, // NEW: callback to pass selected assignee to parent
  onWizardReset
}) => {
  // Simple state - no complex optimizations
  // Initialize triageResults from formData if totalTriage exists
  const [triageResults, setTriageResults] = useState(() => {
    if (formData.totalTriage && formData.totalTriage > 0) {
      return {
        totalTriage: formData.totalTriage || 0,
        panelTime: formData.panelTime || 0,
        layoutTime: formData.layoutTime || 0,
        submittalTime: formData.submittalTime || 0,
        pageBonus: formData.pageBonus || 0,
        baseTotal: formData.baseTotal || 0,
        selfQC: formData.selfQC || 0,
        fluff: formData.fluff || 0
      };
    }
    return null;
  });
  const [dropdownOptions, setDropdownOptions] = useState(dropdownOptionsService.getOptions());
  
  // Smart Assignment state
  const [recommendations, setRecommendations] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [revisionDesignerSuggestion, setRevisionDesignerSuggestion] = useState('');
  const formDataRef = useRef(formData);

  const getAverageProductKnowledge = (user) => {
    if (user && typeof user.getAverageProductKnowledge === 'function') {
      return user.getAverageProductKnowledge();
    }

    const productKnowledge = user?.productKnowledge;
    if (productKnowledge && typeof productKnowledge === 'object') {
      const knowledgeValues = Object.values(productKnowledge).filter((value) => Number.isFinite(Number(value)));
      const averageKnowledge = knowledgeValues.length > 0
        ? knowledgeValues.reduce((sum, value) => sum + Number(value), 0) / knowledgeValues.length
        : 0;
      return averageKnowledge;
    }

    return 0;
  };

  const getCardMatchClasses = (matchLevel) => {
    switch (matchLevel) {
      case 'excellent':
        return 'border-success-300 bg-success-50/70 hover:border-success-400 dark:border-success-700 dark:bg-success-900/20 dark:hover:border-success-600';
      case 'good':
        return 'border-info-300 bg-info-50/70 hover:border-info-400 dark:border-info-700 dark:bg-info-900/20 dark:hover:border-info-600';
      case 'fair':
        return 'border-warning-300 bg-warning-50/70 hover:border-warning-400 dark:border-warning-700 dark:bg-warning-900/20 dark:hover:border-warning-600';
      default:
        return 'border-gray-300 bg-gray-50/70 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800/70 dark:hover:border-gray-500';
    }
  };

  const normalizeText = (value) => String(value || '').trim().toLowerCase();

  const findPreviousRevisionDesigner = (projectData) => {
    if (!projectData?.isRevision || !Array.isArray(existingProjects) || existingProjects.length === 0) {
      return null;
    }

    const normalizedPrevPath = normalizeText(projectData.previousRevisionPath);
    const normalizedProjectName = normalizeText(projectData.projectName);
    const normalizedContainer = normalizeText(projectData.projectContainer);

    const candidates = existingProjects.filter((project) =>
      project &&
      project.id !== currentProjectId &&
      project.designBy &&
      String(project.designBy).trim()
    );

    if (normalizedPrevPath) {
      const directMatch = candidates.find((project) => normalizeText(project.rfaPath) === normalizedPrevPath);
      if (directMatch) {
        return {
          designerName: directMatch.designBy.trim(),
          source: 'previous_revision',
          projectId: directMatch.id || ''
        };
      }
    }

    const related = candidates.filter((project) =>
      normalizeText(project.projectName) === normalizedProjectName &&
      normalizeText(project.projectContainer) === normalizedContainer
    );

    if (related.length === 0) {
      return null;
    }

    related.sort((a, b) => {
      const dateA = new Date(a.lastModified || a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.lastModified || b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return {
      designerName: related[0].designBy.trim(),
      source: 'previous_revision',
      projectId: related[0].id || ''
    };
  };

  const handleAssigneeSelection = (user, sourceFormData = formDataRef.current) => {
    if (!user) return;

    setSelectedAssignee(user);
    if (onAssigneeSelected) {
      onAssigneeSelected(user);
    }

    // Keep Design By synchronized with the active recommendation choice.
    onFormDataChange({
      ...sourceFormData,
      designBy: user.name || ''
    });
  };

  // Load dropdown options (simple version)
  useEffect(() => {
    const loadOptions = async () => {
      await dropdownOptionsService.loadFromSettings();
      setDropdownOptions(dropdownOptionsService.getOptions());
    };
    
    loadOptions();
    
    // Listen for option changes
    const unsubscribe = dropdownOptionsService.addListener((newOptions) => {
      setDropdownOptions(newOptions);
    });
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Watch for changes in formData.totalTriage and update triageResults accordingly
  useEffect(() => {
    if (formData.totalTriage && formData.totalTriage > 0 && (!triageResults || triageResults.totalTriage !== formData.totalTriage)) {
      setTriageResults({
        totalTriage: formData.totalTriage || 0,
        panelTime: formData.panelTime || 0,
        layoutTime: formData.layoutTime || 0,
        submittalTime: formData.submittalTime || 0,
        pageBonus: formData.pageBonus || 0,
        baseTotal: formData.baseTotal || 0,
        selfQC: formData.selfQC || 0,
        fluff: formData.fluff || 0
      });
    }
  }, [formData.totalTriage, formData.panelTime, formData.layoutTime, formData.submittalTime, 
      formData.pageBonus, formData.baseTotal, formData.selfQC, formData.fluff, triageResults]);

  // Auto-validate step when formData changes or triageResults are calculated
  useEffect(() => {
    // Step 2 is valid only after triage has been calculated.
    const hasCalculatedTriage = Boolean(
      (triageResults && triageResults.totalTriage > 0) ||
      (formData.totalTriage && formData.totalTriage > 0)
    );
    const isValid = hasCalculatedTriage;
    
    if (onValidationChange) {
      onValidationChange(isValid, isValid ? {} : { 
        step2: ['Please calculate triage time before continuing'] 
      });
    }
  }, [formData, triageResults, onValidationChange]);

  // TIMING FIX: Maintain validation state even after delays
  // Re-validate periodically if we have valid triage results to prevent stale state issues
  useEffect(() => {
    if (!triageResults || triageResults.totalTriage <= 0) return;
    
    // Set up periodic validation refresh to maintain valid state
    const validationRefreshInterval = setInterval(() => {
      if (onValidationChange && triageResults && triageResults.totalTriage > 0) {
        console.log('Step 2: Refreshing validation state to prevent timeout issues');
        onValidationChange(true, {}); // Maintain valid state
      }
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(validationRefreshInterval);
  }, [triageResults, onValidationChange]);

  // Load smart assignment recommendations
  const loadRecommendations = async (triageData, sourceFormData = formDataRef.current) => {
    setLoadingRecommendations(true);
    try {
      const smartAssignmentService = new SmartAssignmentService(workloadPersistenceAdapter);
      
      // Build project details from formData and triage results
      const projectDetails = {
        totalHours: triageData.totalTriage || 0,
        complexity: sourceFormData.complexity || 'medium',
        products: sourceFormData.products || [],
        dueDate: sourceFormData.dueDate,
        priority: sourceFormData.priority || 'medium',
        rfaType: sourceFormData.rfaType,
        regionalTeam: sourceFormData.regionalTeam
      };

      const topRecommendations = await smartAssignmentService.getRecommendations(projectDetails, 3);
      const previousRevisionDesigner = findPreviousRevisionDesigner(sourceFormData);
      const currentDesignBy = normalizeText(sourceFormData.designBy);

      let prioritizedRecommendations = [...topRecommendations];
      if (previousRevisionDesigner) {
        setRevisionDesignerSuggestion(previousRevisionDesigner.designerName);
        const preferredIndex = prioritizedRecommendations.findIndex(
          (rec) => normalizeText(rec?.user?.name) === normalizeText(previousRevisionDesigner.designerName)
        );
        if (preferredIndex > 0) {
          const [preferredRecommendation] = prioritizedRecommendations.splice(preferredIndex, 1);
          prioritizedRecommendations.unshift(preferredRecommendation);
        }
      } else {
        setRevisionDesignerSuggestion('');
      }

      setRecommendations(prioritizedRecommendations);

      // Auto-select recommendation if Design By is still blank.
      if (!currentDesignBy && prioritizedRecommendations.length > 0) {
        const preferredRecommendation = previousRevisionDesigner
          ? prioritizedRecommendations.find(
              (rec) => normalizeText(rec?.user?.name) === normalizeText(previousRevisionDesigner.designerName)
            )
          : null;

        if (preferredRecommendation) {
          const nextFormData = {
            ...sourceFormData,
            recommendedDesignBy: previousRevisionDesigner.designerName,
            recommendedDesignBySource: previousRevisionDesigner.source,
            recommendedDesignByConfidence: 'high',
            revisionSourceProjectId: previousRevisionDesigner.projectId
          };
          handleAssigneeSelection(preferredRecommendation.user, nextFormData);
        } else if (previousRevisionDesigner) {
          onFormDataChange({
            ...sourceFormData,
            designBy: previousRevisionDesigner.designerName,
            recommendedDesignBy: previousRevisionDesigner.designerName,
            recommendedDesignBySource: previousRevisionDesigner.source,
            recommendedDesignByConfidence: 'medium',
            revisionSourceProjectId: previousRevisionDesigner.projectId
          });
        } else {
          const topUser = prioritizedRecommendations[0].user;
          handleAssigneeSelection(topUser, sourceFormData);
        }

        // Trigger confetti celebration for finding perfect match
        if (prioritizedRecommendations[0].matchLevel === 'excellent') {
          setTimeout(() => {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setRecommendations([]);
      setRevisionDesignerSuggestion('');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Simple input handler - DIRECT COPY from ProjectForm.jsx
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    const newFormData = { ...formData, [name]: processedValue };
    onFormDataChange(newFormData);
    
    // Clear field error when user modifies field
    if (onFieldError && errors[name]) {
      onFieldError(name, null);
    }
    
    // Mark field as touched
    if (onFieldTouch) {
      onFieldTouch(name);
    }
  };

  // Simple triage calculation - DIRECT COPY from ProjectForm.jsx
  const calculateTriage = async () => {
    // Use the triage calculation service to get accurate results
    const triageCalculationResults = triageCalculationService.calculateTriage(formData);
    
    console.log('Step 2: Triage calculation completed:', {
      totalTriage: triageCalculationResults.totalTriage,
      baseTotal: triageCalculationResults.baseTotal,
      selfQC: triageCalculationResults.selfQC,
      fluff: triageCalculationResults.fluff
    });
    
    // Update form data with calculated values
    const updatedFormData = {
      ...formData,
      totalTriage: triageCalculationResults.totalTriage,
      panelTime: triageCalculationResults.panelTime,
      layoutTime: triageCalculationResults.layoutTime,
      submittalTime: triageCalculationResults.submittalTime,
      pageBonus: triageCalculationResults.pageBonus,
      baseTotal: triageCalculationResults.baseTotal,
      selfQC: triageCalculationResults.selfQC,
      fluff: triageCalculationResults.fluff
    };
    
    // CRITICAL: Update both local state and parent formData synchronously
    setTriageResults(triageCalculationResults);
    onFormDataChange(updatedFormData);
    
    console.log('Step 2: Updated formData with triage results:', {
      hasTotalTriage: updatedFormData.totalTriage > 0,
      totalTriage: updatedFormData.totalTriage
    });
    
    // Load smart assignment recommendations after triage calculation
    await loadRecommendations(triageCalculationResults, updatedFormData);
    
    // Mark Step 2 as completed and valid after successful triage calculation
    // CRITICAL: Explicitly set validation to ensure button enablement
    if (onValidationChange && triageCalculationResults.totalTriage > 0) {
      console.log('Step 2: Setting validation to TRUE - step is now valid');
      onValidationChange(true, {}); // Step 2 is now valid and complete
    }
  };

  const handleStartFresh = () => {
    if (onWizardReset) {
      onWizardReset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <WizardLayout
      title="Triage & Complete"
      subtitle="Configure calculations and complete project creation"
      step={2}
      totalSteps={2}
      actions={
        <button
          type="button"
          onClick={handleStartFresh}
          className="px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-lg transition-all"
        >
          🗑️ Start Fresh
        </button>
      }
    >
      <Confetti active={showConfetti} />
      <div className="px-4 py-3 space-y-4">
        {/* Project Context Summary - Styled Card */}
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-l-4 border-primary-500 rounded-lg p-3 shadow">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              📁 {formData.projectName || 'Untitled Project'}
            </h4>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                <strong className="text-gray-600 dark:text-gray-400">RFA:</strong> <span className="text-gray-900 dark:text-white font-semibold">{formData.rfaNumber || 'N/A'}</span>
              </span>
              <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                <strong className="text-gray-600 dark:text-gray-400">Type:</strong> <span className="text-gray-900 dark:text-white font-semibold">{formData.rfaType || 'Not Selected'}</span>
              </span>
              <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                <strong className="text-gray-600 dark:text-gray-400">Agent:</strong> <span className="text-gray-900 dark:text-white font-semibold">{formData.agentNumber || 'N/A'}</span>
              </span>
              <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                <strong className="text-gray-600 dark:text-gray-400">Team:</strong> <span className="text-gray-900 dark:text-white font-semibold">{formData.regionalTeam || 'N/A'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Settings Button - Compact */}
        <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">⚙️ Triage Calculation Settings</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Configure multipliers, defaults, and calculation parameters</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onNavigateToSettings) {
                onNavigateToSettings('triage-calc');
              } else {
                console.warn('Navigation function not provided');
              }
            }}
            className="px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded transition-all"
          >
            Open Settings
          </button>
        </div>

        {/* Optimized Triage Configuration - Compact Layout */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Triage Configuration</h4>
          
          <div className="config-grid">
            {/* Panel Schedules Question */}
            <div className="config-item">
              <h5>Panel Schedules:</h5>
              <div className="radio-group">
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
            </div>

            {/* Submittal Section Question */}
            <div className="config-item">
              <h5>Submittal Section:</h5>
              <div className="radio-group">
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
            </div>

            {/* Conditional Layout/BOM Question */}
            {formData.hasSubmittals && (
              <div className="config-item">
                <h5>Layout/BOM:</h5>
                <div className="radio-group">
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
              </div>
            )}
          </div>
        </div>

        {formData.dasPaidServiceEnabled && (
          <div className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-primary-200 dark:border-primary-800 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Lighting Pages (Paid Services)</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Keep this in sync with the DAS paid services fee calculation.
                </p>
              </div>
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                {formData.dasLightingPages || 0} pages × {formData.dasCostPerPage || 0} = {formData.dasFee || 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Lighting pages
              </label>
              <input
                type="number"
                min="0"
                step="1"
                name="dasLightingPages"
                value={formData.dasLightingPages || 0}
                onChange={handleInputChange}
                className="input w-32"
              />
            </div>
          </div>
        )}

        {/* DIRECT COPY: Dynamic Triage Fields from ProjectForm.jsx lines 916-1201 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Triage Calculation Fields</h4>
          
          {/* Panel Schedule Fields - Show only when hasPanelSchedules = true */}
          {formData.hasPanelSchedules && (
            <div className="panel-fields">
              <h5>Panel Schedule Fields:</h5>
              
              <div className="grid grid-cols-3 gap-4 lg:grid-cols-2 md:grid-cols-1">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">LMPs:</h6>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="form-group">
                      <label htmlFor="largeLMPs">Large</label>
                      <input
                        type="number"
                        id="largeLMPs"
                        name="largeLMPs"
                        value={formData.largeLMPs || ''}
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
                        value={formData.mediumLMPs || ''}
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
                        value={formData.smallLMPs || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">nLight ARPs:</h6>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="form-group">
                      <label htmlFor="arp8">ARP 8</label>
                      <input
                        type="number"
                        id="arp8"
                        name="arp8"
                        value={formData.arp8 || ''}
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
                        value={formData.arp16 || ''}
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
                        value={formData.arp32 || ''}
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
                        value={formData.arp48 || ''}
                        onChange={handleInputChange}
                        min="0"
                        step="1"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-span-full p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Panel Schedules (Shown on E-Sheets):</h6>
                <div className="flex gap-5">
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
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="numOfRooms"># of Rooms:</label>
                  <input
                    type="number"
                    id="numOfRooms"
                    name="numOfRooms"
                    value={formData.numOfRooms || ''}
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
                    value={formData.overrideRooms || ''}
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
                    value={formData.reviewSetup || ''}
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
                    value={formData.numOfPages || ''}
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
                    value={formData.specReview || ''}
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
                    value={formData.numOfSubRooms || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                  <span className="field-hint">(qty. of rooms)</span>
                </div>
                <div className="form-group">
                  <label htmlFor="riserMultiplier">Riser Multiplier:</label>
                  <input
                    type="number"
                    id="riserMultiplier"
                    name="riserMultiplier"
                    value={formData.riserMultiplier || ''}
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
                    value={formData.soo || ''}
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

        {/* DIRECT COPY: Photometrics Section from ProjectForm.jsx lines 1203-1221 */}
        {formData.showPhotometrics && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Photometrics:</h4>
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

        {/* DIRECT COPY: Triage Results from ProjectForm.jsx lines 1224-1270 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Triage Results:</h4>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="selfQC">Self QC:</label>
              <input
                type="number"
                id="selfQC"
                name="selfQC"
                value={formData.selfQC || ''}
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
                value={formData.fluff || ''}
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
                value={formData.totalTriage || ''}
                onChange={handleInputChange}
                min="0"
                step="0.25"
                placeholder="0.0"
              />
              <span className="field-hint">(hr) - Auto-calculated, can be overridden</span>
            </div>
          </div>
        </div>

        {/* DIRECT COPY: Assignment section from ProjectForm.jsx lines 1272-1298 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Assignment:</h4>
          {!formData.designBy && (
            <div className="mb-3 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-200">
              Assign <strong>Design By</strong> during triage so completion is not blocked later.
            </div>
          )}
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

        {/* DIRECT COPY: Calculate Button from ProjectForm.jsx lines 1300-1310 */}
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={calculateTriage}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg shadow-lg transition-all flex items-center gap-2"
          >
            🧮 Calculate Triage
          </button>
        </div>

        {/* Simplified Triage Results Display */}
        {triageResults && (
          <div className="bg-gradient-to-r from-success-50 to-green-50 dark:from-success-900/20 dark:to-green-900/20 border-l-4 border-success-500 rounded-lg p-4 shadow">
            <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              ⏱️ Estimated Project Time
            </h4>
            <div className="space-y-3">
              {/* Total Time - Prominent Display */}
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border-2 border-success-500 dark:border-success-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Estimated Time:</span>
                  <span className="text-2xl font-bold text-success-600 dark:text-success-400">{triageResults.totalTriage.toFixed(1)} hours</span>
                </div>
              </div>
              
              {/* Breakdown - Compact */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-600 dark:text-gray-400">Base Calc:</div>
                  <div className="font-bold text-gray-900 dark:text-white">{triageResults.baseTotal.toFixed(1)} hr</div>
                </div>
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-600 dark:text-gray-400">QC:</div>
                  <div className="font-bold text-gray-900 dark:text-white">{triageResults.selfQC.toFixed(1)} hr</div>
                </div>
                <div className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="text-gray-600 dark:text-gray-400">Buffer:</div>
                  <div className="font-bold text-gray-900 dark:text-white">{triageResults.fluff.toFixed(1)} hr</div>
                </div>
              </div>
              
              {/* Success Indicator */}
              <div className="flex items-center gap-2 p-2 bg-success-100 dark:bg-success-900/30 rounded text-success-800 dark:text-success-200 text-sm">
                <span className="text-lg">✅</span>
                <span className="font-medium">Triage calculation complete! Ready to create project.</span>
              </div>
            </div>
          </div>
        )}

        {/* Smart Assignment Recommendations */}
        {triageResults && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                🎯 Recommended Assignees
              </h4>
              {revisionDesignerSuggestion && (
                <p className="mt-2 rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-xs text-primary-800 dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-200">
                  Suggested from prior revision: <strong>{revisionDesignerSuggestion}</strong>
                </p>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Based on availability, expertise, and project requirements
              </p>
            </div>

            {loadingRecommendations ? (
              <>
                <p className="mb-5 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  <span className="text-lg">🔍</span>
                  Analyzing team availability and expertise...
                </p>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/70">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="h-9 w-14 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="h-3 rounded bg-gray-200 dark:bg-gray-700"></div>
                        <div className="h-3 w-11/12 rounded bg-gray-200 dark:bg-gray-700"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : recommendations.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {recommendations.map((rec, index) => (
                  <div
                    key={rec.user.id}
                    className={`relative cursor-pointer rounded-lg border p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      getCardMatchClasses(rec.matchLevel)
                    } ${
                      selectedAssignee?.id === rec.user.id
                        ? 'ring-2 ring-primary-500 border-primary-500 dark:ring-primary-400 dark:border-primary-500'
                        : ''
                    }`}
                    onClick={() => {
                      handleAssigneeSelection(rec.user);
                      // Trigger confetti for top pick selection
                      if (index === 0) {
                        setShowConfetti(true);
                        setTimeout(() => setShowConfetti(false), 3000);
                      }
                    }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                          {index === 0 && (
                            <span className="inline-flex items-center rounded-full border border-warning-300 bg-warning-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-800 dark:border-warning-700 dark:bg-warning-900/40 dark:text-warning-200">
                              ⭐ Top Pick
                            </span>
                          )}
                          {rec.user.name}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{rec.user.position}</div>
                      </div>
                      <Tooltip text="Overall match score based on availability, experience, and product knowledge">
                        <div className="flex min-w-[56px] flex-col items-center rounded-lg border border-primary-200 bg-primary-100 px-2 py-1 text-primary-800 shadow-sm dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                          <AnimatedCounter value={Math.round(rec.score)} duration={800} />
                          <span className="text-[10px] font-semibold uppercase tracking-wide">Score</span>
                        </div>
                      </Tooltip>
                    </div>

                    <div className="space-y-2">
                      <Tooltip text="Available hours this week (40% of total score)">
                        <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white/80 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800/80">
                          <span className="text-sm">📊</span>
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            Availability: {rec.availableHours.toFixed(0)}h available
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {rec.breakdown.availability.toFixed(0)}%
                          </span>
                        </div>
                      </Tooltip>
                      <Tooltip text="Experience level matched to project complexity (30% of total score)">
                        <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white/80 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800/80">
                          <span className="text-sm">🎓</span>
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            Experience: {rec.user.position.includes('Senior') ? 'Senior' : rec.user.position.includes('Lead') ? 'Lead' : 'Junior'}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {rec.breakdown.seniority.toFixed(0)}%
                          </span>
                        </div>
                      </Tooltip>
                      <Tooltip text="Expertise in required products (30% of total score)">
                        <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white/80 px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800/80">
                          <span className="text-sm">🔧</span>
                          <span className="flex-1 text-gray-700 dark:text-gray-300">
                            Product Knowledge: {getAverageProductKnowledge(rec.user).toFixed(1)}/5
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {rec.breakdown.productKnowledge.toFixed(0)}%
                          </span>
                        </div>
                      </Tooltip>
                    </div>

                    <div className="mt-3 rounded-md border border-gray-200 bg-white/70 p-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                      <p>{rec.reasoning}</p>
                    </div>

                    {selectedAssignee?.id === rec.user.id && (
                      <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-success-300 bg-success-100 px-2 py-1 text-xs font-semibold text-success-800 dark:border-success-700 dark:bg-success-900/30 dark:text-success-200">
                        ✓ Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-5 text-center text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-200">
                <div className="mb-2 text-2xl">🤷‍♂️</div>
                <p className="font-semibold">No team members available at this time</p>
                <p className="mt-2 text-xs">
                  💡 <strong>Tip:</strong> Make sure users have set up their profiles in<br />
                  Settings → Workload Dashboard → User Profile
                </p>
              </div>
            )}

            {selectedAssignee && (
              <div className="mt-3 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-800 dark:border-success-700 dark:bg-success-900/20 dark:text-success-200">
                <p className="font-medium">
                  <strong>{selectedAssignee.name}</strong> will be assigned to this project upon creation.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </WizardLayout>
  );
};

export default ProjectWizardStep2;