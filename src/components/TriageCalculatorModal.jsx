import React, { useState, useEffect } from 'react';
import dropdownOptionsService from '../services/DropdownOptionsService';
import triageCalculationService from '../services/TriageCalculationService';

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-3 animate-fadeIn" onClick={handleCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-[1400px] w-full max-h-[95vh] flex flex-col animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-primary-600 to-blue-700 dark:from-primary-800 dark:to-blue-900 text-white rounded-t-xl">
          <div>
            <h2 className="m-0 text-xl font-semibold">🧮 Triage Calculator</h2>
            <p className="m-0 text-xs opacity-90">{formData.projectName || 'Untitled Project'} - {formData.rfaNumber || 'N/A'}</p>
          </div>
          <button className="bg-white/20 border-none text-white text-2xl leading-none w-8 h-8 rounded-md cursor-pointer p-0 transition-all hover:bg-white/30 hover:scale-110" onClick={handleCancel}>×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {/* Before/After Comparison */}
          {triageResults && (
            <div className="flex items-center justify-center gap-4 p-4 bg-gradient-to-br from-info-50 to-purple-50 dark:from-info-900/20 dark:to-purple-900/20 rounded-lg mb-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">Original:</span>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">{originalTriage.totalTriage.toFixed(1)} hours</span>
              </div>
              <div className="text-2xl text-gray-400 dark:text-gray-500">→</div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400 uppercase">New:</span>
                <span className={`text-2xl font-bold ${
                  triageResults.totalTriage > originalTriage.totalTriage ? 'text-error-600 dark:text-error-400' : 
                  triageResults.totalTriage < originalTriage.totalTriage ? 'text-success-600 dark:text-success-400' : 'text-gray-800 dark:text-gray-200'
                }`}>
                  {triageResults.totalTriage.toFixed(1)} hours
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {triageResults.totalTriage > originalTriage.totalTriage && (
                  <span className="px-3 py-1 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-300 rounded-full text-sm font-semibold">
                    +{(triageResults.totalTriage - originalTriage.totalTriage).toFixed(1)}h
                  </span>
                )}
                {triageResults.totalTriage < originalTriage.totalTriage && (
                  <span className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-sm font-semibold">
                    -{(originalTriage.totalTriage - triageResults.totalTriage).toFixed(1)}h
                  </span>
                )}
                {triageResults.totalTriage === originalTriage.totalTriage && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm font-semibold">No change</span>
                )}
              </div>
            </div>
          )}

          {/* Triage Configuration - Compact 2-Column Layout */}
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-1 mb-4">
            {/* Left Column: Configuration */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">⚙️ Configuration</h3>
              <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Panel Schedules:</label>
                <div className="flex gap-5">
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
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Layout/BOM:</label>
                  <div className="flex gap-5">
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

            {/* Right Column: Panel Schedule, Layout, Submittal Fields */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">📊 Field Details</h3>
              
              {/* Panel Schedule Fields */}
              {formData.hasPanelSchedules && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">LMPs</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1.5">
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
                    <div className="flex flex-col gap-1.5">
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
                    <div className="flex flex-col gap-1.5">
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
              )}

              {formData.hasPanelSchedules && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">nLight ARPs</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
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
                  <div className="flex flex-col gap-1.5">
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
                  <div className="flex flex-col gap-1.5">
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
                  <div className="flex flex-col gap-1.5">
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
              )}

              {/* Layout Fields */}
              {(!formData.hasSubmittals || (formData.hasSubmittals && formData.needsLayoutBOM)) && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Layout Details</h4>
                  <div className="grid grid-cols-2 gap-2">
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
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Submittal Details</h4>
                  <div className="grid grid-cols-2 gap-2">
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
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Photometrics</h4>
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
            </div>
          </div>

          {/* Triage Results Section - Full Width */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">📈 Triage Results</h3>
            <div className="grid grid-cols-4 gap-3">
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
          <div className="flex justify-center">
            <button
              type="button"
              onClick={calculateTriage}
              disabled={isCalculating}
              className="btn-primary"
            >
              {isCalculating ? 'Calculating...' : '🧮 Calculate Triage'}
            </button>
          </div>

          {/* Results Display */}
          {triageResults && (
            <div className="bg-success-50 dark:bg-success-900/20 border-2 border-success-500 dark:border-success-700 rounded-lg p-5 mt-6">
              <h3 className="text-lg font-semibold text-success-800 dark:text-success-200 mb-4">✅ Calculation Complete</h3>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Time:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{triageResults.totalTriage.toFixed(1)} hours</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Base Calculation:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{triageResults.baseTotal.toFixed(1)} hr</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quality Control:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{triageResults.selfQC.toFixed(1)} hr</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Buffer Time:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{triageResults.fluff.toFixed(1)} hr</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            onClick={handleCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!triageResults}
            className="btn-primary"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TriageCalculatorModal;

