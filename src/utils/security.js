/**
 * Security utilities for input validation and sanitization
 */

// Path validation and sanitization
export const validatePath = (inputPath) => {
  if (typeof inputPath !== 'string') {
    throw new Error('Path must be a string');
  }
  
  // Check for path traversal attempts
  if (inputPath.includes('..') || inputPath.includes('//')) {
    throw new Error('Invalid path detected');
  }
  
  // Remove null bytes and other dangerous characters
  const sanitized = inputPath
    .replace(/\0/g, '')
    .replace(/[<>:"|?*]/g, '')
    .trim();
    
  return sanitized;
};

// Project name validation and sanitization
export const validateProjectName = (projectName) => {
  if (typeof projectName !== 'string') {
    throw new Error('Project name must be a string');
  }
  
  if (!projectName.trim()) {
    throw new Error('Project name cannot be empty');
  }
  
  if (projectName.length > 255) {
    throw new Error('Project name too long');
  }
  
  // Remove dangerous characters
  const sanitized = projectName
    .replace(/[<>:"|?*\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  return sanitized;
};

// RFA number validation
export const validateRFANumber = (rfaNumber) => {
  if (typeof rfaNumber !== 'string') {
    throw new Error('RFA number must be a string');
  }
  
  if (!rfaNumber.trim()) {
    throw new Error('RFA number cannot be empty');
  }
  
  // Allow alphanumeric and common separators
  if (!/^[A-Za-z0-9\-_\.\s]+$/.test(rfaNumber)) {
    throw new Error('RFA number contains invalid characters');
  }
  
  return rfaNumber.trim();
};

// Email validation
export const validateEmail = (email) => {
  if (typeof email !== 'string') {
    throw new Error('Email must be a string');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  return email.toLowerCase().trim();
};

// Numeric input validation
export const validateNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const num = Number(value);
  
  if (isNaN(num)) {
    throw new Error('Value must be a number');
  }
  
  if (num < min || num > max) {
    throw new Error(`Value must be between ${min} and ${max}`);
  }
  
  return num;
};

// File extension validation
export const validateFileExtension = (filename, allowedExtensions = []) => {
  if (typeof filename !== 'string') {
    throw new Error('Filename must be a string');
  }
  
  const extension = filename.toLowerCase().split('.').pop();
  
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    throw new Error(`File type .${extension} not allowed`);
  }
  
  return true;
};

// SQL injection prevention for search queries
export const sanitizeSearchQuery = (query) => {
  if (typeof query !== 'string') {
    return '';
  }
  
  // Remove SQL injection patterns
  const dangerous = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(\b(and|or)\s+\d+\s*=\s*\d+)/gi,
    /(\b(and|or)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/gi,
    /(--|\/\*|\*\/|;)/g
  ];
  
  let sanitized = query;
  dangerous.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized.trim();
};

// XSS prevention for HTML content
export const sanitizeHTML = (html) => {
  if (typeof html !== 'string') {
    return '';
  }
  
  // Remove script tags and dangerous attributes
  const sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '');
    
  return sanitized;
};

// Rate limiting helper
export class RateLimiter {
  constructor(maxRequests = 100, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = new Map();
  }
  
  isAllowed(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the time window
    const validRequests = userRequests.filter(time => now - time < this.timeWindow);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
  
  reset(identifier) {
    this.requests.delete(identifier);
  }
}

// Export all validation functions
export default {
  validatePath,
  validateProjectName,
  validateRFANumber,
  validateEmail,
  validateNumber,
  validateFileExtension,
  sanitizeSearchQuery,
  sanitizeHTML,
  RateLimiter
};
