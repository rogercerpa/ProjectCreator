import React, { useState, useEffect } from 'react';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';
import './TriageCalculatorModal.css';

/**
 * TriageCalculatorModal - Standalone triage calculator modal
 * Extracted from ProjectWizardStep2 for reusability in project management
 * Allows users to recalculate triage without entering full edit mode
 */
const TriageCalculatorModal = ({ 
  isOpen, 
  project, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState(project || {});
  const [triageResults, setTriageResults] = useState(null);
  const [dropdownOptions, setDropdownOptions] = useState(dropdownOptionsService.getOptions());
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Store original values for comparison
  const [originalTriage, setOriginalTriage] = useState({
    totalTriage: project?.totalTriage || 0,
    panelTime: project?.panelTime || 0,
    layoutTime: project?.layoutTime || 0,
    submittalTime: project?.submittalTime || 0,
    selfQC: project?.selfQC || 0,
    fluff: project?.fluff || 0
  });

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

  // Reset form data when project changes or modal opens
  useEffect(() => {
    if (isOpen && project) {
      setFormData(project);
      setOriginalTriage({
        totalTriage: project.totalTriage || 0,
        panelTime: project.panelTime || 0,
        layoutTime: project.layoutTime || 0,
        submittalTime: project.submittalTime || 0,
        selfQC: project.selfQC || 0,
        fluff: project.fluff || 0
      });
      setTriageResults(null);
      setHasChanges(false);
    }
  }, [isOpen, project]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    if (type === 'number') {
      processedValue = value === '' ? 0 : parseFloat(value) || 0;
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    setHasChanges(true);
  };

  // Calculate triage
  const calculateTriage = () => {
    setIsCalculating(true);
    
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
      setTriageResults(triageCalculationResults);
      setHasChanges(true);
    } catch (error) {
      console.error('Triage calculation failed:', error);
      alert('Failed to calculate triage. Please check your inputs and try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle save
  const handleSave = () => {
    if (!triageResults) {
      alert('Please calculate triage before saving.');
      return;
    }
    onSave(formData);
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      const confirmCancel = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmCancel) return;
    }
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="triage-calculator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h2>🧮 Triage Calculator</h2>
            <p className="modal-subtitle">Recalculate project triage time</p>
          </div>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          {/* Project Context */}
          <div className="project-context">
            <h4>{formData.projectName || 'Untitled Project'}</h4>
            <div className="context-info">
              <span><strong>RFA:</strong> {formData.rfaNumber || 'N/A'}</span>
              <span><strong>Type:</strong> {formData.rfaType || 'N/A'}</span>
            </div>
          </div>

          {/* Before/After Comparison */}
          {triageResults && (
            <div className="triage-comparison">
              <div className="comparison-item">
                <span className="comparison-label">Original:</span>
                <span className="comparison-value">{originalTriage.totalTriage.toFixed(1)} hours</span>
              </div>
              <div className="comparison-arrow">→</div>
              <div className="comparison-item">
                <span className="comparison-label">New:</span>
                <span className={`comparison-value ${
                  triageResults.totalTriage > originalTriage.totalTriage ? 'increased' : 
                  triageResults.totalTriage < originalTriage.totalTriage ? 'decreased' : ''
                }`}>
                  {triageResults.totalTriage.toFixed(1)} hours
                </span>
              </div>
              <div className="comparison-diff">
                {triageResults.totalTriage > originalTriage.totalTriage && (
                  <span className="diff-badge increased">
                    +{(triageResults.totalTriage - originalTriage.totalTriage).toFixed(1)}h
                  </span>
                )}
                {triageResults.totalTriage < originalTriage.totalTriage && (
                  <span className="diff-badge decreased">
                    -{(originalTriage.totalTriage - triageResults.totalTriage).toFixed(1)}h
                  </span>
                )}
                {triageResults.totalTriage === originalTriage.totalTriage && (
                  <span className="diff-badge unchanged">No change</span>
                )}
              </div>
            </div>
          )}

          {/* Triage Configuration */}
          <div className="triage-section">
            <h3>Configuration</h3>
            <div className="config-grid">
              <div className="config-item">
                <label>Panel Schedules:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="hasPanelSchedules"
                      checked={!formData.hasPanelSchedules}
                      onChange={() => setFormData({ ...formData, hasPanelSchedules: false })}
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hasPanelSchedules"
                      checked={formData.hasPanelSchedules}
                      onChange={() => setFormData({ ...formData, hasPanelSchedules: true })}
                    />
                    Yes
                  </label>
                </div>
              </div>

              <div className="config-item">
                <label>Submittal Section:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="hasSubmittals"
                      checked={!formData.hasSubmittals}
                      onChange={() => setFormData({ ...formData, hasSubmittals: false, needsLayoutBOM: false })}
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="hasSubmittals"
                      checked={formData.hasSubmittals}
                      onChange={() => setFormData({ ...formData, hasSubmittals: true })}
                    />
                    Yes
                  </label>
                </div>
              </div>

              {formData.hasSubmittals && (
                <div className="config-item">
                  <label>Layout/BOM:</label>
                  <div className="radio-group">
                    <label>
                      <input
                        type="radio"
                        name="needsLayoutBOM"
                        checked={!formData.needsLayoutBOM}
                        onChange={() => setFormData({ ...formData, needsLayoutBOM: false })}
                      />
                      No
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="needsLayoutBOM"
                        checked={formData.needsLayoutBOM}
                        onChange={() => setFormData({ ...formData, needsLayoutBOM: true })}
                      />
                      Yes
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel Schedule Fields */}
          {formData.hasPanelSchedules && (
            <div className="triage-section">
              <h3>Panel Schedule Details</h3>
              
              <div className="subsection">
                <h4>LMPs</h4>
                <div className="form-grid compact">
                  <div className="form-group">
                    <label>Large</label>
                    <input
                      type="number"
                      name="largeLMPs"
                      value={formData.largeLMPs || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Medium</label>
                    <input
                      type="number"
                      name="mediumLMPs"
                      value={formData.mediumLMPs || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Small</label>
                    <input
                      type="number"
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

              <div className="subsection">
                <h4>nLight ARPs</h4>
                <div className="form-grid compact">
                  <div className="form-group">
                    <label>ARP 8</label>
                    <input
                      type="number"
                      name="arp8"
                      value={formData.arp8 || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>ARP 16</label>
                    <input
                      type="number"
                      name="arp16"
                      value={formData.arp16 || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>ARP 32</label>
                    <input
                      type="number"
                      name="arp32"
                      value={formData.arp32 || ''}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>ARP 48</label>
                    <input
                      type="number"
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

              <div className="subsection">
                <h4>E-Sheets</h4>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="esheetsSchedules"
                      value={2}
                      checked={formData.esheetsSchedules === 2}
                      onChange={() => setFormData({ ...formData, esheetsSchedules: 2 })}
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="esheetsSchedules"
                      value={1}
                      checked={formData.esheetsSchedules === 1}
                      onChange={() => setFormData({ ...formData, esheetsSchedules: 1 })}
                    />
                    Yes
                  </label>
                </div>
                <small>Panel schedules shown on E-Sheets</small>
              </div>
            </div>
          )}

          {/* Layout Fields */}
          {(!formData.hasSubmittals || (formData.hasSubmittals && formData.needsLayoutBOM)) && (
            <div className="triage-section">
              <h3>Layout Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label># of Rooms</label>
                  <input
                    type="number"
                    name="numOfRooms"
                    value={formData.numOfRooms || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Room Multiplier</label>
                  <input
                    type="number"
                    name="roomMultiplier"
                    value={formData.roomMultiplier || 2}
                    onChange={handleInputChange}
                    min="0"
                    step="0.5"
                    placeholder="2"
                  />
                  <small>min/room</small>
                </div>
                <div className="form-group">
                  <label>Override Rooms</label>
                  <input
                    type="number"
                    name="overrideRooms"
                    value={formData.overrideRooms || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                    placeholder="0"
                  />
                  <small>hours</small>
                </div>
                <div className="form-group">
                  <label>Review/Setup Time</label>
                  <input
                    type="number"
                    name="reviewSetup"
                    value={formData.reviewSetup || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                    placeholder="0.5"
                  />
                  <small>hours</small>
                </div>
                <div className="form-group">
                  <label># of Lighting Pages</label>
                  <input
                    type="number"
                    name="numOfPages"
                    value={formData.numOfPages || ''}
                    onChange={handleInputChange}
                    min="1"
                    step="1"
                    placeholder="1"
                  />
                </div>
                <div className="form-group">
                  <label>Spec Review</label>
                  <input
                    type="number"
                    name="specReview"
                    value={formData.specReview || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                    placeholder="0"
                  />
                  <small>hours</small>
                </div>
              </div>
            </div>
          )}

          {/* Submittal Fields */}
          {formData.hasSubmittals && (
            <div className="triage-section">
              <h3>Submittal Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label># of Rooms</label>
                  <input
                    type="number"
                    name="numOfSubRooms"
                    value={formData.numOfSubRooms || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Riser Multiplier</label>
                  <input
                    type="number"
                    name="riserMultiplier"
                    value={formData.riserMultiplier || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.5"
                    placeholder="1"
                  />
                  <small>min/room</small>
                </div>
                <div className="form-group">
                  <label>Sequence of Operation</label>
                  <input
                    type="number"
                    name="soo"
                    value={formData.soo || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.25"
                    placeholder="0.5"
                  />
                  <small>hours</small>
                </div>
              </div>
            </div>
          )}

          {/* Photometrics */}
          {formData.showPhotometrics && (
            <div className="triage-section">
              <h3>Photometrics</h3>
              <div className="form-group">
                <label>Photo Software</label>
                <select
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

          {/* Triage Results Section */}
          <div className="triage-section">
            <h3>Triage Results</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Self QC</label>
                <input
                  type="number"
                  name="selfQC"
                  value={formData.selfQC || ''}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0"
                />
                <small>Auto-calculated, can be overridden</small>
              </div>
              <div className="form-group">
                <label>Fluff</label>
                <input
                  type="number"
                  name="fluff"
                  value={formData.fluff || ''}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0"
                />
                <small>Auto-calculated, can be overridden</small>
              </div>
              <div className="form-group">
                <label>Total Triage Time</label>
                <input
                  type="number"
                  name="totalTriage"
                  value={formData.totalTriage || ''}
                  onChange={handleInputChange}
                  min="0"
                  step="0.25"
                  placeholder="0"
                />
                <small>Auto-calculated, can be overridden</small>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <div className="calculate-section">
            <button
              type="button"
              onClick={calculateTriage}
              disabled={isCalculating}
              className="btn btn-primary btn-calculate"
            >
              {isCalculating ? 'Calculating...' : '🧮 Calculate Triage'}
            </button>
          </div>

          {/* Results Display */}
          {triageResults && (
            <div className="results-display">
              <h3>✅ Calculation Complete</h3>
              <div className="results-grid">
                <div className="result-item">
                  <span className="result-label">Total Time:</span>
                  <span className="result-value">{triageResults.totalTriage.toFixed(1)} hours</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Base Calculation:</span>
                  <span className="result-value">{triageResults.baseTotal.toFixed(1)} hr</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Quality Control:</span>
                  <span className="result-value">{triageResults.selfQC.toFixed(1)} hr</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Buffer Time:</span>
                  <span className="result-value">{triageResults.fluff.toFixed(1)} hr</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!triageResults}
            className="btn btn-primary"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TriageCalculatorModal;

