/**
 * Report Helper Utilities
 * Provides formatting, calculation, and date utilities for analytics reports
 */

/**
 * Format currency value
 * @param {number} value - The value to format
 * @param {boolean} showCents - Whether to show cents
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, showCents = false) => {
  if (value === null || value === undefined || isNaN(value)) return '$0';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  return formatter.format(value);
};

/**
 * Format number with commas
 * @param {number} value - The value to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

/**
 * Format percentage
 * @param {number} value - The value (0-100)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format duration in days
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export const formatDurationDays = (milliseconds) => {
  if (!milliseconds || isNaN(milliseconds)) return '0 days';
  const days = milliseconds / (1000 * 60 * 60 * 24);
  if (days < 1) {
    const hours = milliseconds / (1000 * 60 * 60);
    return `${hours.toFixed(1)} hrs`;
  }
  return `${days.toFixed(1)} days`;
};

/**
 * Format hours
 * @param {number} hours - Number of hours
 * @returns {string} Formatted hours string
 */
export const formatHours = (hours) => {
  if (hours === null || hours === undefined || isNaN(hours)) return '0 hrs';
  return `${hours.toFixed(1)} hrs`;
};

/**
 * Calculate percentage change between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {object} Object with value, formatted string, and direction
 */
export const calculatePercentageChange = (current, previous) => {
  if (!previous || previous === 0) {
    if (current > 0) {
      return { value: 100, formatted: '+100%', direction: 'up' };
    }
    return { value: 0, formatted: '0%', direction: 'neutral' };
  }
  
  const change = ((current - previous) / previous) * 100;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
  const formatted = `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  
  return { value: change, formatted, direction };
};

/**
 * Get start and end dates for a given month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {object} Object with startDate and endDate
 */
export const getMonthDateRange = (year, month) => {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { startDate, endDate };
};

/**
 * Get previous month from a given date
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {object} Object with year and month of previous month
 */
export const getPreviousMonth = (year, month) => {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
};

/**
 * Format month/year for display
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {string} Formatted month string (e.g., "January 2024")
 */
export const formatMonthYear = (year, month) => {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

/**
 * Get list of months for dropdown (last 12 months)
 * @returns {Array} Array of month options with value and label
 */
export const getMonthOptions = () => {
  const options = [];
  const today = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    options.push({
      value: `${date.getFullYear()}-${date.getMonth()}`,
      label: formatMonthYear(date.getFullYear(), date.getMonth()),
      year: date.getFullYear(),
      month: date.getMonth(),
    });
  }
  
  return options;
};

/**
 * Check if a date falls within a month range
 * @param {string|Date} dateStr - The date to check
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @returns {boolean} Whether the date is within range
 */
export const isDateInRange = (dateStr, startDate, endDate) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date >= startDate && date <= endDate;
};

/**
 * Get week number within a month
 * @param {Date} date - The date
 * @returns {number} Week number (1-5)
 */
export const getWeekOfMonth = (date) => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
};

/**
 * Group items by a key and count
 * @param {Array} items - Array of items
 * @param {string} key - Key to group by
 * @returns {Array} Array of { name, value } objects sorted by value descending
 */
export const groupAndCount = (items, key) => {
  const counts = {};
  
  items.forEach(item => {
    const value = item[key] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Group items by a key and sum a value
 * @param {Array} items - Array of items
 * @param {string} groupKey - Key to group by
 * @param {string} sumKey - Key to sum
 * @returns {Array} Array of { name, value } objects sorted by value descending
 */
export const groupAndSum = (items, groupKey, sumKey) => {
  const sums = {};
  
  items.forEach(item => {
    const group = item[groupKey] || 'Unknown';
    const value = parseFloat(item[sumKey]) || 0;
    sums[group] = (sums[group] || 0) + value;
  });
  
  return Object.entries(sums)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

/**
 * Chart color palette for consistent styling
 */
export const CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#84CC16', // Lime
];

/**
 * Get chart color by index
 * @param {number} index - The index
 * @returns {string} Color hex code
 */
export const getChartColor = (index) => {
  return CHART_COLORS[index % CHART_COLORS.length];
};

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 20) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDurationDays,
  formatHours,
  calculatePercentageChange,
  getMonthDateRange,
  getPreviousMonth,
  formatMonthYear,
  getMonthOptions,
  isDateInRange,
  getWeekOfMonth,
  groupAndCount,
  groupAndSum,
  CHART_COLORS,
  getChartColor,
  truncateText,
};
