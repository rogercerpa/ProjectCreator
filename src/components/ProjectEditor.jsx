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
        {/* Basic Project Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📋 Basic Project Information</h3>
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
              <label htmlFor="regionalTeam">Regional Team *</label>
              <select
                id="regionalTeam"
                name="regionalTeam"
                value={formData.regionalTeam || ''}
                onChange={handleInputChange}
                className={errors.regionalTeam ? 'error' : ''}
              >
                <option value="">Select Regional Team</option>
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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status || 'Active'}
                onChange={handleInputChange}
                className={errors.status ? 'error' : ''}
              >
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              {errors.status && <span className="error-message">{errors.status}</span>}
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
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📊 Project Details</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="complexity">Complexity</label>
              <select
                id="complexity"
                name="complexity"
                value={formData.complexity || ''}
                onChange={handleInputChange}
              >
                <option value="">Select Complexity</option>
                {(dropdownOptions.complexityLevels || []).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
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

        {/* Additional Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📋 Additional Information</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="repContacts">Rep Contacts</label>
              <textarea
                id="repContacts"
                name="repContacts"
                value={formData.repContacts || ''}
                onChange={handleInputChange}
                placeholder="Enter rep contact information"
                rows="3"
              />
            </div>
          </div>
        </div>

        {/* Important Dates */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">📅 Important Dates</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
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

        {/* Triage Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">🧮 Triage Configuration</h3>
          
          {/* Panel Schedules */}
          <div className="form-group">
            <label>Panel Schedules</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="hasPanelSchedules"
                  value="false"
                  checked={!formData.hasPanelSchedules}
                  onChange={() => setFormData(prev => ({ ...prev, hasPanelSchedules: false }))}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="hasPanelSchedules"
                  value="true"
                  checked={formData.hasPanelSchedules}
                  onChange={() => setFormData(prev => ({ ...prev, hasPanelSchedules: true }))}
                />
                Yes
              </label>
            </div>
          </div>

          {/* Submittal Section */}
          <div className="form-group">
            <label>Submittal Section</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="hasSubmittals"
                  value="false"
                  checked={!formData.hasSubmittals}
                  onChange={() => setFormData(prev => ({ ...prev, hasSubmittals: false, needsLayoutBOM: false }))}
                />
                No
              </label>
              <label>
                <input
                  type="radio"
                  name="hasSubmittals"
                  value="true"
                  checked={formData.hasSubmittals}
                  onChange={() => setFormData(prev => ({ ...prev, hasSubmittals: true }))}
                />
                Yes
              </label>
            </div>
          </div>

          {/* Layout/BOM */}
          {formData.hasSubmittals && (
            <div className="flex flex-col gap-1.5">
              <label>Needs Layout/BOM</label>
              <div className="flex gap-5 mt-1 md:flex-col md:gap-2.5">
                <label>
                  <input
                    type="radio"
                    name="needsLayoutBOM"
                    value="false"
                    checked={!formData.needsLayoutBOM}
                    onChange={() => setFormData(prev => ({ ...prev, needsLayoutBOM: false }))}
                  />
                  No
                </label>
                <label>
                  <input
                    type="radio"
                    name="needsLayoutBOM"
                    value="true"
                    checked={formData.needsLayoutBOM}
                    onChange={() => setFormData(prev => ({ ...prev, needsLayoutBOM: true }))}
                  />
                  Yes
                </label>
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

        {/* Additional Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg mb-6 p-6 shadow-md md:p-4 md:mb-4 sm:p-3">
          <h3 className="form-section-header">⚙️ Additional Settings</h3>
          <div className="grid grid-cols-3 gap-5 2xl:grid-cols-4 2xl:gap-6 lg:grid-cols-2 lg:gap-4 md:grid-cols-1 md:gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="saveLocation">Save Location</label>
              <select
                id="saveLocation"
                name="saveLocation"
                value={formData.saveLocation || 'Server'}
                onChange={handleInputChange}
              >
                <option value="Server">Server</option>
                <option value="Desktop">Desktop</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label>Is Revision</label>
              <div className="flex gap-5 mt-1 md:flex-col md:gap-2.5">
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value="false"
                    checked={!formData.isRevision}
                    onChange={() => setFormData(prev => ({ ...prev, isRevision: false }))}
                  />
                  No
                </label>
                <label>
                  <input
                    type="radio"
                    name="isRevision"
                    value="true"
                    checked={formData.isRevision}
                    onChange={() => setFormData(prev => ({ ...prev, isRevision: true }))}
                  />
                  Yes
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label>First Available</label>
              <div className="flex gap-5 mt-1 md:flex-col md:gap-2.5">
                <label>
                  <input
                    type="radio"
                    name="firstAvailable"
                    value="false"
                    checked={!formData.firstAvailable}
                    onChange={() => setFormData(prev => ({ ...prev, firstAvailable: false }))}
                  />
                  No
                </label>
                <label>
                  <input
                    type="radio"
                    name="firstAvailable"
                    value="true"
                    checked={formData.firstAvailable}
                    onChange={() => setFormData(prev => ({ ...prev, firstAvailable: true }))}
                  />
                  Yes
                </label>
              </div>
            </div>
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
