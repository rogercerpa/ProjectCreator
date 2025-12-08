import React, { useState, useEffect } from 'react';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';
import EditableProductTags from './EditableProductTags';
import DASPaidServicesSection from './shared/DASPaidServicesSection';
import { openPaidServicesEmail } from '../utils/emailTemplates';

/**
 * ProjectEditor - Edit mode for project information
 * Provides a comprehensive editing interface for all project fields
 * Similar to ProjectForm but optimized for editing existing projects
 */
const ProjectEditor = ({ 
  project, 
  onProjectDataChange, 
  onSave, 
  onCancel, 
  isSaving 
}) => {
  const [formData, setFormData] = useState(project || {});
  const [dropdownOptions, setDropdownOptions] = useState(dropdownOptionsService.getOptions());
  const [triageResults, setTriageResults] = useState(null);
  const [isCalculatingTriage, setIsCalculatingTriage] = useState(false);
  const [errors, setErrors] = useState({});
  const handleDasPaidServicesChange = (updatedData) => {
    setFormData(updatedData);
    onProjectDataChange(updatedData);
  };
  const handleRepEmailListChange = (nextList) => {
    const sanitizedList = (nextList || [])
      .map((entry) => ({
        email: (entry?.email || '').trim(),
        name: (entry?.name || '').trim(),
        agencyName: (entry?.agencyName || '').trim()
      }))
      .filter((entry) => entry.email);
    const updatedData = {
      ...formData,
      dasRepEmailList: sanitizedList,
      dasRepEmail: sanitizedList.map((entry) => entry.email).join('; ')
    };
    setFormData(updatedData);
    onProjectDataChange(updatedData);
  };
  const handlePaidServicesEmail = () => {
    const result = openPaidServicesEmail(formData);
    if (result.success) {
      window.alert('Outlook email drafted with paid services details.');
    } else if (result.missingFields?.length) {
      window.alert(`Add ${result.missingFields.join(', ')} to draft the email.`);
    }
  };

  // Load dropdown options
  useEffect(() => {
    const loadOptions = async () => {
      await dropdownOptionsService.loadFromSettings();
      setDropdownOptions(dropdownOptionsService.getOptions());
    };
    
    loadOptions();
    
    const unsubscribe = dropdownOptionsService.addListener((newOptions) => {
      setDropdownOptions(newOptions);
    });
    
    return unsubscribe;
  }, []);

  // Update form data when project changes
  useEffect(() => {
    if (project) {
      setFormData(project);
    }
  }, [project]);

  // Agency lookup: Auto-populate Agency Name when Agency Number is entered
  useEffect(() => {
    const lookupAgencyName = async () => {
      const agencyNumber = formData.agentNumber?.trim();
      
      // Skip if agency number is empty or agency name already matches
      if (!agencyNumber) {
        if (formData.agencyName) {
          // Clear agency name if agency number is cleared
          const newFormData = { ...formData, agencyName: '' };
          setFormData(newFormData);
          onProjectDataChange(newFormData);
        }
        return;
      }

      // Skip if we already have an agency name that matches (avoid unnecessary lookups)
      if (formData.agencyName && formData.agencyName.trim()) {
        return;
      }

      try {
        if (window.electronAPI?.agenciesSearch) {
          // Search for agency by agency number
          const result = await window.electronAPI.agenciesSearch(agencyNumber, { region: 'all', role: 'all' });
          
          if (result?.success && Array.isArray(result.agencies)) {
            // Find exact match by agency number
            const matchedAgency = result.agencies.find(
              agency => agency?.agencyNumber?.toLowerCase() === agencyNumber.toLowerCase()
            );
            
            if (matchedAgency?.agencyName) {
              const newFormData = { ...formData, agencyName: matchedAgency.agencyName };
              setFormData(newFormData);
              onProjectDataChange(newFormData);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to lookup agency name:', error);
      }
    };

    // Debounce the lookup to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      lookupAgencyName();
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.agentNumber]);

  // Helper function to convert datetime-local input value to ISO string
  const dateTimeInputToISO = (dateTimeValue) => {
    if (!dateTimeValue) return '';
    try {
      // datetime-local gives us "YYYY-MM-DDTHH:mm" in local timezone
      // Convert to ISO string preserving the time
      const date = new Date(dateTimeValue);
      return date.toISOString();
    } catch {
      return '';
    }
  };

  // Helper function to convert ISO string to datetime-local input format
  const isoToDateTimeInput = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      // Use local timezone to show the correct time to user
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    } else if (type === 'datetime-local') {
      // Convert datetime-local input to ISO string preserving time
      processedValue = dateTimeInputToISO(value);
    }
    
    const newFormData = { ...formData, [name]: processedValue };
    
    if (name === 'dasRepEmail') {
      const manualEmails = (processedValue || '')
        .split(/[;,]+/)
        .map((email) => email.trim())
        .filter(Boolean)
        .map((email) => ({ email, name: '', agencyName: '' }));
      newFormData.dasRepEmailList = manualEmails;
    }
    
    // Validate if status is changing to 'Completed'
    if (name === 'status' && processedValue === 'Completed') {
      if (!newFormData.projectNotes || newFormData.projectNotes.trim() === '') {
        setErrors(prev => ({ 
          ...prev, 
          projectNotes: 'Project Notes are required when marking a project as Completed' 
        }));
        // Prevent status change
        alert('Please add Project Notes before marking the project as Completed.');
        return;
      }
    }
    
    setFormData(newFormData);
    onProjectDataChange(newFormData);
    
    // Clear field error when user modifies field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Calculate triage
  const calculateTriage = () => {
    setIsCalculatingTriage(true);
    
    try {
      const triageCalculationResults = triageCalculationService.calculateTriage(formData);
      
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
      
      setFormData(updatedFormData);
      onProjectDataChange(updatedFormData);
      setTriageResults(triageCalculationResults);
    } catch (error) {
      console.error('Triage calculation failed:', error);
      setErrors(prev => ({ ...prev, triage: 'Failed to calculate triage. Please check your inputs.' }));
    } finally {
      setIsCalculatingTriage(false);
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    const requiredFields = ['projectName', 'rfaNumber', 'agentNumber', 'projectContainer', 'rfaType', 'regionalTeam'];
    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    if (formData.dasPaidServiceEnabled) {
      if (!formData.dasCostPerPage || Number(formData.dasCostPerPage) <= 0) {
        newErrors.dasCostPerPage = 'Cost per page must be greater than 0';
      }
      if (!formData.dasLightingPages || Number(formData.dasLightingPages) <= 0) {
        newErrors.dasLightingPages = 'Lighting pages is required';
      }
      if (!formData.dasFee || Number(formData.dasFee) <= 0) {
        newErrors.dasFee = 'Fee must be greater than 0';
      }
      if (!formData.dasRepEmail || formData.dasRepEmail.trim() === '') {
        newErrors.dasRepEmail = 'Rep email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.dasRepEmail.trim())) {
        newErrors.dasRepEmail = 'Rep email is invalid';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = () => {
    if (validateForm()) {
      onSave();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-8 py-8 max-w-[1400px] mx-auto w-full md:px-4 md:py-4 sm:px-2.5 sm:py-2.5 custom-scrollbar">
        {/* Project Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📋 Project Info</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectName">Project Name *</label>
              <input
                type="text"
                id="projectName"
                name="projectName"
                value={formData.projectName || ''}
                onChange={handleInputChange}
                className={errors.projectName ? 'error' : ''}
                placeholder="Enter project name"
              />
              {errors.projectName && <span className="error-message">{errors.projectName}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectType">Project Type</label>
              <select
                id="projectType"
                name="projectType"
                value={formData.projectType || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Project Type</option>
                {(dropdownOptions.projectTypes || []).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectAddress">Project Address</label>
              <input
                type="text"
                id="projectAddress"
                name="projectAddress"
                value={formData.projectAddress || ''}
                onChange={handleInputChange}
                placeholder="Enter project address"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectContainer">Project Container *</label>
              <input
                type="text"
                id="projectContainer"
                name="projectContainer"
                value={formData.projectContainer || ''}
                onChange={handleInputChange}
                className={errors.projectContainer ? 'error' : ''}
                placeholder="Enter project container"
              />
              {errors.projectContainer && <span className="error-message">{errors.projectContainer}</span>}
            </div>

            <div className="flex flex-col gap-1.5 col-span-full">
              <label htmlFor="projectNotes">
                Project Notes {formData.status === 'Completed' && <span className="required-indicator">*</span>}
              </label>
              <textarea
                id="projectNotes"
                name="projectNotes"
                value={formData.projectNotes || ''}
                onChange={handleInputChange}
                className={errors.projectNotes ? 'error' : ''}
                placeholder="Enter project notes or comments (required when marking as Completed)"
                rows="4"
              />
              {errors.projectNotes && <span className="error-message">{errors.projectNotes}</span>}
              <small className="field-hint">Required when marking project as Completed</small>
            </div>

            <div className="flex flex-col gap-1.5">
              <EditableProductTags
                label="Products"
                options={dropdownOptions.productOptions || []}
                selectedValues={Array.isArray(formData.products) ? formData.products : (formData.products ? [formData.products] : [])}
                onChange={(selectedProducts) => {
                  const newFormData = { ...formData, products: selectedProducts };
                  setFormData(newFormData);
                  onProjectDataChange(newFormData);
                }}
              />
              <small className="field-hint">Click on a product tag to remove it. Use the dropdown to add products.</small>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="projectStage">Project Stage</label>
              <select
                id="projectStage"
                name="projectStage"
                value={formData.projectStage || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Project Stage</option>
                {(dropdownOptions.projectStages || []).map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="designProcessPhase">Design Process Phase</label>
              <select
                id="designProcessPhase"
                name="designProcessPhase"
                value={formData.designProcessPhase || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Design Process Phase</option>
                {(dropdownOptions.designProcessPhases || []).map(phase => (
                  <option key={phase} value={phase}>{phase}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  id="buyAmericanOrBaba"
                  name="buyAmericanOrBaba"
                  checked={formData.buyAmericanOrBaba || false}
                  onChange={(e) => {
                    const newFormData = { ...formData, buyAmericanOrBaba: e.target.checked };
                    setFormData(newFormData);
                    onProjectDataChange(newFormData);
                  }}
                />
                Buy American or BABA
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="saveLocation">Project Folder Save Location</label>
              <select
                id="saveLocation"
                name="saveLocation"
                value={formData.saveLocation || 'Server'}
                onChange={handleInputChange}
              >
                {(dropdownOptions.saveLocations || []).map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Agency Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">🏢 Agency Info</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="agencyName">Agency Name</label>
              <input
                type="text"
                id="agencyName"
                name="agencyName"
                value={formData.agencyName || ''}
                onChange={handleInputChange}
                placeholder="Auto-populated from agency number"
                readOnly
                className="readonly-field"
              />
              <small className="field-hint">Automatically populated when Agency Number is entered</small>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="agentNumber">Agency Number *</label>
              <input
                type="text"
                id="agentNumber"
                name="agentNumber"
                value={formData.agentNumber || ''}
                onChange={handleInputChange}
                className={errors.agentNumber ? 'error' : ''}
                placeholder="Enter agency number"
              />
              {errors.agentNumber && <span className="error-message">{errors.agentNumber}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="repContacts">Agent Contact</label>
              <textarea
                id="repContacts"
                name="repContacts"
                value={formData.repContacts || ''}
                onChange={handleInputChange}
                placeholder="Enter agent contact information"
                rows="3"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="regionalTeam">Region *</label>
              <select
                id="regionalTeam"
                name="regionalTeam"
                value={formData.regionalTeam || ''}
                onChange={handleInputChange}
                className={errors.regionalTeam ? 'error' : ''}
              >
                <option value="">Select Region</option>
                {(dropdownOptions.regionalTeams || []).map(team => (
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
                value={formData.nationalAccount || 'Default'}
                onChange={handleInputChange}
              >
                {(dropdownOptions.nationalAccounts || []).map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* RFA Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📄 RFA Info</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaType">RFA Type *</label>
              <select
                id="rfaType"
                name="rfaType"
                value={formData.rfaType || ''}
                onChange={handleInputChange}
                className={errors.rfaType ? 'error' : ''}
              >
                <option value="">Select RFA Type</option>
                {(dropdownOptions.rfaTypes || []).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.rfaType && <span className="error-message">{errors.rfaType}</span>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label>Revision Type *</label>
              <div className="flex gap-5 mt-1 md:flex-col md:gap-2.5">
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value="false"
                    checked={!formData.isRevision}
                    onChange={() => {
                      const newFormData = { ...formData, isRevision: false };
                      setFormData(newFormData);
                      onProjectDataChange(newFormData);
                    }}
                  />
                  New Project
                </label>
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value="true"
                    checked={formData.isRevision}
                    onChange={() => {
                      const newFormData = { ...formData, isRevision: true };
                      setFormData(newFormData);
                      onProjectDataChange(newFormData);
                    }}
                  />
                  Revision
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaValue">RFA Value</label>
              <input
                type="number"
                id="rfaValue"
                name="rfaValue"
                value={formData.rfaValue || ''}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaStatus">RFA Status</label>
              <select
                id="rfaStatus"
                name="rfaStatus"
                value={formData.rfaStatus || ''}
                onChange={handleInputChange}
              >
                <option value="">Select RFA Status</option>
                {(dropdownOptions.rfaStatuses || []).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rfaComplexity">RFA Complexity</label>
              <select
                id="rfaComplexity"
                name="rfaComplexity"
                value={formData.rfaComplexity || ''}
                onChange={handleInputChange}
              >
                <option value="">Select RFA Complexity</option>
                {(dropdownOptions.rfaComplexityLevels || []).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* WorkTask Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">👥 WorkTask</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="triagedBy">Triaged By</label>
              <select
                id="triagedBy"
                name="triagedBy"
                value={formData.triagedBy || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Triaged By</option>
                {dropdownOptions.assignedToOptions?.map(person => (
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
                {dropdownOptions.assignedToOptions?.map(person => (
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
                {dropdownOptions.assignedToOptions?.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Important Dates Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📅 Important Dates</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="requestedDate">Requested Date & Time</label>
              <input
                type="datetime-local"
                id="requestedDate"
                name="requestedDate"
                value={isoToDateTimeInput(formData.requestedDate)}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ecd">ECD (Expected Completion Date & Time)</label>
              <input
                type="datetime-local"
                id="ecd"
                name="ecd"
                value={isoToDateTimeInput(formData.ecd)}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="submittedDate">Submitted Date & Time</label>
              <input
                type="datetime-local"
                id="submittedDate"
                name="submittedDate"
                value={isoToDateTimeInput(formData.submittedDate)}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="dueDate">Due Date & Time</label>
              <input
                type="datetime-local"
                id="dueDate"
                name="dueDate"
                value={isoToDateTimeInput(formData.dueDate)}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="neededByDate">Needed by Date & Time</label>
              <input
                type="datetime-local"
                id="neededByDate"
                name="neededByDate"
                value={isoToDateTimeInput(formData.neededByDate)}
                onChange={handleInputChange}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bidDate">Bid Date & Time</label>
              <input
                type="datetime-local"
                id="bidDate"
                name="bidDate"
                value={isoToDateTimeInput(formData.bidDate)}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* DAS Paid Services */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">💡 DAS Paid Services</h3>
          <DASPaidServicesSection
            formData={formData}
            onChange={handleDasPaidServicesChange}
            errors={errors}
            showEmailButton
            onRequestEmail={handlePaidServicesEmail}
            repEmailList={formData.dasRepEmailList}
            onRepEmailListChange={handleRepEmailListChange}
          />
        </div>

        {/* Triage Calculation Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">🧮 Triage Calculation</h3>
          
          {/* Total Triage - Prominent Display */}
          <div className="mb-6 p-5 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg border-2 border-primary-500 dark:border-primary-700">
            <label className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">Total Triage Time</label>
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">{formData.totalTriage || 0} hours</div>
          </div>

          {/* Configuration */}
          <div className="mb-6">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">⚙️ Configuration</h4>
            <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
              <div className="form-group">
                <label>Panel Schedules</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="hasPanelSchedules"
                      value="false"
                      checked={!formData.hasPanelSchedules}
                      onChange={() => {
                        const newFormData = { ...formData, hasPanelSchedules: false };
                        setFormData(newFormData);
                        onProjectDataChange(newFormData);
                      }}
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hasPanelSchedules"
                      value="true"
                      checked={formData.hasPanelSchedules}
                      onChange={() => {
                        const newFormData = { ...formData, hasPanelSchedules: true };
                        setFormData(newFormData);
                        onProjectDataChange(newFormData);
                      }}
                    />
                    Yes
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Submittal Section</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="hasSubmittals"
                      value="false"
                      checked={!formData.hasSubmittals}
                      onChange={() => {
                        const newFormData = { ...formData, hasSubmittals: false, needsLayoutBOM: false };
                        setFormData(newFormData);
                        onProjectDataChange(newFormData);
                      }}
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hasSubmittals"
                      value="true"
                      checked={formData.hasSubmittals}
                      onChange={() => {
                        const newFormData = { ...formData, hasSubmittals: true };
                        setFormData(newFormData);
                        onProjectDataChange(newFormData);
                      }}
                    />
                    Yes
                  </label>
                </div>
              </div>

              {formData.hasSubmittals && (
                <div className="form-group">
                  <label>Needs Layout/BOM</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        name="needsLayoutBOM"
                        value="false"
                        checked={!formData.needsLayoutBOM}
                        onChange={() => {
                          const newFormData = { ...formData, needsLayoutBOM: false };
                          setFormData(newFormData);
                          onProjectDataChange(newFormData);
                        }}
                      />
                      No
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="needsLayoutBOM"
                        value="true"
                        checked={formData.needsLayoutBOM}
                        onChange={() => {
                          const newFormData = { ...formData, needsLayoutBOM: true };
                          setFormData(newFormData);
                          onProjectDataChange(newFormData);
                        }}
                      />
                      Yes
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Layout Details subsection */}
          {(!formData.hasSubmittals || (formData.hasSubmittals && formData.needsLayoutBOM)) && (
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">📐 Layout Details</h4>
              <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="numOfRooms">Number of Rooms</label>
                  <input
                    type="number"
                    id="numOfRooms"
                    name="numOfRooms"
                    value={formData.numOfRooms || 0}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="roomMultiplier">Room Multiplier</label>
                  <input
                    type="number"
                    id="roomMultiplier"
                    name="roomMultiplier"
                    value={formData.roomMultiplier || 2}
                    onChange={handleInputChange}
                    min="0"
                    step="0.1"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="overrideRooms">Override Rooms</label>
                  <input
                    type="number"
                    id="overrideRooms"
                    name="overrideRooms"
                    value={formData.overrideRooms || 0}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reviewSetup">Review/Setup Time</label>
                  <input
                    type="number"
                    id="reviewSetup"
                    name="reviewSetup"
                    value={formData.reviewSetup || 0}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="numOfPages">Number of Pages</label>
                  <input
                    type="number"
                    id="numOfPages"
                    name="numOfPages"
                    value={formData.numOfPages || 1}
                    onChange={handleInputChange}
                    min="1"
                    step="1"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="specReview">Spec Review</label>
                  <input
                    type="number"
                    id="specReview"
                    name="specReview"
                    value={formData.specReview || 0}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Triage Results */}
          <div className="bg-gray-100 dark:bg-gray-700 p-5 rounded-lg mt-4">
            <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="totalTriage">Total Triage Time (hours)</label>
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="selfQC">Self QC (hours)</label>
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
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="fluff">Fluff (hours)</label>
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
              </div>
            </div>

            <div className="flex justify-center mt-5">
              <button
                type="button"
                onClick={calculateTriage}
                disabled={isCalculatingTriage}
                className="btn-secondary"
              >
                {isCalculatingTriage ? 'Calculating...' : '🧮 Recalculate Triage'}
              </button>
            </div>

            {errors.triage && (
              <div className="error-message">{errors.triage}</div>
            )}
          </div>
        </div>

      </div>

      {/* Save/Cancel Actions */}
      <div className="flex justify-end gap-3 px-8 py-5 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_4px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_4px_rgba(0,0,0,0.3)] md:flex-col md:px-5 md:py-4 sm:px-4 sm:py-3">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default ProjectEditor;
