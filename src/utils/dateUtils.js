/**
 * Date Utilities - Timezone-aware date handling
 * Handles dates without unwanted timezone conversions
 */

/**
 * Get the user's current timezone information
 * @returns {Object} Timezone info with abbreviation and offset
 */
export const getUserTimezone = () => {
  const date = new Date();
  const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Get timezone abbreviation (e.g., EST, PST, CST)
  const shortFormat = new Intl.DateTimeFormat('en-US', {
    timeZoneName: 'short',
    timeZone: timeZoneName
  }).format(date);
  
  const abbreviation = shortFormat.split(', ')[1] || 'Local';
  
  // Get offset in minutes and convert to +/- hours format
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const offset = `GMT${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
  
  return {
    name: timeZoneName,
    abbreviation: abbreviation,
    offset: offset,
    offsetMinutes: offsetMinutes
  };
};

/**
 * Parse a date string from Agile WITHOUT timezone conversion
 * Treats the input as local time and returns datetime-local format
 * @param {string} dateString - Date string like "09/04/2025 6:00 PM"
 * @returns {string|null} - Date in datetime-local format (YYYY-MM-DDTHH:MM)
 */
export const parseAgileDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Parse the date components manually to avoid timezone issues
    // Expected format: "MM/DD/YYYY HH:MM AM/PM"
    const match = dateString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
    
    if (!match) {
      console.warn('Date format not recognized:', dateString);
      return null;
    }
    
    const [, month, day, year, hour, minute, period] = match;
    
    // Convert to 24-hour format
    let hour24 = parseInt(hour, 10);
    if (period.toUpperCase() === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    // Build datetime-local string (YYYY-MM-DDTHH:MM)
    // NO timezone conversion - use the time as-is
    const localDateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour24).padStart(2, '0')}:${minute}`;
    
    return localDateString;
  } catch (error) {
    console.error('Error parsing Agile date:', dateString, error);
    return null;
  }
};

/**
 * Format a datetime-local value for display with timezone
 * @param {string} datetimeLocal - Date in datetime-local format (YYYY-MM-DDTHH:MM)
 * @param {boolean} includeTimezone - Whether to include timezone abbreviation
 * @returns {string} - Formatted date string
 */
export const formatDateTimeLocal = (datetimeLocal, includeTimezone = true) => {
  if (!datetimeLocal) return 'N/A';
  
  try {
    // Parse the datetime-local format (YYYY-MM-DDTHH:MM)
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');
    
    // Create date object in LOCAL time (not UTC)
    const date = new Date(year, month - 1, day, hour, minute);
    
    // Format date
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
    
    if (includeTimezone) {
      const tz = getUserTimezone();
      return `${formatted} (${tz.abbreviation})`;
    }
    
    return formatted;
  } catch (error) {
    console.error('Error formatting datetime-local:', datetimeLocal, error);
    return datetimeLocal;
  }
};

/**
 * Get current date and time in datetime-local format
 * @returns {string} - Current date/time in YYYY-MM-DDTHH:MM format
 */
export const getCurrentDateTimeLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

/**
 * Convert ISO date string to datetime-local format WITHOUT timezone conversion
 * @param {string} isoString - ISO date string
 * @returns {string} - Date in datetime-local format
 */
export const isoToDateTimeLocal = (isoString) => {
  if (!isoString) return '';
  
  try {
    // Simply slice off the seconds and timezone info
    // This keeps the date/time as-is without conversion
    return isoString.slice(0, 16);
  } catch (error) {
    console.error('Error converting ISO to datetime-local:', isoString, error);
    return '';
  }
};

