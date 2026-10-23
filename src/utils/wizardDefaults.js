export const DEFAULT_NEW_PROJECT_RFA_STATUS = 'In Progress';

export const getTodayDateInput = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

export const toDateInput = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const getNewProjectDefaults = () => ({
  rfaStatus: DEFAULT_NEW_PROJECT_RFA_STATUS,
  triageHoursDate: getTodayDateInput(),
  designHoursDate: ''
});

/**
 * Copy Requested Date into Needed by Date and the QC credit date while those
 * fields are empty or still follow the previous Requested Date. Values the user
 * changed by hand are kept.
 */
export const applyRequestedDateDefaults = (nextData, previousRequestedDate = '') => {
  const requestedDate = nextData.requestedDate || '';
  if (!requestedDate) return nextData;

  const result = { ...nextData };
  const previousQcDate = toDateInput(previousRequestedDate);

  if (!result.neededByDate || result.neededByDate === previousRequestedDate) {
    result.neededByDate = requestedDate;
  }
  if (!result.qcHoursDate || result.qcHoursDate === previousQcDate) {
    result.qcHoursDate = toDateInput(requestedDate);
  }
  return result;
};
