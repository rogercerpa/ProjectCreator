import React, { useState, useEffect } from 'react';
import WizardLayout from '../components/WizardLayout';
import dropdownOptionsService from '../../../services/DropdownOptionsService';
import triageCalculationService from '../../../services/TriageCalculationService';

/**
 * ProjectWizardStep2 - Simplified Triage Calculation
 * DIRECT COPY from working ProjectForm.jsx triage section (lines 790-1367)
 * Prioritizes functionality over optimization
 */
const ProjectWizardStep2 = ({
  formData,
  onFormDataChange,
  errors = {},
  onFieldError,
  onFieldTouch,
  onValidationChange
}) => {
  // Simple state - no complex optimizations
  const [triageResults, setTriageResults] = useState(null);
  const [dropdownOptions, setDropdownOptions] = useState(dropdownOptionsService.getOptions());

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
  const calculateTriage = () => {
    // Use the triage calculation service to get accurate results
    const triageCalculationResults = triageCalculationService.calculateTriage(formData);
    
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
    
    onFormDataChange(updatedFormData);
    setTriageResults(triageCalculationResults);
  };

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

        {/* DIRECT COPY: Current Settings Display from ProjectForm.jsx lines 795-828 */}
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

        {/* DIRECT COPY: Triage Configuration from ProjectForm.jsx lines 834-913 */}
        <div className="triage-subsection">
          <h4>Triage Configuration</h4>
          
          {/* Panel Schedules Question */}
          <div className="form-group">
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
          <div className="form-group">
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
            <div className="form-group">
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

        {/* DIRECT COPY: Dynamic Triage Fields from ProjectForm.jsx lines 916-1201 */}
        <div className="triage-subsection">
          <h4>Triage Calculation Fields</h4>
          
          {/* Panel Schedule Fields - Show only when hasPanelSchedules = true */}
          {formData.hasPanelSchedules && (
            <div className="panel-fields">
              <h5>Panel Schedule Fields:</h5>
              
              <div className="lmp-section">
                <h6>LMPs:</h6>
                <div className="form-grid">
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
              
              <div className="nlight-section">
                <h6>nLight ARPs:</h6>
                <div className="form-grid">
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
              
              <div className="esheets-section">
                <h6>Panel Schedules (Shown on E-Sheets):</h6>
                <div className="form-group">
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

        {/* DIRECT COPY: Triage Results from ProjectForm.jsx lines 1224-1270 */}
        <div className="triage-subsection">
          <h4>Triage Results:</h4>
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

        {/* DIRECT COPY: Calculate Button from ProjectForm.jsx lines 1300-1310 */}
        <div className="triage-actions">
          <button
            type="button"
            onClick={calculateTriage}
            className="btn btn-primary"
          >
            🧮 Calculate Triage
          </button>
        </div>

        {/* DIRECT COPY: Triage Results Display from ProjectForm.jsx lines 1312+ */}
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
              <h5>Time Breakdown:</h5>
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Panel Time:</span>
                  <span className="breakdown-value">{triageResults.panelTime.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Layout Time:</span>
                  <span className="breakdown-value">{triageResults.layoutTime.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Submittal Time:</span>
                  <span className="breakdown-value">{triageResults.submittalTime.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Page Bonus:</span>
                  <span className="breakdown-value">{triageResults.pageBonus.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Base Total:</span>
                  <span className="breakdown-value">{triageResults.baseTotal.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Self QC:</span>
                  <span className="breakdown-value">{triageResults.selfQC.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Fluff:</span>
                  <span className="breakdown-value">{triageResults.fluff.toFixed(2)} hr</span>
                </div>
                <div className="breakdown-item total">
                  <span className="breakdown-label"><strong>Total Triage:</strong></span>
                  <span className="breakdown-value"><strong>{triageResults.totalTriage.toFixed(2)} hr</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WizardLayout>
  );
};

export default ProjectWizardStep2;