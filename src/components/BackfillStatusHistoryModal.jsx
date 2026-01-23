import React, { useState, useEffect } from 'react';

/**
 * BackfillStatusHistoryModal - Allows manual entry of historical status timestamps
 * Used to backfill status history for existing projects that don't have tracking data
 */
const BackfillStatusHistoryModal = ({ 
  isOpen, 
  project, 
  onSave, 
  onCancel 
}) => {
  // Available RFA statuses in typical workflow order
  const statusOptions = [
    { value: 'Pending', label: 'Pending' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Ready for QC', label: 'Ready for QC' },
    { value: 'On Hold', label: 'On Hold' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' }
  ];

  // Initialize status entries with common workflow
  const [statusEntries, setStatusEntries] = useState([
    { status: 'In Progress', timestamp: '', enabled: true },
    { status: 'Ready for QC', timestamp: '', enabled: false },
    { status: 'Completed', timestamp: '', enabled: false }
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && project) {
      // Pre-populate with createdAt as the In Progress date if available
      const createdDate = project.createdAt 
        ? formatDateForInput(new Date(project.createdAt))
        : '';
      
      setStatusEntries([
        { status: 'In Progress', timestamp: createdDate, enabled: true },
        { status: 'Ready for QC', timestamp: '', enabled: false },
        { status: 'Completed', timestamp: '', enabled: false }
      ]);
      setError(null);
    }
  }, [isOpen, project]);

  // Format date for datetime-local input
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Convert datetime-local input to ISO string
  const dateTimeInputToISO = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return date.toISOString();
  };

  // Handle timestamp change for a status entry
  const handleTimestampChange = (index, value) => {
    const newEntries = [...statusEntries];
    newEntries[index].timestamp = value;
    setStatusEntries(newEntries);
  };

  // Handle enabling/disabling a status entry
  const handleEnabledChange = (index, enabled) => {
    const newEntries = [...statusEntries];
    newEntries[index].enabled = enabled;
    if (!enabled) {
      newEntries[index].timestamp = '';
    }
    setStatusEntries(newEntries);
  };

  // Handle status selection change
  const handleStatusChange = (index, newStatus) => {
    const newEntries = [...statusEntries];
    newEntries[index].status = newStatus;
    setStatusEntries(newEntries);
  };

  // Add a new status entry
  const addStatusEntry = () => {
    setStatusEntries([
      ...statusEntries,
      { status: 'On Hold', timestamp: '', enabled: true }
    ]);
  };

  // Remove a status entry
  const removeStatusEntry = (index) => {
    const newEntries = statusEntries.filter((_, i) => i !== index);
    setStatusEntries(newEntries);
  };

  // Validate entries
  const validateEntries = () => {
    const enabledEntries = statusEntries.filter(e => e.enabled && e.timestamp);
    
    if (enabledEntries.length === 0) {
      return { valid: false, error: 'Please enter at least one status with a timestamp' };
    }

    // Check that timestamps are in chronological order
    const sortedByTime = [...enabledEntries].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (let i = 0; i < sortedByTime.length - 1; i++) {
      const currentTime = new Date(sortedByTime[i].timestamp);
      const nextTime = new Date(sortedByTime[i + 1].timestamp);
      
      if (currentTime >= nextTime) {
        return { 
          valid: false, 
          error: `Status timestamps must be in chronological order. "${sortedByTime[i].status}" should be before "${sortedByTime[i + 1].status}".` 
        };
      }
    }

    return { valid: true, entries: enabledEntries };
  };

  // Handle save
  const handleSave = async () => {
    setError(null);
    
    const validation = validateEntries();
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setIsSaving(true);

    try {
      // Convert entries to the format expected by the backfill API
      const statusDates = validation.entries.map(entry => ({
        status: entry.status,
        timestamp: dateTimeInputToISO(entry.timestamp)
      }));

      // Call the onSave callback with the status dates
      await onSave(statusDates);
    } catch (err) {
      setError(err.message || 'Failed to save status history');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Backfill Status History
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Enter the historical dates when this project transitioned through each status.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {/* Project Info */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Project:</strong> {project?.projectName || 'Unknown'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>RFA:</strong> {project?.rfaNumber || 'N/A'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Current Status:</strong> {project?.rfaStatus || 'Unknown'}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Status Entries */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status Timeline
            </div>
            
            {statusEntries.map((entry, index) => (
              <div 
                key={index} 
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  entry.enabled 
                    ? 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600' 
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-60'
                }`}
              >
                {/* Enable/Disable Checkbox */}
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={(e) => handleEnabledChange(index, e.target.checked)}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />

                {/* Status Select */}
                <select
                  value={entry.status}
                  onChange={(e) => handleStatusChange(index, e.target.value)}
                  disabled={!entry.enabled}
                  className="flex-shrink-0 w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Timestamp Input */}
                <input
                  type="datetime-local"
                  value={entry.timestamp}
                  onChange={(e) => handleTimestampChange(index, e.target.value)}
                  disabled={!entry.enabled}
                  className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
                />

                {/* Remove Button (only for additional entries) */}
                {index > 2 && (
                  <button
                    type="button"
                    onClick={() => removeStatusEntry(index)}
                    className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove this status"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Add Status Button */}
            <button
              type="button"
              onClick={addStatusEntry}
              className="w-full py-2 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors"
            >
              + Add Another Status
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Tip:</strong> Enter the approximate date and time when each status change occurred. 
              This data will be used for project analytics and reporting.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Status History'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackfillStatusHistoryModal;
