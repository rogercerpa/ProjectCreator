import React, { useState, useEffect, useMemo } from 'react';

/**
 * Multi-select dropdown component
 */
const MultiSelect = ({ label, options, selected, onChange, placeholder, searchable = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return options;
    return options.filter(opt => 
      opt.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search, searchable]);

  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <div className="flex items-center justify-between">
          <span className={selected.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
            {selected.length > 0 ? `${selected.length} selected` : placeholder}
          </span>
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-200 dark:border-gray-600">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}
          <div className="p-2 border-b border-gray-200 dark:border-gray-600 flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="overflow-y-auto max-h-40">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <label
                  key={option}
                  className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="mr-2 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{option}</span>
                </label>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">No options available</div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Single select dropdown component
 */
const SingleSelect = ({ label, options, value, onChange, placeholder }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
};

/**
 * Date preset button
 */
const DatePresetButton = ({ label, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`}
  >
    {label}
  </button>
);

/**
 * Get date preset ranges
 */
const getDatePresets = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  // This week (Sunday to Saturday)
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  
  // This month
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Last month
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // This quarter
  const currentQuarter = Math.floor(today.getMonth() / 3);
  const thisQuarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
  const thisQuarterEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);

  // This year
  const thisYearStart = new Date(today.getFullYear(), 0, 1);

  // Last 30 days
  const last30Start = new Date(today);
  last30Start.setDate(today.getDate() - 30);

  // Last 90 days
  const last90Start = new Date(today);
  last90Start.setDate(today.getDate() - 90);

  return {
    'This Week': { start: startOfDay(thisWeekStart), end: endOfDay(today) },
    'This Month': { start: startOfDay(thisMonthStart), end: endOfDay(thisMonthEnd) },
    'Last Month': { start: startOfDay(lastMonthStart), end: endOfDay(lastMonthEnd) },
    'This Quarter': { start: startOfDay(thisQuarterStart), end: endOfDay(thisQuarterEnd) },
    'This Year': { start: startOfDay(thisYearStart), end: endOfDay(today) },
    'Last 30 Days': { start: startOfDay(last30Start), end: endOfDay(today) },
    'Last 90 Days': { start: startOfDay(last90Start), end: endOfDay(today) },
  };
};

/**
 * Format date for input
 */
const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Report Settings Modal Component
 */
function ReportSettingsModal({ isOpen, onClose, onApply, currentSettings, filterOptions }) {
  const [settings, setSettings] = useState({
    startDate: null,
    endDate: null,
    activePreset: 'This Month',
    viewMode: 'created',
    filters: {
      rfaTypes: [],
      regions: [],
      statuses: [],
      agencies: [],
      products: [],
      designer: null,
      qc: null,
      triage: null,
    },
  });

  const datePresets = useMemo(() => getDatePresets(), []);

  // Initialize with current settings
  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    } else {
      // Default to "This Month"
      const preset = datePresets['This Month'];
      setSettings(prev => ({
        ...prev,
        startDate: preset.start,
        endDate: preset.end,
        activePreset: 'This Month',
      }));
    }
  }, [currentSettings, isOpen]);

  // Handle date preset selection
  const handlePresetClick = (presetName) => {
    const preset = datePresets[presetName];
    setSettings(prev => ({
      ...prev,
      startDate: preset.start,
      endDate: preset.end,
      activePreset: presetName,
    }));
  };

  // Handle custom date change
  const handleDateChange = (field, value) => {
    const date = value ? new Date(value) : null;
    if (field === 'startDate' && date) {
      date.setHours(0, 0, 0, 0);
    }
    if (field === 'endDate' && date) {
      date.setHours(23, 59, 59, 999);
    }
    setSettings(prev => ({
      ...prev,
      [field]: date,
      activePreset: 'Custom',
    }));
  };

  // Handle filter change
  const handleFilterChange = (filterName, value) => {
    setSettings(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterName]: value,
      },
    }));
  };

  // Reset to defaults
  const handleReset = () => {
    const preset = datePresets['This Month'];
    setSettings({
      startDate: preset.start,
      endDate: preset.end,
      activePreset: 'This Month',
      viewMode: 'created',
      filters: {
        rfaTypes: [],
        regions: [],
        statuses: [],
        agencies: [],
        products: [],
        designer: null,
        qc: null,
        triage: null,
      },
    });
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    const { filters } = settings;
    if (filters.rfaTypes?.length) count += filters.rfaTypes.length;
    if (filters.regions?.length) count += filters.regions.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.agencies?.length) count += filters.agencies.length;
    if (filters.products?.length) count += filters.products.length;
    if (filters.designer) count++;
    if (filters.qc) count++;
    if (filters.triage) count++;
    return count;
  }, [settings.filters]);

  // Handle apply
  const handleApply = () => {
    onApply(settings);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Report Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure date range and filters</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Date Range Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>📅</span> Date Range
            </h3>
            
            {/* Date Presets */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(datePresets).map((presetName) => (
                <DatePresetButton
                  key={presetName}
                  label={presetName}
                  isActive={settings.activePreset === presetName}
                  onClick={() => handlePresetClick(presetName)}
                />
              ))}
              <DatePresetButton
                label="Custom"
                isActive={settings.activePreset === 'Custom'}
                onClick={() => setSettings(prev => ({ ...prev, activePreset: 'Custom' }))}
              />
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={formatDateForInput(settings.startDate)}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={formatDateForInput(settings.endDate)}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Mode
              </label>
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, viewMode: 'created' }))}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    settings.viewMode === 'created'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  By Created Date
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, viewMode: 'completed' }))}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    settings.viewMode === 'completed'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  By Completed Date
                </button>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>🔍</span> Filters
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded-full">
                  {activeFilterCount} active
                </span>
              )}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MultiSelect
                label="RFA Type"
                options={filterOptions?.rfaTypes || []}
                selected={settings.filters.rfaTypes || []}
                onChange={(value) => handleFilterChange('rfaTypes', value)}
                placeholder="All types"
              />

              <MultiSelect
                label="Region"
                options={filterOptions?.regions || []}
                selected={settings.filters.regions || []}
                onChange={(value) => handleFilterChange('regions', value)}
                placeholder="All regions"
              />

              <MultiSelect
                label="Status"
                options={filterOptions?.statuses || []}
                selected={settings.filters.statuses || []}
                onChange={(value) => handleFilterChange('statuses', value)}
                placeholder="All statuses"
              />

              <MultiSelect
                label="Agency"
                options={filterOptions?.agencies || []}
                selected={settings.filters.agencies || []}
                onChange={(value) => handleFilterChange('agencies', value)}
                placeholder="All agencies"
                searchable={true}
              />

              <MultiSelect
                label="Products"
                options={filterOptions?.products || []}
                selected={settings.filters.products || []}
                onChange={(value) => handleFilterChange('products', value)}
                placeholder="All products"
              />

              <SingleSelect
                label="Designer"
                options={filterOptions?.designers || []}
                value={settings.filters.designer}
                onChange={(value) => handleFilterChange('designer', value)}
                placeholder="Any designer"
              />

              <SingleSelect
                label="QC"
                options={filterOptions?.qcMembers || []}
                value={settings.filters.qc}
                onChange={(value) => handleFilterChange('qc', value)}
                placeholder="Any QC"
              />

              <SingleSelect
                label="Triage"
                options={filterOptions?.triageMembers || []}
                value={settings.filters.triage}
                onChange={(value) => handleFilterChange('triage', value)}
                placeholder="Any triage"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportSettingsModal;
