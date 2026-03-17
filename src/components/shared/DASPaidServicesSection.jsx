import React, { useEffect, useMemo, useState, useRef } from 'react';
import EmailTemplateEditor from './EmailTemplateEditor';

const BASE_NEW_RATE = 350;
const BASE_REVISION_RATE = 265;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const STATUS_OPTIONS = ['Waiting on Order', 'Paid', 'Cancelled', 'Fee Waived'];

const SERVICE_TYPE_OPTIONS = [
  'DESIGN APPLICATION LAYOUT',
  'DESIGN APPLICATION REVISED LAYOUT',
  'DESIGN APPLICATION REVISED SUBMITTAL',
  'DESIGN APPLICATION SUBMITTAL'
];
const COST_OPTIONS = [
  { value: 'new', label: 'New ($350)' },
  { value: 'revision', label: 'Revision ($265)' },
  { value: 'discount50', label: 'Discount Option 1 (50% off New)' },
  { value: 'discount75', label: 'Discount Option 2 (75% off New)' },
  { value: 'waive', label: 'Waive Fee' },
  { value: 'other', label: 'Other' }
];
const WAIVER_REASON_OPTIONS = [
  { value: 'acuitySpecRequirement', label: 'Acuity specification requirement' },
  { value: 'projectAwarded', label: 'Project awarded' },
  { value: 'purchaseOrderReceived', label: 'Purchase order received' },
  { value: 'projectValueExceeds250k', label: 'Project value exceeds $250K' },
  { value: 'other', label: 'Other' }
];

const getRateForOption = (option) => {
  switch (option) {
    case 'revision':
      return BASE_REVISION_RATE;
    case 'discount50':
      return Number((BASE_NEW_RATE * 0.5).toFixed(2));
    case 'discount75':
      return Number((BASE_NEW_RATE * 0.25).toFixed(2));
    case 'new':
    default:
      return BASE_NEW_RATE;
  }
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
};

const roundCurrency = (value) => Number(Number(value || 0).toFixed(2));

