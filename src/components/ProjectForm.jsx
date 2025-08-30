import React, { useState, useEffect } from 'react';
import './ProjectForm.css';

function ProjectForm({ project, formData, onFormDataChange, onFormReset, onProjectCreated, onProjectUpdated }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [triageResults, setTriageResults] = useState(null);
  const [isPasting, setIsPasting] = useState(false);
  const [showPanelSchedules, setShowPanelSchedules] = useState(false);
  
  const [dropdownOptions, setDropdownOptions] = useState({
    rfaTypes: ['BOM (No Layout)', 'BOM with Layout', 'Controls BOM - Budget', 'Controls BOM - Layout'],
    regionalTeams: ['Region 1', 'Region 2', 'Region 3', 'Region 4', 'Region 5', 'NAVS'],
    nationalAccounts: ['N/A', "Arby's"],
    complexityLevels: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
    statusOptions: ['In Progress', 'Completed', 'Inactive', 'Not Started'],
    productOptions: ['nLight Wired', 'nLight Air', 'SensorSwitch', 'Pathway', 'Fresco', 'Controls - nLight'],
    assignedToOptions: ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown', 'Cerpa, Roger']
  });

  // Load project data if editing
  useEffect(() => {
    if (project) {
      onFormDataChange({ ...formData, ...project });
    }
  }, [project]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    const newFormData = { ...formData, [name]: processedValue };
    onFormDataChange(newFormData);
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
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

  const parseRFAInfo = (clipboardText) => {
    const lines = clipboardText.split('\n');
    const parsedData = {};

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Parse different fields based on content
      if (trimmedLine.includes('RFA') && trimmedLine.includes('#')) {
        const rfaMatch = trimmedLine.match(/RFA\s*#?\s*([^\s]+)/i);
        if (rfaMatch) {
          parsedData.rfaNumber = rfaMatch[1];
        }
      }
    });

    return Object.keys(parsedData).length > 0 ? parsedData : null;
  };

  const calculateTriage = () => {
    const triageData = {
      largeLMPs: formData.largeLMPs || 0,
      mediumLMPs: formData.mediumLMPs || 0,
      smallLMPs: formData.smallLMPs || 0,
      arp8: formData.arp8 || 0,
      arp16: formData.arp16 || 0,
      arp32: formData.arp32 || 0,
      arp48: formData.arp48 || 0,
      esheetsSchedules: formData.esheetsSchedules || 0,
      numOfRooms: formData.numOfRooms || 0,
      overrideRooms: formData.overrideRooms || 0,
      roomMultiplier: formData.roomMultiplier || 1,
      reviewSetup: formData.reviewSetup || 0,
      numOfPages: formData.numOfPages || 0,
      specReview: formData.specReview || 0,
      numOfSubRooms: formData.numOfSubRooms || 0,
      overrideSubRooms: formData.overrideSubRooms || 0,
      riserMultiplier: formData.riserMultiplier || 1,
      soo: formData.soo || 0,
      showPanelSchedules
    };

    // Simple triage calculation (simplified for now)
    const totalTriage = (
      (triageData.largeLMPs * 2) +
      (triageData.mediumLMPs * 1.5) +
      (triageData.smallLMPs * 1) +
      (triageData.arp8 * 0.5) +
      (triageData.arp16 * 1) +
      (triageData.arp32 * 1.5) +
      (triageData.arp48 * 2) +
      (triageData.esheetsSchedules * 0.5) +
      (triageData.numOfRooms * triageData.roomMultiplier) +
      (triageData.reviewSetup) +
      (triageData.numOfPages * 0.5) +
      (triageData.specReview) +
      (triageData.numOfSubRooms * triageData.riserMultiplier) +
      (triageData.soo)
    );

    setTriageResults({
      totalTriage: totalTriage.toFixed(2),
      breakdown: triageData
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      const requiredFields = ['projectName', 'rfaNumber', 'regionalTeam'];
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
            {isPasting ? 'Pasting...' : 'Paste RFA Info'}
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
              <label htmlFor="rfaType">RFA Type</label>
              <select
                id="rfaType"
                name="rfaType"
                value={formData.rfaType}
                onChange={handleInputChange}
              >
                <option value="">Select RFA Type</option>
                {dropdownOptions.rfaTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Triage Calculation */}
        <div className="form-section">
          <h3>Triage Calculation</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="largeLMPs">Large LMPs</label>
              <input
                type="number"
                id="largeLMPs"
                name="largeLMPs"
                value={formData.largeLMPs}
                onChange={handleInputChange}
                min="0"
                step="0.5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="mediumLMPs">Medium LMPs</label>
              <input
                type="number"
                id="mediumLMPs"
                name="mediumLMPs"
                value={formData.mediumLMPs}
                onChange={handleInputChange}
                min="0"
                step="0.5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="smallLMPs">Small LMPs</label>
              <input
                type="number"
                id="smallLMPs"
                name="smallLMPs"
                value={formData.smallLMPs}
                onChange={handleInputChange}
                min="0"
                step="0.5"
              />
            </div>

            <div className="form-group">
              <label htmlFor="numOfRooms">Number of Rooms</label>
              <input
                type="number"
                id="numOfRooms"
                name="numOfRooms"
                value={formData.numOfRooms}
                onChange={handleInputChange}
                min="0"
                step="0.5"
              />
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
              <h4>Triage Results</h4>
              <p><strong>Total Triage Time:</strong> {triageResults.totalTriage} hours</p>
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
