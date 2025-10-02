import React, { useState, useEffect } from 'react';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';
import './ProjectEditor.css';

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

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    const newFormData = { ...formData, [name]: processedValue };
    
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
    <div className="project-editor">
      <div className="editor-content">
        {/* Basic Project Information */}
        <div className="form-section">
          <h3>📋 Basic Project Information</h3>
          <div className="form-grid">
            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
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
                {(dropdownOptions.regionalTeams || []).map(team => (
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
                value={formData.nationalAccount || 'Default'}
                onChange={handleInputChange}
              >
                {(dropdownOptions.nationalAccounts || []).map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
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

            <div className="form-group form-group-full">
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
        <div className="form-section">
          <h3>📊 Project Details</h3>
          <div className="form-grid">
            <div className="form-group">
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

            <div className="form-group">
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

            <div className="form-group">
              <label htmlFor="products">Products</label>
              <textarea
                id="products"
                name="products"
                value={formData.products || ''}
                onChange={handleInputChange}
                placeholder="Enter products information"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label htmlFor="assignedTo">Assigned To</label>
              <input
                type="text"
                id="assignedTo"
                name="assignedTo"
                value={formData.assignedTo || ''}
                onChange={handleInputChange}
                placeholder="Enter assigned person"
              />
            </div>

            <div className="form-group">
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
        <div className="form-section">
          <h3>📅 Important Dates</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="ecd">ECD (Expected Completion Date)</label>
              <input
                type="date"
                id="ecd"
                name="ecd"
                value={formData.ecd || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="requestedDate">Requested Date</label>
              <input
                type="date"
                id="requestedDate"
                name="requestedDate"
                value={formData.requestedDate || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="submittedDate">Submitted Date</label>
              <input
                type="date"
                id="submittedDate"
                name="submittedDate"
                value={formData.submittedDate || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate || ''}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Triage Configuration */}
        <div className="form-section">
          <h3>🧮 Triage Configuration</h3>
          
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
            <div className="form-group">
              <label>Needs Layout/BOM</label>
              <div className="radio-group">
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
          <div className="triage-results-section">
            <div className="form-grid">
              <div className="form-group">
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

              <div className="form-group">
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

              <div className="form-group">
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

            <div className="triage-actions">
              <button
                type="button"
                onClick={calculateTriage}
                disabled={isCalculatingTriage}
                className="btn btn-secondary"
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
        <div className="form-section">
          <h3>⚙️ Additional Settings</h3>
          <div className="form-grid">
            <div className="form-group">
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

            <div className="form-group">
              <label>Is Revision</label>
              <div className="radio-group">
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

            <div className="form-group">
              <label>First Available</label>
              <div className="radio-group">
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
      <div className="editor-actions">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default ProjectEditor;
