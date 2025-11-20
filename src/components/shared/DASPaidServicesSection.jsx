import React, { useEffect, useMemo } from 'react';

const BASE_NEW_RATE = 350;
const BASE_REVISION_RATE = 265;

const STATUS_OPTIONS = ['Waiting on Order', 'Paid', 'Cancelled'];
const COST_OPTIONS = [
  { value: 'new', label: 'New ($350)' },
  { value: 'revision', label: 'Revision ($265)' },
  { value: 'discount50', label: 'Discount Option 1 (50% off New)' },
  { value: 'discount75', label: 'Discount Option 2 (75% off New)' },
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
  highlight = false
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
    dasRepEmail = ''
  } = formData;

  const sectionClasses = [
    'rounded-lg border-2 p-5 shadow-sm space-y-4',
    'bg-white dark:bg-gray-800',
    highlight ? 'border-primary-400 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const resolvedCostOption = dasCostOption || (isRevision ? 'revision' : 'new');

  // Automatically align cost per page when not manually overridden
  useEffect(() => {
    if (!dasPaidServiceEnabled || readOnly || !onChange) {
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
    readOnly,
    onChange,
    formData
  ]);

  // Auto-calculate fee unless overridden
  useEffect(() => {
    if (!dasPaidServiceEnabled || readOnly || dasFeeManual || !onChange) {
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
    if (value === 'other') {
      handleUpdate({
        dasCostOption: value,
        dasCostPerPageManual: true
      });
      return;
    }

    handleUpdate({
      dasCostOption: value,
      dasCostPerPage: getRateForOption(value),
      dasCostPerPageManual: false
    });
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
    if (!dasRepEmail) return false;
    if (!dasLightingPages || !dasCostPerPage) return false;
    if (!dasFee) return false;
    return true;
  }, [dasPaidServiceEnabled, dasRepEmail, dasLightingPages, dasCostPerPage, dasFee]);

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
            <div className="flex flex-col">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Rep contact email
              </label>
              <input
                type="email"
                name="dasRepEmail"
                disabled={readOnly}
                value={dasRepEmail}
                onChange={(e) => handleUpdate({ dasRepEmail: e.target.value })}
                className={`input ${fieldError(errors, 'dasRepEmail') ? 'error' : ''}`}
              />
              {fieldError(errors, 'dasRepEmail') && (
                <span className="text-xs text-error-600 mt-1">{fieldError(errors, 'dasRepEmail')}</span>
              )}
            </div>
            <div className="flex flex-col justify-end">
              {showEmailButton && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={readOnly || emailButtonDisabled || !canSendEmail}
                  onClick={onRequestEmail}
                >
                  {emailButtonLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DASPaidServicesSection;

