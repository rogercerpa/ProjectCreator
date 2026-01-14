/**
 * File Utilities - Centralized file/folder name sanitization
 * 
 * This module provides utilities for sanitizing strings to be used
 * in file and folder names across all platforms.
 */

/**
 * Characters that are invalid in Windows file/folder names
 * Windows doesn't allow: \ / : * ? " < > |
 * We also remove parentheses as they cause issues with:
 * - Command line operations
 * - Certain backup tools
 * - Network paths
 * - Legacy systems
 */
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|()]/g;

/**
 * Sanitize a string for use in file/folder names
 * Removes: \ / : * ? " < > | ( )
 * 
 * @param {string} str - The string to sanitize
 * @param {Object} options - Sanitization options
 * @param {string} options.replaceWith - Character to replace invalid chars with (default: '')
 * @param {boolean} options.preserveSpaces - Whether to keep spaces (default: true)
 * @param {boolean} options.toUpperCase - Whether to convert to uppercase (default: false)
 * @param {boolean} options.collapseSpaces - Whether to collapse multiple spaces (default: true)
 * @param {number} options.maxLength - Maximum length of the result (default: 255)
 * @returns {string} Sanitized string safe for file/folder names
 */
function sanitizeForFilename(str, options = {}) {
  if (!str || typeof str !== 'string') return '';
  
  const {
    replaceWith = '',
    preserveSpaces = true,
    toUpperCase = false,
    collapseSpaces = true,
    maxLength = 255
  } = options;
  
  let result = str
    .replace(INVALID_FILENAME_CHARS, replaceWith)  // Remove invalid chars including parentheses
    .replace(/\s+/g, preserveSpaces ? (collapseSpaces ? ' ' : '$&') : '_')
    .trim();
  
  // Remove leading/trailing underscores if we replaced spaces with underscores
  if (!preserveSpaces) {
    result = result.replace(/^_+|_+$/g, '');
  }
  
  // Apply case transformation
  if (toUpperCase) {
    result = result.toUpperCase();
  }
  
  // Limit length
  if (result.length > maxLength) {
    result = result.substring(0, maxLength).trim();
  }
  
  return result;
}

/**
 * Sanitize a project name for use in folder naming
 * This is a convenience function that matches the expected behavior
 * of the project wizard: uppercase, spaces preserved, invalid chars removed
 * 
 * @param {string} projectName - The project name to sanitize
 * @returns {string} Sanitized project name
 */
function sanitizeProjectName(projectName) {
  if (!projectName || typeof projectName !== 'string') return '';
  
  return projectName
    .replace(INVALID_FILENAME_CHARS, ' ')  // Replace invalid chars with space
    .replace(/_/g, ' ')                     // Replace underscores with space (legacy behavior)
    .replace(/\s+/g, ' ')                   // Collapse multiple spaces
    .toUpperCase()
    .trim();
}

/**
 * Sanitize an RFA type for use in folder/file naming
 * RFA types often contain parentheses like "BOM (No Layout)" which need to be removed
 * 
 * @param {string} rfaType - The RFA type to sanitize
 * @returns {string} Sanitized RFA type
 */
function sanitizeRfaType(rfaType) {
  if (!rfaType || typeof rfaType !== 'string') return '';
  
  return rfaType
    .replace(INVALID_FILENAME_CHARS, '')   // Remove invalid chars
    .replace(/\s+/g, ' ')                  // Collapse multiple spaces
    .trim();
}

/**
 * Build a safe folder name from project data
 * Format: {sanitizedProjectName}_{projectContainer}
 * 
 * @param {string} projectName - Project name
 * @param {string} projectContainer - Project container/number
 * @returns {string} Safe folder name
 */
function buildProjectFolderName(projectName, projectContainer) {
  const sanitizedName = sanitizeProjectName(projectName);
  const sanitizedContainer = sanitizeForFilename(projectContainer);
  return `${sanitizedName}_${sanitizedContainer}`;
}

/**
 * Build a safe RFA folder name
 * Format: RFA#{rfaNumber}_{rfaType}_{dateString}
 * 
 * @param {string} rfaNumber - RFA number
 * @param {string} rfaType - RFA type
 * @param {string} dateString - Date string in MMDDYYYY format
 * @param {Object} options - Additional options
 * @param {boolean} options.isRelocControls - Whether this is a Reloc Controls project
 * @returns {string} Safe RFA folder name
 */
function buildRfaFolderName(rfaNumber, rfaType, dateString, options = {}) {
  const sanitizedRfaNumber = sanitizeForFilename(rfaNumber);
  const sanitizedRfaType = sanitizeRfaType(rfaType);
  const sanitizedDate = sanitizeForFilename(dateString);
  
  // For Reloc Controls projects, prefix with "Reloc Portion"
  if (options.isRelocControls) {
    return `RFA#${sanitizedRfaNumber}_Reloc Portion ${sanitizedRfaType}_${sanitizedDate}`;
  }
  
  return `RFA#${sanitizedRfaNumber}_${sanitizedRfaType}_${sanitizedDate}`;
}

/**
 * Build a safe VSP filename
 * Format: ABC_{projectName}_{rfaType} ORIG_{dateString}.vsp
 * 
 * @param {string} projectName - Project name (will be sanitized)
 * @param {string} rfaType - RFA type (will be sanitized)
 * @param {string} dateString - Date string
 * @param {Object} options - Additional options
 * @param {boolean} options.isMetric - Whether this is a metric file
 * @returns {string} Safe VSP filename
 */
function buildVspFilename(projectName, rfaType, dateString, options = {}) {
  const sanitizedProjectName = sanitizeProjectName(projectName);
  const sanitizedRfaType = sanitizeRfaType(rfaType);
  const sanitizedDate = sanitizeForFilename(dateString);
  
  let filename = `ABC_${sanitizedProjectName}_${sanitizedRfaType} ORIG_${sanitizedDate}`;
  
  if (options.isMetric) {
    filename += ' Metric';
  }
  
  return `${filename}.vsp`;
}

// Export for ES modules (frontend)
export {
  sanitizeForFilename,
  sanitizeProjectName,
  sanitizeRfaType,
  buildProjectFolderName,
  buildRfaFolderName,
  buildVspFilename,
  INVALID_FILENAME_CHARS
};

// Also export as default for convenience
export default {
  sanitizeForFilename,
  sanitizeProjectName,
  sanitizeRfaType,
  buildProjectFolderName,
  buildRfaFolderName,
  buildVspFilename,
  INVALID_FILENAME_CHARS
};