const fieldError = (errors, key) => {
  if (!errors) return null;
  if (typeof errors === 'string') return errors;
  const value = errors[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value || null;
};

const RepEmailSelector = ({
  selected = [],
  onChange,
  options = [],
  onSearch,
  status,
  readOnly
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!onSearch) return;
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      return;
    }
    const handler = setTimeout(() => {
      onSearch(trimmed);
      setIsDropdownOpen(true);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, onSearch]);

  const handleAddEntry = (entry) => {
    if (!entry?.email || readOnly) return;
    const exists = (selected || []).some(
      (item) => item?.email?.toLowerCase() === entry.email.toLowerCase()
    );
    if (exists) return;
    onChange([...(selected || []), entry]);
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const handleManualEntry = () => {
    const trimmed = searchTerm.trim();
    if (!EMAIL_REGEX.test(trimmed)) return;
    handleAddEntry({ email: trimmed, name: '', agencyName: '' });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleManualEntry();
    }
  };

  const handleRemove = (email) => {
    if (readOnly) return;
    onChange((selected || []).filter((entry) => entry.email !== email));
  };

  const normalizedOptions = (options || []).filter((option) => option?.email);
  const showDropdown = isDropdownOpen && normalizedOptions.length > 0 && !readOnly;

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <div className="flex flex-wrap gap-2">
        {(selected || []).length === 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">No recipients selected yet.</span>
        )}
        {(selected || []).map((entry) => (
          <span
            key={entry.email}
            className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-xs text-primary-900 dark:text-primary-100"
          >
            <span>
              {entry.name || entry.email}
              {entry.agencyName ? ` • ${entry.agencyName}` : ''}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(entry.email)}
                className="text-primary-700 dark:text-primary-300 hover:text-primary-900"
                aria-label="Remove email"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => !readOnly && setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={readOnly ? 'Emails locked' : 'Type a name or email to search…'}
          disabled={readOnly}
          className="input"
        />
        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {normalizedOptions.map((option) => (
              <button
                key={option.email}
                type="button"
                onClick={() => handleAddEntry(option)}
                className="w-full px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="font-semibold">{option.name || option.email}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {option.email}
                  {option.agencyName ? ` • ${option.agencyName}` : ''}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {!readOnly && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Press Enter to add a custom email address.
        </span>
      )}
      {status?.state === 'searching' && (
        <span className="text-xs text-warning-600 dark:text-warning-400">{status.message}</span>
      )}
      {status?.state === 'notFound' && (
        <span className="text-xs text-warning-600 dark:text-warning-400">{status.message}</span>
      )}
      {status?.state === 'error' && (
        <span className="text-xs text-error-600 dark:text-error-400">{status.message}</span>
      )}
    </div>
  );
};

const DASPaidServicesSection = ({
  formData = {},
  onChange,
  className = '',
  readOnly = false,
  errors = {},
  showEmailButton = false,
  emailButtonLabel = 'Draft Outlook Email',
  onRequestEmail,
  emailButtonDisabled = false,
  highlight = false,
  repEmailStatus = null,
  repEmailList = [],
  onRepEmailListChange,
  repEmailOptions = [],
  onRepEmailSearch
}) => {
  const {
    isRevision = false,
    dasPaidServiceEnabled = false,
    dasPaidServiceForced = false,
    dasCostOption,
    dasCostPerPage = BASE_NEW_RATE,
    dasCostPerPageManual = false,
    dasLightingPages = 0,
    dasFee = 0,
    dasFeeManual = false,
    dasStatus = STATUS_OPTIONS[0],
    dasRepEmail = '',
    dasRepEmailList = [],
    dasWaiverReasons = [],
    dasWaiverOtherNote = '',
    dasWaiverDescription = ''
  } = formData;
  const resolvedRepEmailList = repEmailList ?? dasRepEmailList ?? [];

  const sectionClasses = [
    'rounded-lg border-2 p-5 shadow-sm space-y-4',
    'bg-white dark:bg-gray-800',
    highlight ? 'border-primary-400 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedCostOption = dasCostOption || (isRevision ? 'revision' : 'new');
  const isFeeWaived = resolvedCostOption === 'waive' || dasStatus === 'Fee Waived';

  // Automatically align cost per page when not manually overridden
  useEffect(() => {
    if (!dasPaidServiceEnabled || readOnly || !onChange) {
      return;
    }

    // Don't auto-update if fee is waived
    if (isFeeWaived) {
      return;
    }

    if (!dasCostPerPageManual || resolvedCostOption !== 'other') {
      const nextRate = getRateForOption(resolvedCostOption);
      const updates = {};

      if (dasCostPerPageManual && resolvedCostOption !== 'other') {
        updates.dasCostPerPageManual = false;
      }

      if (resolvedCostOption !== dasCostOption) {
        updates.dasCostOption = resolvedCostOption;
      }

      if (typeof nextRate === 'number' && nextRate !== Number(dasCostPerPage)) {
        updates.dasCostPerPage = nextRate;
      }

      if (Object.keys(updates).length > 0) {
        onChange({
          ...formData,
          ...updates
        });
      }
    }
  }, [
    dasPaidServiceEnabled,
    dasCostPerPageManual,
    resolvedCostOption,
    dasCostOption,
    dasCostPerPage,
    isFeeWaived,
    readOnly,
    onChange,
    formData
  ]);

  // Auto-calculate fee unless overridden or waived
  useEffect(() => {
    if (!dasPaidServiceEnabled || readOnly || dasFeeManual || !onChange) {
      return;
    }

    // Don't auto-calculate if fee is waived
    if (isFeeWaived) {
      return;
    }

    const calculatedFee = roundCurrency(Number(dasCostPerPage || 0) * Number(dasLightingPages || 0));
    if (Number(dasFee || 0) !== calculatedFee) {
      onChange({
        ...formData,
        dasFee: calculatedFee
      });
    }
  }, [
    dasPaidServiceEnabled,
    dasCostPerPage,
    dasLightingPages,
    dasFeeManual,
    dasFee,
    isFeeWaived,
    readOnly,
    onChange,
    formData
  ]);

  const handleUpdate = (partial) => {
    if (!onChange || readOnly) return;
    onChange({
      ...formData,
      ...partial
    });
  };

  const handleToggle = (checked) => {
    handleUpdate({
      dasPaidServiceEnabled: checked,
      dasPaidServiceForced: checked ? true : dasPaidServiceForced
    });
  };

  const handleCostOptionChange = (value) => {
    if (value === 'waive') {
      // Waive fee: set all values to zero and status to "Fee Waived"
      handleUpdate({
        dasCostOption: value,
        dasCostPerPage: 0,
        dasCostPerPageManual: false,
        dasLightingPages: 0,
        dasFee: 0,
        dasFeeManual: false,
        dasStatus: 'Fee Waived'
      });
      return;
    }

    if (value === 'other') {
      handleUpdate({
        dasCostOption: value,
        dasCostPerPageManual: true,
        dasStatus: dasStatus === 'Fee Waived' ? 'Waiting on Order' : dasStatus
      });
      return;
    }

    handleUpdate({
      dasCostOption: value,
      dasCostPerPage: getRateForOption(value),
      dasCostPerPageManual: false,
      dasStatus: dasStatus === 'Fee Waived' ? 'Waiting on Order' : dasStatus
    });
  };

  const handleWaiverReasonToggle = (reasonValue, checked) => {
    const current = Array.isArray(dasWaiverReasons) ? dasWaiverReasons : [];
    const next = checked
      ? [...new Set([...current, reasonValue])]
      : current.filter((item) => item !== reasonValue);
    const updates = { dasWaiverReasons: next };
    if (!checked && reasonValue === 'other') {
      updates.dasWaiverOtherNote = '';
    }
    handleUpdate(updates);
  };

  const handleCostPerPageChange = (event) => {
    const { value } = event.target;
    const parsed = value === '' ? '' : Number(value);
    if (Number.isNaN(parsed)) return;

    handleUpdate({
      dasCostOption: 'other',
      dasCostPerPage: parsed === '' ? 0 : parsed,
      dasCostPerPageManual: true
    });
  };

  const handleLightingPagesChange = (event) => {
    const parsed = Number(event.target.value);
    handleUpdate({
      dasLightingPages: Number.isNaN(parsed) ? 0 : Math.max(parsed, 0)
    });
  };

  const handleFeeChange = (event) => {
    const parsed = Number(event.target.value);
    handleUpdate({
      dasFee: Number.isNaN(parsed) ? 0 : parsed
    });
  };

  const canSendEmail = useMemo(() => {
    if (!dasPaidServiceEnabled) return false;
    if (isFeeWaived) return false;
    const hasExplicitEmails = Array.isArray(resolvedRepEmailList) && resolvedRepEmailList.length > 0;
    if (!hasExplicitEmails && !dasRepEmail) return false;
    if (!dasLightingPages || !dasCostPerPage) return false;
    if (!dasFee) return false;
    return true;
  }, [dasPaidServiceEnabled, isFeeWaived, dasRepEmail, resolvedRepEmailList, dasLightingPages, dasCostPerPage, dasFee]);

  const [selectedServiceType, setSelectedServiceType] = useState('');
  const [copySuccess, setCopySuccess] = useState({ bom: false, serviceType: false });
  const [showEmailEditor, setShowEmailEditor] = useState(false);

  const handleCopyBOM = async () => {
    try {
      await navigator.clipboard.writeText('Design Services');
      setCopySuccess({ ...copySuccess, bom: true });
      setTimeout(() => setCopySuccess({ ...copySuccess, bom: false }), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleCopyServiceType = async () => {
    if (!selectedServiceType) return;
    try {
      await navigator.clipboard.writeText(selectedServiceType);
      setCopySuccess({ ...copySuccess, serviceType: true });
      setTimeout(() => setCopySuccess({ ...copySuccess, serviceType: false }), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <section className={sectionClasses}>
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              💡 DAS Paid Services
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 max-w-3xl">
              Track paid layouts by capturing lighting page counts, cost-per-page, status, and a ready-to-send email template.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-primary-600"
              disabled={readOnly}
              checked={dasPaidServiceEnabled}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            Enable Paid Service
          </label>
        </div>
        {dasPaidServiceForced && !isRevision && (
          <p className="text-xs text-primary-600 dark:text-primary-300">
            Section forced on manually.
          </p>
        )}
      </div>

      {!dasPaidServiceEnabled && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enable this section to capture DAS Paid Service details.
        </p>
      )}

      {dasPaidServiceEnabled && (
        <div className="space-y-5">
          {/* Agile Website Clipboard Copy Section */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">📋 Copy to Agile Website</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0 min-w-[120px]">
                  Version Label:
                </label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    readOnly
                    value="Design Services"
                    className="input flex-1 bg-white dark:bg-gray-800"
                  />
                  <button
                    type="button"
                    onClick={handleCopyBOM}
                    className="btn btn-outline btn-sm whitespace-nowrap"
                    disabled={readOnly}
                    title="Copy 'Design Services' to clipboard"
                  >
                    {copySuccess.bom ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0 min-w-[120px]">
                  Service Type:
                </label>
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={selectedServiceType}
                    onChange={(e) => setSelectedServiceType(e.target.value)}
                    disabled={readOnly}
                    className="input flex-1"
                  >
                    <option value="">Select Service Type</option>
                    {SERVICE_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleCopyServiceType}
                    disabled={readOnly || !selectedServiceType}
                    className="btn btn-outline btn-sm whitespace-nowrap"
                    title="Copy selected service type to clipboard"
                  >
                    {copySuccess.serviceType ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">RFA Type Cost per Page</p>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              {COST_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="radio"
                    className="form-radio h-4 w-4 text-primary-600"
                    disabled={readOnly}
                    name="dasCostOption"
                    value={option.value}
                    checked={resolvedCostOption === option.value}
                    onChange={() => handleCostOptionChange(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {!isFeeWaived ? (
              <div className="mt-3 grid grid-cols-3 md:grid-cols-1 gap-3 items-end">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Cost per page
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="dasCostPerPage"
                    disabled={readOnly}
                    value={dasCostPerPage}
                    onChange={handleCostPerPageChange}
                    className={`input ${fieldError(errors, 'dasCostPerPage') ? 'error' : ''}`}
                  />
                  {fieldError(errors, 'dasCostPerPage') && (
                    <span className="text-xs text-error-600 mt-1">{fieldError(errors, 'dasCostPerPage')}</span>
                  )}
                  {dasCostPerPageManual && (
                    <button
                      type="button"
                      className="text-xs text-primary-600 hover:underline mt-1 self-start"
                      disabled={readOnly}
                      onClick={() =>
                        handleUpdate({
                          dasCostPerPageManual: false,
                          dasCostOption: isRevision ? 'revision' : 'new',
                          dasCostPerPage: getRateForOption(isRevision ? 'revision' : 'new')
                        })
                      }
                    >
                      Reset to recommended
                    </button>
                  )}
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Lighting pages
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="dasLightingPages"
                    disabled={readOnly}
                    value={dasLightingPages}
                    onChange={handleLightingPagesChange}
                    className={`input ${fieldError(errors, 'dasLightingPages') ? 'error' : ''}`}
                  />
                  {fieldError(errors, 'dasLightingPages') && (
                    <span className="text-xs text-error-600 mt-1">{fieldError(errors, 'dasLightingPages')}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Fee value
                    </label>
                    <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        className="form-checkbox h-3.5 w-3.5 text-primary-600"
                        disabled={readOnly}
                        checked={dasFeeManual}
                        onChange={(e) =>
                          handleUpdate({
                            dasFeeManual: e.target.checked
                          })
                        }
                      />
                      Manual
                    </label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="dasFee"
                    disabled={readOnly || !dasFeeManual}
                    value={dasFee}
                    onChange={handleFeeChange}
                    className={`input ${fieldError(errors, 'dasFee') ? 'error' : ''} ${
                      !dasFeeManual ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''
                    }`}
                  />
                  {fieldError(errors, 'dasFee') && (
                    <span className="text-xs text-error-600 mt-1">{fieldError(errors, 'dasFee')}</span>
                  )}
                  {!dasFeeManual && (
                    <p className="text-xs text-gray-500 mt-1">
                      Auto: {formatCurrency(dasCostPerPage)} × {dasLightingPages || 0} = {formatCurrency(dasFee)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Fee Waiver Reason</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select the applicable reason(s) for waiving this service fee.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                  {WAIVER_REASON_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-primary-600"
                        disabled={readOnly}
                        checked={(Array.isArray(dasWaiverReasons) ? dasWaiverReasons : []).includes(option.value)}
                        onChange={(e) => handleWaiverReasonToggle(option.value, e.target.checked)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {fieldError(errors, 'dasWaiverReasons') && (
                  <span className="text-xs text-error-600">{fieldError(errors, 'dasWaiverReasons')}</span>
                )}
                {(Array.isArray(dasWaiverReasons) ? dasWaiverReasons : []).includes('other') && (
                  <div className="flex flex-col">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Other reason
                    </label>
                    <input
                      type="text"
                      name="dasWaiverOtherNote"
                      disabled={readOnly}
                      value={dasWaiverOtherNote}
                      onChange={(e) => handleUpdate({ dasWaiverOtherNote: e.target.value })}
                      maxLength={120}
                      className={`input ${fieldError(errors, 'dasWaiverOtherNote') ? 'error' : ''}`}
                      placeholder="Add the specific reason"
                    />
                    {fieldError(errors, 'dasWaiverOtherNote') && (
                      <span className="text-xs text-error-600 mt-1">{fieldError(errors, 'dasWaiverOtherNote')}</span>
                    )}
                  </div>
                )}
                <div className="flex flex-col">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Short description (optional)
                  </label>
                  <input
                    type="text"
                    name="dasWaiverDescription"
                    disabled={readOnly}
                    value={dasWaiverDescription}
                    onChange={(e) => handleUpdate({ dasWaiverDescription: e.target.value })}
                    maxLength={200}
                    className="input"
                    placeholder="Add context for internal tracking"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Paid service status
              </label>
              <select
                className="input"
                name="dasStatus"
                disabled={readOnly}
                value={dasStatus}
                onChange={(e) => handleUpdate({ dasStatus: e.target.value })}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            {!isFeeWaived && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Rep contact email
                </label>
                {typeof onRepEmailListChange === 'function' ? (
                  <RepEmailSelector
                    selected={resolvedRepEmailList}
                    onChange={onRepEmailListChange}
                    options={repEmailOptions}
                    onSearch={onRepEmailSearch}
                    status={repEmailStatus}
                    readOnly={readOnly}
                  />
                ) : (
                  <>
                    <input
                      type="email"
                      name="dasRepEmail"
                      disabled={readOnly}
                      value={dasRepEmail}
                      onChange={(e) => handleUpdate({ dasRepEmail: e.target.value })}
                      className={`input ${fieldError(errors, 'dasRepEmail') ? 'error' : ''}`}
                    />
                    {repEmailStatus?.state === 'searching' && (
                      <span className="text-xs text-warning-600 mt-1">{repEmailStatus.message}</span>
                    )}
                    {repEmailStatus?.state === 'notFound' && (
                      <span className="text-xs text-warning-600 mt-1">{repEmailStatus.message}</span>
                    )}
                    {repEmailStatus?.state === 'error' && (
                      <span className="text-xs text-error-600 mt-1">{repEmailStatus.message}</span>
                    )}
                  </>
                )}
                {fieldError(errors, 'dasRepEmail') && (
                  <span className="text-xs text-error-600 mt-1">{fieldError(errors, 'dasRepEmail')}</span>
                )}
              </div>
            )}
            <div className="flex flex-col justify-end gap-2">
              {showEmailButton && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={readOnly || emailButtonDisabled || !canSendEmail}
                    onClick={onRequestEmail}
                  >
                    {emailButtonLabel}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowEmailEditor(true)}
                    title="Edit email template and signature"
                  >
                    ✏️ Edit Template
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Template Editor Modal */}
      <EmailTemplateEditor
        isOpen={showEmailEditor}
        onClose={() => setShowEmailEditor(false)}
        project={formData}
      />
    </section>
  );
};

export default DASPaidServicesSection;

